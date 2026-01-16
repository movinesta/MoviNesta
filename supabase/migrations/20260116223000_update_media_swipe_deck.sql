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

  -- accept: null, 'movie', or 'movie,series' (comma-separated)
  v_kind_filter text := nullif(lower(coalesce(p_kind_filter, '')), '');
  v_kind_filters text[];  -- derived from v_kind_filter

  v_limit int := greatest(1, least(120, coalesce(p_limit, 60)));

  -- Seed (computed after auth check)
  v_seed text;

  -- vectors
  v_session_vec vector;
  v_user_vec vector;
  v_has_vec boolean := false;

  -- session recency weight
  v_session_updated timestamptz;
  v_session_age_seconds double precision := 1e9;
  v_session_weight double precision := 0.0;

  -- diversity caps (soft constraints)
  v_genre_cap int := greatest(2, ceil(v_limit * 0.35)::int);
  v_collection_cap int := 2;

  -- why helpers
  v_recent_like_id uuid;
  v_recent_like_title text;

  -- cold-start detection (POSITIVE signals, not “any event”)
  v_has_any_events boolean := false;
begin
  if v_user_id is null then
    return;
  end if;

  -- seed: allow caller; else stable daily seed (user_id + YYYY-MM-DD UTC)
  v_seed := coalesce(
    nullif(p_seed, ''),
    ('daily:' || v_user_id::text || ':' || to_char((now() at time zone 'utc')::date, 'YYYY-MM-DD'))
  );

  -- kind filters array (supports CSV)
  if v_kind_filter is not null then
    v_kind_filters := regexp_split_to_array(v_kind_filter, '\s*,\s*');
  else
    v_kind_filters := null;
  end if;

  -- Active embedding profile
  select active_provider, active_model, active_dimensions, active_task
    into v_provider, v_model, v_dims, v_task
  from public.embedding_settings
  where id = 1;


  -- Muted genres (user control / safety). Empty means no filtering.
  -- Refactored: read from user_preferences.recsys->mutedGenres
  select coalesce(
      (select array_agg(x) from jsonb_array_elements_text(up.recsys->'mutedGenres') x),
      '{}'::text[]
    )
    into v_muted_genres
  from public.user_preferences up
  where up.user_id = v_user_id;


  -- Any POSITIVE events?
  select exists(
    select 1
    from public.media_events e
    where e.user_id = v_user_id
      and e.created_at > now() - interval '120 days'
      and (
        e.event_type::text='like'
        or (e.event_type::text='watchlist' and e.in_watchlist=true)
        or (e.event_type::text='rating' and e.rating_0_10>=7)
        or (e.event_type::text='dwell' and e.dwell_ms>=6000)
        or (e.event_type::text='detail_open')
      )
    limit 1
  ) into v_has_any_events;

  -- session vector
  select sv.taste, sv.updated_at
    into v_session_vec, v_session_updated
  from public.media_session_vectors sv
  where sv.user_id=v_user_id
    and sv.session_id=p_session_id
    and sv.provider=v_provider and sv.model=v_model and sv.dimensions=v_dims and sv.task=v_task
  order by sv.updated_at desc
  limit 1;

  if v_session_updated is not null then
    v_session_age_seconds := extract(epoch from (now() - v_session_updated));
    -- half-life ~45 minutes
    v_session_weight := exp(-v_session_age_seconds / (45*60.0));
  end if;

  -- user vector
  select uv.taste
    into v_user_vec
  from public.media_user_vectors uv
  where uv.user_id=v_user_id
    and uv.provider=v_provider and uv.model=v_model and uv.dimensions=v_dims and uv.task=v_task
  order by uv.updated_at desc
  limit 1;

  v_has_vec := (v_user_vec is not null) or (v_session_vec is not null)
               or exists(
                 select 1 from public.media_user_centroids c
                 where c.user_id=v_user_id
                   and c.provider=v_provider and c.model=v_model and c.dimensions=v_dims and c.task=v_task
               );

  -- relaxed "recent positive" for explanations
  select e.media_item_id
    into v_recent_like_id
  from public.media_events e
  where e.user_id=v_user_id
    and e.created_at > now() - interval '30 days'
    and (
      e.event_type::text='like'
      or (e.event_type::text='watchlist' and e.in_watchlist=true)
      or (e.event_type::text='rating' and e.rating_0_10>=7)
      or (e.event_type::text='dwell' and e.dwell_ms>=6000)
      or (e.event_type::text='detail_open')
    )
  order by e.created_at desc
  limit 1;

  if v_recent_like_id is not null then
    select coalesce(mi.tmdb_title, mi.tmdb_name, mi.omdb_title)
      into v_recent_like_title
    from public.media_items mi
    where mi.id=v_recent_like_id;
  end if;

  ---------------------------------------------------------------------------
  -- temp tables
  ---------------------------------------------------------------------------
  create temporary table if not exists _cand (
    media_item_id uuid primary key,
    source text not null,
    score double precision not null,
    jit double precision not null,
    final_score double precision not null,
    primary_genre text,
    collection_id text,
    friend_ids uuid[],
    anchor_media_id uuid,
    anchor_title text
  ) on commit drop;
  truncate table _cand;

  create temporary table if not exists _take (
    media_item_id uuid primary key,
    source text not null,
    final_score double precision not null,
    primary_genre text,
    collection_id text,
    friend_ids uuid[],
    anchor_title text
  ) on commit drop;
  truncate table _take;

  create temporary table if not exists _picked (
    pos int primary key,
    media_item_id uuid not null,
    source text not null,
    final_score double precision not null,
    friend_ids uuid[],
    anchor_title text
  ) on commit drop;
  truncate table _picked;

  create temporary table if not exists _seen24h (media_item_id uuid primary key) on commit drop;
  truncate table _seen24h;

  insert into _seen24h(media_item_id)
  select x.media_item_id
  from (
    select mf.media_item_id
    from public.media_feedback mf
    where mf.user_id = v_user_id
      and mf.last_impression_at is not null
      and mf.last_impression_at > now() - interval '24 hours'

    union

    select e.media_item_id
    from public.media_events e
    where e.user_id = v_user_id
      and e.created_at > now() - interval '24 hours'
      and e.event_type in (
        'impression'::public.media_event_type,
        'dwell'::public.media_event_type,
        'skip'::public.media_event_type,
        'detail_open'::public.media_event_type,
        'detail_close'::public.media_event_type,
        'like'::public.media_event_type,
        'dislike'::public.media_event_type
      )
  ) x
  on conflict (media_item_id) do nothing;

  create temporary table if not exists _blocked (media_item_id uuid primary key) on commit drop;
  truncate table _blocked;

  -- block only strong negatives
  insert into _blocked(media_item_id)
  select x.media_item_id
  from (
    select mf.media_item_id
    from public.media_feedback mf
    where mf.user_id = v_user_id
      and (
        mf.last_action::text = 'dislike'
        or coalesce(mf.negative_ema,0) >= 0.95
      )

    union

    select e.media_item_id
    from public.media_events e
    where e.user_id = v_user_id
      and e.created_at > now() - interval '365 days'
      and (
        e.event_type = 'dislike'::public.media_event_type
        or (e.event_type::text='rating' and e.rating_0_10 is not null and e.rating_0_10 <= 3)
      )
  ) x
  on conflict (media_item_id) do nothing;

  create temporary table if not exists _served30m (media_item_id uuid primary key) on commit drop;
  truncate table _served30m;

  insert into _served30m(media_item_id)
  select ms.media_item_id
  from public.media_served ms
  where ms.user_id = v_user_id
    and ms.served_at > now() - interval '30 minutes'
  on conflict (media_item_id) do nothing;

  ---------------------------------------------------------------------------
  -- Candidate construction
  ---------------------------------------------------------------------------
  with
  params as (
    select v_mode as mode, v_kind_filters as kind_filters, v_seed as seed, v_has_vec as has_vec
  ),

  cents as (
    select taste
    from public.media_user_centroids c
    where c.user_id=v_user_id
      and c.provider=v_provider and c.model=v_model and c.dimensions=v_dims and c.task=v_task
    order by c.centroid asc
    limit 3
  ),

  -- POS anchors
  pos_anchors as (
    select
      e.media_item_id as anchor_id,
      me.embedding as anchor_emb,
      e.created_at
    from public.media_events e
    join public.media_embeddings me on me.media_item_id = e.media_item_id
    where e.user_id = v_user_id
      and e.created_at > now() - interval '120 days'
      and (
        e.event_type::text='like'
        or (e.event_type::text='watchlist' and e.in_watchlist=true)
        or (e.event_type::text='rating' and e.rating_0_10>=7)
        or (e.event_type::text='dwell' and e.dwell_ms>=6000)
        or (e.event_type::text='detail_open')
      )
      and me.provider=v_provider and me.model=v_model and me.dimensions=v_dims and me.task=v_task
      and not exists (select 1 from _blocked b where b.media_item_id = e.media_item_id)
    order by e.created_at desc
    limit 10
  ),

  anchor_neighbors_raw as (
    select
      n.media_item_id,
      n.anchor_id,
      n.sim
    from pos_anchors a
    cross join lateral (
      select
        a.anchor_id,
        me2.media_item_id,
        (1 - (me2.embedding <=> a.anchor_emb))::double precision as sim
      from public.media_embeddings me2
      where me2.provider=v_provider and me2.model=v_model and me2.dimensions=v_dims and me2.task=v_task
        and me2.media_item_id <> a.anchor_id
        and not exists (select 1 from _blocked b where b.media_item_id = me2.media_item_id)
      order by me2.embedding <=> a.anchor_emb
      limit (v_limit * 20)
    ) n
  ),

  anchor_neighbors as (
    select
      r.media_item_id,
      max(r.sim) as score,
      (array_agg(r.anchor_id order by r.sim desc))[1] as best_anchor_id
    from anchor_neighbors_raw r
    group by r.media_item_id
    order by score desc
    limit (v_limit * 60)
  ),

  anchor_neighbors_labeled as (
    select
      an.media_item_id,
      an.score,
      an.best_anchor_id as anchor_media_id,
      coalesce(mi.tmdb_title, mi.tmdb_name, mi.omdb_title) as anchor_title
    from anchor_neighbors an
    left join public.media_items mi on mi.id = an.best_anchor_id
  ),

  -- centroid/session/user fallback (only if anchors empty)
  session_neighbors as (
    select
      e.media_item_id,
      ((1 - (e.embedding <=> v_session_vec)) * v_session_weight)::double precision as score
    from public.media_embeddings e, params p
    where p.has_vec
      and v_session_vec is not null
      and e.provider=v_provider and e.model=v_model and e.dimensions=v_dims and e.task=v_task
      and not exists (select 1 from _blocked b where b.media_item_id=e.media_item_id)
    order by e.embedding <=> v_session_vec
    limit (v_limit * 30)
  ),

  user_neighbors as (
    select
      e.media_item_id,
      (1 - (e.embedding <=> v_user_vec))::double precision as score
    from public.media_embeddings e, params p
    where p.has_vec
      and v_user_vec is not null
      and e.provider=v_provider and e.model=v_model and e.dimensions=v_dims and e.task=v_task
      and not exists (select 1 from _blocked b where b.media_item_id=e.media_item_id)
    order by e.embedding <=> v_user_vec
    limit (v_limit * 30)
  ),

  centroid_neighbors_raw as (
    select
      n.media_item_id,
      n.sim
    from cents c
    cross join lateral (
      select
        me2.media_item_id,
        (1 - (me2.embedding <=> c.taste))::double precision as sim
      from public.media_embeddings me2, params p
      where p.has_vec
        and me2.provider=v_provider and me2.model=v_model and me2.dimensions=v_dims and me2.task=v_task
        and not exists (select 1 from _blocked b where b.media_item_id = me2.media_item_id)
      order by me2.embedding <=> c.taste
      limit (v_limit * 20)
    ) n
  ),

  centroid_neighbors as (
    select
      r.media_item_id,
      max(r.sim) as score
    from centroid_neighbors_raw r
    group by r.media_item_id
    order by score desc
    limit (v_limit * 40)
  ),

  for_you_centroid_candidates as (
    select * from session_neighbors
    union all select * from user_neighbors
    union all select * from centroid_neighbors
  ),

  for_you_centroid as (
    select
      c.media_item_id,
      max(c.score)::double precision as score
    from for_you_centroid_candidates c
    group by c.media_item_id
    order by score desc
    limit (v_limit * 30)
  ),

  -- cold-start for_you (learning): only if user has no POSITIVE events AND no vectors
  for_you_learning as (
    select
      mi.id as media_item_id,
      (
        coalesce(mi.tmdb_popularity,0)::double precision * 0.65
        + coalesce(mi.tmdb_vote_average,0)::double precision * 8.0
        + 0.15 * (
          (((hashtext(v_seed || mi.id::text))::bigint % 100000 + 100000) % 100000)::double precision / 100000.0
        )
      ) as score
    from public.media_items mi
    where (not v_has_any_events)
      and (not v_has_vec)
      and coalesce(mi.completeness,1.0) >= 0.25
      and (v_kind_filters is null or lower(mi.kind::text) = any (v_kind_filters))
      and mi.id not in (select media_item_id from _blocked)
    order by score desc
    limit (v_limit * 50)
  ),

  -- Trending vs Popular
  trending_recent as (
    select
      t.media_item_id,
      (t.score_72h * exp(-extract(epoch from (now() - t.computed_at)) / (18*3600.0)))::double precision as score
    from public.media_trending_scores t
    join public.media_items mi on mi.id=t.media_item_id
    where not exists (select 1 from _blocked b where b.media_item_id=t.media_item_id)
      and coalesce(mi.tmdb_release_date, mi.tmdb_first_air_date) >= ((now()::date - interval '6 months')::date)
    order by score desc
    limit (v_limit * 30)
  ),

  popular_catalog as (
    select
      t.media_item_id,
      (t.score_72h * exp(-extract(epoch from (now() - t.computed_at)) / (24*3600.0)) * 0.55)::double precision as score
    from public.media_trending_scores t
    join public.media_items mi on mi.id=t.media_item_id
    where not exists (select 1 from _blocked b where b.media_item_id=t.media_item_id)
      and coalesce(mi.tmdb_release_date, mi.tmdb_first_air_date) < ((now()::date - interval '6 months')::date)
    order by score desc
    limit (v_limit * 10)
  ),

  -- Friends
  friend_events as (
    select
      e.media_item_id,
      e.user_id as friend_id,
      e.created_at,
      case
        when e.event_type::text='like' then 2.0
        when e.event_type::text='watchlist' and e.in_watchlist=true then 1.6
        when e.event_type::text='rating' and e.rating_0_10>=7 then 1.2
        when e.event_type::text='dwell' and e.dwell_ms>=6000 then 0.8
        else 0.0
      end as w
    from public.follows f
    join public.media_events e on e.user_id=f.followed_id
    where f.follower_id=v_user_id
      and e.created_at > now() - interval '45 days'
      and e.event_type::text in ('like','watchlist','rating','dwell')
  ),

  friends as (
    select
      fe.media_item_id,
      sum(fe.w * exp(-extract(epoch from (now()-fe.created_at))/(7*24*3600.0)))::double precision as score,
      array_agg(distinct fe.friend_id) as friend_ids
    from friend_events fe
    where fe.w > 0
      and not exists (select 1 from _blocked b where b.media_item_id=fe.media_item_id)
    group by fe.media_item_id
    order by score desc
    limit (v_limit * 30)
  ),

  -- For-you pool
  for_you_pool as (
    select
      anl.media_item_id, anl.score, 'for_you'::text as source,
      null::uuid[] as friend_ids, anl.anchor_media_id, anl.anchor_title
    from anchor_neighbors_labeled anl

    union all

    select
      fyc.media_item_id, (fyc.score * 0.95) as score, 'for_you'::text as source,
      null::uuid[] as friend_ids, null::uuid as anchor_media_id, null::text as anchor_title
    from for_you_centroid fyc

    union all

    select
      fl.media_item_id, (fl.score * 0.8) as score, 'for_you'::text as source,
      null::uuid[] as friend_ids, null::uuid as anchor_media_id, null::text as anchor_title
    from for_you_learning fl
  )

  -- Insert candidates
  insert into _cand(media_item_id, source, score, jit, final_score, friend_ids, anchor_media_id, anchor_title)
  select
    x.media_item_id,
    x.source,
    x.score,
    0.0 as jit,
    x.score as final_score,
    x.friend_ids,
    x.anchor_media_id,
    x.anchor_title
  from (
    -- Mode-specific logic
    select * from for_you_pool where v_mode in ('for_you', 'combined')

    union all

    select media_item_id, score, 'trending'::text, null::uuid[], null::uuid, null::text
    from trending_recent
    where v_mode in ('trending', 'combined')

    union all

    select media_item_id, score, 'trending'::text, null::uuid[], null::uuid, null::text
    from popular_catalog
    where v_mode in ('trending', 'combined')

    union all

    select media_item_id, score, 'friends'::text, friend_ids, null::uuid, null::text
    from friends
    where v_mode in ('friends', 'combined')
  ) x
  where not exists (select 1 from _blocked b where b.media_item_id=x.media_item_id)
    and not exists (select 1 from _served30m s where s.media_item_id=x.media_item_id)
  on conflict (media_item_id) do update
    set score = greatest(_cand.score, excluded.score),
        source = case when excluded.score > _cand.score then excluded.source else _cand.source end,
        friend_ids = case when excluded.friend_ids is not null then excluded.friend_ids else _cand.friend_ids end;


  -- JIT random noise for freshness
  update _cand
  set jit = (
    (((hashtext(v_seed || media_item_id::text))::bigint % 100000 + 100000) % 100000)::double precision / 100000.0
  );

  -- Final score logic
  update _cand
  set final_score = case
      when source='for_you' then score + (jit * 0.05)
      when source='friends' then score + (jit * 0.05)
      else score + (jit * 0.15)
    end;

  -- Filter by kind
  if v_kind_filters is not null then
    delete from _cand c using public.media_items mi
    where c.media_item_id = mi.id
      and not (lower(mi.kind::text) = any(v_kind_filters));
  else
    -- if no filter, exclude 'episode' / 'other' to be safe
    delete from _cand c using public.media_items mi
    where c.media_item_id = mi.id
      and lower(mi.kind::text) in ('episode', 'other');
  end if;

  -- Filter by muted genres (best-effort soft filter)
  if array_length(v_muted_genres, 1) > 0 then
     -- This is expensive, so we only do it if mutated genres exist.
     delete from _cand c using public.media_items mi
     where c.media_item_id = mi.id
       and exists (
         select 1 from unnest(regexp_split_to_array(lower(coalesce(mi.omdb_genre,'')), '\s*,\s*')) t
         where t = any(v_muted_genres)
       );
  end if;


  -- Populate metadata
  update _cand
  set primary_genre = (regexp_split_to_array(mi.omdb_genre, ','))[1],
      collection_id = (mi.tmdb_belongs_to_collection ->> 'id')
  from public.media_items mi
  where _cand.media_item_id = mi.id;


  -- Take top N
  insert into _take (media_item_id, source, final_score, primary_genre, collection_id, friend_ids, anchor_title)
  select media_item_id, source, final_score, primary_genre, collection_id, friend_ids, anchor_title
  from _cand
  order by final_score desc
  limit (v_limit * 3);


  -- Diversity selection (simple greedy MM with collection/genre caps)
  declare
    _r record;
    _taken_ids uuid[] := '{}';
    _genre_counts jsonb := '{}'::jsonb;
    _coll_counts jsonb := '{}'::jsonb;
    _g text;
    _c text;
    _ok boolean;
    _pass int := 0;
  begin
    for _r in (select * from _take order by final_score desc) loop
      if array_length(_taken_ids,1) >= v_limit then exit; end if;

      _ok := true;
      _g := lower(coalesce(_r.primary_genre, 'unknown'));
      _c := _r.collection_id;

      if (_genre_counts->>_g)::int >= v_genre_cap then _ok := false; end if;
      if _c is not null and (_coll_counts->>_c)::int >= v_collection_cap then _ok := false; end if;

      if _ok then
        insert into _picked(pos, media_item_id, source, final_score, friend_ids, anchor_title)
        values (array_length(_taken_ids,1)+1, _r.media_item_id, _r.source, _r.final_score, _r.friend_ids, _r.anchor_title);

        _taken_ids := _taken_ids || _r.media_item_id;
        _genre_counts := jsonb_set(_genre_counts, array[_g], ((coalesce(_genre_counts->>_g, '0')::int + 1)::text)::jsonb);
        if _c is not null then
          _coll_counts := jsonb_set(_coll_counts, array[_c], ((coalesce(_coll_counts->>_c, '0')::int + 1)::text)::jsonb);
        end if;
      end if;
    end loop;

    -- Fill if under limit
    if array_length(_taken_ids,1) < v_limit then
      for _r in (select * from _take where not (media_item_id = any(_taken_ids)) order by final_score desc) loop
        if array_length(_taken_ids,1) >= v_limit then exit; end if;
        insert into _picked(pos, media_item_id, source, final_score, friend_ids, anchor_title)
        values (array_length(_taken_ids,1)+1, _r.media_item_id, _r.source, _r.final_score, _r.friend_ids, _r.anchor_title);
        _taken_ids := _taken_ids || _r.media_item_id;
      end loop;
    end if;
  end;


  -- Return final result
  return query
  select
    mi.id as media_item_id,
    coalesce(mi.tmdb_title, mi.tmdb_name, mi.omdb_title) as title,
    coalesce(mi.tmdb_overview, mi.omdb_plot) as overview,
    mi.kind,
    mi.tmdb_release_date as release_date,
    mi.tmdb_first_air_date as first_air_date,
    mi.omdb_runtime,
    mi.tmdb_poster_path as poster_path,
    mi.tmdb_backdrop_path as backdrop_path,
    mi.tmdb_vote_average as vote_average,
    mi.tmdb_vote_count as vote_count,
    mi.tmdb_popularity as popularity,
    mi.completeness,
    p.source,
    case
      when p.source='friends' then 'Recommended by friends'
      when p.source='trending' then 'Trending on MoviNesta'
      when p.source='for_you' and p.anchor_title is not null then 'Because you liked ' || p.anchor_title
      else 'Recommended for you'
    end as why,
    p.friend_ids
  from _picked p
  join public.media_items mi on mi.id = p.media_item_id
  order by p.pos asc;

end;
$function$
;
