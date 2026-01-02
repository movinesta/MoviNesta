-- MoviNesta AI Assistant v6
-- Adds a compact context snapshot RPC and fixes/optimizes lookups used by the assistant.

-- Perf indexes for assistant reads (safe if they already exist).
create index if not exists media_events_user_type_created_idx
  on public.media_events (user_id, event_type, created_at desc);

create index if not exists library_entries_user_updated_idx
  on public.library_entries (user_id, updated_at desc);

create index if not exists lists_user_updated_idx
  on public.lists (user_id, updated_at desc);

-- One-call context snapshot to reduce roundtrips and hallucinations.
create or replace function public.assistant_ctx_snapshot_v1(p_limit int default 8)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_limit int;

  v_profile jsonb;
  v_prefs jsonb;

  v_library_total int;
  v_library_by_status jsonb;

  v_lists jsonb;
  v_recent_library jsonb;
  v_recent_likes jsonb;
  v_goals jsonb;

  v_lists_count int;
  v_likes_count int;
begin
  v_uid := auth.uid();
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  end if;

  v_limit := greatest(1, least(20, coalesce(p_limit, 8)));

  select jsonb_build_object(
      'id', p.id,
      'username', p.username,
      'displayName', p.display_name,
      'avatarUrl', p.avatar_url,
      'bio', p.bio
    )
    into v_profile
  from public.profiles p
  where p.id = v_uid;

  select jsonb_build_object(
      'enabled', ap.enabled,
      'proactivityLevel', ap.proactivity_level,
      'updatedAt', ap.updated_at
    )
    into v_prefs
  from public.assistant_prefs ap
  where ap.user_id = v_uid;

  if v_prefs is null then
    v_prefs := jsonb_build_object('enabled', false, 'proactivityLevel', 0);
  end if;

  select
    coalesce(sum(cnt), 0)::int,
    coalesce(jsonb_object_agg(status, cnt), '{}'::jsonb)
    into v_library_total, v_library_by_status
  from (
    select le.status::text as status, count(*)::int as cnt
    from public.library_entries le
    where le.user_id = v_uid
    group by le.status
  ) s;

  select count(*)::int into v_lists_count
  from public.lists
  where user_id = v_uid;

  select count(*)::int into v_likes_count
  from public.media_events
  where user_id = v_uid and event_type = 'like';

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', l.id,
        'name', l.name,
        'isPublic', l.is_public,
        'updatedAt', l.updated_at
      )
      order by l.updated_at desc
    ),
    '[]'::jsonb
  )
  into v_lists
  from (
    select id, name, is_public, updated_at
    from public.lists
    where user_id = v_uid
    order by updated_at desc
    limit v_limit
  ) l;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'titleId', le.title_id,
        'status', le.status,
        'updatedAt', le.updated_at,
        'title', coalesce(mi.tmdb_title, mi.tmdb_name, mi.omdb_title),
        'poster', coalesce(mi.tmdb_poster_path, mi.omdb_poster),
        'kind', mi.kind
      )
      order by le.updated_at desc
    ),
    '[]'::jsonb
  )
  into v_recent_library
  from (
    select title_id, status, updated_at
    from public.library_entries
    where user_id = v_uid
    order by updated_at desc
    limit v_limit
  ) le
  left join public.media_items mi on mi.id = le.title_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'titleId', e.media_item_id,
        'createdAt', e.created_at,
        'kind', mi.kind,
        'title', coalesce(mi.tmdb_title, mi.tmdb_name, mi.omdb_title),
        'poster', coalesce(mi.tmdb_poster_path, mi.omdb_poster)
      )
      order by e.created_at desc
    ),
    '[]'::jsonb
  )
  into v_recent_likes
  from (
    select media_item_id, created_at
    from public.media_events
    where user_id = v_uid and event_type = 'like'
    order by created_at desc
    limit v_limit
  ) e
  left join public.media_items mi on mi.id = e.media_item_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', g.id,
        'kind', g.kind,
        'title', g.title,
        'description', g.description,
        'status', g.status,
        'startAt', g.start_at,
        'endAt', g.end_at,
        'progressCount', gs.progress_count,
        'targetCount', gs.target_count,
        'lastEventAt', gs.last_event_at
      )
      order by g.updated_at desc
    ),
    '[]'::jsonb
  )
  into v_goals
  from public.assistant_goals g
  left join public.assistant_goal_state gs on gs.goal_id = g.id
  where g.user_id = v_uid and g.status = 'active'
  order by g.updated_at desc
  limit 5;

  return jsonb_build_object(
    'ok', true,
    'profile', coalesce(v_profile, '{}'::jsonb),
    'prefs', coalesce(v_prefs, '{}'::jsonb),
    'stats', jsonb_build_object(
      'libraryTotal', coalesce(v_library_total, 0),
      'libraryByStatus', coalesce(v_library_by_status, '{}'::jsonb),
      'listsCount', coalesce(v_lists_count, 0),
      'likesCount', coalesce(v_likes_count, 0)
    ),
    'lists', coalesce(v_lists, '[]'::jsonb),
    'recentLibrary', coalesce(v_recent_library, '[]'::jsonb),
    'recentLikes', coalesce(v_recent_likes, '[]'::jsonb),
    'activeGoals', coalesce(v_goals, '[]'::jsonb)
  );
end;
$$;

revoke all on function public.assistant_ctx_snapshot_v1(int) from public;
grant execute on function public.assistant_ctx_snapshot_v1(int) to authenticated;
grant execute on function public.assistant_ctx_snapshot_v1(int) to service_role;
