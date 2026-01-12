// src/lib/settings/defaultPublicSettings.ts
//
// Backwards-compatible public settings defaults.
//
// IMPORTANT:
// - These MUST match the current hard-coded behavior.
// - These are used when the settings endpoint is unavailable or not yet loaded.

export const DEFAULT_PUBLIC_SETTINGS = {
  // Assistant
  "ux.assistant.username": "movinesta",

  // Presence
  "ux.presence.channel": "presence:global",
  "ux.presence.label_online": "Online",
  "ux.presence.label_active_recently": "Active recently",
  "ux.presence.label_active_prefix": "Active",
  "ux.presence.online_ttl_ms": 45_000,
  "ux.presence.away_ttl_ms": 2 * 60_000,
  "ux.presence.heartbeat_ms": 20_000,
  "ux.presence.recompute_ms": 5_000,
  "ux.presence.db_touch_min_interval_ms": 60_000,
  "ux.presence.initial_sync_delay_ms": 150,

  // Typing
  "ux.typing.inactivity_ms": 3_000,
  "ux.typing.heartbeat_ms": 2_000,
  "ux.typing.remote_ttl_ms": 5_000,

  // Messages composer
  "ux.messages.max_message_chars": 2000,
  "ux.messages.composer_max_height_px": 140,

  // Messages search
  "ux.messages.search.min_query_chars": 2,

  // Attachments
  "ux.attachments.max_image_bytes": 10 * 1024 * 1024,

  // Search
  "ux.search.page_size": 20,
  "ux.search.batch_sync_limit": 5,
  "ux.search.min_query_chars": 2,
  "ux.search.stale_time_ms": 1000 * 60 * 30,
  "ux.search.gc_time_ms": 1000 * 60 * 60,

  // Ops (frontend)
  "ops.frontend.function_timeout_ms": 20_000,
  "ops.search.timeout_ms": 20_000,
} as const;

export type PublicSettingKey = keyof typeof DEFAULT_PUBLIC_SETTINGS;
