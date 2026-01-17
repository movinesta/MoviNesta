-- DeepReview P31
-- Admin-only read access (via RLS) for selected internal diagnostics tables.
--
-- Goal:
-- - Keep service-role writes for logs/caches, but allow authenticated *admin* users
--   (as determined by public.is_app_admin()) to view operational state.
-- - Still deny all anon access and all non-admin authenticated access.

begin;

-- Helper macro pattern used below:
--   USING ((select public.is_app_admin() as is_app_admin))

/* =========================
 * external_api_cache
 * ======================= */

alter table public.external_api_cache enable row level security;

drop policy if exists external_api_cache_admin_select on public.external_api_cache;
create policy external_api_cache_admin_select
  on public.external_api_cache
  for select
  to authenticated
  using ((select public.is_app_admin() as is_app_admin));

revoke all on table public.external_api_cache from anon;
revoke all on table public.external_api_cache from authenticated;
grant select on table public.external_api_cache to authenticated;
grant all on table public.external_api_cache to service_role;

/* =========================
 * media_metadata_cache
 * ======================= */

alter table public.media_metadata_cache enable row level security;

drop policy if exists media_metadata_cache_admin_select on public.media_metadata_cache;
create policy media_metadata_cache_admin_select
  on public.media_metadata_cache
  for select
  to authenticated
  using ((select public.is_app_admin() as is_app_admin));

revoke all on table public.media_metadata_cache from anon;
revoke all on table public.media_metadata_cache from authenticated;
grant select on table public.media_metadata_cache to authenticated;
grant all on table public.media_metadata_cache to service_role;

/* =========================
 * rate_limits
 * ======================= */

alter table public.rate_limits enable row level security;

drop policy if exists rate_limits_admin_select on public.rate_limits;
create policy rate_limits_admin_select
  on public.rate_limits
  for select
  to authenticated
  using ((select public.is_app_admin() as is_app_admin));

revoke all on table public.rate_limits from anon;
revoke all on table public.rate_limits from authenticated;
grant select on table public.rate_limits to authenticated;
grant all on table public.rate_limits to service_role;

/* =========================
 * openrouter_request_log
 * ======================= */

alter table public.openrouter_request_log enable row level security;

drop policy if exists openrouter_request_log_admin_select on public.openrouter_request_log;
create policy openrouter_request_log_admin_select
  on public.openrouter_request_log
  for select
  to authenticated
  using ((select public.is_app_admin() as is_app_admin));

revoke all on table public.openrouter_request_log from anon;
revoke all on table public.openrouter_request_log from authenticated;
grant select on table public.openrouter_request_log to authenticated;
grant all on table public.openrouter_request_log to service_role;

/* =========================
 * openrouter_circuit_breakers
 * ======================= */

alter table public.openrouter_circuit_breakers enable row level security;

-- Replace the existing restrictive deny-all policy with explicit admin/service_role policies.
drop policy if exists openrouter_circuit_breakers_deny_all on public.openrouter_circuit_breakers;
drop policy if exists openrouter_circuit_breakers_admin_select on public.openrouter_circuit_breakers;
drop policy if exists openrouter_circuit_breakers_service_role_all on public.openrouter_circuit_breakers;

create policy openrouter_circuit_breakers_admin_select
  on public.openrouter_circuit_breakers
  for select
  to authenticated
  using ((select public.is_app_admin() as is_app_admin));

create policy openrouter_circuit_breakers_service_role_all
  on public.openrouter_circuit_breakers
  for all
  to service_role
  using (true)
  with check (true);

revoke all on table public.openrouter_circuit_breakers from anon;
revoke all on table public.openrouter_circuit_breakers from authenticated;
grant select on table public.openrouter_circuit_breakers to authenticated;
grant all on table public.openrouter_circuit_breakers to service_role;

/* =========================
 * job_run_log
 * ======================= */

alter table public.job_run_log enable row level security;

drop policy if exists job_run_log_deny_all on public.job_run_log;
drop policy if exists job_run_log_admin_select on public.job_run_log;
drop policy if exists job_run_log_service_role_all on public.job_run_log;

create policy job_run_log_admin_select
  on public.job_run_log
  for select
  to authenticated
  using ((select public.is_app_admin() as is_app_admin));

create policy job_run_log_service_role_all
  on public.job_run_log
  for all
  to service_role
  using (true)
  with check (true);

revoke all on table public.job_run_log from anon;
revoke all on table public.job_run_log from authenticated;
grant select on table public.job_run_log to authenticated;
grant all on table public.job_run_log to service_role;

/* =========================
 * ops_alerts
 * ======================= */

alter table public.ops_alerts enable row level security;

drop policy if exists ops_alerts_deny_all on public.ops_alerts;
drop policy if exists ops_alerts_admin_select on public.ops_alerts;
drop policy if exists ops_alerts_service_role_all on public.ops_alerts;

create policy ops_alerts_admin_select
  on public.ops_alerts
  for select
  to authenticated
  using ((select public.is_app_admin() as is_app_admin));

create policy ops_alerts_service_role_all
  on public.ops_alerts
  for all
  to service_role
  using (true)
  with check (true);

revoke all on table public.ops_alerts from anon;
revoke all on table public.ops_alerts from authenticated;
grant select on table public.ops_alerts to authenticated;
grant all on table public.ops_alerts to service_role;

/* =========================
 * assistant_reply_jobs
 * ======================= */

alter table public.assistant_reply_jobs enable row level security;

drop policy if exists assistant_reply_jobs_admin_select on public.assistant_reply_jobs;
create policy assistant_reply_jobs_admin_select
  on public.assistant_reply_jobs
  for select
  to authenticated
  using ((select public.is_app_admin() as is_app_admin));

revoke all on table public.assistant_reply_jobs from anon;
revoke all on table public.assistant_reply_jobs from authenticated;
grant select on table public.assistant_reply_jobs to authenticated;
grant all on table public.assistant_reply_jobs to service_role;

/* =========================
 * assistant_system_config
 * ======================= */

alter table public.assistant_system_config enable row level security;

drop policy if exists assistant_system_config_admin_select on public.assistant_system_config;
create policy assistant_system_config_admin_select
  on public.assistant_system_config
  for select
  to authenticated
  using ((select public.is_app_admin() as is_app_admin));

revoke all on table public.assistant_system_config from anon;
revoke all on table public.assistant_system_config from authenticated;
grant select on table public.assistant_system_config to authenticated;
grant all on table public.assistant_system_config to service_role;

commit;
