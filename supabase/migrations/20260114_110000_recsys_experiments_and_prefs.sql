-- 20260114_110000_recsys_experiments_and_prefs.sql
--
-- Session 3: Experimentation + onboarding prefs (additive)
--
-- Goals:
-- 1) Provide an experimentation framework for recommendation changes.
-- 2) Persist lightweight user taste preferences (e.g., preferred genres) captured during onboarding.
--
-- Security model:
-- - Only service_role may create/modify experiments and write assignments.
-- - Authenticated users may READ active experiments and their own assignment rows.
-- - Authenticated users may read/write their own preference row.

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Experiments
-- -----------------------------------------------------------------------------

create table if not exists public.rec_experiments (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  description text,
  status text not null default 'draft' check (status in ('draft','active','paused','ended')),
  -- JSON array of {"name": "control", "weight": 0.5}
  variants jsonb not null default '[]'::jsonb,
  salt text not null default encode(gen_random_bytes(12), 'hex'),
  started_at timestamptz,
  ended_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_rec_experiments_status on public.rec_experiments(status);
create index if not exists idx_rec_experiments_updated_at on public.rec_experiments(updated_at desc);

-- Keep updated_at fresh
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_rec_experiments_set_updated_at on public.rec_experiments;
create trigger trg_rec_experiments_set_updated_at
before update on public.rec_experiments
for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- Assignments
-- -----------------------------------------------------------------------------

create table if not exists public.rec_user_experiment_assignments (
  experiment_id uuid not null references public.rec_experiments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  variant text not null,
  assigned_at timestamptz not null default now(),
  primary key (experiment_id, user_id)
);

create index if not exists idx_rec_assignments_user on public.rec_user_experiment_assignments(user_id, assigned_at desc);

-- -----------------------------------------------------------------------------
-- Recommender user preferences (onboarding capture)
-- -----------------------------------------------------------------------------

create table if not exists public.recsys_user_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferred_genres text[] not null default '{}'::text[],
  muted_genres text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_recsys_user_prefs_set_updated_at on public.recsys_user_prefs;
create trigger trg_recsys_user_prefs_set_updated_at
before update on public.recsys_user_prefs
for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table public.rec_experiments enable row level security;
alter table public.rec_user_experiment_assignments enable row level security;
alter table public.recsys_user_prefs enable row level security;

-- Experiments: read-only for authenticated when active; full access for service_role.
drop policy if exists rec_experiments_read_active on public.rec_experiments;
create policy rec_experiments_read_active
on public.rec_experiments
for select
to authenticated
using (status = 'active');

drop policy if exists "service_role full access rec_experiments" on public.rec_experiments;
create policy "service_role full access rec_experiments"
on public.rec_experiments
to service_role
using (true)
with check (true);

-- Assignments: read own; service_role full.
drop policy if exists rec_assignments_read_own on public.rec_user_experiment_assignments;
create policy rec_assignments_read_own
on public.rec_user_experiment_assignments
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "service_role full access rec_user_experiment_assignments" on public.rec_user_experiment_assignments;
create policy "service_role full access rec_user_experiment_assignments"
on public.rec_user_experiment_assignments
to service_role
using (true)
with check (true);

-- User prefs: owner read/write; service_role full.
drop policy if exists recsys_user_prefs_owner_rw on public.recsys_user_prefs;
create policy recsys_user_prefs_owner_rw
on public.recsys_user_prefs
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "service_role full access recsys_user_prefs" on public.recsys_user_prefs;
create policy "service_role full access recsys_user_prefs"
on public.recsys_user_prefs
to service_role
using (true)
with check (true);

-- Grants (kept consistent with project conventions)
grant all on table public.rec_experiments to anon, authenticated, service_role;
grant all on table public.rec_user_experiment_assignments to anon, authenticated, service_role;
grant all on table public.recsys_user_prefs to anon, authenticated, service_role;
