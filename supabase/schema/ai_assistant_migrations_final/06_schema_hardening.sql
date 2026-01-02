-- MoviNesta AI Assistant v9
-- Schema hardening: enable RLS + least-privilege grants + immutable-column guards
-- Safe to re-run.

-- -----------------------------------------------------------------------------
-- 0) Helper: admin predicate
-- -----------------------------------------------------------------------------
create or replace function public.is_app_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.app_admins a
    where a.user_id = auth.uid()
  );
$$;

-- -----------------------------------------------------------------------------
-- 1) assistant_prefs: user can read/write own prefs; admins can read all; service_role all
-- -----------------------------------------------------------------------------
alter table if exists public.assistant_prefs enable row level security;

revoke all on table public.assistant_prefs from anon, authenticated;
grant select, insert, update on table public.assistant_prefs to authenticated;
grant all on table public.assistant_prefs to service_role;

drop policy if exists assistant_prefs_select_own on public.assistant_prefs;
create policy assistant_prefs_select_own
on public.assistant_prefs
for select
to authenticated
using (user_id = auth.uid() or public.is_app_admin());

drop policy if exists assistant_prefs_upsert_own on public.assistant_prefs;
create policy assistant_prefs_upsert_own
on public.assistant_prefs
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists assistant_prefs_update_own on public.assistant_prefs;
create policy assistant_prefs_update_own
on public.assistant_prefs
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Guard: prevent non-admin/service updates to immutable columns (user_id)
create or replace function public.assistant_prefs_guard_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_app_admin() or auth.role() = 'service_role' then
    return new;
  end if;

  if new.user_id <> old.user_id then
    raise exception 'assistant_prefs.user_id is immutable';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_assistant_prefs_guard_update on public.assistant_prefs;
create trigger trg_assistant_prefs_guard_update
before update on public.assistant_prefs
for each row
execute function public.assistant_prefs_guard_update();

-- -----------------------------------------------------------------------------
-- 2) assistant_memory: user can read/write own; admins read all; service_role all
-- -----------------------------------------------------------------------------
alter table if exists public.assistant_memory enable row level security;

revoke all on table public.assistant_memory from anon, authenticated;
grant select, insert, update on table public.assistant_memory to authenticated;
grant all on table public.assistant_memory to service_role;

drop policy if exists assistant_memory_select_own on public.assistant_memory;
create policy assistant_memory_select_own
on public.assistant_memory
for select
to authenticated
using (user_id = auth.uid() or public.is_app_admin());

drop policy if exists assistant_memory_insert_own on public.assistant_memory;
create policy assistant_memory_insert_own
on public.assistant_memory
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists assistant_memory_update_own on public.assistant_memory;
create policy assistant_memory_update_own
on public.assistant_memory
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 3) assistant_suggestions: user can read own; user can update only state columns; service_role all; admins read all
-- -----------------------------------------------------------------------------
alter table if exists public.assistant_suggestions enable row level security;

revoke all on table public.assistant_suggestions from anon, authenticated;
grant select, insert, update on table public.assistant_suggestions to authenticated;
grant all on table public.assistant_suggestions to service_role;

drop policy if exists assistant_suggestions_select_own on public.assistant_suggestions;
create policy assistant_suggestions_select_own
on public.assistant_suggestions
for select
to authenticated
using (user_id = auth.uid() or public.is_app_admin());

drop policy if exists assistant_suggestions_insert_own on public.assistant_suggestions;
create policy assistant_suggestions_insert_own
on public.assistant_suggestions
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists assistant_suggestions_update_own on public.assistant_suggestions;
create policy assistant_suggestions_update_own
on public.assistant_suggestions
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Guard updates so users can't mutate generated content
create or replace function public.assistant_suggestions_guard_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_app_admin() or auth.role() = 'service_role' then
    return new;
  end if;

  -- Immutable content columns
  if new.user_id <> old.user_id
    or new.surface <> old.surface
    or new.context_key <> old.context_key
    or new.context <> old.context
    or new.kind <> old.kind
    or new.title <> old.title
    or new.body <> old.body
    or new.actions <> old.actions
    or new.score <> old.score
    or coalesce(new.model,'') <> coalesce(old.model,'')
    or coalesce(new.usage,'{}'::jsonb) <> coalesce(old.usage,'{}'::jsonb)
    or new.created_at <> old.created_at
  then
    raise exception 'assistant_suggestions content is immutable; only state fields can change';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_assistant_suggestions_guard_update on public.assistant_suggestions;
create trigger trg_assistant_suggestions_guard_update
before update on public.assistant_suggestions
for each row
execute function public.assistant_suggestions_guard_update();

-- Optional: enforce known surfaces (safe if you only use these)
alter table if exists public.assistant_suggestions
  drop constraint if exists assistant_suggestions_surface_chk;
alter table if exists public.assistant_suggestions
  add constraint assistant_suggestions_surface_chk
  check (surface in ('home','swipe','title','messages','diary','search','assistant'));

-- -----------------------------------------------------------------------------
-- 4) assistant_message_action_log: user can select/insert own; admins select all; service_role all
-- -----------------------------------------------------------------------------
alter table if exists public.assistant_message_action_log enable row level security;

revoke all on table public.assistant_message_action_log from anon, authenticated;
grant select, insert on table public.assistant_message_action_log to authenticated;
grant all on table public.assistant_message_action_log to service_role;

-- Dedupe (user_id, action_id) in case older migrations inserted twice
do $$
begin
  if to_regclass('public.assistant_message_action_log') is not null then
    delete from public.assistant_message_action_log a
    using public.assistant_message_action_log b
    where a.user_id = b.user_id
      and a.action_id = b.action_id
      and a.ctid < b.ctid;
  end if;
end $$;

create unique index if not exists assistant_message_action_log_user_action_uidx
  on public.assistant_message_action_log (user_id, action_id);

drop policy if exists assistant_action_log_select_own on public.assistant_message_action_log;
create policy assistant_action_log_select_own
on public.assistant_message_action_log
for select
to authenticated
using (user_id = auth.uid() or public.is_app_admin());

drop policy if exists assistant_action_log_insert_own on public.assistant_message_action_log;
create policy assistant_action_log_insert_own
on public.assistant_message_action_log
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.conversation_participants cp
    where cp.conversation_id = conversation_id
      and cp.user_id = auth.uid()
  )
  and exists (
    select 1 from public.messages m
    where m.id = message_id
      and m.conversation_id = conversation_id
  )
);

-- -----------------------------------------------------------------------------
-- 5) assistant_goals / goal_state / goal_events: user reads/writes own goals; goal_state/events are restricted via join
-- -----------------------------------------------------------------------------
alter table if exists public.assistant_goals enable row level security;
alter table if exists public.assistant_goal_state enable row level security;
alter table if exists public.assistant_goal_events enable row level security;

revoke all on table public.assistant_goals from anon, authenticated;
revoke all on table public.assistant_goal_state from anon, authenticated;
revoke all on table public.assistant_goal_events from anon, authenticated;

grant select, insert, update on table public.assistant_goals to authenticated;
grant select, insert, update on table public.assistant_goal_state to authenticated;
grant select on table public.assistant_goal_events to authenticated;

grant all on table public.assistant_goals to service_role;
grant all on table public.assistant_goal_state to service_role;
grant all on table public.assistant_goal_events to service_role;

drop policy if exists assistant_goals_select_own on public.assistant_goals;
create policy assistant_goals_select_own
on public.assistant_goals
for select
to authenticated
using (user_id = auth.uid() or public.is_app_admin());

drop policy if exists assistant_goals_insert_own on public.assistant_goals;
create policy assistant_goals_insert_own
on public.assistant_goals
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists assistant_goals_update_own on public.assistant_goals;
create policy assistant_goals_update_own
on public.assistant_goals
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- goal_state: tie to goals ownership
drop policy if exists assistant_goal_state_select_own on public.assistant_goal_state;
create policy assistant_goal_state_select_own
on public.assistant_goal_state
for select
to authenticated
using (
  public.is_app_admin()
  or exists (
    select 1 from public.assistant_goals g
    where g.id = goal_id and g.user_id = auth.uid()
  )
);

drop policy if exists assistant_goal_state_upsert_own on public.assistant_goal_state;
create policy assistant_goal_state_upsert_own
on public.assistant_goal_state
for insert
to authenticated
with check (
  exists (
    select 1 from public.assistant_goals g
    where g.id = goal_id and g.user_id = auth.uid()
  )
);

drop policy if exists assistant_goal_state_update_own on public.assistant_goal_state;
create policy assistant_goal_state_update_own
on public.assistant_goal_state
for update
to authenticated
using (
  exists (
    select 1 from public.assistant_goals g
    where g.id = goal_id and g.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.assistant_goals g
    where g.id = goal_id and g.user_id = auth.uid()
  )
);

-- goal_events: read-only to owner
drop policy if exists assistant_goal_events_select_own on public.assistant_goal_events;
create policy assistant_goal_events_select_own
on public.assistant_goal_events
for select
to authenticated
using (
  public.is_app_admin()
  or exists (
    select 1 from public.assistant_goals g
    where g.id = goal_id and g.user_id = auth.uid()
  )
);

-- -----------------------------------------------------------------------------
-- 6) assistant_trigger_fires / triggers / metrics_daily: lock down
-- -----------------------------------------------------------------------------
alter table if exists public.assistant_trigger_fires enable row level security;
alter table if exists public.assistant_triggers enable row level security;
alter table if exists public.assistant_metrics_daily enable row level security;

revoke all on table public.assistant_trigger_fires from anon, authenticated;
revoke all on table public.assistant_triggers from anon, authenticated;
revoke all on table public.assistant_metrics_daily from anon, authenticated;

grant select on table public.assistant_trigger_fires to authenticated;
grant select on table public.assistant_triggers to authenticated;
grant select on table public.assistant_metrics_daily to authenticated;

grant all on table public.assistant_trigger_fires to service_role;
grant all on table public.assistant_triggers to service_role;
grant all on table public.assistant_metrics_daily to service_role;

-- trigger_fires: user can read own; admins can read all; no user inserts
drop policy if exists assistant_trigger_fires_select_own on public.assistant_trigger_fires;
create policy assistant_trigger_fires_select_own
on public.assistant_trigger_fires
for select
to authenticated
using (user_id = auth.uid() or public.is_app_admin());

-- triggers: only admins can read; hide definitions from regular users (still available via edge functions if needed)
drop policy if exists assistant_triggers_select_admin on public.assistant_triggers;
create policy assistant_triggers_select_admin
on public.assistant_triggers
for select
to authenticated
using (public.is_app_admin());

-- metrics_daily: admin-only reads
drop policy if exists assistant_metrics_daily_select_admin on public.assistant_metrics_daily;
create policy assistant_metrics_daily_select_admin
on public.assistant_metrics_daily
for select
to authenticated
using (public.is_app_admin());

-- -----------------------------------------------------------------------------
-- 7) Harden RPC function privileges (remove PUBLIC/anon)
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.assistant_tx_plan_execute_v1(jsonb)') is not null then
    revoke all on function public.assistant_tx_plan_execute_v1(jsonb) from public, anon;
    grant execute on function public.assistant_tx_plan_execute_v1(jsonb) to authenticated, service_role;
  end if;

  if to_regprocedure('public.assistant_ctx_snapshot_v1(integer)') is not null then
    revoke all on function public.assistant_ctx_snapshot_v1(integer) from public, anon;
    grant execute on function public.assistant_ctx_snapshot_v1(integer) to authenticated, service_role;
  end if;
end $$;
