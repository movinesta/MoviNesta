-- Migration: 20260104_assistant_action_log_rls
-- Description: Ensure assistant_message_action_log uses RLS and indexed lookups for evidence fetches.

BEGIN;

ALTER TABLE IF EXISTS public.assistant_message_action_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own assistant action logs"
    ON public.assistant_message_action_log FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own assistant action logs"
    ON public.assistant_message_action_log FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_assistant_message_action_log_action_id
    ON public.assistant_message_action_log(action_id);

CREATE INDEX IF NOT EXISTS idx_assistant_message_action_log_conversation_id
    ON public.assistant_message_action_log(conversation_id);

CREATE INDEX IF NOT EXISTS idx_assistant_message_action_log_user_id
    ON public.assistant_message_action_log(user_id);

COMMIT;
