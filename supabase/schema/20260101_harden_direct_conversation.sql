-- Harden direct conversation creation and block invariants.

DO $$
begin
  delete from public.blocked_users
  where blocker_id = blocked_id;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'blocked_users_not_self'
      and conrelid = 'public.blocked_users'::regclass
  ) then
    alter table public.blocked_users
      add constraint blocked_users_not_self
      check (blocker_id <> blocked_id);
  end if;
end $$;

create or replace function public.create_direct_conversation_v1(
  p_creator_id uuid,
  p_target_user_id uuid
) returns uuid
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  pair uuid[];
  conv_id uuid;
begin
  if p_creator_id is null or p_target_user_id is null then
    raise exception 'MISSING_USER_ID' using errcode = '22004';
  end if;
  if p_creator_id = p_target_user_id then
    raise exception 'SELF_CONVERSATION' using errcode = '22000';
  end if;
  if not exists (select 1 from auth.users where id = p_creator_id) then
    raise exception 'CREATOR_NOT_FOUND' using errcode = 'P0001';
  end if;
  if not exists (select 1 from auth.users where id = p_target_user_id) then
    raise exception 'TARGET_NOT_FOUND' using errcode = 'P0001';
  end if;
  if exists (
    select 1
    from public.blocked_users bu
    where bu.blocker_id = p_creator_id
      and bu.blocked_id = p_target_user_id
  ) then
    raise exception 'BLOCKED_BY_SELF' using errcode = 'P0001';
  end if;
  if exists (
    select 1
    from public.blocked_users bu
    where bu.blocker_id = p_target_user_id
      and bu.blocked_id = p_creator_id
  ) then
    raise exception 'BLOCKED_BY_OTHER' using errcode = 'P0001';
  end if;

  pair := array[p_creator_id, p_target_user_id];
  if pair[1] > pair[2] then
    pair := array[p_target_user_id, p_creator_id];
  end if;

  insert into public.conversations (is_group, created_by, direct_participant_ids)
  values (false, p_creator_id, pair)
  on conflict (direct_participant_ids) where (is_group = false)
  do update set updated_at = now()
  returning id into conv_id;

  insert into public.conversation_participants (conversation_id, user_id, role)
  values
    (conv_id, pair[1], 'member'),
    (conv_id, pair[2], 'member')
  on conflict (conversation_id, user_id) do nothing;

  return conv_id;
end;
$$;
