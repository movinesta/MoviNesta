-- DeepReview P27
-- SECURITY: Lock down cron admin RPCs so they are ONLY callable by service_role.
--
-- These functions are SECURITY DEFINER and can schedule/unschedule/run cron commands.
-- They must never be callable by anon/authenticated.

begin;

-- Core cron admin RPCs
revoke all on function public.admin_list_cron_jobs() from public, anon, authenticated;
revoke all on function public.admin_run_cron_job(text) from public, anon, authenticated;
revoke all on function public.admin_set_cron_active(text, boolean) from public, anon, authenticated;
revoke all on function public.admin_set_cron_schedule(text, text) from public, anon, authenticated;

grant execute on function public.admin_list_cron_jobs() to service_role;
grant execute on function public.admin_run_cron_job(text) to service_role;
grant execute on function public.admin_set_cron_active(text, boolean) to service_role;
grant execute on function public.admin_set_cron_schedule(text, text) to service_role;

-- Run history RPCs (DeepReview P26)
revoke all on function public.admin_list_cron_job_runs(text, integer) from public, anon, authenticated;
revoke all on function public.admin_prune_cron_job_run_details(integer) from public, anon, authenticated;

grant execute on function public.admin_list_cron_job_runs(text, integer) to service_role;
grant execute on function public.admin_prune_cron_job_run_details(integer) to service_role;

commit;
