-- Migration: 20260104031000_assistant_chat_reply_runner_invoke
-- Description:
-- Adds a DB helper to invoke the assistant chat reply runner via pg_net and schedules it via pg_cron.

BEGIN;

-- Helper function that calls the edge function with anon key + internal job token.
CREATE OR REPLACE FUNCTION public.invoke_assistant_chat_reply_runner_with_anon_key(
  p_reason text DEFAULT 'cron'::text,
  p_limit integer DEFAULT 20
) RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/assistant-chat-reply-runner',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key'),
      'x-job-token', (select decrypted_secret from vault.decrypted_secrets where name = 'internal_job_token')
    ),
    body := jsonb_build_object('reason', p_reason, 'limit', p_limit)
  );
$$;

REVOKE ALL ON FUNCTION public.invoke_assistant_chat_reply_runner_with_anon_key(text, integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.invoke_assistant_chat_reply_runner_with_anon_key(text, integer) TO anon;
GRANT ALL ON FUNCTION public.invoke_assistant_chat_reply_runner_with_anon_key(text, integer) TO authenticated;
GRANT ALL ON FUNCTION public.invoke_assistant_chat_reply_runner_with_anon_key(text, integer) TO service_role;

-- Schedule: run every minute.
DO $$
BEGIN
  PERFORM cron.schedule(
    'assistant-chat-reply-runner',
    '*/1 * * * *',
    'SELECT public.invoke_assistant_chat_reply_runner_with_anon_key()'
  );
EXCEPTION WHEN others THEN
  -- Ignore if the job already exists.
  NULL;
END$$;

COMMIT;
