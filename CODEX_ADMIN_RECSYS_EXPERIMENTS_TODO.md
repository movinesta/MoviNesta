
## Goal

Make **experiments fully manageable from the Admin Dashboard**, end-to-end:

* Admin can **create/edit/activate/end** experiments
* Admin can **assign users** (manual overrides) + enable **automatic sticky** assignment
* Swipe deck generation tags **every impression** with:
  `rec_impressions.request_context.experiments = { [experiment_key]: variant }`
* Admin “Daily experiment metrics” works automatically (no backfills)
* Fix relevant Supabase linter issues (security + performance)

---

## 0) Guardrails (non-negotiables)

* [ ] Do not break existing flows: swipe, like/dislike, watchlist, rating, detail open.
* [ ] Don’t rename outcome types unless you also update views/metrics mapping.
* [ ] No client-side direct writes to experiments/assignments using anon key.
* [ ] Keep changes incremental; every step must build.
* [ ] Must pass:

  * [ ] `npm run build` (root app)
  * [ ] `pnpm -C admin-dashboard run build` (admin)

---

## 1) Verify current behavior (must understand before changing)

**Key fact from your view definition:**
`rec_variant_daily_metrics_v1` reads experiments ONLY from:

* `rec_impressions.request_context -> 'experiments'`
  and expands via `jsonb_each_text(...)`

So assignments table alone will NOT populate that view unless deck/impressions are tagged.

### TODO

* [ ] Locate deck generation entrypoint:

  * [ ] `supabase/functions/media-swipe-deck/*`
  * [ ] Identify DB RPC used (likely `public.media_swipe_deck_v3(...)` or similar).
* [ ] Locate impression insert path:

  * [ ] Where `rec_impressions` rows are inserted and where `request_context` is built.
* [ ] Confirm outcomes write path:

  * [ ] `rec_outcomes` includes `user_id`, `rec_request_id`, `media_item_id`, `outcome_type`
* [ ] Confirm admin reads experiment metrics from:

  * [ ] `public.rec_variant_daily_metrics_v1`

**Acceptance**

* [ ] You can point to the exact code/SQL line where `request_context.experiments` is formed (or confirm it is missing today).

---

## 2) DB schema: make experiments safe + queryable (migration)

Your `rec_experiments` columns are:

`id uuid, key text, description text, status text, variants jsonb, salt text, started_at timestamptz, ended_at timestamptz, created_by uuid, created_at timestamptz, updated_at timestamptz`

### 2.1 Constraints + indexes

* [ ] Create migration file:
  `supabase/migrations/YYYYMMDD_HHMMSS_recsys_experiments_admin.sql`
* [ ] Ensure unique key:

  * [ ] `alter table public.rec_experiments add constraint rec_experiments_key_uk unique (key);`
* [ ] Validate status:

  * [ ] Add CHECK constraint: `status in ('draft','active','ended')`
* [ ] Ensure timestamps default:

  * [ ] `created_at default now()`, `updated_at default now()` if not present
* [ ] Add indexes:

  * [ ] `create index if not exists idx_rec_experiments_status on public.rec_experiments(status);`
  * [ ] `create index if not exists idx_rec_experiments_updated_at on public.rec_experiments(updated_at desc);`
  * [ ] `create index if not exists idx_rec_experiments_started_at on public.rec_experiments(started_at desc);`

### 2.2 Assignments table improvements

Your assignments table:
`rec_user_experiment_assignments(experiment_id, user_id, variant, assigned_at, pk(experiment_id,user_id))`

* [ ] Add indexes:

  * [ ] `create index if not exists idx_rec_assignments_user_time on public.rec_user_experiment_assignments(user_id, assigned_at desc);`
  * [ ] `create index if not exists idx_rec_assignments_exp_time on public.rec_user_experiment_assignments(experiment_id, assigned_at desc);`
* [ ] Optional but recommended:

  * [ ] Add `assignment_mode text not null default 'auto'` (auto/manual)
  * [ ] Add `assigned_by uuid null` (admin user id)

**Acceptance**

* [ ] Migration runs with no error on Supabase.

---

## 3) Security & RLS (must be correct)

### 3.1 Experiments table

* [ ] Enable RLS on `public.rec_experiments` (if not enabled).
* [ ] Policies:

  * [ ] Admin-only write: insert/update/delete only via service role (edge function).
  * [ ] Read policy options:

    * Option A (recommended): authenticated users can read only active experiments (for debugging)
    * Option B: admin only (strict)

### 3.2 Assignments table

* [ ] Enable RLS on `public.rec_user_experiment_assignments`
* [ ] Policies:

  * [ ] Users can read only their own assignments (optional)
  * [ ] Users cannot write
  * [ ] Admin write via service role only

### 3.3 Fix Supabase linter issues you already reported

* [ ] **auth_rls_initplan**: replace `auth.uid()` etc inside RLS expressions with `(select auth.uid())` to avoid per-row evaluation:

  * `rec_impressions_*`
  * `rec_outcomes_*`
  * `rec_user_experiment_assignments_*`
  * `recsys_user_prefs_*`
  * `cf_recos_*`
* [ ] **Function search_path mutable**:

  * [ ] `alter function public.tg_set_updated_at() set search_path = public;`
* [ ] **security_definer_view** (errors):

  * [ ] Recreate these views WITHOUT `SECURITY DEFINER`:

    * `rec_genre_daily_metrics_v1`
    * `rec_health_daily_metrics_v1`
    * `rec_alerts_daily_metrics_v1`
    * `rec_position_daily_metrics_v1`
    * `rec_active_alerts_v1`
    * `rec_variant_daily_metrics_v1`
    * `rec_source_daily_metrics_v1`

**Acceptance**

* [ ] Database linter errors for these items are resolved or reduced.

---

## 4) Build the experiment assignment engine (DB functions)

**Purpose:** pick a stable variant per user per active experiment, and store it.

### 4.1 Active experiments function

* [ ] Create: `public.rec_active_experiments()`

  * returns rows: `(id, key, variants, salt)`
  * filters: `status='active' and (ended_at is null or ended_at > now())`

### 4.2 Deterministic assignment (sticky)

* [ ] Create: `public.rec_assign_variant(experiment_key text, user_id uuid) returns text`

  * Logic:

    1. Look up experiment by key + active
    2. If assignment exists in `rec_user_experiment_assignments`, return it
    3. Else compute hash from `(salt || user_id::text)` and map to variants by weights
    4. Insert assignment (mode='auto') and return variant

### 4.3 Admin override

* [ ] Create: `public.rec_set_user_variant(experiment_key text, user_id uuid, variant text, admin_id uuid)`

  * upsert assignment (mode='manual', assigned_by=admin_id)

**Acceptance**

* [ ] Calling `rec_assign_variant()` twice gives the same variant (sticky).
* [ ] Manual override forces variant.

---

## 5) Critical integration: tag impressions during deck generation

This is the missing link for the Admin chart to work.

### 5.1 Decide where tagging happens

* Preferred: **inside DB RPC** (atomic + consistent)
* Acceptable: edge function, but then ensure RPC insert receives experiments JSON.

### 5.2 Implement experiments map in request_context

When a deck request is generated, build:

```json
{
  "experiments": {
    "swipe_blend_test": "A",
    "diversity_cap_v1": "B"
  }
}
```

Then insert impressions with:

* `rec_request_id` (shared by all impressions in the deck)
* `request_context` includes `.experiments`

**Important:** Your view expands `jsonb_each_text(experiments)` so it must be a flat object string→string.

### 5.3 Ensure outcomes join still works

No change needed other than ensuring outcomes have matching:

* `user_id`
* `rec_request_id`
* `media_item_id`

**Acceptance**

* [ ] New impressions show non-empty experiments:

  ```sql
  select created_at, request_context->'experiments'
  from rec_impressions
  order by created_at desc limit 20;
  ```
* [ ] Daily view returns rows:

  ```sql
  select * from rec_variant_daily_metrics_v1
  where day >= current_date - 7
  order by day desc limit 50;
  ```

---

## 6) Admin Dashboard features (Experiments + Assignments UI)

### 6.1 Add navigation & pages

* [ ] Add new sections under Admin → Recsys:

  * [ ] Experiments
  * [ ] Assignments
  * [ ] Experiment details/edit

### 6.2 Experiments list page

* [ ] Table: key, status, started_at, ended_at, last_updated, split summary
* [ ] Buttons:

  * [ ] Create
  * [ ] Edit
  * [ ] Activate
  * [ ] End
  * [ ] Duplicate

### 6.3 Experiment editor page

* [ ] Fields:

  * key (immutable or warn strongly)
  * description
  * status dropdown (draft/active/ended)
  * started_at / ended_at
  * variants JSON editor with validation (weights sum ~1)
  * rotate salt button (danger: breaks stickiness; show warning)

### 6.4 Assignments page

* [ ] Search user by:

  * uuid
  * email/username (if available)
* [ ] Show active experiments and current variant
* [ ] Actions:

  * [ ] force variant (manual override)
  * [ ] reset to auto (delete assignment row)

### 6.5 Metrics widgets (very useful)

* [ ] Show counts by variant:

  * `count(*) group by experiment_id, variant`
* [ ] Chart: today/last 7 days from `rec_variant_daily_metrics_v1`

**Acceptance**

* [ ] Admin can create an experiment, activate it, and force a user variant from UI.

---

## 7) Admin APIs (Edge Functions) — service role only

Admin UI must use secure endpoints.

Create functions (or add routes in an existing admin function):

* [ ] `admin-recsys-experiments-list`
* [ ] `admin-recsys-experiments-upsert`
* [ ] `admin-recsys-experiments-activate`
* [ ] `admin-recsys-experiments-end`
* [ ] `admin-recsys-assignments-get`
* [ ] `admin-recsys-assignments-set`
* [ ] `admin-recsys-assignments-reset`

Rules:

* [ ] Require admin auth (reuse your existing admin token/role pattern)
* [ ] Use service role Supabase client inside edge functions
* [ ] Validate inputs with Zod

**Acceptance**

* [ ] Calls succeed for admin, fail for non-admin.

---

## 8) Telemetry health checks (avoid silent “no data” again)

Add Admin diagnostics panel:

* [ ] % of impressions missing experiments:

  ```sql
  select
    count(*) as total,
    count(*) filter (where (request_context->'experiments') is null or (request_context->'experiments')='{}'::jsonb) as missing
  from rec_impressions
  where created_at >= now() - interval '7 days';
  ```
* [ ] Outcomes with no matching impression (by request_id+media_item_id)

**Acceptance**

* [ ] Admin can see immediately if experiment tagging is broken.

---

## 9) Test plan (must run before shipping)

### 9.1 SQL smoke test

* [ ] Create + activate experiment (via admin UI or API)
* [ ] Swipe in app
* [ ] Verify experiments tagged on newest impressions
* [ ] Verify `rec_variant_daily_metrics_v1` shows today rows

### 9.2 Build tests

* [ ] `npm run build`
* [ ] `pnpm -C admin-dashboard run build`

**Acceptance**

* [ ] Both builds pass with no errors.

---

## 10) Documentation

* [ ] Add: `docs/recsys-experiments.md`

  * What experiments are
  * How variants work
  * Sticky assignment
  * What admin controls do
  * How metrics are computed from impressions/outcomes

---

## 11) Delivery checklist

* [ ] SQL migrations committed
* [ ] DB functions committed
* [ ] Deck tagging implemented
* [ ] Admin pages + charts implemented
* [ ] Admin edge functions implemented
* [ ] Linter issues fixed (security definer view, auth initplan, search_path)
* [ ] Builds pass
* [ ] Provide updated ZIP (frontend + admin + supabase migrations/functions)

---

## Appendix: acceptance queries

```sql
-- Experiments tagging exists:
select created_at, request_context->'experiments'
from rec_impressions
order by created_at desc
limit 20;

-- Daily experiment metrics returns rows:
select *
from rec_variant_daily_metrics_v1
where day >= (now() - interval '30 days')::date
order by day desc
limit 50;

-- Sticky assignments exist:
select *
from rec_user_experiment_assignments
order by assigned_at desc
limit 20;

