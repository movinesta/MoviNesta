-- Migration: 20260105_110000_ai_idempotency_and_rls
-- Purpose:
-- 1) Prevent duplicate assistant replies for the same triggering user message.
-- 2) Make assistant_message_action_log RLS policy creation idempotent and compatible
--    with older policy names used in previous migrations.

begin;

-- 1) Idempotency query speed: index reply lookups by (conversation, sender, triggeredBy.userMessageId)
-- Note: we intentionally do NOT make this unique, because existing installs may
-- already contain duplicates (a UNIQUE index would fail to build).
-- The server logic still de-duplicates; this index makes it fast.
create index if not exists idx_messages_conversation_user_triggered_by_user_msg
  on public.messages (conversation_id, user_id, ((meta->'triggeredBy'->>'userMessageId')));

-- 2) assistant_message_action_log RLS (idempotent)
alter table if exists public.assistant_message_action_log enable row level security;

-- Drop legacy policy names that have caused "already exists" failures.
drop policy if exists "Users can view their own assistant action logs" on public.assistant_message_action_log;
drop policy if exists "Users can insert their own assistant action logs" on public.assistant_message_action_log;

-- Ensure modern policies exist (or are updated) with initplan-friendly auth.uid usage.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='assistant_message_action_log'
      and policyname='rls_assistant_message_action_log_select_self'
  ) then
    create policy rls_assistant_message_action_log_select_self
      on public.assistant_message_action_log
      for select
      to authenticated
      using (user_id = (select auth.uid()));
  else
    alter policy rls_assistant_message_action_log_select_self
      on public.assistant_message_action_log
      using (user_id = (select auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='assistant_message_action_log'
      and policyname='rls_assistant_message_action_log_insert_self'
  ) then
    create policy rls_assistant_message_action_log_insert_self
      on public.assistant_message_action_log
      for insert
      to authenticated
      with check (user_id = (select auth.uid()));
  else
    alter policy rls_assistant_message_action_log_insert_self
      on public.assistant_message_action_log
      with check (user_id = (select auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='assistant_message_action_log'
      and policyname='rls_assistant_message_action_log_service_role_all'
  ) then
    create policy rls_assistant_message_action_log_service_role_all
      on public.assistant_message_action_log
      to service_role
      using (true)
      with check (true);
  end if;
end $$;

commit;
