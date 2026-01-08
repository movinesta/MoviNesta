-- ONE_RUN_MIGRATIONS_20260108_SETTINGS_CLEAN
-- Generated: 2026-01-08T18:43:11Z
-- Purpose: Run all post-baseline migrations for MoviNesta in a single execution.
-- Notes:
--  - This file concatenates the SQL files in supabase/migrations (present in repo).
--  - Each migration is written to be idempotent (IF NOT EXISTS / policy guards).

-- ====================================================================
-- BEGIN MIGRATION: 20260107_130000_app_settings.sql
-- ====================================================================
-- Migration: 20260107_130000_app_settings
-- Description: Generic non-secret app settings with scopes, history, and meta versioning.
--
-- IMPORTANT SECURITY NOTES:
-- - Store ONLY non-secret values in these tables.
-- - Secrets (API keys/service role keys) must remain in Edge Function env (or Vault).

begin;

-- 1) Settings table (non-secret config)
create table if not exists public.app_settings (
  key text primary key,
  scope text not null check (scope in ('public','admin','server_only')),
  value jsonb not null,
  description text null,
  version bigint not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id)
);

create index if not exists app_settings_scope_idx on public.app_settings(scope);

alter table public.app_settings enable row level security;

drop policy if exists app_settings_public_select on public.app_settings;
create policy app_settings_public_select
on public.app_settings for select
to anon, authenticated
using (scope = 'public');

drop policy if exists app_settings_service_role_all on public.app_settings;
create policy app_settings_service_role_all
on public.app_settings for all
to service_role
using (true)
with check (true);

-- 2) Meta table for a single monotonic version counter
create table if not exists public.app_settings_meta (
  id integer primary key,
  version bigint not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.app_settings_meta enable row level security;

drop policy if exists app_settings_meta_public_select on public.app_settings_meta;
create policy app_settings_meta_public_select
on public.app_settings_meta for select
to anon, authenticated
using (true);

drop policy if exists app_settings_meta_service_role_all on public.app_settings_meta;
create policy app_settings_meta_service_role_all
on public.app_settings_meta for all
to service_role
using (true)
with check (true);

insert into public.app_settings_meta (id, version)
values (1, 1)
on conflict (id) do nothing;

create or replace function public.bump_app_settings_meta()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.app_settings_meta
     set version = version + 1,
         updated_at = now()
   where id = 1;
  return null;
end;
$$;

drop trigger if exists trg_bump_app_settings_meta on public.app_settings;
create trigger trg_bump_app_settings_meta
after insert or update or delete on public.app_settings
for each statement
execute function public.bump_app_settings_meta();

-- 3) Settings history (write-only, service_role only)
create table if not exists public.app_settings_history (
  id bigserial primary key,
  key text not null,
  scope text not null check (scope in ('public','admin','server_only')),
  old_value jsonb null,
  new_value jsonb null,
  old_version bigint null,
  new_version bigint null,
  change_reason text null,
  request_id text null,
  changed_at timestamptz not null default now(),
  changed_by uuid null references auth.users(id)
);

create index if not exists app_settings_history_key_changed_at_idx
on public.app_settings_history(key, changed_at desc);

alter table public.app_settings_history enable row level security;

drop policy if exists app_settings_history_service_role_all on public.app_settings_history;
create policy app_settings_history_service_role_all
on public.app_settings_history for all
to service_role
using (true)
with check (true);

-- 4) Seed public defaults (keep behavior identical until frontend opts-in)
insert into public.app_settings (key, scope, value, description)
values
  ('ux.presence.channel', 'public', to_jsonb('presence:global'::text), 'Realtime presence channel base name.'),
  ('ux.presence.online_ttl_ms', 'public', to_jsonb(45000), 'Presence: considered online if last_seen age <= this window (ms).'),
  ('ux.presence.away_ttl_ms', 'public', to_jsonb(120000), 'Presence: considered away if last_seen age <= this window (ms).'),
  ('ux.presence.heartbeat_ms', 'public', to_jsonb(20000), 'Presence: how often the client re-tracks presence (ms).'),
  ('ux.presence.recompute_ms', 'public', to_jsonb(5000), 'Presence: how often the client recomputes time-based status (ms).'),
  ('ux.presence.db_touch_min_interval_ms', 'public', to_jsonb(60000), 'Presence: minimum interval between best-effort last_seen DB updates (ms).'),
  ('ux.presence.initial_sync_delay_ms', 'public', to_jsonb(150), 'Presence: delay before forcing a sync after subscribe (ms).'),
  ('ux.typing.inactivity_ms', 'public', to_jsonb(3000), 'Typing: stop typing after this many ms without input.'),
  ('ux.typing.heartbeat_ms', 'public', to_jsonb(2000), 'Typing: re-broadcast typing at most once per heartbeat (ms).'),
  ('ux.typing.remote_ttl_ms', 'public', to_jsonb(5000), 'Typing: remote typing indicator expiry TTL (ms).')
on conflict (key) do nothing;

commit;
-- ====================================================================
-- END MIGRATION: 20260107_130000_app_settings.sql
-- ====================================================================
-- ====================================================================
-- BEGIN MIGRATION: 20260107_140500_app_settings_public_defaults_v2.sql
-- ====================================================================
-- Migration: 20260107_140500_app_settings_public_defaults_v2
-- Description: Seed additional public app settings used by the frontend (composer, attachments, search, timeouts).

BEGIN;

INSERT INTO public.app_settings (key, scope, value, description)
VALUES
  -- Messages composer
  ('ux.messages.max_message_chars', 'public', '2000'::jsonb, 'Max characters allowed in the message composer.'),
  ('ux.messages.composer_max_height_px', 'public', '140'::jsonb, 'Max auto-resize height for the message composer textarea (px).'),

  -- Attachments
  ('ux.attachments.max_image_bytes', 'public', '10485760'::jsonb, 'Max allowed size for an uploaded chat image (bytes). Non-secret; used for client-side validation only.'),

  -- Search
  ('ux.search.page_size', 'public', '20'::jsonb, 'Search results page size used by the client and fallback DB query.'),
  ('ux.search.batch_sync_limit', 'public', '5'::jsonb, 'Max external TMDb results to attempt syncing into the catalog per page.'),
  ('ux.search.min_query_chars', 'public', '2'::jsonb, 'Minimum query length to enable search.'),
  ('ux.search.stale_time_ms', 'public', '1800000'::jsonb, 'React Query: staleTime for title search (ms). Set to 0 to always refetch.'),
  ('ux.search.gc_time_ms', 'public', '3600000'::jsonb, 'React Query: gcTime for title search cache (ms).'),

  -- Ops (frontend)
  ('ops.frontend.function_timeout_ms', 'public', '20000'::jsonb, 'Default timeout for calling Supabase Edge Functions (ms).'),
  ('ops.search.timeout_ms', 'public', '20000'::jsonb, 'Timeout for search-related Edge Function calls (ms).')
ON CONFLICT (key) DO NOTHING;

COMMIT;
-- ====================================================================
-- END MIGRATION: 20260107_140500_app_settings_public_defaults_v2.sql
-- ====================================================================
-- ====================================================================
-- BEGIN MIGRATION: 20260107_170001_assistant_settings_behavior_column.sql
-- ====================================================================
-- Migration: 20260107_170001_assistant_settings_behavior_column
-- Description: Ensure assistant_settings has a behavior JSONB column for admin-controlled assistant behavior.

BEGIN;

ALTER TABLE IF EXISTS public.assistant_settings
  ADD COLUMN IF NOT EXISTS behavior jsonb;

COMMENT ON COLUMN public.assistant_settings.behavior IS
  'Admin-controlled assistant behavior settings (prompts, chunking, tool loop, rate limits, orchestrator knobs, OpenRouter attribution).';

COMMIT;
-- ====================================================================
-- END MIGRATION: 20260107_170001_assistant_settings_behavior_column.sql
-- ====================================================================
-- ====================================================================
-- BEGIN MIGRATION: 20260107_180000_app_settings_server_defaults_v1.sql
-- ====================================================================
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
-- ====================================================================
-- END MIGRATION: 20260107_180000_app_settings_server_defaults_v1.sql
-- ====================================================================
-- ====================================================================
-- BEGIN MIGRATION: 20260107_190000_app_settings_server_defaults_v2.sql
-- ====================================================================
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
-- ====================================================================
-- END MIGRATION: 20260107_190000_app_settings_server_defaults_v2.sql
-- ====================================================================
-- ====================================================================
-- BEGIN MIGRATION: 20260107_200000_app_settings_server_defaults_v3.sql
-- ====================================================================
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
-- ====================================================================
-- END MIGRATION: 20260107_200000_app_settings_server_defaults_v3.sql
-- ====================================================================
-- ====================================================================
-- BEGIN MIGRATION: 20260107_210000_app_settings_server_defaults_v4.sql
-- ====================================================================
-- Migration: 20260107_210000_app_settings_server_defaults_v4
-- Description: Seed server_only defaults for per-action rate limits and assistant tool-result truncation.

BEGIN;

INSERT INTO public.app_settings (key, scope, value, description)
VALUES
  (
    'ops.rate_limits',
    'server_only',
    '{
      "actions": {
        "catalog-sync": 60
      }
    }'::jsonb,
    'Server-only per-action rate limits. Keys match rate-limit action names (e.g. catalog-sync).'
  )
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_settings (key, scope, value, description)
VALUES
  (
    'assistant.tool_result_truncation',
    'server_only',
    '{
      "defaults": { "maxString": 1200, "maxArray": 40, "maxObjectKeys": 60 },
      "caps": { "maxString": 4000, "maxArray": 200, "maxObjectKeys": 200 },
      "maxDepth": 4
    }'::jsonb,
    'Server-only defaults + caps for assistant-tool-result payload truncation.'
  )
ON CONFLICT (key) DO NOTHING;

COMMIT;
-- ====================================================================
-- END MIGRATION: 20260107_210000_app_settings_server_defaults_v4.sql
-- ====================================================================
-- ====================================================================
-- BEGIN MIGRATION: 20260107_220000_app_settings_server_defaults_v5.sql
-- ====================================================================
-- Migration: 20260107_220000_app_settings_server_defaults_v5
-- Description: Seed server_only defaults for assistant reply-runner knobs.

BEGIN;

INSERT INTO public.app_settings (key, scope, value, description)
VALUES
  (
    'assistant.reply_runner.claim_limit_default',
    'server_only',
    '20'::jsonb,
    'Default number of reply jobs to claim per runner invocation when request omits limit.'
  )
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_settings (key, scope, value, description)
VALUES
  (
    'assistant.reply_runner.max_attempts_default',
    'server_only',
    '5'::jsonb,
    'Default maxAttempts for runner processing when request omits maxAttempts.'
  )
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_settings (key, scope, value, description)
VALUES
  (
    'assistant.reply_runner.stuck_minutes',
    'server_only',
    '10'::jsonb,
    'Minutes after which a job is considered stuck and eligible to be reclaimed.'
  )
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_settings (key, scope, value, description)
VALUES
  (
    'assistant.reply_runner.max_context_messages',
    'server_only',
    '12'::jsonb,
    'maxContextMessages passed to assistant-chat-reply from the runner (background execution).'
  )
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_settings (key, scope, value, description)
VALUES
  (
    'assistant.reply_runner.backoff',
    'server_only',
    '{
      "base_seconds": 10,
      "max_exp": 10,
      "max_seconds": 3600,
      "jitter_seconds": 5
    }'::jsonb,
    'Backoff strategy for rescheduling jobs after rate limiting or transient errors.'
  )
ON CONFLICT (key) DO NOTHING;

COMMIT;
-- ====================================================================
-- END MIGRATION: 20260107_220000_app_settings_server_defaults_v5.sql
-- ====================================================================
-- ====================================================================
-- BEGIN MIGRATION: 20260107_230000_app_settings_admin_defaults_v1.sql
-- ====================================================================
-- Migration: 20260107_230000_app_settings_admin_defaults_v1
-- Description: Seed admin-scope defaults for Admin Dashboard endpoints.
--
-- Notes:
-- - These settings are non-secret.
-- - Scope 'admin' means only admins (via Edge Functions / service_role) can read/update.

BEGIN;

INSERT INTO public.app_settings (key, scope, value, description)
VALUES
  ('admin.users.page_limit', 'admin', to_jsonb(50), 'Admin Users: page size used by admin-users list endpoint (offset-based pagination).'),
  ('admin.users.ban_duration_days', 'admin', to_jsonb(18250), 'Admin Users: ban duration (days) applied when admin-users action=ban.'),
  ('admin.overview.recent_errors_limit', 'admin', to_jsonb(50), 'Admin Overview: number of recent error rows to return (last 24h).'),
  ('admin.overview.last_job_runs_limit', 'admin', to_jsonb(20), 'Admin Overview: number of last job runs to return.'),
  ('admin.audit.default_limit', 'admin', to_jsonb(50), 'Admin Audit: default limit when the request omits the limit query param.')
ON CONFLICT (key) DO NOTHING;

COMMIT;
-- ====================================================================
-- END MIGRATION: 20260107_230000_app_settings_admin_defaults_v1.sql
-- ====================================================================
-- ====================================================================
-- BEGIN MIGRATION: 20260107_235500_app_settings_public_defaults_v3.sql
-- ====================================================================
-- Migration: 20260107_235500_app_settings_public_defaults_v3
-- Description: Seed additional public UX settings (assistant detection + presence labels + message search).

BEGIN;

INSERT INTO public.app_settings (key, scope, value, description)
VALUES
  -- Assistant UX
  ('ux.assistant.username', 'public', to_jsonb('movinesta'::text), 'Username used by the client to identify the built-in assistant thread when no cached conversation id exists.'),

  -- Presence copy
  ('ux.presence.label_online', 'public', '"Online"'::jsonb, 'Presence: label shown when a user is online.'),
  ('ux.presence.label_active_recently', 'public', '"Active recently"'::jsonb, 'Presence: label shown when a user is away / recently active.'),
  ('ux.presence.label_active_prefix', 'public', '"Active"'::jsonb, 'Presence: prefix used for last-active strings (e.g., "Active 2 minutes ago").'),

  -- Conversation message search
  ('ux.messages.search.min_query_chars', 'public', '2'::jsonb, 'Minimum query length to enable in-conversation message search.')
ON CONFLICT (key) DO NOTHING;

COMMIT;
-- ====================================================================
-- END MIGRATION: 20260107_235500_app_settings_public_defaults_v3.sql
-- ====================================================================
-- ====================================================================
-- BEGIN MIGRATION: 20260108_000100_admin_user_prefs.sql
-- ====================================================================
-- Migration: 20260108_000100_admin_user_prefs
-- Description: Store per-admin UI preferences (e.g., settings favorites) server-side.

BEGIN;

CREATE TABLE IF NOT EXISTS public.admin_user_prefs (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  settings_favorites text[] NOT NULL DEFAULT '{}'::text[],
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_user_prefs ENABLE ROW LEVEL SECURITY;

-- We only access this table via admin Edge Functions using service_role.
-- Keeping it service_role-only prevents any accidental client reads.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'admin_user_prefs'
      AND policyname = 'service_role full access admin_user_prefs'
  ) THEN
    CREATE POLICY "service_role full access admin_user_prefs"
      ON public.admin_user_prefs
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_admin_user_prefs_updated_at
  ON public.admin_user_prefs (updated_at DESC);

COMMIT;
-- ====================================================================
-- END MIGRATION: 20260108_000100_admin_user_prefs.sql
-- ====================================================================
-- ====================================================================
-- BEGIN MIGRATION: 20260108_000200_app_settings_presets.sql
-- ====================================================================
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
-- ====================================================================
-- END MIGRATION: 20260108_000200_app_settings_presets.sql
-- ====================================================================

