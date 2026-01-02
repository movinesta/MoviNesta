-- MoviNesta AI Assistant - incremental migration (v2)
-- Date: 2026-01-02
--
-- Apply in Supabase SQL editor (safe to re-run).

-- Faster lookups by tool result handle (action_id)
create index if not exists assistant_message_action_log_user_action_id_created_at_idx
  on public.assistant_message_action_log (user_id, action_id, created_at desc);
