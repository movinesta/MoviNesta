-- Migration: 20260107_190000_app_settings_server_defaults_v2
-- Description: Seed additional server_only settings for swipe deck sizing, taste profiling thresholds, and adaptive rerank TopK.

BEGIN;

INSERT INTO public.app_settings (key, scope, value, description)
VALUES
  -- Cold-start scan bounds
  (
    'ranking.swipe.cold_start.event_limit',
    'server_only',
    '120'::jsonb,
    'Max number of recent media_events rows scanned for cold-start strong-positive detection.'
  ),

  -- Swipe deck sizing
  (
    'ranking.swipe.deck',
    'server_only',
    '{
      "default_limit": 60,
      "max_limit": 120,
      "rpc_extra_factor_base": 2,
      "rpc_extra_factor_with_filters": 3,
      "rpc_limit_cap": 120,
      "fill_second_attempt_enabled": true,
      "fill_second_seed_suffix": "fill2",
      "media_item_fetch_ids_cap": 500
    }'::jsonb,
    'Server-side tuning for swipe deck sizing and enrichment behavior.'
  ),

  -- Taste-profile extraction knobs
  (
    'ranking.swipe.taste',
    'server_only',
    '{
      "lookback_days": 30,
      "event_limit": 250,
      "pick_liked_max": 6,
      "pick_disliked_max": 4,
      "min_liked_for_query": 3,
      "thresholds": {
        "strong_positive_rating_min": 7,
        "strong_negative_rating_max": 3,
        "strong_positive_dwell_ms_min": 12000
      }
    }'::jsonb,
    'Taste-profile extraction knobs (events lookback, strong-signal thresholds, and profile compacting).'
  ),

  -- Adaptive rerank candidate sizing
  (
    'ops.rerank.adaptive_topk',
    'server_only',
    '{
      "explicit_query_max": 60,
      "thresholds": [
        { "lt": 5, "topk": 15 },
        { "lt": 15, "topk": 25 },
        { "lt": 40, "topk": 40 }
      ],
      "default_topk": 60
    }'::jsonb,
    'Adaptive rerank candidate sizing based on taste signal strength (strongPosCount).'
  )
ON CONFLICT (key) DO NOTHING;

COMMIT;
