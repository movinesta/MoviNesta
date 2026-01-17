-- MoviNesta - DeepReview P25
--
-- Update/create the cron job that invokes the Edge Function: openrouter-generation-backfill
-- and pass credit/limit gating parameters.
--
-- Why:
-- - Supabase supports scheduling Edge Functions using pg_cron + pg_net, and recommends
--   storing tokens in Supabase Vault.
-- - OpenRouter exposes credits/rate-limit remaining via GET https://openrouter.ai/api/v1/key.
--
-- IMPORTANT
-- 1) Set INTERNAL_JOB_TOKEN in Edge Functions secrets.
-- 2) Store project_url, publishable_key, and internal_job_token in Supabase Vault.
-- 3) Run this script once from the SQL Editor.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Vault setup (run once):
-- select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
-- select vault.create_secret('<YOUR_SUPABASE_PUBLISHABLE_KEY>', 'publishable_key');
-- select vault.create_secret('<YOUR_INTERNAL_JOB_TOKEN>', 'internal_job_token');

DO $$
DECLARE
  v_jobname  text := 'openrouter-generation-backfill';
  v_schedule text := '*/15 * * * *';
  v_command  text;
  v_jobid    integer;
  has_alter  boolean;
BEGIN
  -- Build a cron command that invokes the Edge Function via pg_net.
  v_command := format($fmt$
    select
      net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
               || '/functions/v1/openrouter-generation-backfill',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
          'x-job-token', (select decrypted_secret from vault.decrypted_secrets where name = 'internal_job_token')
        ),
        body := jsonb_build_object(
          'batch_size', 50,
          'max_scan', 600,
          'max_age_hours', 72,
          'timeout_ms', 1500,
          'concurrency', 3,
          -- Credit/limit safety gate (OpenRouter /api/v1/key)
          'min_limit_remaining', 0.25,
          'max_key_age_minutes', 60,
          'dry_run', false
        )
      ) as request_id;
  $fmt$);

  -- Upsert into admin_cron_registry so the Admin Dashboard can manage it.
  insert into public.admin_cron_registry(jobname, schedule, command, updated_at)
  values (v_jobname, v_schedule, v_command, now())
  on conflict (jobname) do update
    set schedule = excluded.schedule,
        command  = excluded.command,
        updated_at = now();

  -- Create/update the actual pg_cron job.
  select exists(
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'cron' and p.proname = 'alter_job'
  ) into has_alter;

  select j.jobid into v_jobid
  from cron.job j
  where j.jobname = v_jobname
  limit 1;

  if v_jobid is null then
    perform cron.schedule(v_jobname, v_schedule, v_command);
  else
    if has_alter then
      perform cron.alter_job(v_jobid, schedule => v_schedule, command => v_command, active => true);
    else
      perform cron.unschedule(v_jobid);
      perform cron.schedule(v_jobname, v_schedule, v_command);
    end if;
  end if;
END $$;

-- After running, confirm:
-- select * from cron.job order by jobid desc;
-- select * from public.admin_list_cron_jobs();
