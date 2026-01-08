export type SettingExample = {
  scenario: string;
  effect: string;
};

export type SettingImpactHints = Partial<Record<"ux" | "performance" | "cost" | "safety" | "ops", string>>;

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
  "ux.presence.flush_interval_ms": {
    title: "Presence flush interval",
    details: "How often the client writes/flushes presence updates. Smaller values feel more ‘live’ but create more realtime traffic.",
    examples: [
      { scenario: "Set to 2000ms", effect: "Online status updates faster, but you may see higher Realtime load." },
      { scenario: "Set to 15000ms", effect: "Less traffic, but users might appear ‘online’ with more delay." },
    ],
    recommended: 5000,
    recommended_why: "Good balance: near-realtime feel without spamming writes.",
    recommended_safe: 8000,
    recommended_safe_why: "Slightly less realtime traffic; still feels responsive.",
    recommended_aggressive: 2000,
    recommended_aggressive_why: "More ‘live’ feel, but increases realtime load.",
    impacts: { ux: "presence freshness", performance: "realtime traffic", cost: "realtime usage" },
    caution: "Too low (<1000ms) can create noisy presence updates and higher cost.",
    related: ["ux.presence.active_timeout_ms", "ux.presence.profile_update_debounce_ms"],
  },
  "ux.presence.active_timeout_ms": {
    title: "Presence active timeout",
    details: "How long a user is considered ‘active’ after their last presence ping.",
    examples: [
      { scenario: "Set to 60,000ms", effect: "Users switch from ‘Online’ → ‘Active recently’ sooner." },
      { scenario: "Set to 300,000ms", effect: "Users stay ‘active’ longer even if they stop interacting." },
    ],
    recommended: 120000,
    recommended_why: "Matches typical chat apps: quick but not jumpy transitions.",
    recommended_safe: 60000,
    recommended_safe_why: "Shows ‘Active recently’ sooner; avoids ‘ghost online’.",
    recommended_aggressive: 300000,
    recommended_aggressive_why: "Keeps users ‘active’ longer; can feel more social.",
    impacts: { ux: "online/active labels" },
  },
  "ux.typing.ttl_ms": {
    title: "Typing indicator TTL",
    details: "How long a typing indicator stays visible if no new typing events arrive.",
    examples: [
      { scenario: "TTL 1500ms", effect: "Typing indicator disappears quickly (may flicker)." },
      { scenario: "TTL 5000ms", effect: "Typing indicator stays longer (may feel ‘sticky’)." },
    ],
    recommended: 3000,
    recommended_why: "Prevents flicker while not staying on screen too long.",
    recommended_safe: 2000,
    recommended_safe_why: "Less sticky typing; may flicker on slow networks.",
    recommended_aggressive: 5000,
    recommended_aggressive_why: "Typing stays longer; can feel smoother but more ‘sticky’.",
    impacts: { ux: "typing indicator" },
    related: ["ux.typing.broadcast_interval_ms"],
  },

  // --- Messages UX (public) ---
  "ux.messages.max_chars": {
    title: "Max message characters",
    details: "Client-side maximum message length. This is a UI limit; server may still validate separately.",
    examples: [
      { scenario: "Set to 500", effect: "Short messages only; reduces wall-of-text, but blocks longer asks." },
      { scenario: "Set to 8000", effect: "Long messages allowed; can stress assistant context + UX." },
    ],
    recommended: 2000,
    recommended_why: "Keeps chat readable and reduces accidental giant pastes.",
    recommended_safe: 1000,
    recommended_safe_why: "Reduces wall-of-text and token usage; may block power users.",
    recommended_aggressive: 6000,
    recommended_aggressive_why: "Allows longer asks; can increase token usage and UI clutter.",
    impacts: { ux: "chat readability", cost: "token usage" },
    caution: "Very large values can increase token usage and slow responses.",
  },
  "ux.attachments.max_bytes": {
    title: "Max attachment size",
    details: "Client-side file-size validation for uploads. Storage policies still enforce server-side rules.",
    examples: [
      { scenario: "Set to 5MB", effect: "Faster uploads, fewer failures on slow networks." },
      { scenario: "Set to 25MB", effect: "More flexibility, but higher upload failures + storage cost." },
    ],
    recommended: 10_000_000,
    recommended_why: "Works well for typical image uploads without huge storage spikes.",
  },
  "ux.messages.search.min_query_chars": {
    title: "Search minimum characters",
    details: "Minimum input length before message search triggers.",
    examples: [
      { scenario: "Min = 1", effect: "Search runs more often; can feel instant but may be noisy." },
      { scenario: "Min = 3", effect: "Fewer searches; reduces load but feels less responsive." },
    ],
    recommended: 2,
    recommended_why: "Common default that avoids accidental searches on single-letter inputs.",
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

function defaultExamples(meta?: RegistryMeta["meta"]): SettingExample[] {
  if (!meta) {
    return [{ scenario: "Leave default", effect: "Keeps the app behavior unchanged." }];
  }
  if (meta.kind === "boolean") {
    return [
      { scenario: "Set to true", effect: "Enables the behavior controlled by this setting." },
      { scenario: "Set to false", effect: "Disables the behavior controlled by this setting." },
    ];
  }
  if (meta.kind === "number") {
    const lo = meta.min ?? "(low)";
    const hi = meta.max ?? "(high)";
    return [
      { scenario: `Lower (${lo})`, effect: "Usually reduces cost/load but may reduce quality/responsiveness." },
      { scenario: `Higher (${hi})`, effect: "Usually improves quality/responsiveness but may increase cost/load." },
    ];
  }
  if (meta.kind === "string") {
    return [
      { scenario: "Short / simple value", effect: "Works best for labels and quick UX copy." },
      { scenario: "Long / detailed value", effect: "Can improve clarity but may clutter the UI." },
    ];
  }
  if (meta.kind === "enum") {
    return meta.values.slice(0, 3).map((v) => ({ scenario: `Set to '${v}'`, effect: "Switches behavior to this mode." }));
  }
  return [
    { scenario: "Smaller JSON payload", effect: "Reduces response size and risk of token/payload blowups." },
    { scenario: "Larger JSON payload", effect: "More flexibility, but can increase latency/cost." },
  ];
}

export function getSettingHint(key: string, reg?: RegistryMeta): SettingHint {
  const curated = SETTING_HINTS[key];
  if (curated) return curated;

  const title = humanizeKey(key);
  const description = (reg?.description ?? "").trim() || "Controls this setting's behavior.";
  const examples = defaultExamples(reg?.meta);
  const recommended = reg?.default;
  const recommended_why = "Matches the app's current default behavior (safe starting point).";

  const cautionParts: string[] = [];
  if (reg?.meta && reg.meta.kind === "number") {
    if (typeof reg.meta.min === "number" || typeof reg.meta.max === "number") {
      cautionParts.push("Stay within the validated range to avoid rejected updates.");
    }
  }
  if (reg?.meta && reg.meta.kind === "json") {
    cautionParts.push("Invalid JSON will be rejected by server validation.");
  }

  return {
    title,
    details: description,
    examples,
    recommended,
    recommended_why,
    caution: cautionParts.length ? cautionParts.join(" ") : undefined,
  };
}
