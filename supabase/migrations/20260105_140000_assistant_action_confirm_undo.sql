-- Migration: 20260105_140000_assistant_action_confirm_undo
-- Description: Add confirmation + undo metadata to assistant_message_action_log.

BEGIN;

ALTER TABLE IF EXISTS public.assistant_message_action_log
  ADD COLUMN IF NOT EXISTS action_key text,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS request_id text,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS finished_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirm_token text,
  ADD COLUMN IF NOT EXISTS confirm_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS undo_tool text,
  ADD COLUMN IF NOT EXISTS undo_args jsonb;

-- Idempotency across retries (action_key is computed from actionId + tool + args).
CREATE UNIQUE INDEX IF NOT EXISTS assistant_message_action_log_user_action_key_uidx
  ON public.assistant_message_action_log(user_id, action_key)
  WHERE action_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS assistant_message_action_log_status_idx
  ON public.assistant_message_action_log(status);

COMMIT;
