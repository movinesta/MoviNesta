export type SettingExample = {
  scenario: string;
  effect: string;
};

export type SettingImpactHints = Partial<
  Record<"ux" | "performance" | "cost" | "safety" | "ops" | "quality", string>
>;

export type SettingHint = {
  /** Human name shown in the hint drawer. */
  title: string;
  /** Plain-English explanation of what the setting does. */
  details: string;
  /** Practical examples describing what changes in the app. */
  examples?: SettingExample[];
  /** A suggested value (can be string/number/boolean/object). */
  recommended?: any;
  /** Why the recommended value is a good default. */
  recommended_why?: string;
  /** Optional conservative alternative. */
  recommended_safe?: any;
  recommended_safe_why?: string;
  /** Optional aggressive alternative. */
  recommended_aggressive?: any;
  recommended_aggressive_why?: string;
  /** Quick impact hints shown as chips (short). */
  impacts?: SettingImpactHints;
  /** Optional caution text when setting too high/low can be harmful. */
  caution?: string;
  /** Related keys to look at when tuning. */
  related?: string[];
};

// Curated, user-friendly hints for the most important knobs.
// If a key is missing here, the UI will still show a generic hint using server registry info.
export const SETTING_HINTS: Record<string, SettingHint> = {
  // --- Presence / typing (public UX) ---
    "ux.presence.heartbeat_ms": {
    title: "Presence heartbeat",
    details: "How often the client broadcasts presence heartbeats (ms). Smaller values feel more ‘live’ but create more realtime traffic.",
    examples: [
      { scenario: "Set to 10000ms", effect: "Faster updates; higher Realtime traffic + battery use." },
      { scenario: "Set to 30000ms", effect: "Lower traffic; presence may lag slightly." },
    ],
    recommended: 20000,
    recommended_why: "Balanced default: responsive without being too chatty.",
    recommended_safe: 25000,
    recommended_safe_why: "Slightly less Realtime traffic, still responsive.",
    recommended_aggressive: 10000,
    recommended_aggressive_why: "Very snappy presence, but higher traffic.",
    impacts: { ux: "presence freshness", performance: "realtime traffic" },
    caution: "Very low values can increase Realtime load and mobile battery usage.",
    related: ["ux.presence.online_ttl_ms", "ux.presence.db_touch_min_interval_ms"],
  },

    "ux.presence.online_ttl_ms": {
    title: "Online TTL window",
    details: "A user is shown as ‘online’ if their last_seen timestamp is within this window (ms).",
    examples: [
      { scenario: "Lower it (e.g., 20000ms)", effect: "Online clears faster when users disconnect abruptly." },
      { scenario: "Raise it (e.g., 90000ms)", effect: "Users stay online longer; less accurate." },
    ],
    recommended: 45000,
    recommended_why: "Default: responsive but tolerant of mobile networks.",
    impacts: { ux: "online accuracy" },
    related: ["ux.presence.heartbeat_ms", "ux.presence.db_touch_min_interval_ms"],
  },
  "ux.presence.away_ttl_ms": {
    title: "Away TTL window",
    details: "A user is shown as ‘away’ (recently active) if last_seen is within this window (ms).",
    examples: [
      { scenario: "Set to 60000ms", effect: "Away expires quickly; users move to ‘offline’ sooner." },
      { scenario: "Set to 600000ms", effect: "Away lasts longer; more forgiving but less precise." },
    ],
    recommended: 120000,
    recommended_why: "Good UX default: not too aggressive on offline transitions.",
    impacts: { ux: "presence labels" },
    related: ["ux.presence.online_ttl_ms"],
  },

  "ux.presence.db_touch_min_interval_ms": {
    title: "DB last_seen write interval",
    details: "Minimum interval between writing last_seen to the database (ms). Throttles DB writes while preserving UX.",
    examples: [
      { scenario: "Set to 30000ms", effect: "More accurate timestamps; more DB writes." },
      { scenario: "Set to 120000ms", effect: "Fewer DB writes; less granular last_seen." },
    ],
    recommended: 60000,
    recommended_why: "Default throttle to protect DB while keeping timestamps useful.",
    impacts: { performance: "db write volume", ops: "db load" },
    related: ["ux.presence.heartbeat_ms"],
  },

  "ux.presence.initial_sync_delay_ms": {
    title: "Presence initial sync delay",
    details: "Delay before forcing the first presence sync after subscribing (ms). Helps avoid bursts during initial load.",
    examples: [
      { scenario: "Set to 0", effect: "Fastest initial presence; can burst on load." },
      { scenario: "Set to 200", effect: "Smoother load; tiny UX delay." },
    ],
    recommended: 150,
    recommended_why: "Small delay that reduces burstiness while feeling instant.",
    impacts: { performance: "burst control", ux: "first load" },
    related: ["ux.presence.heartbeat_ms"],
  },


    "ux.typing.remote_ttl_ms": {
    title: "Remote typing TTL",
    details: "How long to keep showing a remote user as typing if no new typing heartbeat arrives (ms).",
    examples: [
      { scenario: "Set to 3000ms", effect: "Typing clears quickly; can feel unstable on poor networks." },
      { scenario: "Set to 10000ms", effect: "More forgiving; may feel stale." },
    ],
    recommended: 5000,
    recommended_why: "Good balance for mobile networks without feeling stale.",
    impacts: { ux: "typing stability" },
    related: ["ux.typing.heartbeat_ms", "ux.typing.inactivity_ms"],
  },
  "ux.typing.inactivity_ms": {
    title: "Typing inactivity cutoff",
    details: "Stops sending ‘typing’ after this many ms without local input.",
    examples: [
      { scenario: "Set to 1500ms", effect: "Typing clears quickly; can be ‘flickery’." },
      { scenario: "Set to 6000ms", effect: "More stable; slower to disappear." },
    ],
    recommended: 3000,
    recommended_why: "A natural ‘typing pause’ threshold.",
    impacts: { ux: "typing feel" },
    related: ["ux.typing.remote_ttl_ms"],
  },

  "ux.typing.heartbeat_ms": {
    title: "Typing heartbeat",
    details: "Maximum frequency for broadcasting typing updates (ms).",
    examples: [
      { scenario: "Set to 1000ms", effect: "More realtime updates; higher traffic." },
      { scenario: "Set to 4000ms", effect: "Lower traffic; typing may lag slightly." },
    ],
    recommended: 2000,
    recommended_why: "Responsive without being too chatty.",
    impacts: { ux: "typing freshness", performance: "realtime traffic" },
    related: ["ux.typing.remote_ttl_ms"],
  },



  // --- Messages UX (public) ---
    "ux.messages.max_message_chars": {
    title: "Max message length",
    details: "Maximum characters allowed in the message composer.",
    examples: [
      { scenario: "Set to 500", effect: "Forces short messages; can frustrate long-form users." },
      { scenario: "Set to 5000", effect: "Supports long messages; increases AI prompt cost." },
    ],
    recommended: 2000,
    recommended_why: "Default supports natural chat while preventing extremely long messages.",
    impacts: { ux: "composer limits", cost: "ai tokens" },
    caution: "Very large values can increase AI costs and slow rendering on large threads.",
    related: ["assistant.reply_runner.max_context_messages"],
  },
  "ux.messages.composer_max_height_px": {
    title: "Composer max height",
    details: "Maximum auto-resize height for the composer textarea (px).",
    examples: [
      { scenario: "Set to 100px", effect: "More compact UI; users scroll sooner." },
      { scenario: "Set to 300px", effect: "Easier long editing; uses more vertical space." },
    ],
    recommended: 140,
    recommended_why: "Default keeps UI tidy while allowing multi-line editing.",
    impacts: { ux: "layout density" },
  },


    "ux.attachments.max_image_bytes": {
    title: "Max image upload size",
    details: "Client-side limit for chat image upload size (bytes). Prevents huge uploads before the server rejects them.",
    examples: [
      { scenario: "Set to 5MB", effect: "Faster uploads; fewer large images allowed." },
      { scenario: "Set to 20MB", effect: "Allows bigger images; slower uploads and higher storage/bandwidth." },
    ],
    recommended: 10 * 1024 * 1024,
    recommended_why: "10MB is a practical balance for mobile images.",
    impacts: { ux: "upload success", cost: "storage/bandwidth" },
    caution: "Raising this increases storage and bandwidth costs.",
  },

    "ux.search.min_query_chars": {
    title: "Search min query length",
    details: "Minimum query length to enable search. Prevents expensive queries for tiny inputs.",
    examples: [
      { scenario: "Set to 1", effect: "Search triggers quickly; more query load." },
      { scenario: "Set to 3", effect: "Less load; users type more before results." },
    ],
    recommended: 2,
    recommended_why: "Good balance between responsiveness and avoiding noisy queries.",
    impacts: { performance: "query load", ux: "search responsiveness" },
    related: ["ux.search.page_size", "ops.search.timeout_ms"],
  },
  "ux.search.page_size": {
    title: "Search page size",
    details: "How many results per page for search. Higher values return more results but can be slower.",
    examples: [
      { scenario: "Set to 10", effect: "Faster responses; more pagination." },
      { scenario: "Set to 50", effect: "Fewer pages; heavier payload and slower." },
    ],
    recommended: 20,
    recommended_why: "Useful results while staying fast.",
    impacts: { performance: "payload size", ux: "scroll depth" },
  },

  "ux.search.stale_time_ms": {
    title: "Search cache staleTime",
    details: "React Query staleTime for search (ms). Higher values mean fewer refetches, but more stale results.",
    examples: [
      { scenario: "Set to 0", effect: "Always refetch; freshest but more requests." },
      { scenario: "Set to 30 minutes", effect: "Fewer calls; results can lag new content." },
    ],
    recommended: 1000 * 60 * 30,
    recommended_why: "Default reduces repeated calls while keeping results reasonably fresh.",
    impacts: { performance: "request volume", ux: "perceived speed" },
  },

  "ux.search.gc_time_ms": {
    title: "Search cache gcTime",
    details: "How long to keep unused search results in cache (ms).",
    examples: [
      { scenario: "Set to 5 minutes", effect: "Lower memory; more refetches." },
      { scenario: "Set to 2 hours", effect: "Fewer refetches; more memory usage." },
    ],
    recommended: 1000 * 60 * 60,
    recommended_why: "Keeps common searches warm without keeping data forever.",
    impacts: { performance: "memory usage" },
  },

  "ux.search.batch_sync_limit": {
    title: "Search background sync batch size",
    details: "How many records the client syncs per batch (when doing background search index sync).",
    examples: [
      { scenario: "Set to 200", effect: "Smoother but slower overall sync." },
      { scenario: "Set to 2000", effect: "Faster sync; can spike CPU/network." },
    ],
    recommended: 800,
    recommended_why: "Default avoids spikes on mid-range devices.",
    impacts: { performance: "sync burst", ux: "background smoothness" },
  },



  // --- Ops / Integrations (server_only) ---
  "ops.rate_limits": {
    title: "Per-action rate limits",
    details: "Server-only throttle settings used by Edge Functions to limit abusive/high-cost operations.",
    examples: [
      { scenario: "Lower catalog-sync to 30/min", effect: "Prevents bursts; slower bulk sync for users." },
      { scenario: "Raise to 120/min", effect: "Faster sync, but higher DB/API pressure." },
    ],
    recommended: { actions: { "catalog-sync": 60 } },
    recommended_why: "Keeps sync responsive while preventing accidental tight loops.",
    recommended_safe: { actions: { "catalog-sync": 30 } },
    recommended_safe_why: "More conservative; better during outages or heavy load.",
    recommended_aggressive: { actions: { "catalog-sync": 120 } },
    recommended_aggressive_why: "Faster bursts; higher DB/API pressure.",
    impacts: { ops: "throttling", performance: "DB/API load", cost: "upstream usage" },
    caution: "High values can amplify costs and rate-limit upstream services.",
  },
  "assistant.tool_result_truncation": {
    title: "Assistant tool result truncation",
    details: "Caps tool outputs returned to the assistant/client so huge payloads don’t blow up tokens or UI.",
    examples: [
      { scenario: "Increase maxString to 2500", effect: "More context in tool results; higher token usage." },
      { scenario: "Reduce maxArray to 20", effect: "Smaller payloads; might hide useful list items." },
    ],
    recommended: {
      defaults: { maxString: 1200, maxArray: 40, maxObjectKeys: 60 },
      caps: { maxString: 4000, maxArray: 200, maxObjectKeys: 200 },
      maxDepth: 4,
    },
    recommended_why: "Keeps most tool responses usable while preventing huge token spikes.",
    recommended_safe: {
      defaults: { maxString: 800, maxArray: 30, maxObjectKeys: 40 },
      caps: { maxString: 2500, maxArray: 120, maxObjectKeys: 120 },
      maxDepth: 4,
    },
    recommended_safe_why: "More conservative payload sizes; reduces token/cost risk.",
    recommended_aggressive: {
      defaults: { maxString: 2000, maxArray: 60, maxObjectKeys: 80 },
      caps: { maxString: 6000, maxArray: 300, maxObjectKeys: 300 },
      maxDepth: 5,
    },
    recommended_aggressive_why: "More context in tool results; higher token usage risk.",
    impacts: { cost: "tokens", performance: "payload size", ux: "assistant quality" },
  },
  "assistant.reply_runner.backoff": {
    title: "Assistant reply runner backoff",
    details: "How the background worker spaces retries after failures (exponential backoff + jitter).",
    examples: [
      { scenario: "Increase base_seconds to 20", effect: "Slower retries; reduces contention during outages." },
      { scenario: "Reduce max_seconds to 600", effect: "Faster recovery after transient errors; more retry load." },
    ],
    recommended: { base_seconds: 10, max_exp: 10, max_seconds: 3600, jitter_seconds: 5 },
    recommended_why: "Balances resilience (keeps trying) without hammering providers.",
    recommended_safe: { base_seconds: 15, max_exp: 10, max_seconds: 7200, jitter_seconds: 8 },
    recommended_safe_why: "Slower retries; safer during provider issues/outages.",
    recommended_aggressive: { base_seconds: 5, max_exp: 9, max_seconds: 1200, jitter_seconds: 3 },
    recommended_aggressive_why: "Faster recovery from transient errors; more retry pressure.",
    impacts: { ops: "retries", performance: "queue pressure", cost: "provider usage" },
  },

  // --- Admin dashboard (admin scope) ---
  "admin.users.page_limit": {
    title: "Admin Users list page size",
    details: "Controls how many users the Admin Users page fetches per request.",
    examples: [
      { scenario: "Set to 25", effect: "Faster load, less scrolling; more pagination." },
      { scenario: "Set to 200", effect: "Fewer pages; can slow load for large accounts." },
    ],
    recommended: 50,
    recommended_why: "Good balance between speed and admin convenience.",
    recommended_safe: 25,
    recommended_safe_why: "Faster loads on big accounts; more pagination.",
    recommended_aggressive: 150,
    recommended_aggressive_why: "Fewer pages; heavier response payloads.",
    impacts: { ux: "admin speed", performance: "endpoint load" },
    caution: "Very high values can stress admin endpoints.",
  },
  "admin.audit.default_limit": {
    title: "Audit default limit",
    details: "Default row count returned by Admin Audit if no limit is provided.",
    examples: [
      { scenario: "Set to 20", effect: "Quick glance view; less scrolling." },
      { scenario: "Set to 150", effect: "More history visible; heavier response payload." },
    ],
    recommended: 50,
    recommended_why: "Enough rows for investigation without huge payloads.",
    recommended_safe: 25,
    recommended_safe_why: "Quicker load; smaller payload.",
    recommended_aggressive: 150,
    recommended_aggressive_why: "More rows visible; heavier responses.",
    impacts: { ux: "investigation speed", performance: "endpoint load" },
  },
  // --- Assistant runner (server_only) ---
  "assistant.reply_runner.claim_limit_default": {
    title: "Runner claim limit",
    details: "How many pending assistant-reply jobs a single runner invocation claims by default. Higher values increase throughput, but can cause bigger traffic bursts and increase the chance of timeouts.",
    examples: [
      { scenario: "Set to 10", effect: "Smoother load; slower backlog drain during spikes." },
      { scenario: "Set to 50", effect: "Faster backlog drain; more bursty provider usage and higher risk of hitting rate limits." },
    ],
    recommended: 20,
    recommended_why: "A balanced default: drains normal queues quickly without creating huge bursts.",
    recommended_safe: 10,
    recommended_safe_why: "Lower burst risk; good for smaller deployments or tight provider limits.",
    recommended_aggressive: 50,
    recommended_aggressive_why: "Maximizes throughput if you have headroom and strong rate-limit handling.",
    impacts: { performance: "throughput vs burstiness", cost: "provider usage spikes", ops: "queue stability" },
    caution: "If set too high, one invocation may spend its entire time budget processing claims and leave jobs half-finished.",
    related: ["assistant.reply_runner.max_attempts_default", "assistant.reply_runner.backoff", "assistant.reply_runner.stuck_minutes"],
  },
  "assistant.reply_runner.max_attempts_default": {
    title: "Runner max attempts",
    details: "Default maximum retry attempts for a job. More attempts improves resilience during transient failures, but can turn outages into repeated retries.",
    examples: [
      { scenario: "Set to 3", effect: "Quicker failure; fewer retries during outages; less wasted cost." },
      { scenario: "Set to 7", effect: "More persistent retries; better recovery, but more load while degraded." },
    ],
    recommended: 5,
    recommended_why: "Good resilience without endless retries.",
    recommended_safe: 3,
    recommended_safe_why: "Minimizes retry cost during provider outages.",
    recommended_aggressive: 7,
    recommended_aggressive_why: "More persistent recovery when failures are usually transient.",
    impacts: { ops: "retry behavior", cost: "extra generations", safety: "stability under outages" },
    caution: "If retries are too high, a provider outage can create a retry storm.",
    related: ["assistant.reply_runner.backoff", "assistant.reply_runner.claim_limit_default"],
  },
  "assistant.reply_runner.stuck_minutes": {
    title: "Stuck job detection window",
    details: "How long a job can be ‘in progress’ without updates before it’s considered stuck and eligible for recovery.",
    examples: [
      { scenario: "Set to 5 minutes", effect: "Faster recovery from crashed workers; higher chance of false positives on slow runs." },
      { scenario: "Set to 20 minutes", effect: "Fewer false positives; slower recovery when a worker dies." },
    ],
    recommended: 10,
    recommended_why: "Enough time for normal work, while still recovering quickly from crashes.",
    recommended_safe: 15,
    recommended_safe_why: "Reduces false positives if jobs sometimes take longer (slow providers).",
    recommended_aggressive: 5,
    recommended_aggressive_why: "Fastest recovery if you prioritize responsiveness.",
    impacts: { ops: "job recovery speed", performance: "queue latency", cost: "duplicate work risk" },
    caution: "Too low can cause duplicate processing (two workers may re-run the same job).",
    related: ["assistant.reply_runner.max_attempts_default", "assistant.reply_runner.backoff"],
  },
  "assistant.reply_runner.max_context_messages": {
    title: "Max context messages",
    details: "How many recent messages are included as context when generating a reply. More context can improve quality, but increases tokens and latency.",
    examples: [
      { scenario: "Set to 8", effect: "Cheaper/faster replies; may lose important earlier context." },
      { scenario: "Set to 20", effect: "Better continuity; higher token cost and higher risk of long prompts." },
    ],
    recommended: 12,
    recommended_why: "Typically enough to keep conversation coherent without bloating prompts.",
    recommended_safe: 10,
    recommended_safe_why: "Saves cost while staying coherent for most chats.",
    recommended_aggressive: 18,
    recommended_aggressive_why: "More context for complex conversations (higher cost).",
    impacts: { ux: "assistant coherence", cost: "token usage", performance: "latency" },
    caution: "Very high values can lead to long prompts and more frequent provider length limits.",
    related: ["assistant.tool_result_truncation"],
  },

  // --- Rerank provider/model (server-only) ---
  "ml.rerank.provider": {
    title: "Rerank provider",
    details: "Which provider is used for reranking. In this project, only \"voyage\" is supported right now.",
    examples: [
      { scenario: "Keep default: voyage", effect: "Rerank works as expected." },
      { scenario: "Change to something else", effect: "Will likely fail validation/server calls because only voyage is supported." },
    ],
    recommended: "voyage",
    recommended_why: "Only supported option at the moment.",
    recommended_safe: "voyage",
    recommended_safe_why: "Same as recommended.",
    recommended_aggressive: "voyage",
    recommended_aggressive_why: "Same as recommended.",
    impacts: { ux: "ranking quality", performance: "latency", cost: "provider usage", ops: "stability" },
    caution: "If you want a different provider, add support in the server implementation + schema first.",
    related: ["ml.rerank.model", "ops.rerank.adaptive_topk", "ops.rerank.cache_ttl_seconds"],
  },

  "ml.rerank.model": {
    title: "Voyage rerank model",
    details: "The Voyage model name used for reranking (example: \"rerank-2.5\"). This controls quality vs latency/cost.",
    examples: [
      { scenario: "rerank-2.5", effect: "Balanced default for quality and speed." },
      { scenario: "Other Voyage model", effect: "May change quality/cost; check Voyage docs for supported model names." },
    ],
    recommended: "rerank-2.5",
    recommended_why: "Project default; a good balance for most catalogs.",
    recommended_safe: "rerank-2.5",
    recommended_safe_why: "Stick to the known-good default unless you’ve tested alternatives.",
    recommended_aggressive: "rerank-2.5",
    recommended_aggressive_why: "Aggressive tuning is usually done via candidate sizing, not model name.",
    impacts: { ux: "ranking quality", performance: "latency", cost: "provider usage" },
    caution: "If the model name is wrong/unsupported, rerank calls may error. Always test in staging.",
    related: ["ml.rerank.provider", "ops.rerank.adaptive_topk", "ops.rerank.fresh_window_seconds"],
  },


  // --- Admin overview (admin) ---
  "admin.overview.recent_errors_limit": {
    title: "Recent errors limit",
    details: "How many recent errors the Overview page fetches and displays. Higher values can help investigation but increases payload size.",
    examples: [
      { scenario: "Set to 20", effect: "Faster overview load; shorter error list." },
      { scenario: "Set to 200", effect: "More investigation context; bigger payload and slower load." },
    ],
    recommended: 50,
    recommended_why: "Enough context for triage without making the overview heavy.",
    recommended_safe: 25,
    recommended_safe_why: "Lightweight overview for smaller admin devices.",
    recommended_aggressive: 150,
    recommended_aggressive_why: "More context for ops-heavy workflows.",
    impacts: { ux: "triage speed", performance: "overview load time", ops: "debugging depth" },
    related: ["admin.overview.last_job_runs_limit", "admin.audit.default_limit"],
  },
  "admin.overview.last_job_runs_limit": {
    title: "Last job runs limit",
    details: "How many recent job runs the Overview page shows (cron / background tasks).",
    examples: [
      { scenario: "Set to 10", effect: "Quick snapshot; less historical context." },
      { scenario: "Set to 50", effect: "More history; slightly heavier payload." },
    ],
    recommended: 20,
    recommended_why: "Clear overview without long tables.",
    recommended_safe: 10,
    recommended_safe_why: "Minimal payload; good on low bandwidth.",
    recommended_aggressive: 50,
    recommended_aggressive_why: "More context if you rely on Overview for historical checks.",
    impacts: { ux: "monitoring convenience", performance: "payload size" },
    related: ["admin.overview.recent_errors_limit", "admin.audit.default_limit"],
  },
  "admin.users.ban_duration_days": {
    title: "Default ban duration (days)",
    details: "How long a ban lasts when you ban a user from the admin dashboard. This is used to set banned_until.",
    examples: [
      { scenario: "Set to 7", effect: "Short suspensions; users can return automatically." },
      { scenario: "Set to 365", effect: "Long bans; still reversible by unbanning." },
      { scenario: "Set to 18,250 (~50 years)", effect: "Effectively permanent bans unless manually reversed." },
    ],
    recommended: 18250,
    recommended_why: "Treat bans as ‘permanent’ by default so serious abuse doesn’t auto-expire.",
    recommended_safe: 365,
    recommended_safe_why: "Long but not permanent; good if you prefer auto-expiring bans.",
    recommended_aggressive: 30,
    recommended_aggressive_why: "Shorter bans to reduce support friction (manual escalation for repeat abuse).",
    impacts: { safety: "abuse mitigation", ops: "moderation workflow", ux: "support burden" },
    caution: "Very short bans can make abuse recurring unless you monitor closely.",
    related: ["admin.users.page_limit"],
  },

  // --- Ops timeouts & rerank (server_only) ---
  "ops.frontend.function_timeout_ms": {
    title: "Frontend function timeout",
    details: "Client-side timeout for calling Edge Functions. If the function doesn’t respond before this, the UI reports an error.",
    examples: [
      { scenario: "Set to 12s", effect: "Fails fast; better UX during incidents; higher chance of false timeouts on slow networks." },
      { scenario: "Set to 30s", effect: "Fewer false timeouts; users wait longer when something is stuck." },
    ],
    recommended: 20000,
    recommended_why: "Good balance for most Edge Function calls.",
    recommended_safe: 30000,
    recommended_safe_why: "Better for slow networks or heavier functions; users wait longer.",
    recommended_aggressive: 12000,
    recommended_aggressive_why: "Fast failure for snappy UX and faster incident detection.",
    impacts: { ux: "perceived responsiveness", ops: "incident detection", performance: "hanging requests" },
    related: ["ops.search.timeout_ms", "integrations.tmdb_proxy.timeout_ms"],
  },
  "ops.search.timeout_ms": {
    title: "Search timeout (ms)",
    details: "Timeout budget for search-related server calls. If exceeded, the request fails to protect UX and costs.",
    examples: [
      { scenario: "Set to 10s", effect: "Search fails faster during slowness; fewer long tail requests." },
      { scenario: "Set to 45s", effect: "More searches succeed under load; users may wait too long." },
    ],
    recommended: 20000,
    recommended_why: "Prevents long tail waits while still allowing normal success.",
    recommended_safe: 30000,
    recommended_safe_why: "Better success rate under moderate load at the cost of slower UX.",
    recommended_aggressive: 12000,
    recommended_aggressive_why: "Snappier UX; good if your search infra is consistently fast.",
    impacts: { ux: "search latency", cost: "long tail compute", ops: "SLO protection" },
    related: ["ops.frontend.function_timeout_ms"],
  },
  "ops.rerank.cache_ttl_seconds": {
    title: "Rerank cache TTL (seconds)",
    details: "How long rerank responses are cached. Higher TTL reduces provider calls and cost, but can serve slightly older results.",
    examples: [
      { scenario: "Set to 300 (5m)", effect: "Fresher results; more provider calls." },
      { scenario: "Set to 1800 (30m)", effect: "Lower cost; can reuse cached reranks longer." },
    ],
    recommended: 600,
    recommended_why: "Great cost/quality balance for most workloads.",
    recommended_safe: 300,
    recommended_safe_why: "Prioritizes freshness if your catalog changes frequently.",
    recommended_aggressive: 1800,
    recommended_aggressive_why: "Prioritizes cost reduction if rerank calls are expensive.",
    impacts: { cost: "provider usage", performance: "latency", ux: "freshness" },
    related: ["ops.rerank.fresh_window_seconds", "ops.rerank.cooldown_429_seconds"],
  },
  "ops.rerank.fresh_window_seconds": {
    title: "Rerank freshness window (seconds)",
    details: "If a title/user signal is considered ‘fresh’, rerank may prefer recalculating instead of using older cache. Lower values mean more cache hits; higher values mean more fresh recompute.",
    examples: [
      { scenario: "Set to 4h", effect: "More cache hits; cheaper; slightly less reactive to rapid preference changes." },
      { scenario: "Set to 12h", effect: "More recompute; more reactive; higher cost." },
    ],
    recommended: 21600,
    recommended_why: "6 hours balances responsiveness with cost.",
    recommended_safe: 14400,
    recommended_safe_why: "Cheaper default if preferences don’t change rapidly.",
    recommended_aggressive: 43200,
    recommended_aggressive_why: "More recompute window to capture preference shifts.",
    impacts: { ux: "recommendation responsiveness", cost: "rerank calls" },
    related: ["ops.rerank.cache_ttl_seconds"],
  },
  "ops.rerank.cooldown_429_seconds": {
    title: "Rerank 429 cooldown (seconds)",
    details: "When the rerank provider returns rate-limited (HTTP 429), the system pauses rerank calls for this cooldown window to avoid repeated failures.",
    examples: [
      { scenario: "Set to 120 (2m)", effect: "Retries sooner; may keep hitting 429 if limits are tight." },
      { scenario: "Set to 900 (15m)", effect: "Backs off harder; fewer 429 loops but slower recovery." },
    ],
    recommended: 300,
    recommended_why: "A practical default that avoids 429 loops without stalling too long.",
    recommended_safe: 600,
    recommended_safe_why: "More conservative; better if provider limits are strict.",
    recommended_aggressive: 120,
    recommended_aggressive_why: "Faster recovery if 429s are rare and short-lived.",
    impacts: { ops: "rate-limit stability", cost: "wasted calls", performance: "recovery time" },
    related: ["ops.rerank.cache_ttl_seconds", "ops.rate_limits"],
  },

  // --- TMDB proxy guardrails (server_only) ---
  "integrations.tmdb_proxy.default_language": {
    title: "TMDB default language",
    details: "Default language passed to TMDB when the client does not specify one (e.g., UI language).",
    examples: [
      { scenario: "en-US", effect: "English titles/overviews by default." },
      { scenario: "ar-IQ", effect: "Arabic titles/overviews when available." },
    ],
    recommended: "en-US",
    recommended_why: "Matches most catalogs; override per-request for localized UX.",
    impacts: { ux: "localization" },
    related: ["integrations.tmdb_proxy.max_query_len", "integrations.tmdb_proxy.timeout_ms"],
  },
  "integrations.tmdb_proxy.max_query_len": {
    title: "TMDB max query length",
    details: "Maximum allowed length for TMDB search queries. Prevents abuse (huge payloads) and avoids pathological search queries.",
    examples: [
      { scenario: "Set to 100", effect: "Stricter input; may reject very long pasted text." },
      { scenario: "Set to 400", effect: "More permissive; slightly higher abuse surface." },
    ],
    recommended: 200,
    recommended_why: "Allows normal queries while blocking obvious abuse and giant payloads.",
    recommended_safe: 120,
    recommended_safe_why: "More conservative if you’ve seen abuse.",
    recommended_aggressive: 300,
    recommended_aggressive_why: "More permissive UX at the cost of a slightly larger attack surface.",
    impacts: { safety: "abuse prevention", ops: "input guardrails", ux: "search flexibility" },
    related: ["integrations.tmdb_proxy.max_per_minute"],
  },
  "integrations.tmdb_proxy.max_page": {
    title: "TMDB max page",
    details: "Maximum page number allowed for TMDB pagination. Limits deep crawling and abuse.",
    examples: [
      { scenario: "Set to 10", effect: "Restricts deep paging; faster typical usage." },
      { scenario: "Set to 100", effect: "Allows deep paging; can increase TMDB usage." },
    ],
    recommended: 50,
    recommended_why: "Supports real browsing while preventing deep crawling.",
    recommended_safe: 25,
    recommended_safe_why: "More conservative usage if you want to minimize external traffic.",
    recommended_aggressive: 80,
    recommended_aggressive_why: "More browsing depth if admins rely on deep pagination.",
    impacts: { cost: "external API usage", ops: "abuse prevention" },
    related: ["integrations.tmdb_proxy.max_per_minute"],
  },
  "integrations.tmdb_proxy.timeout_ms": {
    title: "TMDB timeout (ms)",
    details: "Timeout for TMDB proxy requests. Protects your Edge Function budget and keeps UI responsive.",
    examples: [
      { scenario: "Set to 4s", effect: "Fast failure; fewer hung requests; may fail on slow TMDB responses." },
      { scenario: "Set to 12s", effect: "Higher success rate; slower UX on long tail." },
    ],
    recommended: 8000,
    recommended_why: "Good balance: allows normal TMDB latency while avoiding long hangs.",
    recommended_safe: 12000,
    recommended_safe_why: "More tolerant of slow responses.",
    recommended_aggressive: 5000,
    recommended_aggressive_why: "Snappier UX and stricter budgets.",
    impacts: { ux: "search responsiveness", ops: "budget control", cost: "timeout waste" },
    related: ["ops.frontend.function_timeout_ms"],
  },
  "integrations.tmdb_proxy.max_per_minute": {
    title: "TMDB max per minute",
    details: "Rate limit for TMDB proxy calls per minute. Prevents hitting TMDB limits and controls cost.",
    examples: [
      { scenario: "Set to 60", effect: "More conservative; less likely to hit external limits." },
      { scenario: "Set to 300", effect: "More throughput; higher risk of 429s if TMDB is strict." },
    ],
    recommended: 120,
    recommended_why: "Reasonable throughput for normal usage and background tasks.",
    recommended_safe: 60,
    recommended_safe_why: "Safer if you’re frequently seeing 429s or have many clients.",
    recommended_aggressive: 240,
    recommended_aggressive_why: "Higher throughput if your workload requires it and TMDB limits allow.",
    impacts: { ops: "rate-limit stability", cost: "external usage", safety: "abuse prevention" },
    related: ["ops.rate_limits", "integrations.tmdb_proxy.max_query_len"],
  },

  // --- Assistant / OpenRouter (admin dashboard) ---
  "assistant_settings.openrouter_base_url": {
    title: "OpenRouter base URL override",
    details:
      "Overrides which OpenRouter-compatible endpoint the assistant uses. Leave blank to use the deployed environment default. Use this when you run a local proxy / gateway, have multiple OpenRouter endpoints, or need to temporarily fail over.",
    examples: [
      { scenario: "Blank", effect: "Uses the env default (recommended for production)." },
      { scenario: "Custom gateway URL", effect: "All assistant calls route through your gateway (useful for logging / allowlists / caching)." },
    ],
    recommended: null,
    recommended_why: "Safer: avoids accidental misrouting. Keep the production endpoint in env." ,
    caution: "A wrong URL commonly causes 404/timeout errors for all assistant calls.",
    impacts: { ops: "routing & availability" },
    related: ["assistant_settings.test_provider"],
  },

  "assistant_settings.model_fast": {
    title: "Fast model",
    details:
      "Primary model used for normal chat replies and tool-driven tasks where speed and cost matter most.",
    examples: [
      { scenario: "Smaller/cheaper model", effect: "Faster responses and lower cost, but can be less accurate." },
      { scenario: "Larger model", effect: "More reliable reasoning, but slower and higher cost." },
    ],
    recommended_why: "Pick the most stable low-latency model you trust for everyday use. Validate with Provider test.",
    impacts: { cost: "token cost", ux: "latency" },
    related: ["assistant_settings.fallback_models", "assistant_settings.test_provider"],
  },
  "assistant_settings.model_creative": {
    title: "Creative model",
    details: "Used for creative writing / brainstorming style tasks when you want richer language.",
    examples: [
      { scenario: "Same as fast model", effect: "Simpler ops; less variety between roles." },
      { scenario: "More capable model", effect: "Better style and nuance; higher cost." },
    ],
    impacts: { cost: "token cost" },
    related: ["assistant_settings.model_fast"],
  },
  "assistant_settings.model_planner": {
    title: "Planner model",
    details: "Used for planning / decomposition / structured reasoning.",
    examples: [
      { scenario: "More capable model", effect: "Better plans and fewer mistakes." },
      { scenario: "Cheap model", effect: "Faster but can miss edge cases." },
    ],
    impacts: { ux: "answer quality", cost: "token cost" },
    related: ["assistant_settings.model_fast"],
  },
  "assistant_settings.model_maker": {
    title: "Maker model",
    details: "Used for content generation where the assistant must produce longer, polished output.",
    impacts: { cost: "token cost", ux: "output quality" },
    related: ["assistant_settings.params.max_output_tokens"],
  },
  "assistant_settings.model_critic": {
    title: "Critic model",
    details: "Used for self-check / review steps (when enabled by behavior config).",
    impacts: { cost: "token cost", safety: "review quality" },
    related: ["assistant_settings.model_fast"],
  },

  "assistant_settings.fallback_models": {
    title: "Fallback models",
    details:
      "Ordered list of models tried when the primary model fails (timeouts, rate limits, provider errors). This is the biggest reliability lever.",
    examples: [
      { scenario: "No fallbacks", effect: "Any provider issue becomes a user-visible failure." },
      { scenario: "2–5 diverse fallbacks", effect: "Higher success rate during provider incidents." },
    ],
    recommended_why: "Include a few stable alternatives with different providers/hosts (when possible).", 
    impacts: { ops: "reliability", ux: "fewer failures" },
    related: ["assistant_settings.model_fast", "assistant_settings.test_provider"],
  },

  "assistant_settings.model_catalog": {
    title: "Model catalog",
    details:
      "The list of models shown in the dashboard dropdowns and used to populate fallback checkboxes.",
    examples: [
      { scenario: "Small curated list", effect: "Less confusion; safer changes." },
      { scenario: "Huge list", effect: "More flexibility, but easier to pick a wrong/unstable model." },
    ],
    recommended_why: "Keep it curated: only models you actively support and test.",
    impacts: { ops: "change safety" },
    related: ["assistant_settings.fallback_models"],
  },

  "assistant_settings.params.timeout_ms": {
    title: "Provider timeout (ms)",
    details:
      "Hard timeout for the OpenRouter request. If exceeded, the assistant will return a timeout-style error. Lower values fail faster; higher values increase success rate on slow models.",
    examples: [
      { scenario: "8–12s", effect: "Good balance for most chat replies." },
      { scenario: "20–60s", effect: "Higher success on slow models but worse UX and more hung requests." },
    ],
    recommended: 12000,
    recommended_why: "Balanced default for chat UX; long enough for typical model latency.",
    recommended_safe: 20000,
    recommended_safe_why: "More tolerant during transient slowness.",
    recommended_aggressive: 8000,
    recommended_aggressive_why: "Snappier UX if you mostly use fast models.",
    impacts: { ux: "perceived latency", ops: "timeout rate" },
    related: ["assistant_settings.model_fast", "assistant_settings.fallback_models"],
  },

  "assistant_settings.params.stream_passthrough": {
    title: "Stream passthrough (SSE)",
    details:
      "When the client requests streaming, MoviNesta will forward user-visible text deltas from OpenRouter’s streaming endpoint (server-sent events). Tool-call deltas are ignored so you don’t leak JSON arguments to the UI. This is automatically bypassed for chunk mode and native tool calling.",
    examples: [
      { scenario: "On", effect: "Replies appear token-by-token (better perceived speed)." },
      { scenario: "Off", effect: "Server waits for the full reply, then streams it as safe text chunks." },
    ],
    recommended: false,
    recommended_why: "Safer default. Keeps streaming stable across providers and preserves tool-loop behavior.",
    recommended_safe: false,
    recommended_safe_why: "Best compatibility and least risk of mid-stream provider failures.",
    recommended_aggressive: true,
    recommended_aggressive_why: "Enable if you want true token streaming for non-tool replies.",
    impacts: { ux: "perceived latency", ops: "SSE stability" },
    related: [
      "assistant_settings.params.stream",
      "assistant_settings.params.native_tool_calling",
      "assistant_settings.params.timeout_ms",
      "behavior.chunking.enabled",
    ],
  },



  "assistant_settings.params.response_healing": {
    title: "Response healing (plugin)",
    details:
      "Enables OpenRouter’s Response Healing plugin to improve compliance with JSON schemas and structured outputs. It can reduce malformed JSON or schema violations when MoviNesta expects a strict agent response.",
    examples: [
      { scenario: "On", effect: "Fewer parse errors and more reliable tool-loop outputs." },
      { scenario: "Off", effect: "Lower overhead, but schema parsing may fail more often." },
    ],
    recommended: true,
    recommended_why: "Recommended when using the default schema-wrapped agent responses.",
    recommended_safe: true,
    recommended_safe_why: "Improves reliability for structured outputs.",
    recommended_aggressive: false,
    recommended_aggressive_why: "Turn off only if you are 100% plain-text and never parse JSON.",
    impacts: { quality: "schema compliance", ops: "fewer retries" },
    related: ["assistant_settings.params.response_format", "assistant_settings.params.plugins"],
  },

  "assistant_settings.params.web_search": {
    title: "Web search (plugin)",
    details:
      "Enables OpenRouter’s Web Search plugin. When enabled, MoviNesta can ask OpenRouter to fetch fresh web results for recency-sensitive questions (news, ‘latest’, current facts). Results are returned with URL citations/annotations.",
    examples: [
      { scenario: "On (auto)", effect: "Uses web search only when the user asks for recent/current info." },
      { scenario: "Off", effect: "No external web lookups; answers rely only on the model and your tools." },
    ],
    recommended: false,
    recommended_why: "Off by default to avoid extra cost and latency. Turn on if you want current web facts.",
    recommended_safe: false,
    recommended_safe_why: "Keeps costs predictable.",
    recommended_aggressive: true,
    recommended_aggressive_why: "Enable if your assistant frequently needs ‘latest’ facts.",
    impacts: { quality: "freshness", ops: "latency/cost" },
    related: [
      "assistant_settings.params.web_search_mode",
      "assistant_settings.params.web_max_results",
      "assistant_settings.params.web_engine",
      "assistant_settings.params.web_search_prompt",
      "assistant_settings.params.plugins",
    ],
  },

  "assistant_settings.params.web_search_mode": {
    title: "Web search mode",
    details:
      "Controls when the web-search plugin is used. Supported values: off, auto, always. Auto only triggers for recency-sensitive prompts (e.g., ‘latest’, ‘today’).",
    examples: [
      { scenario: "off", effect: "Never use web search." },
      { scenario: "auto", effect: "Only use web search when the user asks for current/recent info." },
      { scenario: "always", effect: "Always allow web search (highest cost/latency)." },
    ],
    recommended: "off",
    recommended_why: "Default to off; enable auto when you need fresh facts.",
    recommended_safe: "off",
    recommended_safe_why: "Most predictable behavior.",
    recommended_aggressive: "auto",
    recommended_aggressive_why: "Balanced: better freshness when needed, without always searching.",
    impacts: { quality: "freshness", ops: "cost" },
    related: ["assistant_settings.params.web_search", "assistant_settings.params.web_max_results"],
  },

  "assistant_settings.params.web_max_results": {
    title: "Web search max results",
    details:
      "How many results OpenRouter should fetch for web search (1–10). Higher values can improve coverage but increase latency and token usage.",
    examples: [
      { scenario: "3", effect: "Good balance for most ‘what’s new’ questions." },
      { scenario: "8–10", effect: "More coverage, higher latency and cost." },
    ],
    recommended: 3,
    recommended_why: "Balanced default.",
    recommended_safe: 2,
    recommended_safe_why: "Lower latency and cost.",
    recommended_aggressive: 6,
    recommended_aggressive_why: "More coverage when you rely heavily on web search.",
    impacts: { ux: "latency", ops: "token usage" },
    related: ["assistant_settings.params.web_engine", "assistant_settings.params.web_search_prompt"],
  },

  "assistant_settings.params.web_engine": {
    title: "Web search engine",
    details:
      "Selects the web search engine/provider for the plugin. Typical values include ‘native’ or ‘exa’ (depending on your OpenRouter plan/availability). Leave blank to use the default.",
    examples: [
      { scenario: "(blank)", effect: "Use OpenRouter’s default web search behavior." },
      { scenario: "native", effect: "Prefer native OpenRouter web search." },
      { scenario: "exa", effect: "Prefer Exa-backed search (if enabled)." },
    ],
    recommended: "",
    recommended_why: "Leave blank unless you have a reason to pin a provider.",
    recommended_safe: "",
    recommended_safe_why: "Avoids breaking changes if providers vary.",
    recommended_aggressive: "native",
    recommended_aggressive_why: "Pin to reduce variance if you trust one provider.",
    impacts: { quality: "result relevance", ops: "stability" },
    related: ["assistant_settings.params.web_search", "assistant_settings.params.web_max_results"],
  },

  "assistant_settings.params.web_search_prompt": {
    title: "Web search prompt",
    details:
      "Optional instruction that guides how the web search is performed (e.g., prefer authoritative sources, official docs, etc.).",
    examples: [
      { scenario: "Prefer official sources", effect: "Search focuses on docs and authoritative sites when possible." },
    ],
    recommended: "",
    recommended_why: "Keep blank unless you want consistent search behavior.",
    recommended_safe: "",
    recommended_safe_why: "Avoids over-constraining search.",
    recommended_aggressive: "Prefer official sources and cite URLs.",
    recommended_aggressive_why: "Improves trustworthiness when web search is on.",
    impacts: { quality: "source selection", ops: "none" },
    related: ["assistant_settings.params.web_search", "assistant_settings.params.web_engine"],
  },
  "assistant_settings.params.native_tool_calling": {
    title: "Native tool calling",
    details:
      "Enables OpenRouter Responses API native tool calling (function_call / function_call_output). When ON, the assistant will ask the model for tool calls directly instead of using MoviNesta’s JSON-schema agent wrapper.",
    examples: [
      { scenario: "OFF (default)", effect: "Uses MoviNesta JSON-schema agent loop (more predictable JSON, fewer provider quirks)." },
      { scenario: "ON", effect: "Uses OpenRouter function calling (better for tool-native models, supports parallel tool calls)." },
    ],
    recommended: false,
    recommended_why: "Enable after you’ve tested your chosen model(s) with your toolset and confirmed stable behavior.",
    caution: "Some models/providers may emit malformed arguments or call tools excessively. Use the max loops/calls limits.",
    impacts: { ux: "tool responsiveness", ops: "reliability" },
    related: [
      "assistant_settings.params.tool_choice",
      "assistant_settings.params.parallel_tool_calls",
      "assistant_settings.params.native_tool_max_loops",
      "assistant_settings.params.native_tool_max_calls_per_loop",
    ],
  },

  "assistant_settings.params.native_tool_max_loops": {
    title: "Native tool max loops",
    details:
      "Maximum number of model→tool→model rounds when native tool calling is enabled. Higher values can solve harder tasks but increase latency and cost.",
    examples: [
      { scenario: "1–2", effect: "Fast, safe. Good for simple lookups and single-step actions." },
      { scenario: "3–6", effect: "More capable multi-step tasks but more tokens and time." },
    ],
    recommended: 3,
    recommended_why: "A balanced default that supports multi-step tasks without runaway loops.",
    impacts: { cost: "token cost", ux: "latency", ops: "timeout risk" },
    related: ["assistant_settings.params.native_tool_calling", "assistant_settings.params.timeout_ms"],
  },

  "assistant_settings.params.native_tool_max_calls_per_loop": {
    title: "Native tool max calls per loop",
    details:
      "Caps how many tool calls the assistant will execute per model response when native tool calling is enabled.",
    examples: [
      { scenario: "1–2", effect: "Safer. Prevents tool spam and keeps latency low." },
      { scenario: "4+", effect: "Allows parallelized multi-fetch tasks but increases load and cost." },
    ],
    recommended: 4,
    recommended_why: "Enough for common multi-fetch tasks (e.g., lookup + compare) without overloading.",
    impacts: { ops: "DB load", cost: "tool overhead", ux: "latency" },
    related: ["assistant_settings.params.native_tool_calling", "assistant_settings.params.parallel_tool_calls"],
  },

  "assistant_settings.params.verbosity": {
    title: "Verbosity",
    details:
      "Controls how detailed the model should be (Responses API parameter). This affects response length and sometimes style. Typical values are low / medium / high.",
    examples: [
      { scenario: "low", effect: "Short answers, fewer explanations." },
      { scenario: "high", effect: "More detailed answers (more tokens)." },
    ],
    recommended: "medium",
    recommended_why: "Good default for a consumer app: helpful but not overly long.",
    impacts: { cost: "token cost", ux: "response length" },
    related: ["assistant_settings.params.max_output_tokens"],
  },

  "assistant_settings.params.reasoning": {
    title: "Reasoning",
    details:
      "Advanced Responses API parameter used by some models to control reasoning behavior (for example, effort: low/medium/high). Provide a JSON object, e.g. { \"effort\": \"medium\" }.",
    examples: [
      { scenario: "{ \"effort\": \"low\" }", effect: "Faster, cheaper reasoning; may miss edge cases." },
      { scenario: "{ \"effort\": \"high\" }", effect: "More thorough reasoning; slower and higher cost." },
    ],
    recommended_why: "Leave unset unless your selected model explicitly supports it and you’ve tested the tradeoffs.",
    caution: "If a model/provider doesn’t support this param, routing may fail unless your fallback/variants strip it.",
    impacts: { cost: "token cost", ux: "latency", ops: "compatibility" },
    related: ["assistant_settings.params.verbosity", "assistant_settings.params.timeout_ms"],
  },


  "assistant_settings.test_provider": {
    title: "Provider test",
    details:
      "Runs a tiny request using the current assistant settings and returns a structured diagnostic envelope (code, culprit variable, request IDs). Use this first when you see 'couldn’t reach the AI provider'.",
    examples: [
      { scenario: "401/403", effect: "Usually API key / auth issue (env.OPENROUTER_API_KEY)." },
      { scenario: "timeout", effect: "Model too slow or network issue; adjust timeout or fallbacks." },
      { scenario: "model_not_found", effect: "Selected model name is wrong or unavailable." },
    ],
    impacts: { ops: "debug speed" },
    related: ["assistant_settings.openrouter_base_url", "assistant_settings.model_fast", "assistant_settings.params.timeout_ms"],
  },

  "behavior.diagnostics.user_error_detail": {
    title: "User-facing error detail mode",
    details:
      "Controls how much diagnostic information is shown to end users when an AI call fails. Use 'friendly' for production, 'code' for supportable errors, and 'technical' for internal testing.",
    examples: [
      { scenario: "Friendly", effect: "Shows a generic message (safe for users)." },
      { scenario: "Code", effect: "Shows an error code like AI_TIMEOUT / AI_AUTH." },
      { scenario: "Technical", effect: "Shows cause + culprit variable and IDs (best for admin/dev)." },
    ],
    recommended: "friendly",
    recommended_why: "Best default for production UX and security.",
    impacts: { ux: "error clarity", safety: "info exposure" },
    related: [
      "behavior.diagnostics.user_error_show_culprit_var",
      "behavior.diagnostics.user_error_show_culprit_value",
      "behavior.diagnostics.user_error_show_status_model",
      "behavior.diagnostics.user_error_show_trace_ids",
    ],
  },
  "behavior.diagnostics.user_error_show_culprit_var": {
    title: "Show culprit variable",
    details:
      "When enabled, the user message includes the config variable most likely responsible (e.g., assistant_settings.model_fast).",
    recommended_why: "Keep off for public users; enable for admins/support environments.",
    impacts: { ops: "faster fixes", safety: "info exposure" },
    related: ["behavior.diagnostics.user_error_detail"],
  },
  "behavior.diagnostics.user_error_show_culprit_value": {
    title: "Show culprit value preview",
    details:
      "When enabled, the user message may include a short preview of the bad value (e.g., an invalid base URL).",
    caution: "Do not enable for public users if previews might reveal secrets or internal endpoints.",
    impacts: { ops: "faster fixes", safety: "info exposure" },
    related: ["behavior.diagnostics.user_error_show_culprit_var"],
  },
  "behavior.diagnostics.user_error_show_status_model": {
    title: "Show status + model",
    details:
      "When enabled, the message can include HTTP status code and the model that was attempted. Helps debug 401/429/5xx quickly.",
    impacts: { ops: "faster triage", safety: "info exposure" },
    related: ["behavior.diagnostics.user_error_detail"],
  },
  "behavior.diagnostics.user_error_show_trace_ids": {
    title: "Show trace IDs",
    details:
      "When enabled, includes requestId / upstreamRequestId so you can correlate logs between MoviNesta and OpenRouter/provider.",
    impacts: { ops: "log correlation" },
    related: ["behavior.diagnostics.user_error_detail"],
  },

  "behavior.router.zdr.enabled": {
    title: "ZDR routing toggle",
    details:
      "When enabled, privacy-sensitive assistant requests are routed to OpenRouter endpoints flagged as Zero Data Retention (ZDR).",
    examples: [
      { scenario: "Disabled", effect: "Uses the standard OpenRouter base URL." },
      { scenario: "Enabled", effect: "Routes sensitive traffic to ZDR endpoints when available." },
    ],
    recommended_why: "Enable for privacy-sensitive workloads when ZDR endpoints are configured.",
    impacts: { safety: "data retention" },
    related: [
      "behavior.router.zdr.mode",
      "behavior.router.zdr.allow_fallback",
      "behavior.router.zdr.base_url",
    ],
  },
  "behavior.router.zdr.mode": {
    title: "ZDR routing mode",
    details:
      "Controls whether ZDR routing applies only to privacy-sensitive requests or to all assistant calls.",
    examples: [
      { scenario: "Sensitive only", effect: "Only user-personal requests try ZDR endpoints." },
      { scenario: "All", effect: "Every request attempts ZDR routing." },
    ],
    recommended: "sensitive_only",
    recommended_why: "Limits ZDR use to the most sensitive traffic.",
    impacts: { safety: "data retention", cost: "endpoint selection" },
    related: ["behavior.router.zdr.enabled", "behavior.router.zdr.allow_fallback"],
  },
  "behavior.router.zdr.allow_fallback": {
    title: "Allow ZDR fallback",
    details:
      "When enabled, the assistant falls back to the default OpenRouter base URL if no ZDR endpoint is discovered.",
    examples: [
      { scenario: "True", effect: "Ensures the assistant still responds even without ZDR coverage." },
      { scenario: "False", effect: "Hard-requires ZDR endpoints; requests may fail if none are available." },
    ],
    recommended: true,
    recommended_why: "Keeps the assistant available while you validate ZDR coverage.",
    impacts: { ops: "availability", safety: "data retention" },
    related: ["behavior.router.zdr.enabled", "behavior.router.zdr.mode"],
  },

  "behavior.router.policy.provider": {
    title: "Provider routing policy (OpenRouter)",
    details:
      "Controls how OpenRouter selects a provider for a request. Use this to prefer specific providers, exclude providers, enforce parameter support, or bias toward lower latency/price/throughput. These settings map to OpenRouter's `provider` object on requests.",
    recommended:
      "Leave empty unless you have a clear reason (e.g., exclude an unstable provider, enforce ZDR, or require tools/JSON schema support). Start small: set `ignore` or `only` first, then add `order` if needed.",
    examples: [
      {
        scenario: "Force only OpenAI and Anthropic",
        effect: "only=[openai, anthropic]",
      },
      {
        scenario: "Avoid a flaky provider",
        effect: "ignore=[together]",
      },
      {
        scenario: "Use tools/response_format",
        effect: "require_parameters=true (only providers that support requested params)",
      },
    ],
  },
  "behavior.router.policy.provider.only": {
    title: "Provider allowlist (only)",
    details: "If set, OpenRouter will only route to these provider slugs.",
    recommended: "Use sparingly. Prefer `ignore` unless you need hard restrictions.",
    examples: [
      {
        scenario: "Only OpenAI and Anthropic",
        effect: "only=[openai, anthropic]",
      },
    ],
  },
  "behavior.router.policy.provider.ignore": {
    title: "Provider blocklist (ignore)",
    details: "Providers in this list will not be used for routing.",
    recommended: "Good first step when one provider is unstable or undesired.",
    examples: [
      {
        scenario: "Avoid a flaky provider",
        effect: "ignore=[together]",
      },
    ],
  },
  "behavior.router.policy.provider.order": {
    title: "Provider order",
    details: "If set, OpenRouter tries providers in this order (before load balancing).",
    recommended: "Use when you want a preferred provider but allow fallbacks.",
    examples: [
      {
        scenario: "Prefer a specific routing order",
        effect: "order=[openai, anthropic, mistral]",
      },
    ],
  },
  "behavior.router.policy.provider.require_parameters": {
    title: "Require parameter support",
    details:
      "If true, OpenRouter will only pick providers that support all parameters used in the request (tools, response_format, plugins, etc.).",
    recommended: "Turn ON if you use tools/JSON schema/web search plugins frequently.",
    examples: [
      {
        scenario: "Require full param support",
        effect: "require_parameters=true",
      },
    ],
  },
  "behavior.router.policy.provider.zdr": {
    title: "ZDR routing (provider.zdr)",
    details:
      "If true, OpenRouter will only route to providers that support ZDR (Zero Data Retention).",
    recommended: "Enable if you need strict data handling and you have compatible providers/models.",
    examples: [
      {
        scenario: "Force ZDR-capable providers",
        effect: "zdr=true",
      },
    ],
  },
  "behavior.router.policy.provider.data_collection": {
    title: "Data collection filter",
    details:
      "If set to deny, OpenRouter filters out providers that collect data. If allow, no filtering is applied (default).",
    recommended: "Set to deny only if it aligns with your compliance needs and supported providers exist.",
    examples: [
      {
        scenario: "Filter to providers that do not collect data",
        effect: "data_collection=deny",
      },
    ],
  },

  "behavior.router.zdr.base_url": {
    title: "ZDR base URL override",
    details:
      "Optional override for a dedicated ZDR endpoint. Leave blank to use discovered ZDR endpoints from the OpenRouter endpoints cache.",
    examples: [
      { scenario: "Blank", effect: "Uses the first discovered ZDR endpoint." },
      { scenario: "Custom URL", effect: "Routes ZDR traffic to the specified endpoint." },
    ],
    recommended_why: "Leave blank unless you operate a dedicated ZDR proxy.",
    impacts: { ops: "routing control", safety: "data retention" },
    related: ["behavior.router.zdr.enabled", "behavior.router.zdr.mode"],
  },

};

// ---- Runtime hint stubs ----
//
// The UI shows a hint icon (ⓘ) for every setting.
// If a key is missing from the curated map above, we build a generic but useful hint
// from server registry metadata (description + defaults + optional min/max).

export type RegistryMeta = {
  default: any;
  description?: string;
  meta?:
    | { kind: "number"; int?: boolean; min?: number; max?: number }
    | { kind: "string"; minLength?: number; maxLength?: number }
    | { kind: "boolean" }
    | { kind: "enum"; values: string[] }
    | { kind: "json" };
};

function humanizeKey(key: string): string {
  const parts = key.split(".");
  const last = parts[parts.length - 1] ?? key;
  return last
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^\w/, (c) => c.toUpperCase());
}

function clampNumber(n: number, min?: number, max?: number): number {
  if (typeof min === "number") n = Math.max(min, n);
  if (typeof max === "number") n = Math.min(max, n);
  return n;
}

function isDurationKey(key: string): boolean {
  return (
    key.endsWith("_ms") ||
    key.includes(".ttl_ms") ||
    key.includes(".timeout_ms") ||
    key.includes(".interval_ms") ||
    key.includes(".heartbeat_ms") ||
    key.includes(".debounce_ms") ||
    key.includes(".recompute_ms") ||
    key.includes("_minutes") ||
    key.includes("_seconds") ||
    key.includes("_ttl") ||
    key.includes("_timeout")
  );
}

function formatNumberForKey(key: string, value: number): string {
  if (!Number.isFinite(value)) return String(value);
  if (key.endsWith("_ms") || key.includes("_ms")) {
    if (value >= 60_000) return `${Math.round(value / 1000 / 60)}m`;
    if (value >= 1_000) return `${Math.round(value / 100) / 10}s`;
    return `${Math.round(value)}ms`;
  }
  if (key.endsWith("_seconds") || key.includes("_seconds")) return `${Math.round(value)}s`;
  if (key.endsWith("_minutes") || key.includes("_minutes")) return `${Math.round(value)}m`;
  return String(value);
}

function deriveImpactsFromKey(key: string): SettingImpactHints {
  const impacts: SettingImpactHints = {};
  const k = key.toLowerCase();

  if (k.startsWith("ux.")) impacts.ux = "user experience";
  if (k.startsWith("assistant.")) {
    impacts.ux = impacts.ux ?? "assistant behavior";
    impacts.cost = impacts.cost ?? "model usage";
  }
  if (k.startsWith("ops.")) impacts.ops = "operations";
  if (k.startsWith("integrations.")) impacts.ops = impacts.ops ?? "integrations";
  if (k.startsWith("admin.")) impacts.ops = impacts.ops ?? "admin UX/ops";
  if (k.startsWith("ml.")) impacts.performance = "model selection";
  if (k.includes("timeout") || k.includes("ttl") || k.includes("debounce") || k.includes("interval")) {
    impacts.performance = impacts.performance ?? "latency/load";
    impacts.cost = impacts.cost ?? "network/model usage";
  }
  if (k.includes("max_") || k.includes("limit") || k.includes("topk")) {
    impacts.performance = impacts.performance ?? "compute cost";
    impacts.cost = impacts.cost ?? "usage";
  }
  if (k.includes("rate") || k.includes("per_minute") || k.includes("cooldown") || k.includes("429")) {
    impacts.ops = impacts.ops ?? "rate limiting";
    impacts.safety = impacts.safety ?? "stability";
  }

  return impacts;
}

function autoExamplesAndRecommendations(key: string, reg?: RegistryMeta): {
  examples: SettingExample[];
  recommended: any;
  recommended_why: string;
  recommended_safe?: any;
  recommended_safe_why?: string;
  recommended_aggressive?: any;
  recommended_aggressive_why?: string;
  caution?: string;
  impacts?: SettingImpactHints;
} {
  const meta = reg?.meta;
  const impacts = deriveImpactsFromKey(key);
  const description = (reg?.description ?? "").trim();

  // Defaults
  const recommended = reg?.default;
  let recommended_why = description ? description : "Matches the app's current default behavior (safe starting point).";

  const cautionParts: string[] = [];
  if (meta?.kind === "number" && (typeof meta.min === "number" || typeof meta.max === "number")) {
    cautionParts.push("Stay within the validated range to avoid rejected updates.");
  }
  if (meta?.kind === "json") cautionParts.push("Invalid JSON will be rejected by server validation.");

  const k = key.toLowerCase();

  if (!meta) {
    return {
      examples: [{ scenario: "Leave default", effect: "Keeps the app behavior unchanged." }],
      recommended,
      recommended_why: recommended_why || "Use the default unless you have a clear reason to change it.",
      caution: cautionParts.length ? cautionParts.join(" ") : undefined,
      impacts,
    };
  }

  if (meta.kind === "boolean") {
    return {
      examples: [
        { scenario: "Set to true", effect: "Enables the behavior controlled by this setting." },
        { scenario: "Set to false", effect: "Disables the behavior controlled by this setting." },
      ],
      recommended,
      recommended_why: recommended_why || "Default is usually the safest option.",
      recommended_safe: false,
      recommended_safe_why: "Safer operationally if you’re unsure; may reduce features/UX.",
      recommended_aggressive: true,
      recommended_aggressive_why: "Enables the feature; ensure it doesn’t increase cost/ops load unexpectedly.",
      caution: cautionParts.length ? cautionParts.join(" ") : undefined,
      impacts,
    };
  }

  if (meta.kind === "enum") {
    const examples = meta.values.slice(0, 3).map((v) => ({ scenario: `Set to '${v}'`, effect: "Switches behavior to this mode." }));
    return {
      examples: examples.length ? examples : [{ scenario: "Pick a mode", effect: "Changes behavior according to the selected mode." }],
      recommended,
      recommended_why: recommended_why || "Use the default mode unless you’re deliberately changing behavior.",
      caution: cautionParts.length ? cautionParts.join(" ") : undefined,
      impacts,
    };
  }

  if (meta.kind === "string") {
    if (k.includes("provider") || k.includes("model")) {
      return {
        examples: [
          { scenario: "Cheaper/faster model", effect: "Lower latency/cost; may reduce answer quality." },
          { scenario: "Higher-quality model", effect: "Better answers; higher latency/cost." },
        ],
        recommended,
        recommended_why: recommended_why || "Default is tuned for typical quality/cost tradeoffs.",
        caution: cautionParts.length ? cautionParts.join(" ") : undefined,
        impacts,
      };
    }
    return {
      examples: [
        { scenario: "Short / simple value", effect: "Works best for labels and quick UX copy." },
        { scenario: "Long / detailed value", effect: "Can improve clarity but may clutter the UI." },
      ],
      recommended,
      recommended_why: recommended_why || "Default is usually a sensible copy/label.",
      caution: cautionParts.length ? cautionParts.join(" ") : undefined,
      impacts,
    };
  }

  // number/json
  if (meta.kind === "number") {
    const def = typeof reg?.default === "number" ? (reg!.default as number) : typeof meta.min === "number" ? meta.min : 0;
    const min = meta.min;
    const max = meta.max;

    // Heuristic: duration / timeout-ish keys
    if (isDurationKey(k)) {
      const safe = clampNumber(def * 1.5, min, max);
      const aggressive = clampNumber(def * 0.6, min, max);

      const safeLabel = formatNumberForKey(key, safe);
      const aggrLabel = formatNumberForKey(key, aggressive);
      const defLabel = formatNumberForKey(key, def);

      return {
        examples: [
          { scenario: `Lower (${aggrLabel})`, effect: "More responsive/fresher behavior, but can increase load/cost." },
          { scenario: `Default (${defLabel})`, effect: "Balanced behavior for most users." },
          { scenario: `Higher (${safeLabel})`, effect: "Less load/cost, but can feel slower or show stale data." },
        ],
        recommended: def,
        recommended_why: recommended_why || "Default is tuned to balance responsiveness and load.",
        recommended_safe: safe,
        recommended_safe_why: "Safer for stability/cost if you see load spikes; may reduce responsiveness.",
        recommended_aggressive: aggressive,
        recommended_aggressive_why: "Feels faster, but may increase load/cost (watch logs and rate limits).",
        caution: cautionParts.length ? cautionParts.join(" ") : undefined,
        impacts,
      };
    }

    // Heuristic: caps/limits
    if (k.includes("max_") || k.includes("limit") || k.includes("topk") || k.includes("rows") || k.includes("page")) {
      const safe = clampNumber(Math.max(1, Math.round(def * 0.7)), min, max);
      const aggressive = clampNumber(Math.max(1, Math.round(def * 1.4)), min, max);

      return {
        examples: [
          { scenario: `Lower (${safe})`, effect: "Faster/cheaper, but may reduce coverage/results." },
          { scenario: `Higher (${aggressive})`, effect: "More coverage, but can increase latency/cost." },
        ],
        recommended: def,
        recommended_why: recommended_why || "Default balances speed/cost with usefulness.",
        recommended_safe: safe,
        recommended_safe_why: "Safer for performance/cost if you’re tuning for scale.",
        recommended_aggressive: aggressive,
        recommended_aggressive_why: "More results/coverage; watch latency/cost.",
        caution: cautionParts.length ? cautionParts.join(" ") : undefined,
        impacts,
      };
    }

    // Heuristic: cooldown/backoff
    if (k.includes("cooldown") || k.includes("backoff") || k.includes("stuck") || k.includes("retry") || k.includes("attempt")) {
      const safe = clampNumber(def * 1.3, min, max);
      const aggressive = clampNumber(def * 0.8, min, max);

      return {
        examples: [
          { scenario: `Lower (${formatNumberForKey(key, aggressive)})`, effect: "Retries sooner; can increase pressure on providers." },
          { scenario: `Higher (${formatNumberForKey(key, safe)})`, effect: "Backs off more; slower recovery but more stable under rate limits." },
        ],
        recommended: def,
        recommended_why: recommended_why || "Default is a good balance between recovery speed and stability.",
        recommended_safe: safe,
        recommended_safe_why: "Prefer this if you hit rate limits or see repeated retries.",
        recommended_aggressive: aggressive,
        recommended_aggressive_why: "Faster recovery, but monitor error rates and provider limits.",
        caution: cautionParts.length ? cautionParts.join(" ") : undefined,
        impacts,
      };
    }

    const lo = typeof min === "number" ? min : "(low)";
    const hi = typeof max === "number" ? max : "(high)";
    return {
      examples: [
        { scenario: `Lower (${lo})`, effect: "Usually reduces cost/load but may reduce quality/responsiveness." },
        { scenario: `Higher (${hi})`, effect: "Usually improves quality/responsiveness but may increase cost/load." },
      ],
      recommended: def,
      recommended_why: recommended_why || "Default is typically safest unless you’re tuning a specific issue.",
      caution: cautionParts.length ? cautionParts.join(" ") : undefined,
      impacts,
    };
  }

  // json
  return {
    examples: [
      { scenario: "Smaller JSON payload", effect: "Reduces response size and risk of token/payload blowups." },
      { scenario: "Larger JSON payload", effect: "More flexibility, but can increase latency/cost." },
    ],
    recommended,
    recommended_why: recommended_why || "Default is the safest starting point.",
    caution: cautionParts.length ? cautionParts.join(" ") : undefined,
    impacts,
  };
}

export function getSettingHint(key: string, reg?: RegistryMeta): SettingHint {
  const curated = SETTING_HINTS[key];
  if (curated) return curated;

  const title = humanizeKey(key);
  const description = (reg?.description ?? "").trim() || "Controls this setting's behavior.";

  const auto = autoExamplesAndRecommendations(key, reg);

  return {
    title,
    details: description,
    examples: auto.examples,
    recommended: auto.recommended,
    recommended_why: auto.recommended_why,
    recommended_safe: auto.recommended_safe,
    recommended_safe_why: auto.recommended_safe_why,
    recommended_aggressive: auto.recommended_aggressive,
    recommended_aggressive_why: auto.recommended_aggressive_why,
    caution: auto.caution,
    impacts: auto.impacts,
  };
}
