// supabase/functions/_shared/appSettingsSchema.ts
//
// Typed registry of non-secret app settings.
//
// SECURITY:
// - Do NOT put secrets here.
// - Anything with scope === 'public' may be returned to unauthenticated clients.

import { z } from "zod";

export const AppSettingScopeSchema = z.enum(["public", "admin", "server_only"]);
export type AppSettingScope = z.infer<typeof AppSettingScopeSchema>;

export type AppSettingRegistryEntry<T> = {
  scope: AppSettingScope;
  schema: z.ZodType<T>;
  default: T;
  description: string;
};

// IMPORTANT:
// - Keys are stable identifiers (do not rename without a migration).
// - Defaults MUST match the current hard-coded behavior to be backward-compatible.
export const APP_SETTINGS_REGISTRY = {
  // Assistant (frontend UX)
  "ux.assistant.username": {
    scope: "public",
    schema: z.string().min(1).max(64),
    default: "movinesta",
    description: "Username used by the client to identify the built-in assistant thread when no cached conversation id exists.",
  },

  // Presence (frontend)
  "ux.presence.channel": {
    scope: "public",
    schema: z.string().min(1),
    default: "presence:global",
    description: "Realtime presence channel base name.",
  },
  "ux.presence.label_online": {
    scope: "public",
    schema: z.string().min(1).max(64),
    default: "Online",
    description: "Presence: label shown when a user is online.",
  },
  "ux.presence.label_active_recently": {
    scope: "public",
    schema: z.string().min(1).max(64),
    default: "Active recently",
    description: "Presence: label shown when a user is away / recently active.",
  },
  "ux.presence.label_active_prefix": {
    scope: "public",
    schema: z.string().min(1).max(32),
    default: "Active",
    description: "Presence: prefix used for last-active strings (e.g., 'Active 2 minutes ago').",
  },
  "ux.presence.online_ttl_ms": {
    scope: "public",
    schema: z.number().int().min(1_000).max(300_000),
    default: 45_000,
    description: "Presence: considered online if last_seen age <= this window (ms).",
  },
  "ux.presence.away_ttl_ms": {
    scope: "public",
    schema: z.number().int().min(1_000).max(900_000),
    default: 2 * 60_000,
    description: "Presence: considered away if last_seen age <= this window (ms).",
  },
  "ux.presence.heartbeat_ms": {
    scope: "public",
    schema: z.number().int().min(1_000).max(120_000),
    default: 20_000,
    description: "Presence: how often the client tracks presence (ms).",
  },
  "ux.presence.recompute_ms": {
    scope: "public",
    schema: z.number().int().min(500).max(60_000),
    default: 5_000,
    description: "Presence: how often the client recomputes time-based status (ms).",
  },
  "ux.presence.db_touch_min_interval_ms": {
    scope: "public",
    schema: z.number().int().min(5_000).max(300_000),
    default: 60_000,
    description: "Presence: minimum interval between last_seen DB updates (ms).",
  },
  "ux.presence.initial_sync_delay_ms": {
    scope: "public",
    schema: z.number().int().min(0).max(2_000),
    default: 150,
    description: "Presence: delay before forcing a sync after subscribe (ms).",
  },

  // Typing indicators (frontend)
  "ux.typing.inactivity_ms": {
    scope: "public",
    schema: z.number().int().min(250).max(60_000),
    default: 3_000,
    description: "Typing: stop typing after this many ms without input.",
  },
  "ux.typing.heartbeat_ms": {
    scope: "public",
    schema: z.number().int().min(250).max(30_000),
    default: 2_000,
    description: "Typing: re-broadcast typing at most once per heartbeat (ms).",
  },
  "ux.typing.remote_ttl_ms": {
    scope: "public",
    schema: z.number().int().min(250).max(120_000),
    default: 5_000,
    description: "Typing: remote typing indicator expiry TTL (ms).",
  },

  // Messages composer
  "ux.messages.max_message_chars": {
    scope: "public",
    description: "Max characters allowed in the message composer.",
    schema: z.number().int().min(50).max(20000),
    default: 2000,
  },
  "ux.messages.search.min_query_chars": {
    scope: "public",
    description: "Messages: minimum query length to enable in-conversation search.",
    schema: z.number().int().min(1).max(10),
    default: 2,
  },
  "ux.messages.composer_max_height_px": {
    scope: "public",
    description: "Max auto-resize height for the message composer textarea (px).",
    schema: z.number().int().min(60).max(600),
    default: 140,
  },

  // Attachments
  "ux.attachments.max_image_bytes": {
    scope: "public",
    description: "Max allowed size for an uploaded chat image (bytes). Non-secret; used for client-side validation only.",
    schema: z.number().int().min(1_000_000).max(100_000_000),
    default: 10 * 1024 * 1024,
  },

  // Search
  "ux.search.page_size": {
    scope: "public",
    description: "Search results page size used by the client and fallback DB query.",
    schema: z.number().int().min(5).max(100),
    default: 20,
  },
  "ux.search.batch_sync_limit": {
    scope: "public",
    description: "Max external TMDb results to attempt syncing into the catalog per page.",
    schema: z.number().int().min(0).max(50),
    default: 5,
  },
  "ux.search.min_query_chars": {
    scope: "public",
    description: "Minimum query length to enable search.",
    schema: z.number().int().min(1).max(10),
    default: 2,
  },
  "ux.search.stale_time_ms": {
    scope: "public",
    description: "React Query: staleTime for title search (ms). Set to 0 to always refetch.",
    schema: z.number().int().min(0).max(7 * 24 * 60 * 60 * 1000),
    default: 1000 * 60 * 30,
  },
  "ux.search.gc_time_ms": {
    scope: "public",
    description: "React Query: gcTime for title search cache (ms).",
    schema: z.number().int().min(0).max(7 * 24 * 60 * 60 * 1000),
    default: 1000 * 60 * 60,
  },

  // Ops (frontend)
  "ops.frontend.function_timeout_ms": {
    scope: "public",
    description: "Default timeout for calling Supabase Edge Functions (ms).",
    schema: z.number().int().min(1000).max(120000),
    default: 20000,
  },

  // Admin dashboard defaults (admin-only, non-secret)
  "admin.users.page_limit": {
    scope: "admin",
    description: "Admin Users: page size used by admin-users list endpoint (offset-based pagination).",
    schema: z.number().int().min(10).max(500),
    default: 50,
  },
  "admin.users.ban_duration_days": {
    scope: "admin",
    description: "Admin Users: ban duration (days) applied when admin-users action=ban.",
    schema: z.number().int().min(1).max(36500),
    default: 365 * 50,
  },
  "admin.overview.recent_errors_limit": {
    scope: "admin",
    description: "Admin Overview: number of recent error rows to return (last 24h).",
    schema: z.number().int().min(1).max(200),
    default: 50,
  },
  "admin.overview.last_job_runs_limit": {
    scope: "admin",
    description: "Admin Overview: number of last job runs to return.",
    schema: z.number().int().min(1).max(200),
    default: 20,
  },
  "admin.overview.ops_alerts_limit": {
    scope: "admin",
    description: "Admin Overview: maximum number of active ops alerts to show.",
    schema: z.number().int().min(1).max(200),
    default: 25,
  },

  // Admin diagnostics (admin-only, non-secret)
  "admin.diagnostics.read_source_default": {
    scope: "admin",
    description: "Admin diagnostics: preferred read source for admin dashboards (direct PostgREST read vs Edge Function).",
    schema: z.enum(["auto", "direct", "edge"]),
    default: "auto",
  },
  "admin.diagnostics.read_source_overrides": {
    scope: "admin",
    description: "Admin diagnostics: per-section overrides for preferred read source. JSON object mapping section -> 'auto' | 'direct' | 'edge'.",
    schema: z.record(z.enum(["auto", "direct", "edge"])).default({}),
    default: {},
  },


  "admin.audit.default_limit": {
    scope: "admin",
    description: "Admin Audit: default limit when the request omits the limit query param.",
    schema: z.number().int().min(1).max(200),
    default: 50,
  },
  "ops.search.timeout_ms": {
    scope: "public",
    description: "Timeout for search-related Edge Function calls (ms).",
    schema: z.number().int().min(1000).max(120000),
    default: 20000,
  },

  // Rate limits (server-only, non-secret)
  "ops.rate_limits": {
    scope: "server_only",
    description: "Per-action rate limits (max per minute). Used by Edge Functions that call enforceRateLimit().",
    schema: z.object({
      actions: z.record(z.number().int().min(1).max(6000)),
    }),
    default: {
      actions: {
        "catalog-sync": 60,
        "swipe_deck": 120,
        "swipe_event": 1000,
      },
    },
  },
  // Trending refresh (ops)
  "ops.trending_refresh.lookback_days_default": {
    scope: "server_only",
    description: "Default lookback days for the trending refresh job when request omits lookbackDays.",
    schema: z.number().int().min(1).max(60),
    default: 14,
  },
  "ops.trending_refresh.half_life_hours_default": {
    scope: "server_only",
    description: "Default half-life hours for the trending refresh job when request omits halfLifeHours.",
    schema: z.number().int().min(1).max(720),
    default: 72,
  },
  "ops.trending_refresh.completeness_min_default": {
    scope: "server_only",
    description: "Default completeness_min for trending refresh when request omits completenessMin.",
    schema: z.number().min(0).max(1),
    default: 0.75,
  },

  // TMDb proxy (server-only, non-secret)
  "integrations.tmdb_proxy.default_language": {
    scope: "server_only",
    description: "Default TMDb language parameter when the client does not provide one (e.g., en-US).",
    schema: z.string().min(1).max(32),
    default: "en-US",
  },
  "integrations.tmdb_proxy.max_query_len": {
    scope: "server_only",
    description: "Max length for TMDb search query forwarded by tmdb-proxy.",
    schema: z.number().int().min(10).max(500),
    default: 200,
  },
  "integrations.tmdb_proxy.max_page": {
    scope: "server_only",
    description: "Max TMDb page number allowed via tmdb-proxy.",
    schema: z.number().int().min(1).max(500),
    default: 50,
  },
  "integrations.tmdb_proxy.timeout_ms": {
    scope: "server_only",
    description: "HTTP timeout used by tmdb-proxy when calling TMDb (ms).",
    schema: z.number().int().min(1000).max(30000),
    default: 8000,
  },
  "integrations.tmdb_proxy.max_per_minute": {
    scope: "server_only",
    description: "Per-user rate limit for tmdb-proxy requests (max per minute).",
    schema: z.number().int().min(10).max(600),
    default: 120,
  },

  // Assistant tool result truncation (server-only, non-secret)
  "assistant.tool_result_truncation": {
    scope: "server_only",
    description: "Default + cap for truncating assistant tool result payloads returned to clients (prevents huge JSON from flooding UI / model).",
    schema: z.object({
      defaults: z.object({
        maxString: z.number().int().min(80).max(4000),
        maxArray: z.number().int().min(1).max(200),
        maxObjectKeys: z.number().int().min(5).max(200),
      }),
      caps: z.object({
        maxString: z.number().int().min(80).max(4000),
        maxArray: z.number().int().min(1).max(200),
        maxObjectKeys: z.number().int().min(5).max(200),
      }),
      maxDepth: z.number().int().min(1).max(8),
    }),
    default: {
      defaults: { maxString: 1200, maxArray: 40, maxObjectKeys: 60 },
      caps: { maxString: 4000, maxArray: 200, maxObjectKeys: 200 },
      maxDepth: 4,
    },
  },

  "assistant.output_validation.mode": {
    scope: "server_only",
    description: "Structured output validation policy for assistant responses (strict rejects invalid output).",
    schema: z.enum(["strict", "lenient"]),
    default: "lenient",
  },
  "assistant.output_validation.auto_heal": {
    scope: "server_only",
    description: "Attempt auto-healing when structured output validation fails.",
    schema: z.boolean(),
    default: true,
  },


  // Assistant reply runner knobs (server-only, non-secret)
  "assistant.reply_runner.claim_limit_default": {
    scope: "server_only",
    description: "Default number of reply jobs to claim per runner invocation when request omits limit.",
    schema: z.number().int().min(1).max(200),
    default: 20,
  },
  "assistant.reply_runner.max_attempts_default": {
    scope: "server_only",
    description: "Default maxAttempts for runner processing when request omits maxAttempts.",
    schema: z.number().int().min(1).max(10),
    default: 5,
  },
  "assistant.reply_runner.stuck_minutes": {
    scope: "server_only",
    description: "Minutes after which a job is considered stuck and eligible to be reclaimed.",
    schema: z.number().int().min(1).max(120),
    default: 10,
  },
  "assistant.reply_runner.max_context_messages": {
    scope: "server_only",
    description: "maxContextMessages passed to assistant-chat-reply from the runner (background execution).",
    schema: z.number().int().min(1).max(50),
    default: 12,
  },
  "assistant.reply_runner.backoff": {
    scope: "server_only",
    description: "Backoff strategy for rescheduling jobs after rate limiting or transient errors.",
    schema: z.object({
      base_seconds: z.number().int().min(1).max(120),
      max_exp: z.number().int().min(1).max(16),
      max_seconds: z.number().int().min(10).max(7200),
      jitter_seconds: z.number().int().min(0).max(30),
    }),
    default: {
      base_seconds: 10,
      max_exp: 10,
      max_seconds: 3600,
      jitter_seconds: 5,
    },
  },


// ML (server-side) rerank model selection (non-secret)
"ml.rerank.provider": {
  scope: "server_only",
  description: "Provider used for reranking (currently only 'voyage' is supported).",
  schema: z.enum(["voyage"]),
  default: "voyage",
},
"ml.rerank.model": {
  scope: "server_only",
  description: "Rerank model name used by Voyage rerank (e.g., 'rerank-2.5').",
  schema: z.string().min(1).max(80),
  default: "rerank-2.5",
},

  // Rerank ops knobs (server-only, non-secret)
  "ops.rerank.cache_ttl_seconds": {
    scope: "server_only",
    description: "TTL for persistent Voyage rerank cache entries (seconds).",
    schema: z.number().int().min(60).max(86400),
    default: 600,
  },
  "ops.rerank.fresh_window_seconds": {
    scope: "server_only",
    description: "Freshness window for re-running rerank without explicit query (seconds).",
    schema: z.number().int().min(0).max(7 * 86400),
    default: 21600,
  },
  "ops.rerank.cooldown_429_seconds": {
    scope: "server_only",
    description: "Cooldown applied when Voyage rerank returns 429 (seconds).",
    schema: z.number().int().min(10).max(3600),
    default: 300,
  },

  // Swipe cold-start behavior (server-only, non-secret)
  "ranking.swipe.cold_start.lookback_days": {
    scope: "server_only",
    description: "Lookback window (days) for cold-start strong-positive detection.",
    schema: z.number().int().min(1).max(180),
    default: 30,
  },
  "ranking.swipe.cold_start.min_strong_positive": {
    scope: "server_only",
    description: "Minimum strong-positive signals required to avoid cold-start mode.",
    schema: z.number().int().min(0).max(20),
    default: 3,
  },

  "ranking.swipe.cold_start.event_limit": {
    scope: "server_only",
    description: "Max number of recent media_events rows scanned for cold-start strong-positive detection.",
    schema: z.number().int().min(10).max(300),
    default: 120,
  },

  "ranking.swipe.deck": {
    scope: "server_only",
    description: "Server-side tuning for swipe deck sizing and enrichment behavior.",
    schema: z.object({
      default_limit: z.number().int().min(1).max(120),
      max_limit: z.number().int().min(1).max(120),
      rpc_extra_factor_base: z.number().int().min(1).max(6),
      rpc_extra_factor_with_filters: z.number().int().min(1).max(6),
      rpc_limit_cap: z.number().int().min(1).max(200),
      fill_second_attempt_enabled: z.boolean(),
      fill_second_seed_suffix: z.string().min(1).max(20),
      media_item_fetch_ids_cap: z.number().int().min(50).max(1000),
      seg_pop_quota: z.number().int().min(0).max(60),
      seg_pop_pool_limit: z.number().int().min(50).max(1000),
      apply_muted_genres: z.boolean(),
      mix: z.object({
        enabled: z.boolean(),
      }),
    }),
    default: {
      default_limit: 60,
      max_limit: 120,
      rpc_extra_factor_base: 2,
      rpc_extra_factor_with_filters: 3,
      rpc_limit_cap: 120,
      fill_second_attempt_enabled: true,
      fill_second_seed_suffix: "fill2",
      media_item_fetch_ids_cap: 500,
      seg_pop_quota: 20,
      seg_pop_pool_limit: 200,
      apply_muted_genres: true,
      mix: {
        enabled: true,
      },
    },
  },


  "ranking.swipe.blend": {
    scope: "server_only",
    description: "Score blending/calibration knobs used to reorder swipe deck candidates (source multipliers + feature weights).",
    schema: z.object({
      enabled: z.boolean(),
      // When true, blending is skipped if a mix/interleaving experiment is active to avoid confounded experiments.
      skip_when_mix_active: z.boolean(),
      // Feature weights for the blend score (all >= 0). Score = Σ(w_i * feature_i) * source_multiplier.
      weights: z.object({
        position: z.number().min(0).max(10),
        popularity: z.number().min(0).max(10),
        vote_avg: z.number().min(0).max(10),
        cf_score: z.number().min(0).max(10),
      }),
      // Per-source multipliers for calibration (>= 0).
      source_multipliers: z.object({
        for_you: z.number().min(0).max(10),
        combined: z.number().min(0).max(10),
        friends: z.number().min(0).max(10),
        trending: z.number().min(0).max(10),
        cf: z.number().min(0).max(10),
        seg_pop: z.number().min(0).max(10),
        other: z.number().min(0).max(10),
      }),
    }),
    default: {
      enabled: true,
      skip_when_mix_active: true,
      weights: { position: 1.0, popularity: 0.25, vote_avg: 0.15, cf_score: 1.0 },
      source_multipliers: { for_you: 1.0, combined: 1.0, friends: 1.0, trending: 1.0, cf: 1.0, seg_pop: 0.9, other: 1.0 },
    },
  },



  // Swipe event ingestion + centroid refresh knobs (server-only, non-secret)
  "ranking.swipe.status_watched.synthetic_dwell_ms": {
    scope: "server_only",
    description: "When the app sends status=watched, we emit a synthetic dwell event with this dwell_ms value (to avoid over-strong positive feedback).",
    schema: z.number().int().min(0).max(600_000),
    default: 12000,
  },
  "ranking.swipe.centroids.refresh_sample_rate": {
    scope: "server_only",
    description: "Probability (0..1) of refreshing user centroids after a strong-positive event batch (reduces DB load).",
    schema: z.number().min(0).max(1),
    default: 0.25,
  },
  "ranking.swipe.centroids.k": {
    scope: "server_only",
    description: "Number of taste centroids to maintain per user (k in k-means-like refresh).",
    schema: z.number().int().min(1).max(10),
    default: 3,
  },
  "ranking.swipe.centroids.max_items": {
    scope: "server_only",
    description: "Maximum positive-history items used to refresh centroids (higher = more stable, more compute).",
    schema: z.number().int().min(10).max(200),
    default: 60,
  },
  "ranking.swipe.taste": {
    scope: "server_only",
    description: "Taste-profile extraction knobs (events lookback, strong-signal thresholds, and profile compacting).",
    schema: z.object({
      lookback_days: z.number().int().min(1).max(180),
      event_limit: z.number().int().min(50).max(1000),
      pick_liked_max: z.number().int().min(1).max(12),
      pick_disliked_max: z.number().int().min(0).max(10),
      min_liked_for_query: z.number().int().min(1).max(12),
      thresholds: z.object({
        strong_positive_rating_min: z.number().min(0).max(10),
        strong_negative_rating_max: z.number().min(0).max(10),
        strong_positive_dwell_ms_min: z.number().int().min(0).max(600_000),
      }),
    }),
    default: {
      lookback_days: 30,
      event_limit: 250,
      pick_liked_max: 6,
      pick_disliked_max: 4,
      min_liked_for_query: 3,
      thresholds: {
        strong_positive_rating_min: 7,
        strong_negative_rating_max: 3,
        strong_positive_dwell_ms_min: 12000,
      },
    },
  },



  "ranking.swipe.taste_match": {
    scope: "server_only",
    description: "Taste-match text profile shaping (weights and output caps) used by swipe reranking.",
    schema: z.object({
      summarize: z.object({
        genre_like_delta: z.number().int().min(-10).max(10),
        genre_dislike_delta: z.number().int().min(-10).max(10),
        vibe_like_delta: z.number().int().min(-10).max(10),
        vibe_dislike_delta: z.number().int().min(-10).max(10),
        keyword_like_delta: z.number().int().min(-10).max(10),
        keyword_dislike_delta: z.number().int().min(-10).max(10),
        era_like_delta: z.number().int().min(-10).max(10),
        era_dislike_delta: z.number().int().min(-10).max(10),

        keywords_per_item: z.number().int().min(0).max(40),
        score_min_abs: z.number().int().min(0).max(10),
        prefer_genres_take: z.number().int().min(0).max(30),
        prefer_vibes_take: z.number().int().min(0).max(30),
        avoid_value_lt: z.number().min(-100).max(100),
        avoid_take: z.number().int().min(0).max(30),

        liked_titles_max: z.number().int().min(0).max(20),
        disliked_titles_max: z.number().int().min(0).max(20),
      }),
      query_caps: z.object({
        liked_titles_max: z.number().int().min(0).max(20),
        disliked_titles_max: z.number().int().min(0).max(20),
        prefer_genres_max: z.number().int().min(0).max(30),
        prefer_vibes_max: z.number().int().min(0).max(30),
        avoid_max: z.number().int().min(0).max(30),
      }),
      doc_caps: z.object({
        genres_max: z.number().int().min(0).max(30),
        vibe_max: z.number().int().min(0).max(30),
        languages_max: z.number().int().min(0).max(10),
        countries_max: z.number().int().min(0).max(10),
        people_max: z.number().int().min(0).max(20),
        keywords_max: z.number().int().min(0).max(50),
      }),
    }),
    default: {
      summarize: {
        genre_like_delta: 2,
        genre_dislike_delta: -2,
        vibe_like_delta: 2,
        vibe_dislike_delta: -2,
        keyword_like_delta: 1,
        keyword_dislike_delta: -1,
        era_like_delta: 1,
        era_dislike_delta: -1,

        keywords_per_item: 8,
        score_min_abs: 1,
        prefer_genres_take: 8,
        prefer_vibes_take: 6,
        avoid_value_lt: -2,
        avoid_take: 10,

        liked_titles_max: 6,
        disliked_titles_max: 4,
      },
      query_caps: {
        liked_titles_max: 6,
        disliked_titles_max: 4,
        prefer_genres_max: 10,
        prefer_vibes_max: 8,
        avoid_max: 10,
      },
      doc_caps: {
        genres_max: 8,
        vibe_max: 6,
        languages_max: 3,
        countries_max: 3,
        people_max: 6,
        keywords_max: 12,
      },
    },
  },
  "ops.rerank.adaptive_topk": {
    scope: "server_only",
    description: "Adaptive rerank candidate sizing based on taste signal strength (strongPosCount).",
    schema: z.object({
      explicit_query_max: z.number().int().min(1).max(200),
      thresholds: z.array(z.object({
        lt: z.number().int().min(0).max(1000),
        topk: z.number().int().min(1).max(200),
      })).min(1).max(10),
      default_topk: z.number().int().min(1).max(200),
    }),
    default: {
      explicit_query_max: 60,
      thresholds: [
        { lt: 5, topk: 15 },
        { lt: 15, topk: 25 },
        { lt: 40, topk: 40 },
      ],
      default_topk: 60,
    },
  },

  // OpenRouter health checks (server-only ops)
  "ops.openrouter.health_check.enabled": {
    scope: "server_only",
    description: "Enable the scheduled OpenRouter health-check job that raises ops alerts (credits/limits/cache staleness).",
    schema: z.boolean(),
    default: true,
  },
  "ops.openrouter.health_check.cache_stale_minutes": {
    scope: "server_only",
    description: "If OpenRouter cache entries are older than this many minutes, raise a cache-stale ops alert.",
    schema: z.number().int().min(1).max(1440),
    default: 90,
  },
  "ops.openrouter.health_check.min_credits_remaining": {
    scope: "server_only",
    description: "Raise a low-credits alert when remaining credits (USD) drop below this threshold.",
    schema: z.number().min(0).max(100000),
    default: 2,
  },
  "ops.openrouter.health_check.min_key_limit_remaining": {
    scope: "server_only",
    description: "Raise a low-key-limit alert when OpenRouter key limit remaining drops below this threshold.",
    schema: z.number().int().min(0).max(1000000),
    default: 10,
  },
  "ops.openrouter.health_check.max_open_circuits": {
    scope: "server_only",
    description: "Raise an alert when the number of currently-open OpenRouter circuit breakers exceeds this value.",
    schema: z.number().int().min(0).max(1000),
    default: 3,
  },
  "ops.openrouter.health_check.auto_resolve": {
    scope: "server_only",
    description: "Automatically resolve health-check alerts when the underlying condition clears.",
    schema: z.boolean(),
    default: true,
  },


  // OpenRouter circuit breaker (server-only ops)
  "ops.openrouter.circuit.enabled": {
    scope: "server_only",
    description: "Enable DB-backed circuit breaker to temporarily skip models that return repeated 429/5xx.",
    schema: z.boolean(),
    default: true,
  },
  "ops.openrouter.circuit.threshold": {
    scope: "server_only",
    description: "Number of failures before a model's circuit is opened.",
    schema: z.number().int().min(1).max(20),
    default: 3,
  },
  "ops.openrouter.circuit.cooldown_seconds": {
    scope: "server_only",
    description: "Seconds to keep a model circuit open before allowing retries again.",
    schema: z.number().int().min(5).max(3600),
    default: 30,
  },

} as const satisfies Record<string, AppSettingRegistryEntry<any>>;

export type KnownAppSettingKey = keyof typeof APP_SETTINGS_REGISTRY;

export function isKnownSettingKey(key: string): key is KnownAppSettingKey {
  return Object.prototype.hasOwnProperty.call(APP_SETTINGS_REGISTRY, key);
}

export function getRegistryEntry(key: KnownAppSettingKey) {
  return APP_SETTINGS_REGISTRY[key];
}

export function getDefaultSettingsForScope(scope: AppSettingScope): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(APP_SETTINGS_REGISTRY)) {
    if (entry.scope === scope) out[key] = entry.default;
  }
  return out;
}

export function getDefaultPublicSettings(): Record<string, unknown> {
  return getDefaultSettingsForScope("public");
}

export function validateSettingValue(key: KnownAppSettingKey, value: unknown): unknown {
  const entry = getRegistryEntry(key);
  return entry.schema.parse(value);
}
