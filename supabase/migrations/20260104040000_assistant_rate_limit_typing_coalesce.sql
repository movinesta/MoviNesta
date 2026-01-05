-- Migration: 20260104040000_assistant_rate_limit_typing_coalesce
-- Description:
-- - Add DB rate limiting primitives.
-- - Coalesce assistant reply jobs to avoid multi-reply bursts.
-- - Add job_kind to assistant_reply_jobs to support cheap non-LLM jobs.
-- - Add an authenticated RPC to read assistant reply status (typing/queued) so UI can persist across refresh.

BEGIN;

-- 1) Rate limit counters (window-bucket).
CREATE TABLE IF NOT EXISTS public.rate_limit_counters (
  key text NOT NULL,
  window_start bigint NOT NULL,
  count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (key, window_start)
);

REVOKE ALL ON TABLE public.rate_limit_counters FROM PUBLIC;
REVOKE ALL ON TABLE public.rate_limit_counters FROM anon;
REVOKE ALL ON TABLE public.rate_limit_counters FROM authenticated;
GRANT ALL ON TABLE public.rate_limit_counters TO service_role;

CREATE OR REPLACE FUNCTION public.rate_limit_check_v1(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  now_epoch bigint;
  bucket_start bigint;
  next_epoch bigint;
  new_count integer;
  allowed boolean;
BEGIN
  p_key := COALESCE(NULLIF(trim(p_key), ''), '');
  IF p_key = '' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'BAD_KEY'
    );
  END IF;

  p_limit := GREATEST(1, COALESCE(p_limit, 1));
  p_window_seconds := GREATEST(1, COALESCE(p_window_seconds, 60));

  now_epoch := floor(extract(epoch from now()))::bigint;
  bucket_start := (now_epoch / p_window_seconds) * p_window_seconds;
  next_epoch := bucket_start + p_window_seconds;

  INSERT INTO public.rate_limit_counters(key, window_start, count, updated_at)
  VALUES (p_key, bucket_start, 1, now())
  ON CONFLICT (key, window_start)
  DO UPDATE SET count = public.rate_limit_counters.count + 1,
               updated_at = now()
  RETURNING count INTO new_count;

  allowed := new_count <= p_limit;

  RETURN jsonb_build_object(
    'ok', true,
    'key', p_key,
    'windowStart', bucket_start,
    'windowSeconds', p_window_seconds,
    'limit', p_limit,
    'count', new_count,
    'allowed', allowed,
    'remaining', GREATEST(0, p_limit - new_count),
    'retryAfterSec', GREATEST(0, (next_epoch - now_epoch))
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rate_limit_check_v1(text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rate_limit_check_v1(text, integer, integer) FROM anon;
REVOKE ALL ON FUNCTION public.rate_limit_check_v1(text, integer, integer) FROM authenticated;
GRANT ALL ON FUNCTION public.rate_limit_check_v1(text, integer, integer) TO service_role;

-- Optional cleanup helper for ops (service_role only).
CREATE OR REPLACE FUNCTION public.rate_limit_cleanup_v1(p_keep_hours integer DEFAULT 24)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH del AS (
    DELETE FROM public.rate_limit_counters
    WHERE updated_at < now() - make_interval(hours => GREATEST(1, COALESCE(p_keep_hours, 24)))
    RETURNING 1
  )
  SELECT count(*)::bigint FROM del;
$$;

REVOKE ALL ON FUNCTION public.rate_limit_cleanup_v1(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rate_limit_cleanup_v1(integer) FROM anon;
REVOKE ALL ON FUNCTION public.rate_limit_cleanup_v1(integer) FROM authenticated;
GRANT ALL ON FUNCTION public.rate_limit_cleanup_v1(integer) TO service_role;

-- 2) Extend assistant_reply_jobs with job_kind.
ALTER TABLE public.assistant_reply_jobs
  ADD COLUMN IF NOT EXISTS job_kind text NOT NULL DEFAULT 'reply';

-- Ensure job_kind check constraint exists (idempotent).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'assistant_reply_jobs_job_kind_chk'
  ) THEN
    ALTER TABLE public.assistant_reply_jobs
      ADD CONSTRAINT assistant_reply_jobs_job_kind_chk
      CHECK (job_kind IN ('reply','rate_limit_notice'));
  END IF;
END$$;

-- Index to quickly lookup latest job for a user+conversation.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'assistant_reply_jobs_conv_user_status_created_idx'
  ) THEN
    CREATE INDEX assistant_reply_jobs_conv_user_status_created_idx
      ON public.assistant_reply_jobs (conversation_id, user_id, status, created_at DESC);
  END IF;
END$$;

-- 3) Update the enqueue trigger to:
--    - only keep the newest pending job per (conversation_id, user_id)
--    - rate-limit enqueue bursts and optionally queue a notice job
CREATE OR REPLACE FUNCTION public.enqueue_assistant_reply_job_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  assistant_id uuid;
  key text;
  rl jsonb;
  window_start bigint;
BEGIN
  -- Only enqueue for non-deleted, text messages.
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.message_type IS DISTINCT FROM 'text' THEN
    RETURN NEW;
  END IF;

  assistant_id := public.get_assistant_user_id_v1();
  IF assistant_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Never enqueue for assistant's own messages.
  IF NEW.user_id = assistant_id THEN
    RETURN NEW;
  END IF;

  -- Only enqueue if the assistant is a participant in this conversation.
  IF NOT EXISTS (
    SELECT 1
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = NEW.conversation_id
      AND cp.user_id = assistant_id
  ) THEN
    RETURN NEW;
  END IF;

  -- Coalesce: mark older pending jobs for this user+conversation as done.
  UPDATE public.assistant_reply_jobs
  SET status = 'done',
      updated_at = now(),
      meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object(
        'supersededByMessageId', NEW.id::text,
        'supersededAt', now()
      )
  WHERE conversation_id = NEW.conversation_id
    AND user_id = NEW.user_id
    AND status = 'pending'
    AND user_message_id <> NEW.id;

  -- Rate limit enqueue bursts (best-effort): 12 messages per 60 seconds.
  rl := public.rate_limit_check_v1(
    'assistant_enqueue:' || NEW.user_id::text || ':' || NEW.conversation_id::text,
    12,
    60
  );

  IF COALESCE((rl->>'ok')::boolean, false) = true
     AND COALESCE((rl->>'allowed')::boolean, true) = false THEN

    window_start := COALESCE((rl->>'windowStart')::bigint, floor(extract(epoch from now()))::bigint);

    -- Deduplicate notices per conversation per window.
    key := NEW.conversation_id::text || ':rate_limit_notice:' || window_start::text;

    INSERT INTO public.assistant_reply_jobs (
      user_id,
      conversation_id,
      user_message_id,
      dedupe_key,
      job_kind,
      meta
    )
    VALUES (
      NEW.user_id,
      NEW.conversation_id,
      NEW.id,
      key,
      'rate_limit_notice',
      jsonb_build_object(
        'source','messages_trigger',
        'rateLimit', rl
      )
    )
    ON CONFLICT (dedupe_key) DO NOTHING;

    RETURN NEW;
  END IF;

  -- Normal reply job (dedupe by message id).
  key := NEW.conversation_id::text || ':' || NEW.id::text;

  INSERT INTO public.assistant_reply_jobs (user_id, conversation_id, user_message_id, dedupe_key, job_kind, meta)
  VALUES (NEW.user_id, NEW.conversation_id, NEW.id, key, 'reply', jsonb_build_object('source','messages_trigger'))
  ON CONFLICT (dedupe_key) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 4) Authenticated RPC for UI: assistant typing/queued status
CREATE OR REPLACE FUNCTION public.assistant_reply_status_v1(p_conversation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid;
  j record;
  retry_after integer;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = p_conversation_id
      AND cp.user_id = uid
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  END IF;

  SELECT * INTO j
  FROM public.assistant_reply_jobs
  WHERE conversation_id = p_conversation_id
    AND user_id = uid
    AND status IN ('pending','processing')
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'is_typing', false,
      'is_queued', false
    );
  END IF;

  retry_after := GREATEST(0, floor(extract(epoch from (j.next_run_at - now())))::int);

  RETURN jsonb_build_object(
    'ok', true,
    'is_typing', (j.status = 'processing'),
    'is_queued', (j.status = 'pending'),
    'jobKind', j.job_kind,
    'attempts', j.attempts,
    'nextRunAt', j.next_run_at,
    'retryAfterSec', retry_after
  );
END;
$$;

REVOKE ALL ON FUNCTION public.assistant_reply_status_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assistant_reply_status_v1(uuid) TO authenticated;

COMMIT;
