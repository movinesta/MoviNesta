-- Collaborative filtering recommendations (ALS baseline)
--
-- This table stores precomputed per-user recommendations produced by offline
-- training jobs (e.g., implicit ALS). The app can read its own rows; writes are
-- restricted to service role.

create table if not exists public.cf_recos (
  user_id uuid not null,
  media_item_id uuid not null,
  model_version text not null default 'als_v1',
  rank int not null,
  score real not null,
  created_at timestamptz not null default now(),

  primary key (user_id, media_item_id, model_version)
);

create index if not exists cf_recos_user_version_rank_idx
  on public.cf_recos (user_id, model_version, rank);

alter table public.cf_recos enable row level security;

-- Read: users can read only their own recommendations.
drop policy if exists "cf_recos_read_own" on public.cf_recos;
create policy "cf_recos_read_own"
  on public.cf_recos
  for select
  to authenticated
  using (user_id = auth.uid());

-- Writes are intentionally not granted to authenticated; service role bypasses RLS.
