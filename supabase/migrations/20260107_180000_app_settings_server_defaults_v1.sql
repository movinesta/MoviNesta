-- Migration: 20260107_180000_app_settings_server_defaults_v1
-- Description: Seed additional server_only app settings used by Edge Functions (tmdb-proxy, trending refresh, rerank, swipe cold-start).

BEGIN;

INSERT INTO public.app_settings (key, scope, value, description)
VALUES
  -- Trending refresh defaults (job)
  ('ops.trending_refresh.lookback_days_default', 'server_only', '14'::jsonb, 'Default lookback days for the trending refresh job when request omits lookbackDays.'),
  ('ops.trending_refresh.half_life_hours_default', 'server_only', '72'::jsonb, 'Default half-life hours for trending refresh when request omits halfLifeHours.'),
  ('ops.trending_refresh.completeness_min_default', 'server_only', '0.75'::jsonb, 'Default completeness_min for trending refresh when request omits completenessMin.'),

  -- TMDb proxy (server-only, non-secret)
  ('integrations.tmdb_proxy.default_language', 'server_only', to_jsonb('en-US'::text), 'Default TMDb language parameter when the client does not provide one (e.g., en-US).'),
  ('integrations.tmdb_proxy.max_query_len', 'server_only', '200'::jsonb, 'Max length for TMDb search query forwarded by tmdb-proxy.'),
  ('integrations.tmdb_proxy.max_page', 'server_only', '50'::jsonb, 'Max TMDb page number allowed via tmdb-proxy.'),
  ('integrations.tmdb_proxy.timeout_ms', 'server_only', '8000'::jsonb, 'HTTP timeout used by tmdb-proxy when calling TMDb (ms).'),
  ('integrations.tmdb_proxy.max_per_minute', 'server_only', '120'::jsonb, 'Per-user rate limit for tmdb-proxy requests (max per minute).'),

  -- Rerank ops knobs (server-only, non-secret)
  ('ops.rerank.cache_ttl_seconds', 'server_only', '600'::jsonb, 'TTL for persistent Voyage rerank cache entries (seconds).'),
  ('ops.rerank.fresh_window_seconds', 'server_only', '21600'::jsonb, 'Freshness window for re-running rerank without explicit query (seconds).'),
  ('ops.rerank.cooldown_429_seconds', 'server_only', '300'::jsonb, 'Cooldown applied when Voyage rerank returns 429 (seconds).'),

  -- Swipe cold-start behavior (server-only, non-secret)
  ('ranking.swipe.cold_start.lookback_days', 'server_only', '30'::jsonb, 'Lookback window (days) for cold-start strong-positive detection.'),
  ('ranking.swipe.cold_start.min_strong_positive', 'server_only', '3'::jsonb, 'Minimum strong-positive signals required to avoid cold-start mode.')
ON CONFLICT (key) DO NOTHING;

COMMIT;
