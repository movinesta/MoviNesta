-- Migration: 20260105000000_assistant_observability_health
-- Description: Add assistant health snapshot RPC + log cron invocations for the runner.

BEGIN;

-- Replace runner invoker to record cron requests for diagnostics.
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
  v_request_id bigint;
BEGIN
  v_request_id := net.http_post(
    url := 'https://' || current_setting('app.settings.project_ref') || '.supabase.co/functions/v1/assistant-chat-reply-runner',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', current_setting('app.settings.service_role_key'),
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
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

-- Admin-only health snapshot for quick diagnostics.
CREATE OR REPLACE FUNCTION public.assistant_health_snapshot_v1()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_now timestamptz := now();
  v_counts jsonb;
  v_by_kind jsonb;
  v_oldest_pending bigint;
  v_oldest_processing bigint;
  v_last24 jsonb;
  v_failures jsonb;
  v_cron jsonb;
BEGIN
  PERFORM public.assert_admin();

  SELECT COALESCE(jsonb_object_agg(status, cnt), '{}'::jsonb)
  INTO v_counts
  FROM (
    SELECT status, count(*)::int AS cnt
    FROM public.assistant_reply_jobs
    GROUP BY status
  ) s;

  WITH k AS (
    SELECT
      job_kind,
      sum((status = 'pending')::int) AS pending,
      sum((status = 'processing')::int) AS processing,
      sum((status = 'done')::int) AS done,
      sum((status = 'failed')::int) AS failed,
      count(*)::int AS total
    FROM public.assistant_reply_jobs
    GROUP BY job_kind
  )
  SELECT COALESCE(
    jsonb_object_agg(
      job_kind,
      jsonb_build_object(
        'pending', pending,
        'processing', processing,
        'done', done,
        'failed', failed,
        'total', total
      )
    ),
    '{}'::jsonb
  )
  INTO v_by_kind
  FROM k;

  SELECT floor(extract(epoch from (v_now - min(created_at))))::bigint
  INTO v_oldest_pending
  FROM public.assistant_reply_jobs
  WHERE status = 'pending';

  SELECT floor(extract(epoch from (v_now - min(updated_at))))::bigint
  INTO v_oldest_processing
  FROM public.assistant_reply_jobs
  WHERE status = 'processing';

  SELECT jsonb_build_object(
    'created', count(*)::int,
    'done', sum((status = 'done')::int),
    'failed', sum((status = 'failed')::int)
  )
  INTO v_last24
  FROM public.assistant_reply_jobs
  WHERE created_at >= (v_now - interval '24 hours');

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', id,
      'conversationId', conversation_id,
      'userId', user_id,
      'jobKind', job_kind,
      'attempts', attempts,
      'updatedAt', updated_at,
      'lastError', left(coalesce(last_error, ''), 220)
    )
    ORDER BY updated_at DESC
  ), '[]'::jsonb)
  INTO v_failures
  FROM (
    SELECT *
    FROM public.assistant_reply_jobs
    WHERE status = 'failed'
    ORDER BY updated_at DESC
    LIMIT 20
  ) f;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', id,
      'job', job_name,
      'requestId', request_id,
      'createdAt', created_at
    )
    ORDER BY created_at DESC
  ), '[]'::jsonb)
  INTO v_cron
  FROM (
    SELECT id, job_name, request_id, created_at
    FROM public.assistant_cron_requests
    ORDER BY created_at DESC
    LIMIT 25
  ) c;

  RETURN jsonb_build_object(
    'ok', true,
    'ts', v_now,
    'counts', v_counts,
    'byKind', v_by_kind,
    'oldestPendingSec', COALESCE(v_oldest_pending, 0),
    'oldestProcessingSec', COALESCE(v_oldest_processing, 0),
    'last24h', COALESCE(v_last24, '{}'::jsonb),
    'recentFailures', v_failures,
    'recentCron', v_cron
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.assistant_health_snapshot_v1() TO authenticated;

COMMIT;
