-- Migration: 20260104021000_assistant_action_log_rls_normalize
-- Purpose:
--   1) Make assistant_message_action_log RLS idempotent across older DB states.
--   2) Remove legacy policy names that caused "policy already exists" migration failures.
--   3) Ensure canonical policies exist with auth initplan best-practice (SELECT auth.uid()).

BEGIN;

-- Ensure RLS is enabled
ALTER TABLE IF EXISTS public.assistant_message_action_log ENABLE ROW LEVEL SECURITY;

-- Drop legacy/older policy names (safe if they don't exist)
DROP POLICY IF EXISTS "Users can view their own assistant action logs" ON public.assistant_message_action_log;
DROP POLICY IF EXISTS "Users can insert their own assistant action logs" ON public.assistant_message_action_log;
DROP POLICY IF EXISTS "Users can update their own assistant action logs" ON public.assistant_message_action_log;
DROP POLICY IF EXISTS "Users can delete their own assistant action logs" ON public.assistant_message_action_log;

DO $$
BEGIN
  -- SELECT
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'assistant_message_action_log'
      AND policyname = 'rls_assistant_message_action_log_select_self'
  ) THEN
    EXECUTE $$
      CREATE POLICY rls_assistant_message_action_log_select_self
        ON public.assistant_message_action_log
        FOR SELECT
        TO authenticated
        USING (user_id = (SELECT auth.uid()))
    $$;
  END IF;

  -- INSERT
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'assistant_message_action_log'
      AND policyname = 'rls_assistant_message_action_log_insert_self'
  ) THEN
    EXECUTE $$
      CREATE POLICY rls_assistant_message_action_log_insert_self
        ON public.assistant_message_action_log
        FOR INSERT
        TO authenticated
        WITH CHECK (user_id = (SELECT auth.uid()))
    $$;
  END IF;

  -- UPDATE
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'assistant_message_action_log'
      AND policyname = 'rls_assistant_message_action_log_update_self'
  ) THEN
    EXECUTE $$
      CREATE POLICY rls_assistant_message_action_log_update_self
        ON public.assistant_message_action_log
        FOR UPDATE
        TO authenticated
        USING (user_id = (SELECT auth.uid()))
        WITH CHECK (user_id = (SELECT auth.uid()))
    $$;
  END IF;

  -- DELETE
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'assistant_message_action_log'
      AND policyname = 'rls_assistant_message_action_log_delete_self'
  ) THEN
    EXECUTE $$
      CREATE POLICY rls_assistant_message_action_log_delete_self
        ON public.assistant_message_action_log
        FOR DELETE
        TO authenticated
        USING (user_id = (SELECT auth.uid()))
    $$;
  END IF;

  -- Service role (explicit allow; harmless if service_role bypasses RLS)
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'assistant_message_action_log'
      AND policyname = 'rls_assistant_message_action_log_service_role_all'
  ) THEN
    EXECUTE $$
      CREATE POLICY rls_assistant_message_action_log_service_role_all
        ON public.assistant_message_action_log
        TO service_role
        USING (true)
        WITH CHECK (true)
    $$;
  END IF;
END
$$;

-- Ensure commonly-used indexes exist (use the existing canonical names to avoid duplicates)
CREATE INDEX IF NOT EXISTS assistant_message_action_log_conversation_id_idx
  ON public.assistant_message_action_log (conversation_id);

CREATE INDEX IF NOT EXISTS assistant_message_action_log_user_id_idx
  ON public.assistant_message_action_log (user_id);

CREATE INDEX IF NOT EXISTS idx_assistant_message_action_log_action_id
  ON public.assistant_message_action_log (action_id);

COMMIT;
