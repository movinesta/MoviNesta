-- Migration: 20260107_200000_app_settings_server_defaults_v3
-- Description: Seed server_only setting for taste-match profile shaping (weights + output caps).

BEGIN;

INSERT INTO public.app_settings (key, scope, value, description)
VALUES
  (
    'ranking.swipe.taste_match',
    'server_only',
    '{
      "summarize": {
        "genre_like_delta": 2,
        "genre_dislike_delta": -2,
        "vibe_like_delta": 2,
        "vibe_dislike_delta": -2,
        "keyword_like_delta": 1,
        "keyword_dislike_delta": -1,
        "era_like_delta": 1,
        "era_dislike_delta": -1,
        "keywords_per_item": 8,
        "score_min_abs": 1,
        "prefer_genres_take": 8,
        "prefer_vibes_take": 6,
        "avoid_value_lt": -2,
        "avoid_take": 10,
        "liked_titles_max": 6,
        "disliked_titles_max": 4
      },
      "query_caps": {
        "liked_titles_max": 6,
        "disliked_titles_max": 4,
        "prefer_genres_max": 10,
        "prefer_vibes_max": 8,
        "avoid_max": 10
      },
      "doc_caps": {
        "genres_max": 8,
        "vibe_max": 6,
        "languages_max": 3,
        "countries_max": 3,
        "people_max": 6,
        "keywords_max": 12
      }
    }'::jsonb,
    'Taste-match text profile shaping (weights and output caps) used by swipe reranking.'
  )
ON CONFLICT (key) DO NOTHING;

COMMIT;
