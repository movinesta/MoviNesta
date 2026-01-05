-- Migration: 20260105001000_fix_assistant_runner_invoker_secrets
-- Description:
--   Restore assistant runner invoker to use Vault secrets (project_url/anon_key/internal_job_token)
--   while keeping cron request logging. This avoids relying on app.settings.* GUCs.

BEGIN;

CREATE OR REPLACE FUNCTION public.invoke_assistant_chat_reply_runner_with_anon_key(
  p_reason text DEFAULT 'cron',
  p_limit integer DEFAULT 20
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_url text;
  v_anon text;
  v_token text;
  v_request_id bigint;
BEGIN
  v_url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/assistant-chat-reply-runner';
  v_anon := (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key');
  v_token := (select decrypted_secret from vault.decrypted_secrets where name = 'internal_job_token');

  v_request_id := net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon,
      'x-job-token', v_token
    ),
    body := jsonb_build_object('reason', p_reason, 'limit', p_limit)
  );

  INSERT INTO public.assistant_cron_requests (job_name, request_id)
  VALUES ('assistant-chat-reply-runner', v_request_id);

  RETURN v_request_id;
EXCEPTION
  WHEN others THEN
    INSERT INTO public.assistant_cron_requests (job_name, request_id)
    VALUES ('assistant-chat-reply-runner', NULL);
    RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.invoke_assistant_chat_reply_runner_with_anon_key(text, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.invoke_assistant_chat_reply_runner_with_anon_key(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.invoke_assistant_chat_reply_runner_with_anon_key(text, integer) TO service_role;

COMMIT;
