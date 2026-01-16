-- Phase 7: Deep Alignment Fixes
-- This migration fixes several RPCs and Views that were still referencing dropped tables or old structures.

BEGIN;

-----------------------------------------------------------------------
-- 1. Fix media_swipe_deck_v3_core (Use rec_impressions instead of media_served)
-----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.media_swipe_deck_v3_core(p_session_id uuid, p_limit integer, p_mode text, p_kind_filter text, p_seed text)
 RETURNS TABLE(media_item_id uuid, title text, overview text, kind text, release_date date, first_air_date date, omdb_runtime text, poster_path text, backdrop_path text, vote_average numeric, vote_count integer, popularity numeric, completeness numeric, source text, why text, friend_ids uuid[])
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
#variable_conflict use_column
declare
  v_user_id uuid := auth.uid();
  v_muted_genres text[] := '{}'::text[];
  v_provider text;
  v_model text;
  v_dims int;
  v_task text;
  v_mode text := lower(coalesce(p_mode, 'combined'));
  v_kind_filter text := nullif(lower(coalesce(p_kind_filter, '')), '');
  v_kind_filters text[];
  v_limit int := greatest(1, least(120, coalesce(p_limit, 60)));
  v_seed text;
  v_session_vec vector;
  v_user_vec vector;
  v_has_vec boolean := false;
  v_session_updated timestamptz;
  v_session_age_seconds double precision := 1e9;
  v_session_weight double precision := 0.0;
  v_genre_cap int := greatest(2, ceil(v_limit * 0.35)::int);
  v_collection_cap int := 2;
  v_recent_like_id uuid;
  v_recent_like_title text;
  v_has_any_events boolean := false;
begin
  if v_user_id is null then return; end if;

  v_seed := coalesce(nullif(p_seed, ''), ('daily:' || v_user_id::text || ':' || to_char((now() at time zone 'utc')::date, 'YYYY-MM-DD')));
  if v_kind_filter is not null then v_kind_filters := regexp_split_to_array(v_kind_filter, '\s*,\s*'); else v_kind_filters := null; end if;

  select active_provider, active_model, active_dimensions, active_task into v_provider, v_model, v_dims, v_task from public.embedding_settings where id = 1;
  select coalesce((select array_agg(x) from jsonb_array_elements_text(up.recsys->'mutedGenres') x), '{}'::text[]) into v_muted_genres from public.user_preferences up where up.user_id = v_user_id;

  select exists(select 1 from public.media_events e where e.user_id = v_user_id and e.created_at > now() - interval '120 days' and (e.event_type::text='like' or (e.event_type::text='watchlist' and e.in_watchlist=true) or (e.event_type::text='rating' and e.rating_0_10>=7) or (e.event_type::text='dwell' and e.dwell_ms>=6000) or (e.event_type::text='detail_open'))) into v_has_any_events;

  select sv.taste, sv.updated_at into v_session_vec, v_session_updated from public.media_session_vectors sv where sv.user_id=v_user_id and sv.session_id=p_session_id and sv.provider=v_provider and sv.model=v_model and sv.dimensions=v_dims and sv.task=v_task order by sv.updated_at desc limit 1;
  if v_session_updated is not null then v_session_age_seconds := extract(epoch from (now() - v_session_updated)); v_session_weight := exp(-v_session_age_seconds / (45*60.0)); end if;

  select uv.taste into v_user_vec from public.media_user_vectors uv where uv.user_id=v_user_id and uv.provider=v_provider and uv.model=v_model and uv.dimensions=v_dims and uv.task=v_task order by uv.updated_at desc limit 1;
  v_has_vec := (v_user_vec is not null) or (v_session_vec is not null) or exists(select 1 from public.media_user_centroids c where c.user_id=v_user_id and c.provider=v_provider and c.model=v_model and c.dimensions=v_dims and c.task=v_task);

  select e.media_item_id into v_recent_like_id from public.media_events e where e.user_id=v_user_id and e.created_at > now() - interval '30 days' and (e.event_type::text='like' or (e.event_type::text='watchlist' and e.in_watchlist=true) or (e.event_type::text='rating' and e.rating_0_10>=7) or (e.event_type::text='dwell' and e.dwell_ms>=6000) or (e.event_type::text='detail_open')) order by e.created_at desc limit 1;
  if v_recent_like_id is not null then select coalesce(mi.tmdb_title, mi.tmdb_name, mi.omdb_title) into v_recent_like_title from public.media_items mi where mi.id=v_recent_like_id; end if;

  create temporary table if not exists _cand (media_item_id uuid primary key, source text not null, score double precision not null, jit double precision not null, final_score double precision not null, primary_genre text, collection_id text, friend_ids uuid[], anchor_media_id uuid, anchor_title text) on commit drop;
  truncate table _cand;
  create temporary table if not exists _take (media_item_id uuid primary key, source text not null, final_score double precision not null, primary_genre text, collection_id text, friend_ids uuid[], anchor_title text) on commit drop;
  truncate table _take;
  create temporary table if not exists _picked (pos int primary key, media_item_id uuid not null, source text not null, final_score double precision not null, friend_ids uuid[], anchor_title text) on commit drop;
  truncate table _picked;
  create temporary table if not exists _seen24h (media_item_id uuid primary key) on commit drop;
  truncate table _seen24h;

  insert into _seen24h(media_item_id) select x.media_item_id from (select mf.media_item_id from public.media_feedback mf where mf.user_id = v_user_id and mf.last_impression_at is not null and mf.last_impression_at > now() - interval '24 hours' union select e.media_item_id from public.media_events e where e.user_id = v_user_id and e.created_at > now() - interval '24 hours' and e.event_type::text in ('impression','dwell','skip','detail_open','detail_close', 'like', 'dislike')) x on conflict (media_item_id) do nothing;

  create temporary table if not exists _blocked (media_item_id uuid primary key) on commit drop;
  truncate table _blocked;
  insert into _blocked(media_item_id) select x.media_item_id from (select mf.media_item_id from public.media_feedback mf where mf.user_id = v_user_id and (mf.last_action::text = 'dislike' or coalesce(mf.negative_ema,0) >= 0.95) union select e.media_item_id from public.media_events e where e.user_id = v_user_id and e.created_at > now() - interval '365 days' and (e.event_type = 'dislike'::public.media_event_type or (e.event_type::text='rating' and e.rating_0_10 is not null and e.rating_0_10 <= 3))) x on conflict (media_item_id) do nothing;

  create temporary table if not exists _served30m (media_item_id uuid primary key) on commit drop;
  truncate table _served30m;

  -- ALIGNMENT FIX: Use rec_impressions instead of the dropped media_served table
  insert into _served30m(media_item_id)
  select ri.media_item_id
  from public.rec_impressions ri
  where ri.user_id = v_user_id
    and ri.created_at > now() - interval '30 minutes'
  on conflict (media_item_id) do nothing;

  -- (Rest of the function logic remains the same as 20260116223000 but it must be fully defined)
  with params as (select v_mode as mode, v_kind_filters as kind_filters, v_seed as seed, v_has_vec as has_vec),
  cents as (select taste from public.media_user_centroids c where c.user_id=v_user_id and c.provider=v_provider and c.model=v_model and c.dimensions=v_dims and c.task=v_task order by c.centroid asc limit 3),
  pos_anchors as (select e.media_item_id as anchor_id, me.embedding as anchor_emb, e.created_at from public.media_events e join public.media_embeddings me on me.media_item_id = e.media_item_id where e.user_id = v_user_id and e.created_at > now() - interval '120 days' and (e.event_type::text='like' or (e.event_type::text='watchlist' and e.in_watchlist=true) or (e.event_type::text='rating' and e.rating_0_10>=7) or (e.event_type::text='dwell' and e.dwell_ms>=6000) or (e.event_type::text='detail_open')) and me.provider=v_provider and me.model=v_model and me.dimensions=v_dims and me.task=v_task and not exists (select 1 from _blocked b where b.media_item_id = e.media_item_id) order by e.created_at desc limit 10),
  anchor_neighbors_raw as (select n.media_item_id, n.anchor_id, n.sim from pos_anchors a cross join lateral (select a.anchor_id, me2.media_item_id, (1 - (me2.embedding <=> a.anchor_emb))::double precision as sim from public.media_embeddings me2 where me2.provider=v_provider and me2.model=v_model and me2.dimensions=v_dims and me2.task=v_task and me2.media_item_id <> a.anchor_id and not exists (select 1 from _blocked b where b.media_item_id = me2.media_item_id) order by me2.embedding <=> a.anchor_emb limit (v_limit * 20)) n),
  anchor_neighbors as (select r.media_item_id, max(r.sim) as score, (array_agg(r.anchor_id order by r.sim desc))[1] as best_anchor_id from anchor_neighbors_raw r group by r.media_item_id order by score desc limit (v_limit * 60)),
  anchor_neighbors_labeled as (select an.media_item_id, an.score, an.best_anchor_id as anchor_media_id, coalesce(mi.tmdb_title, mi.tmdb_name, mi.omdb_title) as anchor_title from anchor_neighbors an left join public.media_items mi on mi.id = an.best_anchor_id),
  session_neighbors as (select e.media_item_id, ((1 - (e.embedding <=> v_session_vec)) * v_session_weight)::double precision as score from public.media_embeddings e, params p where p.has_vec and v_session_vec is not null and e.provider=v_provider and e.model=v_model and e.dimensions=v_dims and e.task=v_task and not exists (select 1 from _blocked b where b.media_item_id=e.media_item_id) order by e.embedding <=> v_session_vec limit (v_limit * 30)),
  user_neighbors as (select e.media_item_id, (1 - (e.embedding <=> v_user_vec))::double precision as score from public.media_embeddings e, params p where p.has_vec and v_user_vec is not null and e.provider=v_provider and e.model=v_model and e.dimensions=v_dims and e.task=v_task and not exists (select 1 from _blocked b where b.media_item_id=e.media_item_id) order by e.embedding <=> v_user_vec limit (v_limit * 30)),
  centroid_neighbors_raw as (select n.media_item_id, n.sim from cents c cross join lateral (select me2.media_item_id, (1 - (me2.embedding <=> c.taste))::double precision as sim from public.media_embeddings me2, params p where p.has_vec and me2.provider=v_provider and me2.model=v_model and me2.dimensions=v_dims and me2.task=v_task and not exists (select 1 from _blocked b where b.media_item_id = me2.media_item_id) order by me2.embedding <=> c.taste limit (v_limit * 20)) n),
  centroid_neighbors as (select r.media_item_id, max(r.sim) as score from centroid_neighbors_raw r group by r.media_item_id order by score desc limit (v_limit * 40)),
  for_you_centroid_candidates as (select * from session_neighbors union all select * from user_neighbors union all select * from centroid_neighbors),
  for_you_centroid as (select c.media_item_id, max(c.score)::double precision as score from for_you_centroid_candidates c group by c.media_item_id order by score desc limit (v_limit * 30)),
  for_you_learning as (select mi.id as media_item_id, (coalesce(mi.tmdb_popularity,0)::double precision * 0.65 + coalesce(mi.tmdb_vote_average,0)::double precision * 8.0 + 0.15 * ((((hashtext(v_seed || mi.id::text))::bigint % 100000 + 100000) % 100000)::double precision / 100000.0)) as score from public.media_items mi where (not v_has_any_events) and (not v_has_vec) and coalesce(mi.completeness,1.0) >= 0.25 and (v_kind_filters is null or lower(mi.kind::text) = any (v_kind_filters)) and mi.id not in (select media_item_id from _blocked) order by score desc limit (v_limit * 50)),
  trending_recent as (select t.media_item_id, (t.score_72h * exp(-extract(epoch from (now() - t.computed_at)) / (18*3600.0)))::double precision as score from public.media_trending_scores t join public.media_items mi on mi.id=t.media_item_id where not exists (select 1 from _blocked b where b.media_item_id=t.media_item_id) and coalesce(mi.tmdb_release_date, mi.tmdb_first_air_date) >= ((now()::date - interval '6 months')::date) order by score desc limit (v_limit * 30)),
  popular_catalog as (select t.media_item_id, (t.score_72h * exp(-extract(epoch from (now() - t.computed_at)) / (24*3600.0)) * 0.55)::double precision as score from public.media_trending_scores t join public.media_items mi on mi.id=t.media_item_id where not exists (select 1 from _blocked b where b.media_item_id=t.media_item_id) and coalesce(mi.tmdb_release_date, mi.tmdb_first_air_date) < ((now()::date - interval '6 months')::date) order by score desc limit (v_limit * 10)),
  friend_events as (select e.media_item_id, e.user_id as friend_id, e.created_at, case when e.event_type::text='like' then 2.0 when e.event_type::text='watchlist' and e.in_watchlist=true then 1.6 when e.event_type::text='rating' and e.rating_0_10>=7 then 1.2 when e.event_type::text='dwell' and e.dwell_ms>=6000 then 0.8 else 0.0 end as w from public.follows f join public.media_events e on e.user_id=f.followed_id where f.follower_id=v_user_id and e.created_at > now() - interval '45 days' and e.event_type::text in ('like','watchlist','rating','dwell')),
  friends as (select fe.media_item_id, sum(fe.w * exp(-extract(epoch from (now()-fe.created_at))/(7*24*3600.0)))::double precision as score, array_agg(distinct fe.friend_id) as friend_ids from friend_events fe where fe.w > 0 and not exists (select 1 from _blocked b where b.media_item_id=fe.media_item_id) group by fe.media_item_id order by score desc limit (v_limit * 30)),
  for_you_pool as (select anl.media_item_id, anl.score, 'for_you'::text as source, null::uuid[] as friend_ids, anl.anchor_media_id, anl.anchor_title from anchor_neighbors_labeled anl union all select fyc.media_item_id, (fyc.score * 0.95) as score, 'for_you'::text as source, null::uuid[] as friend_ids, null::uuid as anchor_media_id, null::text as anchor_title from for_you_centroid fyc union all select fl.media_item_id, (fl.score * 0.8) as score, 'for_you'::text as source, null::uuid[] as friend_ids, null::uuid as anchor_media_id, null::text as anchor_title from for_you_learning fl)
  insert into _cand(media_item_id, source, score, jit, final_score, friend_ids, anchor_media_id, anchor_title)
  select x.media_item_id, x.source, x.score, 0.0 as jit, x.score as final_score, x.friend_ids, x.anchor_media_id, x.anchor_title from (select * from for_you_pool where v_mode in ('for_you', 'combined') union all select media_item_id, score, 'trending'::text, null::uuid[], null::uuid, null::text from trending_recent where v_mode in ('trending', 'combined') union all select media_item_id, score, 'trending'::text, null::uuid[], null::uuid, null::text from popular_catalog where v_mode in ('trending', 'combined') union all select media_item_id, score, 'friends'::text, friend_ids, null::uuid, null::text from friends where v_mode in ('friends', 'combined')) x
  where not exists (select 1 from _blocked b where b.media_item_id=x.media_item_id) and not exists (select 1 from _served30m s where s.media_item_id=x.media_item_id)
  on conflict (media_item_id) do update set score = greatest(_cand.score, excluded.score), source = case when excluded.score > _cand.score then excluded.source else _cand.source end, friend_ids = case when excluded.friend_ids is not null then excluded.friend_ids else _cand.friend_ids end;

  update _cand set jit = ((((hashtext(v_seed || media_item_id::text))::bigint % 100000 + 100000) % 100000)::double precision / 100000.0);
  update _cand set final_score = case when source='for_you' then score + (jit * 0.05) when source='friends' then score + (jit * 0.05) else score + (jit * 0.15) end;
  if v_kind_filters is not null then delete from _cand c using public.media_items mi where c.media_item_id = mi.id and not (lower(mi.kind::text) = any(v_kind_filters)); else delete from _cand c using public.media_items mi where c.media_item_id = mi.id and lower(mi.kind::text) in ('episode', 'other'); end if;
  if array_length(v_muted_genres, 1) > 0 then delete from _cand c using public.media_items mi where c.media_item_id = mi.id and exists (select 1 from unnest(regexp_split_to_array(lower(coalesce(mi.omdb_genre,'')), '\s*,\s*')) t where t = any(v_muted_genres)); end if;
  update _cand set primary_genre = (regexp_split_to_array(mi.omdb_genre, ','))[1], collection_id = (mi.tmdb_belongs_to_collection ->> 'id') from public.media_items mi where _cand.media_item_id = mi.id;
  insert into _take (media_item_id, source, final_score, primary_genre, collection_id, friend_ids, anchor_title)
  select media_item_id, source, final_score, primary_genre, collection_id, friend_ids, anchor_title
  from _cand
  order by final_score desc
  limit (v_limit * 3);

  declare
    _r record; _taken_ids uuid[] := '{}'; _genre_counts jsonb := '{}'::jsonb; _coll_counts jsonb := '{}'::jsonb; _g text; _c text; _ok boolean;
  begin
    for _r in (select * from _take order by final_score desc) loop
      if coalesce(array_length(_taken_ids,1), 0) >= v_limit then exit; end if;
      _ok := true; _g := lower(coalesce(_r.primary_genre, 'unknown')); _c := _r.collection_id;
      if (_genre_counts->>_g)::int >= v_genre_cap then _ok := false; end if;
      if _c is not null and (_coll_counts->>_c)::int >= v_collection_cap then _ok := false; end if;
      if _ok then
        insert into _picked(pos, media_item_id, source, final_score, friend_ids, anchor_title) values (coalesce(array_length(_taken_ids,1), 0)+1, _r.media_item_id, _r.source, _r.final_score, _r.friend_ids, _r.anchor_title);
        _taken_ids := _taken_ids || _r.media_item_id;
        _genre_counts := jsonb_set(_genre_counts, array[_g], ((coalesce(_genre_counts->>_g, '0')::int + 1)::text)::jsonb);
        if _c is not null then _coll_counts := jsonb_set(_coll_counts, array[_c], ((coalesce(_coll_counts->>_c, '0')::int + 1)::text)::jsonb); end if;
      end if;
    end loop;
    if coalesce(array_length(_taken_ids,1), 0) < v_limit then
      for _r in (select * from _take where not (media_item_id = any(_taken_ids)) order by final_score desc) loop
        if coalesce(array_length(_taken_ids,1), 0) >= v_limit then exit; end if;
        insert into _picked(pos, media_item_id, source, final_score, friend_ids, anchor_title) values (coalesce(array_length(_taken_ids,1), 0)+1, _r.media_item_id, _r.source, _r.final_score, _r.friend_ids, _r.anchor_title);
        _taken_ids := _taken_ids || _r.media_item_id;
      end loop;
    end if;
  end;

  return query select mi.id as media_item_id, coalesce(mi.tmdb_title, mi.tmdb_name, mi.omdb_title) as title, coalesce(mi.tmdb_overview, mi.omdb_plot) as overview, mi.kind::text as kind, mi.tmdb_release_date as release_date, mi.tmdb_first_air_date as first_air_date, mi.omdb_runtime, mi.tmdb_poster_path as poster_path, mi.tmdb_backdrop_path as backdrop_path, mi.tmdb_vote_average as vote_average, mi.tmdb_vote_count as vote_count, mi.tmdb_popularity as popularity, mi.completeness, p.source, case when p.source='friends' then 'Recommended by friends' when p.source='trending' then 'Trending on MoviNesta' when p.source='for_you' and p.anchor_title is not null then 'Because you liked ' || p.anchor_title else 'Recommended for you' end as why, p.friend_ids from _picked p join public.media_items mi on mi.id = p.media_item_id order by p.pos asc;
end;
$function$;

-----------------------------------------------------------------------
-- 2. Fix assistant_ctx_snapshot_v1 (Use assistant_goals columns)
-----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assistant_ctx_snapshot_v1(p_limit integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_profile jsonb;
  v_prefs jsonb;
  v_library_total int;
  v_library_by_status jsonb;
  v_lists_count int;
  v_likes_count int;
  v_lists jsonb;
  v_recent_library jsonb;
  v_recent_likes jsonb;
  v_goals jsonb;
  v_limit int := greatest(1, least(100, coalesce(p_limit, 20)));
begin
  if v_uid is null then return null; end if;

  select to_jsonb(p) into v_profile from public.profiles_public p where p.id = v_uid;
  select to_jsonb(up) into v_prefs from public.user_preferences up where up.user_id = v_uid;

  select count(*)::int into v_library_total from public.media_library where user_id = v_uid;
  select coalesce(jsonb_object_agg(status, cnt), '{}'::jsonb) into v_library_by_status from (select status, count(*)::int as cnt from public.media_library where user_id = v_uid group by status) s;
  select count(*)::int into v_lists_count from public.lists where user_id = v_uid;
  select count(*)::int into v_likes_count from public.media_events where user_id = v_uid and event_type = 'like';

  select coalesce(jsonb_agg(to_jsonb(l) - 'user_id'), '[]'::jsonb) into v_lists from (select * from public.lists where user_id = v_uid order by updated_at desc limit 10) l;

  select coalesce(jsonb_agg(jsonb_build_object('id', mi.id, 'title', coalesce(mi.tmdb_title, mi.omdb_title), 'status', ml.status, 'addedAt', ml.created_at)), '[]'::jsonb)
  into v_recent_library
  from (select media_item_id, status, created_at from public.media_library where user_id = v_uid order by created_at desc limit v_limit) ml
  join public.media_items mi on mi.id = ml.media_item_id;

  select coalesce(jsonb_agg(jsonb_build_object('id', mi.id, 'title', coalesce(mi.tmdb_title, mi.omdb_title), 'likedAt', e.created_at)), '[]'::jsonb)
  into v_recent_likes
  from (select media_item_id, created_at from public.media_events where user_id = v_uid and event_type = 'like' order by created_at desc limit v_limit) e
  join public.media_items mi on mi.id = e.media_item_id;

  -- ALIGNMENT FIX: Read from assistant_goals columns instead of assistant_goal_state
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
        'progressCount', g.progress_count,
        'targetCount', g.target_count,
        'lastEventAt', g.updated_at
      )
      order by g.updated_at desc
    ),
    '[]'::jsonb
  )
  into v_goals
  from public.assistant_goals g
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
$function$;

-----------------------------------------------------------------------
-- 3. Fix assistant_goal_refresh_state (Use assistant_goals columns)
-----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assistant_goal_refresh_state(p_goal_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  tcount int;
  pcount int;
begin
  select coalesce((g.meta->>'targetCount')::int, (g.meta->>'target_count')::int, 0)
    into tcount
  from public.assistant_goals g
  where g.id = p_goal_id;

  select count(*)::int
    into pcount
  from public.assistant_goal_events e
  where e.goal_id = p_goal_id
    and e.event_type = 'watched';

  -- ALIGNMENT FIX: Update assistant_goals directly
  UPDATE public.assistant_goals
  SET 
    target_count = coalesce(tcount, 0),
    progress_count = coalesce(pcount, 0),
    updated_at = now()
  WHERE id = p_goal_id;
end;
$function$;

-----------------------------------------------------------------------
-- 4. Fix assistant_health_snapshot_v1 (Use ops_alerts for failures)
-----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assistant_health_snapshot_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_now timestamptz := now();
  v_counts jsonb;
  v_by_kind jsonb;
  v_oldest_pending bigint;
  v_oldest_processing bigint;
  v_last24 jsonb;
  v_failures jsonb;
  v_ai_failures jsonb;
  v_cron jsonb;
BEGIN
  PERFORM public.assert_admin();

  SELECT COALESCE(jsonb_object_agg(status, cnt), '{}'::jsonb) INTO v_counts
  FROM (SELECT status, count(*)::int AS cnt FROM public.assistant_reply_jobs GROUP BY status) s;

  WITH k AS (
    SELECT job_kind, sum((status = 'pending')::int) AS pending, sum((status = 'processing')::int) AS processing, sum((status = 'done')::int) AS done, sum((status = 'failed')::int) AS failed, count(*)::int AS total
    FROM public.assistant_reply_jobs GROUP BY job_kind
  )
  SELECT COALESCE(jsonb_object_agg(job_kind, jsonb_build_object('pending', pending, 'processing', processing, 'done', done, 'failed', failed, 'total', total)), '{}'::jsonb)
  INTO v_by_kind FROM k;

  SELECT floor(extract(epoch from (v_now - min(created_at))))::bigint INTO v_oldest_pending FROM public.assistant_reply_jobs WHERE status = 'pending';
  SELECT floor(extract(epoch from (v_now - min(updated_at))))::bigint INTO v_oldest_processing FROM public.assistant_reply_jobs WHERE status = 'processing';

  SELECT jsonb_build_object('created', count(*)::int, 'done', sum((status = 'done')::int), 'failed', sum((status = 'failed')::int))
  INTO v_last24 FROM public.assistant_reply_jobs WHERE created_at >= (v_now - interval '24 hours');

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'conversationId', conversation_id, 'userId', user_id, 'jobKind', job_kind, 'attempts', attempts, 'updatedAt', updated_at, 'lastError', left(coalesce(last_error, ''), 220)) ORDER BY updated_at DESC), '[]'::jsonb)
  INTO v_failures FROM (SELECT * FROM public.assistant_reply_jobs WHERE status = 'failed' ORDER BY updated_at DESC LIMIT 20) f;

  -- ALIGNMENT FIX: Use ops_alerts instead of dropped assistant_failures table
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', id,
      'createdAt', created_at,
      'requestId', request_id,
      'userId', user_id,
      'code', code,
      'reason', message,
      'context', left(context::text, 500)
    )
    ORDER BY created_at DESC
  ), '[]'::jsonb)
  INTO v_ai_failures
  FROM (
    SELECT *
    FROM public.ops_alerts
    WHERE kind = 'assistant_failure'
      AND created_at >= (v_now - interval '72 hours')
    ORDER BY created_at DESC
    LIMIT 50
  ) af;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'job', job_name, 'requestId', request_id, 'createdAt', created_at) ORDER BY created_at DESC), '[]'::jsonb)
  INTO v_cron FROM (SELECT id, job_name, request_id, created_at FROM public.assistant_cron_requests ORDER BY created_at DESC LIMIT 25) c;

  RETURN jsonb_build_object(
    'ok', true,
    'ts', v_now,
    'counts', v_counts,
    'byKind', v_by_kind,
    'oldestPendingSec', COALESCE(v_oldest_pending, 0),
    'oldestProcessingSec', COALESCE(v_oldest_processing, 0),
    'last24h', COALESCE(v_last24, '{}'::jsonb),
    'recentFailures', v_failures,
    'recentAiFailures', COALESCE(v_ai_failures, '[]'::jsonb),
    'recentCron', v_cron
  );
END;
$function$;

-----------------------------------------------------------------------
-- 5. Fix RecSys Analysis Views (Use media_events instead of rec_outcomes)
-----------------------------------------------------------------------

-- rec_position_daily_metrics_v1
CREATE OR REPLACE VIEW public.rec_position_daily_metrics_v1 WITH (security_invoker='true') AS
 WITH imp AS (
         SELECT (date_trunc('day'::text, i.created_at))::date AS day,
            i.user_id,
            i.rec_request_id,
            i.media_item_id,
            i."position"
           FROM public.rec_impressions i
        ), outc AS (
         SELECT o_1.user_id,
            o_1.rec_request_id,
            o_1.media_item_id,
            o_1.event_type as outcome_type,
            o_1.created_at
           FROM public.media_events o_1
           WHERE o_1.rec_request_id IS NOT NULL
        )
 SELECT imp.day,
    imp."position",
    count(*) AS impressions,
    count(*) FILTER (WHERE (o.outcome_type::text = ANY (ARRAY['like'::text]))) AS likes,
    count(*) FILTER (WHERE (o.outcome_type::text = ANY (ARRAY['dislike'::text]))) AS dislikes,
    count(*) FILTER (WHERE (o.outcome_type::text IN ('watchlist_add'::text, 'watchlist'::text))) AS watchlist_adds,
    count(*) FILTER (WHERE (o.outcome_type::text IN ('detail_open'::text))) AS detail_opens,
    ((count(*) FILTER (WHERE (o.outcome_type::text = ANY (ARRAY['like'::text]))))::numeric / NULLIF((count(*))::numeric, (0)::numeric)) AS like_rate,
    ((count(*) FILTER (WHERE (o.outcome_type::text = ANY (ARRAY['dislike'::text]))))::numeric / NULLIF((count(*))::numeric, (0)::numeric)) AS dislike_rate
   FROM (imp
     LEFT JOIN LATERAL ( SELECT o_1.outcome_type
           FROM outc o_1
          WHERE ((o_1.user_id = imp.user_id) AND (o_1.rec_request_id = imp.rec_request_id) AND (o_1.media_item_id = imp.media_item_id) AND (o_1.created_at >= (imp.day)::timestamp with time zone) AND (o_1.created_at < ((imp.day)::timestamp with time zone + '1 day'::interval)))
          ORDER BY o_1.created_at
         LIMIT 1) o ON (true))
  GROUP BY imp.day, imp."position"
  ORDER BY imp.day DESC, imp."position";

-- rec_variant_daily_metrics_v1
CREATE OR REPLACE VIEW public.rec_variant_daily_metrics_v1 WITH (security_invoker='true') AS
 WITH impressions AS (
         SELECT (date_trunc('day'::text, i.created_at))::date AS day,
            i.id AS impression_id,
            i.user_id,
            i.rec_request_id,
            i.media_item_id,
            COALESCE((i.request_context -> 'experiments'::text), '{}'::jsonb) AS experiments
           FROM public.rec_impressions i
        ), expanded AS (
         SELECT impressions.day,
            impressions.impression_id,
            impressions.user_id,
            impressions.rec_request_id,
            impressions.media_item_id,
            e_1.key AS experiment_key,
            e_1.value AS variant
           FROM (impressions
             CROSS JOIN LATERAL jsonb_each_text(impressions.experiments) e_1(key, value))
        ), outcomes_agg AS (
         SELECT o_1.user_id,
            o_1.rec_request_id,
            o_1.media_item_id,
            bool_or((o_1.event_type::text IN ('detail_open'::text))) AS opened_detail,
            bool_or((o_1.event_type::text IN ('like'::text))) AS liked,
            bool_or((o_1.event_type::text IN ('dislike'::text))) AS disliked,
            bool_or((o_1.event_type::text IN ('watchlist_add'::text, 'watchlist'::text))) AS watchlist_add,
            bool_or((o_1.event_type::text IN ('rating'::text, 'rating_set'::text))) AS rated
           FROM public.media_events o_1
           WHERE o_1.rec_request_id IS NOT NULL
          GROUP BY o_1.user_id, o_1.rec_request_id, o_1.media_item_id
        )
 SELECT e.day,
    e.experiment_key,
    e.variant,
    count(*) AS impressions,
    count(DISTINCT e.user_id) AS users,
    count(*) FILTER (WHERE o.opened_detail) AS detail_opens,
    count(*) FILTER (WHERE o.liked) AS likes,
    count(*) FILTER (WHERE o.disliked) AS dislikes,
    count(*) FILTER (WHERE o.watchlist_add) AS watchlist_adds,
    count(*) FILTER (WHERE o.rated) AS ratings,
    ((count(*) FILTER (WHERE o.liked))::double precision / (NULLIF(count(*), 0))::double precision) AS like_rate,
    ((count(*) FILTER (WHERE o.watchlist_add))::double precision / (NULLIF(count(*), 0))::double precision) AS watchlist_add_rate
   FROM (expanded e
     LEFT JOIN outcomes_agg o ON (((o.user_id = e.user_id) AND (o.rec_request_id = e.rec_request_id) AND (o.media_item_id = e.media_item_id))))
  GROUP BY e.day, e.experiment_key, e.variant;

COMMIT;
