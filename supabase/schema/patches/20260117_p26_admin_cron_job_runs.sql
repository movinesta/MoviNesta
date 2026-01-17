-- DeepReview P26
-- Admin RPC helpers to inspect pg_cron job run history (cron.job_run_details)
-- and to prune old history rows.
--
-- Background:
-- - Supabase Cron uses the pg_cron extension.
-- - Job definitions live in cron.job.
-- - Run history lives in cron.job_run_details.
--   Docs: https://supabase.com/docs/guides/cron

begin;

-- List recent runs for a specific cron job name.
create or replace function public.admin_list_cron_job_runs(
  p_jobname text,
  p_limit integer default 50
) returns table(
  jobid bigint,
  jobname text,
  runid bigint,
  status text,
  return_message text,
  start_time timestamptz,
  end_time timestamptz
)
language plpgsql
security definer
set search_path to 'public', 'cron'
as $$
declare
  v_limit integer;
begin
  if p_jobname is null or length(trim(p_jobname)) = 0 then
    raise exception 'jobname required';
  end if;

  v_limit := greatest(1, least(coalesce(p_limit, 50), 200));

  if to_regclass('cron.job_run_details') is null then
    return;
  end if;

  return query
  select
    j.jobid::bigint,
    j.jobname::text,
    d.runid::bigint,
    d.status::text,
    d.return_message::text,
    d.start_time,
    d.end_time
  from cron.job j
  join cron.job_run_details d on d.jobid = j.jobid
  where j.jobname = p_jobname
  order by d.start_time desc nulls last, d.runid desc
  limit v_limit;
end;
$$;

alter function public.admin_list_cron_job_runs(text, integer) owner to postgres;

revoke all on function public.admin_list_cron_job_runs(text, integer) from public;
grant execute on function public.admin_list_cron_job_runs(text, integer) to service_role;

-- Prune old history rows so cron.job_run_details doesn't grow without bound.
create or replace function public.admin_prune_cron_job_run_details(
  p_keep_days integer default 14
) returns integer
language plpgsql
security definer
set search_path to 'public', 'cron'
as $$
declare
  v_keep_days integer;
  v_deleted integer;
begin
  v_keep_days := greatest(1, least(coalesce(p_keep_days, 14), 365));

  if to_regclass('cron.job_run_details') is null then
    return 0;
  end if;

  delete from cron.job_run_details
  where end_time is not null
    and end_time < (now() - make_interval(days => v_keep_days));

  get diagnostics v_deleted = row_count;
  return coalesce(v_deleted, 0);
end;
$$;

alter function public.admin_prune_cron_job_run_details(integer) owner to postgres;

revoke all on function public.admin_prune_cron_job_run_details(integer) from public;
grant execute on function public.admin_prune_cron_job_run_details(integer) to service_role;

commit;
