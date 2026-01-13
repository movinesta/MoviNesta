# Session 6 Continuation Prompt (MoviNesta)

You are taking over from Session 6 work. The repo is based on `MoviNesta-main_session5_updated.zip` and has **partial Session 6 changes** applied.

## Goal
Finish Session 6 so it is production-ready, build-safe, and deploy-safe.

## What was added in Session 6 (already in repo)
### Database patches
- `supabase/schema/patch_20260113_ops_alerts.sql`
  - Adds `public.ops_alerts` table + service-role-only RPCs:
    - `ops_alert_raise_v1`
    - `ops_alert_list_active_v1`
    - `ops_alert_resolve_v1`
    - `ops_alert_resolve_by_dedupe_key_v1`
    - `ops_alert_resolve_all_v1`
- `supabase/schema/patch_20260113_openrouter_health_check_cron.sql`
  - Schedules `/functions/v1/openrouter-health-check` every 15 minutes using `pg_cron + pg_net + vault.decrypted_secrets`.
- `supabase/schema/patch_20260113_openrouter_circuit_admin_controls.sql`
  - Secret names updated to `project_url` + `anon_key` + `internal_job_token`.

### Edge Functions (new)
- `supabase/functions/openrouter-health-check/index.ts` (job-token protected)
- `supabase/functions/admin-ops-alerts/index.ts` (admin JWT protected)

### Admin Overview backend
- `supabase/functions/admin-overview/index.ts` now includes `ops_alerts` from `ops_alert_list_active_v1`.

### Admin Dashboard
- `admin-dashboard/src/lib/api.ts` extended with OpsAlert types + API calls:
  - `listOpsAlerts`, `resolveOpsAlert`, `resolveAllOpsAlerts`
- `admin-dashboard/src/pages/Overview.tsx` renders an “Ops Alerts” table with resolve actions.

### Supabase config
- `supabase/config.toml` appended:
  - `[functions.openrouter-health-check] verify_jwt=false`
  - `[functions.admin-ops-alerts] verify_jwt=true`

## What must be verified / finished
1) **TypeScript build sanity**
   - Run the admin dashboard build and fix any TS/JSX issues.
   - Check for missing imports or type mismatches in `Overview.tsx` and `api.ts`.

2) **Edge Function correctness**
   - `openrouter-health-check`:
     - Confirm it can read `openrouter_credits_cache`, `openrouter_key_cache`, `openrouter_circuit_breakers`.
     - Confirm RPC parameter names match the SQL patch (`p_kind`, `p_dedupe_key`, etc).
     - Confirm it logs to `job_run_log` via `safeInsertJobRunLog`.
   - `admin-ops-alerts`:
     - Confirm CORS works (handleCors).
     - Confirm requireAdmin returns `{ userId, email, svc }` as expected.

3) **DB migration compatibility**
   - Apply patches in your normal migration flow (or incorporate into your migrations folder).
   - Ensure extensions `pg_cron`, `pg_net`, and Vault are available; cron patch is best-effort but should not crash.

4) **Security review**
   - Ensure ops_alert RPCs are service-role only.
   - Admin dashboard accesses alerts via Edge Functions, not direct table access.

5) **Optional nice-to-have**
   - Add a button in Admin Dashboard to trigger `openrouter-health-check` manually (admin function that calls it internally with job token).

## How to test quickly
- Deploy Edge Functions: `openrouter-health-check`, `admin-ops-alerts`, `admin-overview`.
- Run `openrouter-refresh` to populate caches.
- Call `openrouter-health-check` with header `x-job-token`.
- Verify `ops_alerts` rows appear and then auto-resolve when conditions clear.
- Open Admin Dashboard → Overview → confirm “Ops Alerts” renders and resolve works.

## Deliverable
- Produce `MoviNesta-main_session6_updated.zip` after fixing any build issues and ensuring the project runs.
