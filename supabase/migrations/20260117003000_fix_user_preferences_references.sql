BEGIN;

CREATE OR REPLACE FUNCTION public.can_view_profile(target_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    SET row_security TO 'off'
    AS $$
declare
  v_privacy public.privacy_level;
  v_viewer uuid;
begin
  v_viewer := auth.uid();

  -- Owner can always view self
  if v_viewer is not null and v_viewer = target_user_id then
    return true;
  end if;

  -- Read the target user's privacy setting (bypasses user_preferences RLS because row_security=off)
  select coalesce((up.settings->>'privacy_profile')::public.privacy_level, 'public'::public.privacy_level)
    into v_privacy
  from public.user_preferences up
  where up.user_id = target_user_id;

  -- No preferences row => default to public visibility
  if v_privacy is null then
    v_privacy := 'public'::public.privacy_level;
  end if;

  -- Public => visible to anyone (including anon)
  if v_privacy = 'public'::public.privacy_level then
    return true;
  end if;

  -- Followers-only => visible only if viewer follows target
  if v_privacy = 'followers_only'::public.privacy_level then
    if v_viewer is null then
      return false;
    end if;

    return exists (
      select 1
      from public.follows f
      where f.follower_id = v_viewer
        and f.followed_id = target_user_id
    );
  end if;

  -- Private => not visible
  return false;
end;
$$;

CREATE OR REPLACE FUNCTION public.get_home_feed_v2(p_user_id uuid, p_limit integer DEFAULT 40, p_cursor_created_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_cursor_id uuid DEFAULT NULL::uuid) RETURNS TABLE(id uuid, created_at timestamp with time zone, user_id uuid, event_type public.activity_event_type, media_item_id uuid, related_user_id uuid, payload jsonb, actor_profile jsonb, media_item jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    SET row_security TO 'off'
    AS $_$
declare
  effective_limit integer := least(coalesce(p_limit, 40), 200);
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'Not authorized';
  end if;

  return query
  with base as (
    select
      e.*,
      coalesce(
        e.media_item_id,
        (case
          when e.title_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
            then e.title_id::uuid
          else null
        end)
      ) as effective_media_item_id
    from public.activity_events e
    left join public.user_preferences up on up.user_id = e.user_id
    left join public.follows f
      on f.follower_id = p_user_id
     and f.followed_id = e.user_id
    where
      (
        e.user_id = p_user_id
        or f.followed_id is not null
      )
      and (
        e.user_id = p_user_id
        or coalesce((up.settings->>'privacy_profile')::public.privacy_level, 'public'::public.privacy_level) = 'public'::public.privacy_level
        or (
          coalesce((up.settings->>'privacy_profile')::public.privacy_level, 'public'::public.privacy_level) = 'followers_only'::public.privacy_level
          and f.followed_id is not null
        )
      )
      and (
        p_cursor_created_at is null
        or (e.created_at, e.id) < (
          p_cursor_created_at,
          coalesce(p_cursor_id, '00000000-0000-0000-0000-000000000000'::uuid)
        )
      )
    order by e.created_at desc, e.id desc
    limit effective_limit + 1
  )
  select
    b.id,
    b.created_at,
    b.user_id,
    b.event_type,
    b.effective_media_item_id as media_item_id,
    b.related_user_id,
    b.payload,
    jsonb_build_object(
      'id', p.id,
      'display_name', p.display_name,
      'username', p.username,
      'avatar_url', p.avatar_url,
      'is_verified', p.is_verified,
      'verified_type', p.verified_type,
      'verified_label', p.verified_label,
      'verified_at', p.verified_at,
      'verified_by_org', p.verified_by_org
    ) as actor_profile,
    jsonb_build_object(
      'id', mi.id,
      'kind', mi.kind,
      'tmdb_title', mi.tmdb_title,
      'tmdb_name', mi.tmdb_name,
      'tmdb_original_title', mi.tmdb_original_title,
      'tmdb_original_name', mi.tmdb_original_name,
      'tmdb_poster_path', mi.tmdb_poster_path,
      'tmdb_backdrop_path', mi.tmdb_backdrop_path,
      'tmdb_original_language', mi.tmdb_original_language,
      'tmdb_release_date', mi.tmdb_release_date,
      'tmdb_first_air_date', mi.tmdb_first_air_date,
      'omdb_title', mi.omdb_title,
      'omdb_year', mi.omdb_year,
      'omdb_poster', mi.omdb_poster,
      'omdb_rated', mi.omdb_rated,
      'omdb_imdb_rating', mi.omdb_imdb_rating,
      'omdb_rating_rotten_tomatoes', mi.omdb_rating_rotten_tomatoes,
      'omdb_imdb_id', mi.omdb_imdb_id,
      'tmdb_id', mi.tmdb_id
    ) as media_item
  from base b
  join public.profiles_public p on p.id = b.user_id
  left join public.media_items mi on mi.id = b.effective_media_item_id
  order by b.created_at desc, b.id desc;
end;
$_$;

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  base_username  text;
  final_username text;
begin
  base_username := coalesce(nullif(split_part(new.email, '@', 1), ''), 'user');
  final_username := base_username || '_' || substr(new.id::text, 1, 8);

  insert into public.profiles (id, username, display_name, email)
  values (new.id, final_username, base_username, new.email)
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();

  -- These rows are REQUIRED for RLS visibility via profiles_public policies.
  insert into public.user_preferences (user_id, settings)
  values (new.id, jsonb_build_object('privacy_profile', 'public'))
  on conflict (user_id) do nothing;

  insert into public.user_stats (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

COMMIT;
