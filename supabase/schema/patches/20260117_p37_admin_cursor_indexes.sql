-- Admin cursor pagination indexes
--
-- These indexes support keyset/cursor pagination used by the admin dashboard for:
-- - public.job_run_log (ORDER BY started_at DESC, id DESC)
-- - public.openrouter_request_log (ORDER BY created_at DESC, id DESC)
--
-- Safe to run multiple times.

create index if not exists job_run_log_started_at_id_idx
  on public.job_run_log (started_at, id);

create index if not exists openrouter_request_log_created_at_id_idx
  on public.openrouter_request_log (created_at, id);
