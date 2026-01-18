-- Session 16: Normalize served request_context storage.
--
-- Goal: stop duplicating request_context JSON on every rec_impressions row.
--
-- Strategy:
-- 1) Backfill rec_requests for historical rec_request_id that only exists in rec_impressions.
-- 2) Provide an enriched view that coalesces context from rec_requests.
-- 3) Update metrics views to rely on the enriched view.
-- 4) Provide an optional maintenance function to compact legacy request_context in batches.

BEGIN;

-- 1) Backfill: create missing rec_requests parent rows from existing impressions.
--    We pick the earliest impression per rec_request_id.
INSERT INTO public.rec_requests (
  rec_request_id,
  created_at,
  created_day,
  user_id,
  session_id,
  deck_id,
  mode,
  requested_mode,
  kind_filter,
  seed,
  "limit",
  source,
  request_context
)
SELECT DISTINCT ON (i.rec_request_id)
  i.rec_request_id,
  i.created_at,
  i.created_day,
  i.user_id,
  i.session_id,
  i.deck_id,
  NULLIF(i.request_context ->> 'mode', '') AS mode,
  NULLIF(i.request_context ->> 'requestedMode', '') AS requested_mode,
  NULLIF(i.request_context ->> 'kindFilter', '') AS kind_filter,
  NULLIF(i.request_context ->> 'seed', '') AS seed,
  NULLIF(i.request_context ->> 'limit', '')::integer AS "limit",
  i.source,
  COALESCE(i.request_context, '{}'::jsonb) AS request_context
FROM public.rec_impressions i
LEFT JOIN public.rec_requests r ON r.rec_request_id = i.rec_request_id
WHERE r.rec_request_id IS NULL
  AND i.request_context IS NOT NULL
ORDER BY i.rec_request_id, i.created_at ASC, i.position ASC;

-- 2) Enriched impressions view: use request_context from rec_requests when rec_impressions.request_context is NULL.
CREATE OR REPLACE VIEW public.rec_impressions_enriched_v1
WITH (security_invoker='true') AS
SELECT
  i.id,
  i.rec_request_id,
  i.user_id,
  i.session_id,
  i.deck_id,
  i.media_item_id,
  i."position",
  i.source,
  i.dedupe_key,
  COALESCE(i.request_context, r.request_context) AS request_context,
  i.created_at,
  i.created_day
FROM public.rec_impressions i
LEFT JOIN public.rec_requests r
  ON r.rec_request_id = i.rec_request_id;

ALTER VIEW public.rec_impressions_enriched_v1 OWNER TO postgres;

-- 3) Update variant metrics to use the enriched view so experiments remain available.
CREATE OR REPLACE VIEW public.rec_variant_daily_metrics_v1
WITH (security_invoker='true') AS
WITH impressions AS (
  SELECT
    (date_trunc('day', i.created_at))::date AS day,
    i.id AS impression_id,
    i.user_id,
    i.rec_request_id,
    i.media_item_id,
    COALESCE((i.request_context -> 'experiments'), '{}'::jsonb) AS experiments
  FROM public.rec_impressions_enriched_v1 i
),
expanded AS (
  SELECT
    impressions.day,
    impressions.impression_id,
    impressions.user_id,
    impressions.rec_request_id,
    impressions.media_item_id,
    e.key AS experiment_key,
    e.value AS variant
  FROM impressions
  CROSS JOIN LATERAL jsonb_each_text(impressions.experiments) e(key, value)
),
outcomes_agg AS (
  SELECT
    o.user_id,
    o.rec_request_id,
    o.media_item_id,
    bool_or((o.event_type)::text = 'detail_open'::text) AS opened_detail,
    bool_or((o.event_type)::text = 'like'::text) AS liked,
    bool_or((o.event_type)::text = 'dislike'::text) AS disliked,
    bool_or((o.event_type)::text = ANY (ARRAY['watchlist_add'::text, 'watchlist'::text])) AS watchlist_add,
    bool_or((o.event_type)::text = ANY (ARRAY['rating'::text, 'rating_set'::text])) AS rated
  FROM public.media_events o
  WHERE o.rec_request_id IS NOT NULL
  GROUP BY o.user_id, o.rec_request_id, o.media_item_id
)
SELECT
  e.day,
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
FROM expanded e
LEFT JOIN outcomes_agg o
  ON (o.user_id = e.user_id AND o.rec_request_id = e.rec_request_id AND o.media_item_id = e.media_item_id)
GROUP BY e.day, e.experiment_key, e.variant;

ALTER VIEW public.rec_variant_daily_metrics_v1 OWNER TO postgres;

-- 4) Maintenance: compact legacy request_context in rec_impressions in batches.
-- Run repeatedly (service_role) until it returns 0.
CREATE OR REPLACE FUNCTION public.rec_impressions_compact_request_context(
  p_before_day date,
  p_limit integer DEFAULT 50000
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  WITH todo AS (
    SELECT i.id, i.created_day
    FROM public.rec_impressions i
    WHERE i.created_day < p_before_day
      AND i.request_context IS NOT NULL
    ORDER BY i.created_day, i.id
    LIMIT GREATEST(p_limit, 1)
  )
  UPDATE public.rec_impressions i
  SET request_context = NULL
  FROM todo
  WHERE i.id = todo.id
    AND i.created_day = todo.created_day;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

ALTER FUNCTION public.rec_impressions_compact_request_context(date, integer) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.rec_impressions_compact_request_context(date, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rec_impressions_compact_request_context(date, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.rec_impressions_compact_request_context(date, integer) TO service_role;

COMMIT;
