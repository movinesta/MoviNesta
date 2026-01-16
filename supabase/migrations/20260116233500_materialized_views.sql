-- Scalability Phase 2: Materialized Views for Expensive Aggregates
-- Pre-computes expensive counts and aggregations

BEGIN;

-----------------------------------------------------------------------
-- 1. Materialized view for user stats (replaces live counting)
-----------------------------------------------------------------------
CREATE MATERIALIZED VIEW IF NOT EXISTS public.user_stats_mv AS
SELECT 
    p.id AS user_id,
    (SELECT COUNT(*) FROM public.follows WHERE followed_id = p.id) AS followers_count,
    (SELECT COUNT(*) FROM public.follows WHERE follower_id = p.id) AS following_count,
    (SELECT COUNT(*) FROM public.ratings WHERE user_id = p.id) AS ratings_count,
    (SELECT COUNT(*) FROM public.reviews WHERE user_id = p.id) AS reviews_count,
    (SELECT COUNT(*) FROM public.library_entries WHERE user_id = p.id AND status = 'want_to_watch') AS watchlist_count,
    (SELECT COUNT(*) FROM public.comments WHERE user_id = p.id) AS comments_count,
    (SELECT COUNT(*) FROM public.lists WHERE user_id = p.id AND is_public = true) AS lists_count,
    now() AS refreshed_at
FROM public.profiles p;

CREATE UNIQUE INDEX ON public.user_stats_mv (user_id);

-- Refresh function
CREATE OR REPLACE FUNCTION public.refresh_user_stats_mv()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.user_stats_mv;
$$;

-----------------------------------------------------------------------
-- 2. Materialized view for trending media (refreshed hourly)
-----------------------------------------------------------------------
CREATE MATERIALIZED VIEW IF NOT EXISTS public.media_trending_mv AS
SELECT 
    media_item_id,
    SUM(CASE WHEN event_type = 'like' THEN 1 ELSE 0 END) AS likes_72h,
    SUM(CASE WHEN event_type = 'dislike' THEN 1 ELSE 0 END) AS dislikes_72h,
    SUM(CASE WHEN event_type = 'impression' THEN 1 ELSE 0 END) AS impressions_72h,
    COUNT(DISTINCT user_id) AS unique_users_72h,
    -- Wilson score for ranking
    (SUM(CASE WHEN event_type = 'like' THEN 1.0 ELSE 0.0 END) + 1.9208) / 
    (SUM(CASE WHEN event_type IN ('like', 'dislike') THEN 1.0 ELSE 0.0 END) + 3.8416) -
    1.96 * SQRT(
        (SUM(CASE WHEN event_type = 'like' THEN 1.0 ELSE 0.0 END) * 
         SUM(CASE WHEN event_type = 'dislike' THEN 1.0 ELSE 0.0 END)) / 
        NULLIF(SUM(CASE WHEN event_type IN ('like', 'dislike') THEN 1.0 ELSE 0.0 END), 0) + 0.9604
    ) / (SUM(CASE WHEN event_type IN ('like', 'dislike') THEN 1.0 ELSE 0.0 END) + 3.8416) AS wilson_score,
    now() AS refreshed_at
FROM public.media_events
WHERE created_at > now() - interval '72 hours'
  AND event_type IN ('like', 'dislike', 'impression')
GROUP BY media_item_id
HAVING SUM(CASE WHEN event_type = 'impression' THEN 1 ELSE 0 END) >= 10;

CREATE UNIQUE INDEX ON public.media_trending_mv (media_item_id);
CREATE INDEX ON public.media_trending_mv (wilson_score DESC);

-- Refresh function
CREATE OR REPLACE FUNCTION public.refresh_media_trending_mv()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.media_trending_mv;
$$;

-----------------------------------------------------------------------
-- 3. Grant permissions
-----------------------------------------------------------------------
GRANT SELECT ON public.user_stats_mv TO anon;
GRANT SELECT ON public.user_stats_mv TO authenticated;
GRANT SELECT ON public.user_stats_mv TO service_role;

GRANT SELECT ON public.media_trending_mv TO anon;
GRANT SELECT ON public.media_trending_mv TO authenticated;
GRANT SELECT ON public.media_trending_mv TO service_role;

COMMIT;
