-- DeepReview P30
-- Defense-in-depth hardening for internal-only tables.
--
-- This patch:
-- 1) Enables RLS on internal tables that were service_role-only but lacked RLS.
-- 2) Removes anon/authenticated grants from internal-only cache tables so they are not exposed via the Data API.

begin;

-- 1) Enable RLS (defense-in-depth) and allow ONLY service_role

alter table public.assistant_reply_jobs enable row level security;
drop policy if exists assistant_reply_jobs_service_role_all on public.assistant_reply_jobs;
create policy assistant_reply_jobs_service_role_all
  on public.assistant_reply_jobs
  for all
  to service_role
  using (true)
  with check (true);

alter table public.assistant_system_config enable row level security;
drop policy if exists assistant_system_config_service_role_all on public.assistant_system_config;
create policy assistant_system_config_service_role_all
  on public.assistant_system_config
  for all
  to service_role
  using (true)
  with check (true);

-- 2) Remove Data API exposure for internal-only cache tables
-- These tables already had "Internal only" RLS policies (USING false), but revoking grants makes them invisible to PostgREST.

revoke all on table public.external_api_cache from anon, authenticated;
revoke all on table public.media_metadata_cache from anon, authenticated;
revoke all on table public.rate_limits from anon, authenticated;

-- Ensure service_role access remains
grant all on table public.external_api_cache to service_role;
grant all on table public.media_metadata_cache to service_role;
grant all on table public.rate_limits to service_role;

commit;
