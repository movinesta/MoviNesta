-- Migration: 20260104030000_assistant_reply_jobs
-- Description:
-- Durable background queue for assistant chat replies.
--
-- Why:
-- - The current assistant reply flow is client-triggered.
-- - If the client disconnects after sending a message, the assistant may never reply.
--
-- This migration introduces:
-- - public.assistant_system_config: a singleton row holding assistant identity hints.
-- - public.assistant_reply_jobs: a durable queue of user messages that need an assistant reply.
-- - public.get_assistant_user_id_v1(): resolves assistant id using config (fallback to username lookup).
-- - public.enqueue_assistant_reply_job_v1(): a trigger function on public.messages.
-- - public.assistant_claim_reply_jobs_v1(): lock-safe job claiming for background runners.

BEGIN;

-- 0) Singleton system config for assistant identity.
CREATE TABLE IF NOT EXISTS public.assistant_system_config (
  id integer PRIMARY KEY DEFAULT 1,
  assistant_user_id uuid,
  assistant_username text NOT NULL DEFAULT 'movinesta',
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assistant_system_config_singleton CHECK (id = 1)
);

INSERT INTO public.assistant_system_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- 1) Resolve assistant user id for DB-side logic.
CREATE OR REPLACE FUNCTION public.get_assistant_user_id_v1()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  cfg_id uuid;
  cfg_username text;
  resolved uuid;
BEGIN
  SELECT assistant_user_id, assistant_username
    INTO cfg_id, cfg_username
  FROM public.assistant_system_config
  WHERE id = 1;

  IF cfg_id IS NOT NULL THEN
    RETURN cfg_id;
  END IF;

  cfg_username := COALESCE(NULLIF(trim(cfg_username), ''), 'movinesta');

  SELECT p.id INTO resolved
  FROM public.profiles p
  WHERE lower(p.username) = lower(cfg_username)
  LIMIT 1;

  RETURN resolved;
END;
$$;

-- 2) Durable reply jobs table.
CREATE TABLE IF NOT EXISTS public.assistant_reply_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  conversation_id uuid NOT NULL,
  user_message_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  next_run_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  dedupe_key text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT assistant_reply_jobs_status_chk CHECK (status IN ('pending','processing','done','failed'))
);

-- Idempotency: ensure a user message only enqueues once.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'assistant_reply_jobs_dedupe_key_uidx'
  ) THEN
    CREATE UNIQUE INDEX assistant_reply_jobs_dedupe_key_uidx
      ON public.assistant_reply_jobs (dedupe_key);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'assistant_reply_jobs_pending_idx'
  ) THEN
    CREATE INDEX assistant_reply_jobs_pending_idx
      ON public.assistant_reply_jobs (status, next_run_at, created_at);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'assistant_reply_jobs_conv_msg_idx'
  ) THEN
    CREATE INDEX assistant_reply_jobs_conv_msg_idx
      ON public.assistant_reply_jobs (conversation_id, user_message_id);
  END IF;
END$$;

-- Lock down privileges (service_role bypasses RLS; we keep this table non-public).
REVOKE ALL ON TABLE public.assistant_reply_jobs FROM PUBLIC;
REVOKE ALL ON TABLE public.assistant_reply_jobs FROM anon;
REVOKE ALL ON TABLE public.assistant_reply_jobs FROM authenticated;
GRANT ALL ON TABLE public.assistant_reply_jobs TO service_role;

REVOKE ALL ON TABLE public.assistant_system_config FROM PUBLIC;
REVOKE ALL ON TABLE public.assistant_system_config FROM anon;
REVOKE ALL ON TABLE public.assistant_system_config FROM authenticated;
GRANT ALL ON TABLE public.assistant_system_config TO service_role;

-- 3) Trigger to enqueue reply jobs when a user sends a message to assistant.
CREATE OR REPLACE FUNCTION public.enqueue_assistant_reply_job_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  assistant_id uuid;
  key text;
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

  -- Build a stable dedupe key.
  key := NEW.conversation_id::text || ':' || NEW.id::text;

  INSERT INTO public.assistant_reply_jobs (user_id, conversation_id, user_message_id, dedupe_key, meta)
  VALUES (NEW.user_id, NEW.conversation_id, NEW.id, key, jsonb_build_object('source','messages_trigger'))
  ON CONFLICT (dedupe_key) DO NOTHING;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'messages_enqueue_assistant_reply_job'
  ) THEN
    CREATE TRIGGER messages_enqueue_assistant_reply_job
      AFTER INSERT ON public.messages
      FOR EACH ROW
      EXECUTE FUNCTION public.enqueue_assistant_reply_job_v1();
  END IF;
END$$;

-- 4) Claim jobs for a worker (safe concurrency via SKIP LOCKED).
CREATE OR REPLACE FUNCTION public.assistant_claim_reply_jobs_v1(
  p_limit integer DEFAULT 20,
  p_stuck_minutes integer DEFAULT 10
)
RETURNS SETOF public.assistant_reply_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH candidate AS (
    SELECT id
    FROM public.assistant_reply_jobs
    WHERE (
      (status = 'pending' AND next_run_at <= now())
      OR
      (status = 'processing' AND updated_at < now() - make_interval(mins => p_stuck_minutes))
    )
    ORDER BY created_at ASC
    LIMIT GREATEST(1, LEAST(p_limit, 200))
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.assistant_reply_jobs j
  SET status = 'processing',
      attempts = j.attempts + 1,
      updated_at = now()
  FROM candidate c
  WHERE j.id = c.id
  RETURNING j.*;
END;
$$;

REVOKE ALL ON FUNCTION public.assistant_claim_reply_jobs_v1(integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assistant_claim_reply_jobs_v1(integer, integer) FROM anon;
REVOKE ALL ON FUNCTION public.assistant_claim_reply_jobs_v1(integer, integer) FROM authenticated;
GRANT ALL ON FUNCTION public.assistant_claim_reply_jobs_v1(integer, integer) TO service_role;

COMMIT;
