-- Session 16: Minimal feature+label store for LTR training.
--
-- This replaces the wide, duplicative media_rank_feature_log rows.
-- Served context (deck/session/source/mode/kind_filter) is derived from
-- rec_impressions_enriched_v1 + rec_requests when needed.

BEGIN;

CREATE TABLE IF NOT EXISTS public.media_rank_feature_items_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_day date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  user_id uuid NOT NULL,
  dedupe_key text NOT NULL,
  rec_request_id uuid,
  media_item_id uuid NOT NULL,
  "position" integer,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  labels jsonb NOT NULL DEFAULT '[]'::jsonb
);

ALTER TABLE public.media_rank_feature_items_v2 OWNER TO postgres;

-- Deduplication: one row per served (user,dedupe_key).
CREATE UNIQUE INDEX IF NOT EXISTS media_rank_feature_items_v2_uniq
  ON public.media_rank_feature_items_v2 (user_id, dedupe_key);

CREATE INDEX IF NOT EXISTS media_rank_feature_items_v2_req_idx
  ON public.media_rank_feature_items_v2 (rec_request_id);

CREATE INDEX IF NOT EXISTS media_rank_feature_items_v2_user_day_idx
  ON public.media_rank_feature_items_v2 (user_id, created_day DESC);

-- Security: keep private by default (Edge Functions write using service_role).
ALTER TABLE public.media_rank_feature_items_v2 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.media_rank_feature_items_v2 FROM PUBLIC;
REVOKE ALL ON TABLE public.media_rank_feature_items_v2 FROM anon;
REVOKE ALL ON TABLE public.media_rank_feature_items_v2 FROM authenticated;
GRANT ALL ON TABLE public.media_rank_feature_items_v2 TO service_role;

-- Backward-compatible view (same shape as media_rank_feature_log rows).
CREATE OR REPLACE VIEW public.media_rank_feature_log_v
WITH (security_invoker='true') AS
SELECT
  f.id,
  f.created_at,
  f.user_id,
  impr.session_id,
  impr.deck_id,
  f.media_item_id,
  f."position",
  req.mode,
  req.kind_filter,
  COALESCE(impr.source, req.source) AS source,
  f.features,
  jsonb_build_object('labels', f.labels) AS label
FROM public.media_rank_feature_items_v2 f
LEFT JOIN LATERAL (
  SELECT i.session_id, i.deck_id, i.source, i.created_at
  FROM public.rec_impressions_enriched_v1 i
  WHERE i.user_id = f.user_id
    AND i.dedupe_key = f.dedupe_key
  ORDER BY i.created_at DESC
  LIMIT 1
) impr ON TRUE
LEFT JOIN public.rec_requests req
  ON req.rec_request_id = f.rec_request_id;

ALTER VIEW public.media_rank_feature_log_v OWNER TO postgres;

REVOKE ALL ON TABLE public.media_rank_feature_log_v FROM anon;
REVOKE ALL ON TABLE public.media_rank_feature_log_v FROM authenticated;
GRANT SELECT ON TABLE public.media_rank_feature_log_v TO authenticated;
GRANT ALL ON TABLE public.media_rank_feature_log_v TO service_role;

COMMIT;
