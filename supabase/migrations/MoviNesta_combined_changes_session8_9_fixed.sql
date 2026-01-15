-- MoviNesta Combined SQL (Sessions 8 + 9 Performance Hardening)
-- Generated: 2026-01-15
-- Purpose:
--  - Apply all DB performance, uniqueness, and RPC/function optimizations in ONE file.
--  - Safe to re-run (uses IF NOT EXISTS, CREATE OR REPLACE, and idempotent dedupe).
--
-- How to use:
--  1) Open Supabase Dashboard → SQL Editor
--  2) Paste this entire file and Run
--
-- Notes:
--  - This script will DELETE duplicate rows in:
--      * public.message_delivery_receipts (conversation_id, message_id, user_id)
--      * public.message_reactions (message_id, user_id, emoji)
--    This is intended and was approved pre-launch.
--
-- =====================================================================

-- Session 8: Performance hardening (pre-launch)
-- Date: 2026-01-15
-- Focus:
--  - Reduce hot RPC latency for media_swipe_deck_v3 by indexing media_user_centroids for profile + centroid lookup
--  - Make message delivery receipts idempotent (enables ON CONFLICT upsert path in the app)

-- 1) media_user_centroids: the swipe deck queries centroids by (user_id, provider, model, dimensions, task)
--    and orders by centroid asc (limit 3). Existing indexes don't cover that shape.
CREATE INDEX IF NOT EXISTS idx_media_user_centroids_profile_user_centroid
ON public.media_user_centroids (user_id, provider, model, dimensions, task, centroid);

-- 2) message_delivery_receipts: enable app-side upsert(onConflict=conversation_id,message_id,user_id).
--    We create a UNIQUE index if duplicates don't exist. If duplicates exist, we skip and log a NOTICE
--    so you can clean up and re-run.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT conversation_id, message_id, user_id, COUNT(*) AS c
      FROM public.message_delivery_receipts
      GROUP BY 1,2,3
      HAVING COUNT(*) > 1
      LIMIT 1
    ) d
  ) THEN
    RAISE NOTICE 'Skipping UNIQUE index for message_delivery_receipts(conversation_id,message_id,user_id): duplicates exist. Clean up and re-run.';
  ELSE
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS message_delivery_receipts_conv_msg_user_uniq ON public.message_delivery_receipts (conversation_id, message_id, user_id)';
  END IF;
END$$;

-- Optional: keep the old non-unique index (if any) as it doesn't hurt reads much, but you can drop it later
-- once you confirm the app is using ON CONFLICT successfully.

-- =====================================================================

-- Session 9: Pre-launch performance hardening + uniqueness enforcement
-- Date: 2026-01-15

-- 1) Deduplicate message_delivery_receipts by (conversation_id, message_id, user_id)
WITH ranked AS (
  SELECT
    ctid,
    row_number() OVER (
      PARTITION BY conversation_id, message_id, user_id
      ORDER BY delivered_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM public.message_delivery_receipts
)
DELETE FROM public.message_delivery_receipts d
USING ranked r
WHERE d.ctid = r.ctid
  AND r.rn > 1;

-- 2) Ensure a uniqueness guarantee exists for (conversation_id, message_id, user_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_index i
    WHERE i.indrelid = 'public.message_delivery_receipts'::regclass
      AND i.indisunique
      AND (
        SELECT array_agg(a.attname::text ORDER BY a.attname)
        FROM pg_attribute a
        WHERE a.attrelid = i.indrelid
          AND a.attnum = ANY(i.indkey)
      ) = ARRAY['conversation_id','message_id','user_id']::text[]
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS message_delivery_receipts_conv_msg_user_uniq ON public.message_delivery_receipts (conversation_id, message_id, user_id)';
  END IF;
END$$;

-- 3) Deduplicate message_reactions by (message_id, user_id, emoji)
WITH ranked AS (
  SELECT
    ctid,
    row_number() OVER (
      PARTITION BY message_id, user_id, emoji
      ORDER BY created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM public.message_reactions
)
DELETE FROM public.message_reactions d
USING ranked r
WHERE d.ctid = r.ctid
  AND r.rn > 1;

-- 4) Ensure a uniqueness guarantee exists for (message_id, user_id, emoji)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_index i
    WHERE i.indrelid = 'public.message_reactions'::regclass
      AND i.indisunique
      AND (
        SELECT array_agg(a.attname::text ORDER BY a.attname)
        FROM pg_attribute a
        WHERE a.attrelid = i.indrelid
          AND a.attnum = ANY(i.indkey)
      ) = ARRAY['emoji','message_id','user_id']::text[]
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS message_reactions_unique ON public.message_reactions (message_id, user_id, emoji)';
  END IF;
END$$;

-- 5) Home feed: support follower joins efficiently
CREATE INDEX IF NOT EXISTS follows_follower_followed_idx
ON public.follows (follower_id, followed_id);

-- 6) Optional: speed up vector NN search for the default active embedding profile.
--    If you change embedding_settings away from these defaults, this index won't be used (safe but optional).
-- Optional: HNSW index for a specific embedding profile (safe guard: skip if pgvector/HNSW not available)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    BEGIN
      EXECUTE $sql$
        CREATE INDEX IF NOT EXISTS media_embeddings_voyage_swipe_hnsw_cosine
        ON public.media_embeddings USING hnsw (embedding extensions.vector_cosine_ops)
        WHERE provider = 'voyage'
          AND model = 'voyage-3-large'
          AND dimensions = 1024
          AND task = 'swipe';
      $sql$;
    EXCEPTION
      WHEN undefined_object THEN
        RAISE NOTICE 'Skipping HNSW index media_embeddings_voyage_swipe_hnsw_cosine: missing access method/operator class.';
      WHEN feature_not_supported THEN
        RAISE NOTICE 'Skipping HNSW index media_embeddings_voyage_swipe_hnsw_cosine: feature not supported.';
    END;
  ELSE
    RAISE NOTICE 'Skipping HNSW index media_embeddings_voyage_swipe_hnsw_cosine: pgvector extension not installed.';
  END IF;
END$$;




-- Replace get_home_feed_v2 to avoid per-row can_view_profile() calls and include verification fields.
CREATE OR REPLACE FUNCTION public.get_home_feed_v2(
  p_user_id uuid,
  p_limit integer DEFAULT 40,
  p_cursor_created_at timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_cursor_id uuid DEFAULT NULL::uuid
) RETURNS TABLE(
  id uuid,
  created_at timestamp with time zone,
  user_id uuid,
  event_type public.activity_event_type,
  media_item_id uuid,
  related_user_id uuid,
  payload jsonb,
  actor_profile jsonb,
  media_item jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
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
    left join public.user_settings us on us.user_id = e.user_id
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
        or us.privacy_profile = 'public'::public.privacy_level
        or (us.privacy_profile = 'followers_only'::public.privacy_level and f.followed_id is not null)
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
$$;

CREATE OR REPLACE FUNCTION public.media_swipe_deck_v3_core(p_session_id uuid, p_limit integer, p_mode text, p_kind_filter text, p_seed text) RETURNS TABLE(media_item_id uuid, title text, overview text, kind text, release_date date, first_air_date date, omdb_runtime text, poster_path text, backdrop_path text, vote_average numeric, vote_count integer, popularity numeric, completeness numeric, source text, why text, friend_ids uuid[])
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
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
  select coalesce(p.muted_genres, '{}'::text[])
    into v_muted_genres
  from public.recsys_user_prefs p
  where p.user_id = v_user_id;

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
      fy.media_item_id, fy.score, 'for_you'::text as source,
      null::uuid[] as friend_ids, null::uuid, null::text
    from for_you_centroid fy
    where not exists (select 1 from anchor_neighbors_labeled)

    union all

    select
      fyl.media_item_id, fyl.score, 'for_you'::text as source,
      null::uuid[] as friend_ids, null::uuid, null::text
    from for_you_learning fyl
    where not exists (select 1 from anchor_neighbors_labeled)
      and not exists (select 1 from for_you_centroid)
  ),

  pool as (
    select * from for_you_pool
    union all select media_item_id, score, 'trending'::text, null::uuid[], null::uuid, null::text from trending_recent
    union all select media_item_id, score, 'popular'::text,  null::uuid[], null::uuid, null::text from popular_catalog
    union all select media_item_id, score, 'friends'::text,  friend_ids,  null::uuid, null::text from friends
  ),

  joined as (
    select
      p.media_item_id,
      p.score,
      p.source,
      p.friend_ids,
      p.anchor_media_id,
      p.anchor_title,
      mi.kind::text as kind,
      mi.completeness,
      (mi.tmdb_belongs_to_collection ->> 'id') as collection_id,
      (select min(g.slug)
       from public.media_genres tg
       join public.genres g on g.id=tg.genre_id
       where tg.media_item_id = p.media_item_id
      ) as primary_genre
    from pool p
    join public.media_items mi on mi.id=p.media_item_id
    where (v_kind_filters is null or lower(mi.kind::text) = any (v_kind_filters))
      and coalesce(mi.completeness,1.0) >= 0.20
      and (
        coalesce(array_length(v_muted_genres, 1), 0) = 0
        or not exists (
          select 1
          from public.media_genres mg
          join public.genres g on g.id = mg.genre_id
          where mg.media_item_id = p.media_item_id
            and g.slug = any (v_muted_genres)
        )
      )
  ),

  cand_emb as (
    select
      j.*,
      me.embedding as emb
    from joined j
    left join public.media_embeddings me
      on me.media_item_id = j.media_item_id
     and me.provider=v_provider and me.model=v_model and me.dimensions=v_dims and me.task=v_task
  ),

  -- NEGATIVE anchors
  neg_anchors as (
    select
      e.media_item_id as neg_anchor_id,
      me.embedding as neg_anchor_emb
    from public.media_events e
    join public.media_embeddings me on me.media_item_id = e.media_item_id
    where e.user_id = v_user_id
      and e.created_at > now() - interval '180 days'
      and (
        e.event_type = 'dislike'::public.media_event_type
        or (e.event_type::text='rating' and e.rating_0_10 is not null and e.rating_0_10 <= 3)
      )
      and me.provider=v_provider and me.model=v_model and me.dimensions=v_dims and me.task=v_task
    order by e.created_at desc
    limit 12
  ),

  neg_sim as (
    select
      ce.media_item_id,
      max( (1 - (ce.emb <=> na.neg_anchor_emb))::double precision ) as neg_sim_max
    from cand_emb ce
    cross join neg_anchors na
    where ce.emb is not null
    group by ce.media_item_id
  ),

  session_sim as (
    select
      ce.media_item_id,
      (1 - (ce.emb <=> v_session_vec))::double precision as sess_sim
    from cand_emb ce
    where ce.emb is not null
      and v_session_vec is not null
  ),

  with_fb as (
    select
      ce.*,
      coalesce(mf.impressions_7d,0) as impressions_7d,
      coalesce(mf.negative_ema,0) as negative_ema,
      mf.last_impression_at,
      coalesce(ns.neg_sim_max, 0.0) as neg_sim_max,
      coalesce(ss.sess_sim, 0.0) as sess_sim
    from cand_emb ce
    left join public.media_feedback mf
      on mf.user_id=v_user_id and mf.media_item_id=ce.media_item_id
    left join neg_sim ns on ns.media_item_id = ce.media_item_id
    left join session_sim ss on ss.media_item_id = ce.media_item_id
  ),

  normed as (
    select
      wf.*,
      case
        when wf.source='for_you' and (select has_vec from params) then
          greatest(0.0, least(1.0, (wf.score + 1.0) / 2.0))
        else
          (1.0 - percent_rank() over (partition by wf.source order by wf.score desc))
      end as rel,
      (
        0.06 * ln(1.0 + wf.impressions_7d::double precision)
        + case
            when wf.last_impression_at is null then 0.0
            when wf.last_impression_at > now() - interval '24 hours' then 0.05
            when wf.last_impression_at > now() - interval '3 days' then 0.02
            else 0.0
          end
      ) as novelty,
      (
        (((hashtext(v_seed || wf.media_item_id::text))::bigint % 100000 + 100000) % 100000)::double precision / 100000.0
      ) as jit,
      (0.06 * exp(-wf.impressions_7d::double precision / 2.0)) as explore
    from with_fb wf
  ),

  scored as (
    select
      n.*,
      (
        1.12 * n.rel
        + n.explore
        - 0.18 * n.novelty
        - 0.35 * n.negative_ema
        - 0.55 * greatest(0.0, n.neg_sim_max)
        + 0.18 * greatest(0.0, n.sess_sim) * v_session_weight
        + 0.02 * n.jit
        + case n.source
            when 'for_you' then 0.06
            when 'friends' then 0.04 + (0.01 * least(coalesce(cardinality(n.friend_ids),0), 5))
            when 'trending' then 0.03
            when 'popular' then 0.015
            else 0.015
          end
      ) as final_score
    from normed n
    where coalesce(n.neg_sim_max, 0.0) < 0.70
  ),

  deduped as (
    select distinct on (s.media_item_id)
      s.media_item_id,
      s.source,
      s.score,
      s.jit,
      s.final_score,
      s.primary_genre,
      s.collection_id,
      s.friend_ids,
      s.anchor_media_id,
      s.anchor_title
    from scored s
    order by
      s.media_item_id,
      s.final_score desc,
      case s.source when 'for_you' then 1 when 'friends' then 2 when 'trending' then 3 when 'popular' then 4 else 5 end
  )

  insert into _cand(media_item_id, source, score, jit, final_score, primary_genre, collection_id, friend_ids, anchor_media_id, anchor_title)
  select
    d.media_item_id, d.source, d.score, d.jit, d.final_score, d.primary_genre, d.collection_id, d.friend_ids, d.anchor_media_id, d.anchor_title
  from deduped d
  on conflict (media_item_id) do update
    set source=excluded.source,
        score=excluded.score,
        jit=excluded.jit,
        final_score=excluded.final_score,
        primary_genre=excluded.primary_genre,
        collection_id=excluded.collection_id,
        friend_ids=excluded.friend_ids,
        anchor_media_id=excluded.anchor_media_id,
        anchor_title=excluded.anchor_title;

  ---------------------------------------------------------------------------
  -- QUOTAS + seen filtering
  ---------------------------------------------------------------------------
  declare
    q_fy int;
    q_tr int;
    q_fr int;
    need_more int;
  begin
    if v_mode='for_you' then
      q_fy := ceil(v_limit*0.80)::int;
      q_tr := v_limit - q_fy;
      q_fr := 0;
    elsif v_mode='trending' then
      q_fy := 0; q_tr := v_limit; q_fr := 0;
    elsif v_mode='friends' then
      q_fy := 0; q_tr := 0; q_fr := v_limit;
    else
      if v_has_vec then
        q_fy := ceil(v_limit*0.60)::int;
        q_tr := ceil(v_limit*0.25)::int;
        q_fr := v_limit - q_fy - q_tr;
      else
        q_fy := ceil(v_limit*0.50)::int;
        q_tr := ceil(v_limit*0.30)::int;
        q_fr := v_limit - q_fy - q_tr;
      end if;
    end if;

    with ranked as (
      select c.*,
             row_number() over (partition by c.source order by c.final_score desc) as rn
      from _cand c
      where c.media_item_id not in (select media_item_id from _seen24h)
        and c.media_item_id not in (select media_item_id from _served30m)
    ),
    take1 as (
      select * from ranked where source='for_you' and rn <= q_fy
      union all
      select * from ranked where source in ('trending','popular') and rn <= q_tr
      union all
      select * from ranked where source='friends' and rn <= q_fr
    ),
    base as (
      select distinct on (media_item_id) * from take1
      order by media_item_id, final_score desc
    ),
    refill as (
      select r.*
      from ranked r
      where r.media_item_id not in (select media_item_id from base)
      order by r.final_score desc
      limit greatest(0, v_limit - (select count(*) from base))
    ),
    chosen as (
      select * from base
      union all
      select * from refill
    )
    insert into _take(media_item_id, source, final_score, primary_genre, collection_id, friend_ids, anchor_title)
    select media_item_id, source, final_score, primary_genre, collection_id, friend_ids, anchor_title
    from chosen
    on conflict (media_item_id) do update
      set source=excluded.source,
          final_score=excluded.final_score,
          primary_genre=excluded.primary_genre,
          collection_id=excluded.collection_id,
          friend_ids=excluded.friend_ids,
          anchor_title=excluded.anchor_title;

    select greatest(0, v_limit - (select count(*) from _take)) into need_more;
    if need_more > 0 then
      insert into _take(media_item_id, source, final_score, primary_genre, collection_id, friend_ids, anchor_title)
      select c.media_item_id, c.source, c.final_score, c.primary_genre, c.collection_id, c.friend_ids, c.anchor_title
      from _cand c
      where c.media_item_id not in (select media_item_id from _take)
        and c.media_item_id not in (select media_item_id from _served30m)
      order by c.final_score desc
      limit need_more
      on conflict (media_item_id) do nothing;
    end if;

    select greatest(0, v_limit - (select count(*) from _take)) into need_more;
    if need_more > 0 then
      insert into _take(media_item_id, source, final_score, primary_genre, collection_id, friend_ids, anchor_title)
      select c.media_item_id, c.source, c.final_score, c.primary_genre, c.collection_id, c.friend_ids, c.anchor_title
      from _cand c
      where c.media_item_id not in (select media_item_id from _take)
      order by (c.final_score + (0.01 * c.jit)) desc
      limit need_more
      on conflict (media_item_id) do nothing;
    end if;
  end;

  ---------------------------------------------------------------------------
  -- Final diversity-aware picking (genre + collection caps)
  ---------------------------------------------------------------------------
  truncate table _picked;

  with recursive r as (
    select * from (
      select
        1 as pos,
        t.media_item_id,
        t.source,
        t.final_score,
        t.friend_ids,
        t.anchor_title,
        array[t.media_item_id] as picked_ids,
        case when t.primary_genre is null then '{}'::jsonb else jsonb_build_object(t.primary_genre, 1) end as g_counts,
        case when t.collection_id is null then '{}'::jsonb else jsonb_build_object(t.collection_id::text, 1) end as c_counts
      from _take t
      order by t.final_score desc
      limit 1
    ) seed

    union all

    select
      r.pos + 1,
      nxt.media_item_id,
      nxt.source,
      nxt.final_score,
      nxt.friend_ids,
      nxt.anchor_title,
      r.picked_ids || nxt.media_item_id,
      case
        when nxt.primary_genre is null then r.g_counts
        else jsonb_set(
          r.g_counts,
          array[nxt.primary_genre],
          to_jsonb(coalesce((r.g_counts ->> nxt.primary_genre)::int, 0) + 1),
          true
        )
      end as g_counts,
      case
        when nxt.collection_id is null then r.c_counts
        else jsonb_set(
          r.c_counts,
          array[nxt.collection_id::text],
          to_jsonb(coalesce((r.c_counts ->> nxt.collection_id::text)::int, 0) + 1),
          true
        )
      end as c_counts
    from r
    join lateral (
      select *
      from (
        select t2.*, 1 as pri
        from _take t2
        where t2.media_item_id <> all(r.picked_ids)
          and (t2.primary_genre is null or coalesce((r.g_counts ->> t2.primary_genre)::int, 0) < v_genre_cap)
          and (t2.collection_id is null or coalesce((r.c_counts ->> t2.collection_id::text)::int, 0) < v_collection_cap)

        union all

        select t2.*, 2 as pri
        from _take t2
        where t2.media_item_id <> all(r.picked_ids)
      ) q
      order by q.pri asc, q.final_score desc
      limit 1
    ) nxt on true
    where r.pos < v_limit
  )
  insert into _picked(pos, media_item_id, source, final_score, friend_ids, anchor_title)
  select pos, media_item_id, source, final_score, friend_ids, anchor_title
  from r
  on conflict (pos) do nothing;

  ---------------------------------------------------------------------------
  -- Mark served items
  ---------------------------------------------------------------------------
  insert into public.media_served(user_id, media_item_id, served_at)
  select v_user_id, p.media_item_id, now()
  from (select distinct media_item_id from _picked) p
  on conflict (user_id, media_item_id) do update
    set served_at = excluded.served_at;

  ---------------------------------------------------------------------------
  -- Return payload (poster_path fallback + https)
  ---------------------------------------------------------------------------
  return query
  select
    mi.id as media_item_id,
    coalesce(mi.tmdb_title, mi.tmdb_name, mi.omdb_title, 'Untitled') as title,
    coalesce(mi.tmdb_overview, mi.omdb_plot, '') as overview,
    mi.kind::text as kind,
    mi.tmdb_release_date as release_date,
    mi.tmdb_first_air_date as first_air_date,
    mi.omdb_runtime,

    case
      when nullif(mi.tmdb_poster_path, '') is not null then mi.tmdb_poster_path
      when nullif(mi.omdb_poster, '') is not null then regexp_replace(mi.omdb_poster, '^http://', 'https://')
      else null
    end as poster_path,

    mi.tmdb_backdrop_path as backdrop_path,
    mi.tmdb_vote_average as vote_average,
    mi.tmdb_vote_count as vote_count,
    mi.tmdb_popularity as popularity,
    mi.completeness,
    p.source,
    case p.source
      when 'for_you' then
        case
          when p.anchor_title is not null then 'Matched for you · because you liked ' || p.anchor_title
          when v_recent_like_title is not null then 'Matched for you · because you liked ' || v_recent_like_title
          else 'For you · learning your taste'
        end
      when 'friends' then 'Friends’ picks'
      when 'popular' then 'Popular'
      when 'trending' then 'Trending now'
      else 'Trending now'
    end as why,
    coalesce(p.friend_ids, '{}'::uuid[])
  from _picked p
  join public.media_items mi on mi.id=p.media_item_id
  order by p.pos asc;

end
$$;
