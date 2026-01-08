-- Migration: 20260108_000200_app_settings_presets
-- Description: Admin-managed app settings presets (apply multiple settings with diff preview).

BEGIN;

CREATE TABLE IF NOT EXISTS public.app_settings_presets (
  id bigserial PRIMARY KEY,
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  group_key text NOT NULL DEFAULT 'general',
  preset jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_builtin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS app_settings_presets_group_key_idx
  ON public.app_settings_presets (group_key);

CREATE INDEX IF NOT EXISTS app_settings_presets_updated_at_idx
  ON public.app_settings_presets (updated_at DESC);

ALTER TABLE public.app_settings_presets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'app_settings_presets'
        AND policyname = 'Service role can manage presets'
  ) THEN
    CREATE POLICY "Service role can manage presets"
      ON public.app_settings_presets
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END$$;

-- Seed built-in presets (idempotent)
INSERT INTO public.app_settings_presets (slug, title, description, group_key, preset, is_builtin)
VALUES
  (
    'assistant_fast_cheap',
    'Assistant: Fast & Cheap',
    'Lower timeouts and smaller context/tool truncation for faster, cheaper replies.',
    'assistant',
    '{
      "ops.search.timeout_ms": 12000,
      "assistant.reply_runner.max_context_messages": 8,
      "assistant.reply_runner.backoff": {
        "base_seconds": 8,
        "max_exp": 9,
        "max_seconds": 1800,
        "jitter_seconds": 4
      },
      "assistant.tool_result_truncation": {
        "defaults": {"maxString": 900, "maxArray": 30, "maxObjectKeys": 40},
        "caps": {"maxString": 3000, "maxArray": 120, "maxObjectKeys": 120},
        "maxDepth": 3
      }
    }'::jsonb,
    true
  ),
  (
    'assistant_high_quality',
    'Assistant: High Quality',
    'More context/tool detail and longer timeouts for higher-fidelity answers (may cost more).',
    'assistant',
    '{
      "ops.search.timeout_ms": 30000,
      "assistant.reply_runner.max_context_messages": 20,
      "assistant.reply_runner.backoff": {
        "base_seconds": 10,
        "max_exp": 12,
        "max_seconds": 3600,
        "jitter_seconds": 6
      },
      "assistant.tool_result_truncation": {
        "defaults": {"maxString": 1800, "maxArray": 60, "maxObjectKeys": 80},
        "caps": {"maxString": 4000, "maxArray": 200, "maxObjectKeys": 200},
        "maxDepth": 5
      }
    }'::jsonb,
    true
  ),
  (
    'ux_social_chat',
    'UX: Social Chat',
    'More responsive presence + typing, and a larger message composer limit for chatty use-cases.',
    'ux',
    '{
      "ux.presence.heartbeat_ms": 15000,
      "ux.presence.recompute_ms": 2000,
      "ux.presence.db_touch_min_interval_ms": 45000,
      "ux.typing.inactivity_ms": 2500,
      "ux.typing.heartbeat_ms": 1500,
      "ux.typing.remote_ttl_ms": 7000,
      "ux.messages.max_message_chars": 4000
    }'::jsonb,
    true
  ),
  (
    'ranking_taste_heavy',
    'Ranking: Taste-heavy',
    'Stronger taste signal shaping (more weight on likes/dislikes, larger caps).',
    'ranking',
    '{
      "ranking.swipe.taste_match": {
        "summarize": {
          "genre_like_delta": 3,
          "genre_dislike_delta": -3,
          "vibe_like_delta": 3,
          "vibe_dislike_delta": -3,
          "keyword_like_delta": 2,
          "keyword_dislike_delta": -2,
          "era_like_delta": 1,
          "era_dislike_delta": -1,
          "keywords_per_item": 10,
          "score_min_abs": 1,
          "prefer_genres_take": 10,
          "prefer_vibes_take": 8,
          "avoid_value_lt": -2,
          "avoid_take": 10,
          "liked_titles_max": 6,
          "disliked_titles_max": 4
        },
        "query_caps": {
          "liked_titles_max": 6,
          "disliked_titles_max": 4,
          "prefer_genres_max": 12,
          "prefer_vibes_max": 10,
          "avoid_max": 10
        },
        "doc_caps": {
          "genres_max": 10,
          "vibe_max": 8,
          "languages_max": 3,
          "countries_max": 3,
          "people_max": 8,
          "keywords_max": 16
        }
      }
    }'::jsonb,
    true
  ),
  (
    'ranking_trending_heavy',
    'Ranking: Trending-heavy',
    'Lighter taste shaping (broader trending results, smaller caps).',
    'ranking',
    '{
      "ranking.swipe.taste_match": {
        "summarize": {
          "genre_like_delta": 1,
          "genre_dislike_delta": -1,
          "vibe_like_delta": 1,
          "vibe_dislike_delta": -1,
          "keyword_like_delta": 1,
          "keyword_dislike_delta": -1,
          "era_like_delta": 0,
          "era_dislike_delta": 0,
          "keywords_per_item": 6,
          "score_min_abs": 1,
          "prefer_genres_take": 6,
          "prefer_vibes_take": 4,
          "avoid_value_lt": -1,
          "avoid_take": 6,
          "liked_titles_max": 4,
          "disliked_titles_max": 3
        },
        "query_caps": {
          "liked_titles_max": 4,
          "disliked_titles_max": 3,
          "prefer_genres_max": 8,
          "prefer_vibes_max": 6,
          "avoid_max": 8
        },
        "doc_caps": {
          "genres_max": 6,
          "vibe_max": 4,
          "languages_max": 3,
          "countries_max": 3,
          "people_max": 4,
          "keywords_max": 10
        }
      }
    }'::jsonb,
    true
  )
ON CONFLICT (slug) DO UPDATE
SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  group_key = EXCLUDED.group_key,
  preset = EXCLUDED.preset,
  is_builtin = EXCLUDED.is_builtin,
  updated_at = now();

COMMIT;
