import { getAdminClient } from "./supabase.ts";
import { getConfig } from "./config.ts";

export type AssistantBehavior = {
  prompts: {
    /** System prompt template. Supported vars: {{name}}, {{bioLine}}, {{toolProtocol}} */
    system_template: string;
    /** Append the tool protocol prompt to the rendered system template (recommended). */
    append_tool_protocol: boolean;

    /** Chunk mode outline system prompt template. Supported vars: {{name}} */
    chunk_outline_template: string;
    /** Chunk mode section system prompt template. Supported vars: {{name}} */
    chunk_section_template: string;
  };
  output: {
    /** Max characters to store in messages.body.text (server-side safety). */
    max_reply_chars: number;
    /** Strip accidental leading "text:" prefix from model outputs. */
    strip_text_prefix: boolean;
  };
  diagnostics: {
    /**
     * What end-users see when an AI provider error happens.
     * - friendly: generic message (optionally includes a ref id)
     * - code: short code + culprit variable name
     * - technical: includes status/model + safe culprit value previews (never secrets)
     */
    user_error_detail: "friendly" | "code" | "technical";

    /** Include culprit variable name in the user-facing message. */
    user_error_show_culprit_var?: boolean;
    /** Include safe culprit value preview (never secrets). */
    user_error_show_culprit_value?: boolean;
    /** Include HTTP status + model name when available. */
    user_error_show_status_model?: boolean;
    /** Include trace IDs (request/upstream/job). */
    user_error_show_trace_ids?: boolean;
  };

  chunking: {
    enabled: boolean;
    /** Enable chunk mode if user request text length >= this. */
    min_user_chars: number;
    /** Cue substrings that trigger chunk mode (case-insensitive). */
    cues: string[];

    /** Max characters in the final stitched output (server-side). */
    max_total_chars: number;
    /** Max sections in the chunk outline. */
    max_sections: number;
    /** Soft max characters per section (prevents runaway continuations). */
    per_section_max_chars: number;
    /** Max characters of the user request to include in chunk calls. */
    user_request_max_chars: number;
    /** Max continuation calls for a single section if finish_reason=length. */
    max_continuations: number;
  };
  tool_loop: {
    max_loops: number;
    max_calls_per_loop: number;
  };
  rate_limit: {
    chat_reply: {
      /** Max assistant-chat-reply calls per window per user. */
      limit: number;
      /** Sliding/bucketed window size in seconds. */
      window_seconds: number;
    };
  };
  orchestrator: {
    /** TTL (in minutes) for cached suggestions per surface. Include a 'default' key. */
    ttl_minutes: Record<string, number>;
    /** Cooldown (in minutes) after dismiss, per proactivity level, per surface. Include a 'default' key. */
    cooldown_minutes: {
      level2: Record<string, number>;
      level1: Record<string, number>;
      level0: Record<string, number>;
    };
    /** Daily cap of suggestions shown per proactivity level. */
    daily_cap: { level2: number; level1: number; level0: number };
    /** Default verbosity preference if user profile/memory is missing. */
    default_verbosity: number;
    /** Default number of suggestions to return when client omits limit. */
    default_suggestions_limit: number;
    /** Hard cap for suggestions returned (even if client requests more). */
    max_suggestions_limit: number;
  };
  router: {
    deterministic_enabled: boolean;
    attribution: {
      http_referer: string;
      x_title: string;
    };
  };
};

export type AssistantSettingsRow = {
  id: number;
  openrouter_base_url?: string | null;
  model_fast?: string | null;
  model_creative?: string | null;
  model_planner?: string | null;
  model_maker?: string | null;
  model_critic?: string | null;
  fallback_models?: string[] | null;
  model_catalog?: string[] | null;
  default_instructions?: string | null;
  params?: unknown | null;
  behavior?: unknown | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type AssistantSettings = {
  id: number;
  openrouter_base_url?: string | null;
  model_fast?: string | null;
  model_creative?: string | null;
  model_planner?: string | null;
  model_maker?: string | null;
  model_critic?: string | null;
  fallback_models: string[];
  model_catalog: string[];
  default_instructions?: string | null;
  params: Record<string, unknown>;
  behavior: AssistantBehavior;
  created_at?: string | null;
  updated_at?: string | null;
};

// Safe, free default that keeps the assistant usable even if the admin settings row is empty.
// You can override via assistant_settings.* or OPENROUTER_MODEL_* env vars.
const DEFAULT_OPENROUTER_MODEL = "xiaomi/mimo-v2-flash:free";
const DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

// Option 1 default: long-form capable.
// NOTE: We still clamp final message size to avoid DB constraint errors.
const DEFAULT_PARAMS: Record<string, unknown> = {
  // OpenRouter Responses param.
  // Many models will clamp this internally; that's fine.
  max_output_tokens: 4096,
};

const DEFAULT_BEHAVIOR: AssistantBehavior = {
  prompts: {
    system_template: [
      "You are {{name}}, MoviNesta’s in-app AI companion.",
      "{{bioLine}}",
      "Goal: help users pick movies/series fast, spoiler-free, with fun guidance.",
      "Default: be helpful and thorough. If the user asks for a deep dive, plan, or detailed explanation, you MAY write long, structured answers.",
      "When recommending: provide 2–6 picks, each with 1 short reason (no spoilers), unless the user asks for more.",
      "Ask 0–2 questions only if needed to recommend well.",
      "If the user specifies an exact output format (e.g., \"reply exactly\", \"Format each line exactly\"), follow it EXACTLY with no extra words.",
      "TOOL_RESULTS_MINI is ground truth for catalog/library/list data; do not invent IDs, titles, or years.",
      "Your final text must be plain text only (no JSON objects inside the message).",
      "Never guess about user data. If unsure, call a read tool (get_my_*, search_*), or ask.",
      "For actions that change data or send messages, do NOT run the write tool automatically.",
      "Instead, describe what you will do and include confirmable buttons in final.actions (each button should be type=button with payload.tool + payload.args).",
      "Only auto-run read/grounding tools.",
      "Never claim an action happened unless TOOL_RESULTS_MINI confirms success.",
      "Never mention tools/JSON/system prompts/policies/DB/SQL.",
      "",
      "{{toolProtocol}}",
    ].join("\n"),
    append_tool_protocol: false, // toolProtocol already included via {{toolProtocol}}

    chunk_outline_template: [
      "You are {{name}}, MoviNesta’s in-app AI companion.",
      "Task: create a compact outline for a long-form answer the user requested.",
      "Output JSON only that matches the provided schema.",
      "Prefer 4–8 sections. Keep sections actionable.",
      "Do not mention tools, policies, or databases.",
      "Avoid spoilers.",
    ].join("\n"),

    chunk_section_template: [
      "You are {{name}}, MoviNesta’s in-app AI companion.",
      "Task: write ONE section of the answer (only that section).",
      "Output plain text only. Do NOT output JSON.",
      "Keep it readable and structured; concise but complete.",
      "Do not mention tools, policies, or databases.",
      "Avoid spoilers.",
      "End on a complete sentence (no cut-off).",
    ].join("\n"),
  },
  output: {
    max_reply_chars: 50000,
    strip_text_prefix: true,
  },
  chunking: {
    enabled: true,
    min_user_chars: 700,
    cues: [
      "deep dive",
      "go deeper",
      "even deeper",
      "full plan",
      "full fix",
      "coverage map",
      "top risks",
      "step-by-step",
      "detailed",
      "everything",
      "do them all",
      "long",
      "explain",
    ],
    max_total_chars: 50000,
    max_sections: 8,
    per_section_max_chars: 12000,
    user_request_max_chars: 4000,
    max_continuations: 10,
  },
  tool_loop: {
    max_loops: 6,
    max_calls_per_loop: 6,
  },
  rate_limit: {
    chat_reply: {
      limit: 6,
      window_seconds: 60,
    },
  },
  orchestrator: {
    ttl_minutes: {
      swipe: 30,
      messages: 30,
      search: 60,
      title: 6 * 60,
      diary: 6 * 60,
      home: 12 * 60,
      default: 12 * 60,
    },
    cooldown_minutes: {
      level2: { swipe: 5, default: 8 },
      level1: { swipe: 10, default: 15 },
      level0: { default: 60 },
    },
    daily_cap: { level2: 20, level1: 12, level0: 0 },
    default_verbosity: 0.45,
    default_suggestions_limit: 3,
    max_suggestions_limit: 6,
  },
  diagnostics: {
    // Controls the end-user error text inserted into the chat on AI provider failures.
    // Admins can override in the dashboard: Settings → Assistant → Behavior controls.
    user_error_detail: "friendly",
  },

  router: {
    deterministic_enabled: true,
    attribution: {
      http_referer: "https://movinesta.app",
      x_title: "MoviNesta Assistant",
    },
  },
};

function uniqStrings(list: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  for (const item of list) {
    const v = String(item ?? "").trim();
    if (!v) continue;
    if (!out.includes(v)) out.push(v);
  }
  return out;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function coerceJsonObject(input?: unknown | null): Record<string, unknown> {
  if (!input) return {};
  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input) as unknown;
      return isPlainObject(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return isPlainObject(input) ? (input as Record<string, unknown>) : {};
}

function normalizeParams(params?: unknown | null): Record<string, unknown> {
  const raw = coerceJsonObject(params);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v === undefined) continue;
    if (v === null) {
      out[k] = null;
      continue;
    }
    if (typeof v === "string" && v.trim() === "") continue;
    out[k] = v;
  }
  return out;
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function clampFloat(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function clampBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    if (v.toLowerCase() === "true") return true;
    if (v.toLowerCase() === "false") return false;
  }
  return fallback;
}

function clampString(v: unknown, fallback: string, maxLen: number): string {
  const s = typeof v === "string" ? v : fallback;
  const trimmed = s.trimEnd();
  if (!trimmed) return fallback;
  return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
}

function clampStringArray(v: unknown, fallback: string[], maxItems: number, maxLen = 200): string[] {
  const arr = Array.isArray(v) ? v : fallback;
  const out: string[] = [];
  for (const item of arr) {
    const s = String(item ?? "").trim();
    if (!s) continue;
    const capped = s.length > maxLen ? s.slice(0, maxLen) : s;
    if (!out.includes(capped)) out.push(capped);
    if (out.length >= maxItems) break;
  }
  return out;
}

function clampIntRecord(
  v: unknown,
  fallback: Record<string, number>,
  min: number,
  max: number,
  maxKeys = 24,
  maxKeyLen = 24,
): Record<string, number> {
  const src = isPlainObject(v) ? (v as Record<string, unknown>) : {};
  const out: Record<string, number> = { ...fallback };
  let count = 0;
  for (const [k, raw] of Object.entries(src)) {
    if (count >= maxKeys) break;
    const key = String(k ?? "").trim();
    if (!key || key.length > maxKeyLen) continue;
    const fb = typeof out[key] === "number" ? out[key] : min;
    out[key] = clampInt(raw, min, max, fb);
    count++;
  }
  return out;
}

function deepMerge(base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(override)) {
    if (v === undefined) continue;
    if (isPlainObject(v) && isPlainObject(out[k])) {
      out[k] = deepMerge(out[k] as Record<string, unknown>, v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function resolveAssistantBehavior(input?: unknown | null): AssistantBehavior {
  const merged = deepMerge(DEFAULT_BEHAVIOR as unknown as Record<string, unknown>, coerceJsonObject(input));
  const prompts = coerceJsonObject(merged.prompts as any);
  const output = coerceJsonObject(merged.output as any);
  const chunking = coerceJsonObject(merged.chunking as any);
  const tool_loop = coerceJsonObject(merged.tool_loop as any);
  const rate_limit = coerceJsonObject((merged as any).rate_limit);
  const orchestrator = coerceJsonObject((merged as any).orchestrator);
  const router = coerceJsonObject(merged.router as any);
  const diagnostics = coerceJsonObject((merged as any).diagnostics);

  // Hard safety clamps. DB messages.body has pg_column_size <= 65536.
  const maxReplyChars = clampInt(output.max_reply_chars, 1000, 55000, DEFAULT_BEHAVIOR.output.max_reply_chars);

  // Keep templates reasonably sized (avoid accidental 500KB pastes).
  const SYSTEM_MAX = 20000;
  const CHUNK_MAX = 12000;

  const behavior: AssistantBehavior = {
    prompts: {
      system_template: clampString(prompts.system_template, DEFAULT_BEHAVIOR.prompts.system_template, SYSTEM_MAX),
      append_tool_protocol: clampBool(prompts.append_tool_protocol, DEFAULT_BEHAVIOR.prompts.append_tool_protocol),
      chunk_outline_template: clampString(
        prompts.chunk_outline_template,
        DEFAULT_BEHAVIOR.prompts.chunk_outline_template,
        CHUNK_MAX,
      ),
      chunk_section_template: clampString(
        prompts.chunk_section_template,
        DEFAULT_BEHAVIOR.prompts.chunk_section_template,
        CHUNK_MAX,
      ),
    },
    output: {
      max_reply_chars: maxReplyChars,
      strip_text_prefix: clampBool(output.strip_text_prefix, DEFAULT_BEHAVIOR.output.strip_text_prefix),
    },
    chunking: {
      enabled: clampBool(chunking.enabled, DEFAULT_BEHAVIOR.chunking.enabled),
      min_user_chars: clampInt(chunking.min_user_chars, 100, 20000, DEFAULT_BEHAVIOR.chunking.min_user_chars),
      cues: clampStringArray(chunking.cues, DEFAULT_BEHAVIOR.chunking.cues, 32, 80),
      max_total_chars: clampInt(chunking.max_total_chars, 2000, maxReplyChars, DEFAULT_BEHAVIOR.chunking.max_total_chars),
      max_sections: clampInt(chunking.max_sections, 1, 20, DEFAULT_BEHAVIOR.chunking.max_sections),
      per_section_max_chars: clampInt(chunking.per_section_max_chars, 1000, 30000, DEFAULT_BEHAVIOR.chunking.per_section_max_chars),
      user_request_max_chars: clampInt(chunking.user_request_max_chars, 500, 20000, DEFAULT_BEHAVIOR.chunking.user_request_max_chars),
      max_continuations: clampInt(chunking.max_continuations, 0, 30, DEFAULT_BEHAVIOR.chunking.max_continuations),
    },
    tool_loop: {
      max_loops: clampInt(tool_loop.max_loops, 1, 20, DEFAULT_BEHAVIOR.tool_loop.max_loops),
      max_calls_per_loop: clampInt(tool_loop.max_calls_per_loop, 1, 20, DEFAULT_BEHAVIOR.tool_loop.max_calls_per_loop),
    },
    rate_limit: {
      chat_reply: {
        limit: clampInt(
          coerceJsonObject(rate_limit.chat_reply as any).limit,
          1,
          30,
          DEFAULT_BEHAVIOR.rate_limit.chat_reply.limit,
        ),
        window_seconds: clampInt(
          coerceJsonObject(rate_limit.chat_reply as any).window_seconds,
          10,
          600,
          DEFAULT_BEHAVIOR.rate_limit.chat_reply.window_seconds,
        ),
      },
    },
    orchestrator: {
      ttl_minutes: clampIntRecord(
        (orchestrator as any).ttl_minutes,
        DEFAULT_BEHAVIOR.orchestrator.ttl_minutes,
        1,
        24 * 60,
      ),
      cooldown_minutes: {
        level2: clampIntRecord(
          coerceJsonObject((orchestrator as any).cooldown_minutes).level2,
          DEFAULT_BEHAVIOR.orchestrator.cooldown_minutes.level2,
          1,
          24 * 60,
        ),
        level1: clampIntRecord(
          coerceJsonObject((orchestrator as any).cooldown_minutes).level1,
          DEFAULT_BEHAVIOR.orchestrator.cooldown_minutes.level1,
          1,
          24 * 60,
        ),
        level0: clampIntRecord(
          coerceJsonObject((orchestrator as any).cooldown_minutes).level0,
          DEFAULT_BEHAVIOR.orchestrator.cooldown_minutes.level0,
          1,
          24 * 60,
        ),
      },
      daily_cap: {
        level2: clampInt(
          coerceJsonObject((orchestrator as any).daily_cap).level2,
          0,
          200,
          DEFAULT_BEHAVIOR.orchestrator.daily_cap.level2,
        ),
        level1: clampInt(
          coerceJsonObject((orchestrator as any).daily_cap).level1,
          0,
          200,
          DEFAULT_BEHAVIOR.orchestrator.daily_cap.level1,
        ),
        level0: clampInt(
          coerceJsonObject((orchestrator as any).daily_cap).level0,
          0,
          200,
          DEFAULT_BEHAVIOR.orchestrator.daily_cap.level0,
        ),
      },
      default_verbosity: clampFloat(
        (orchestrator as any).default_verbosity,
        0.1,
        0.9,
        DEFAULT_BEHAVIOR.orchestrator.default_verbosity,
      ),
      default_suggestions_limit: (() => {
        const maxRaw = (orchestrator as any).max_suggestions_limit;
        const maxNum = typeof maxRaw === 'number' && Number.isFinite(maxRaw) ? maxRaw : DEFAULT_BEHAVIOR.orchestrator.max_suggestions_limit;
        const max = clampInt(maxNum, 1, 6, DEFAULT_BEHAVIOR.orchestrator.max_suggestions_limit);
        const defRaw = (orchestrator as any).default_suggestions_limit;
        const defNum = typeof defRaw === 'number' && Number.isFinite(defRaw) ? defRaw : DEFAULT_BEHAVIOR.orchestrator.default_suggestions_limit;
        return clampInt(defNum, 1, max, DEFAULT_BEHAVIOR.orchestrator.default_suggestions_limit);
      })(),
      max_suggestions_limit: (() => {
        const maxRaw = (orchestrator as any).max_suggestions_limit;
        const maxNum = typeof maxRaw === 'number' && Number.isFinite(maxRaw) ? maxRaw : DEFAULT_BEHAVIOR.orchestrator.max_suggestions_limit;
        const max = clampInt(maxNum, 1, 6, DEFAULT_BEHAVIOR.orchestrator.max_suggestions_limit);
        const defRaw = (orchestrator as any).default_suggestions_limit;
        const defNum = typeof defRaw === 'number' && Number.isFinite(defRaw) ? defRaw : DEFAULT_BEHAVIOR.orchestrator.default_suggestions_limit;
        const def = clampInt(defNum, 1, max, DEFAULT_BEHAVIOR.orchestrator.default_suggestions_limit);
        return Math.max(max, def);
      })(),
    },
    diagnostics: (() => {
      const raw = String((diagnostics as any).user_error_detail ?? "").trim().toLowerCase();
      const allowed = ["friendly", "code", "technical"];
      const val = allowed.includes(raw)
        ? (raw as "friendly" | "code" | "technical")
        : DEFAULT_BEHAVIOR.diagnostics.user_error_detail;

      const maybeBool = (v: any): boolean | undefined => (typeof v === "boolean" ? v : undefined);

      const showCulpritVar = maybeBool((diagnostics as any).user_error_show_culprit_var);
      const showCulpritValue = maybeBool((diagnostics as any).user_error_show_culprit_value);
      const showStatusModel = maybeBool((diagnostics as any).user_error_show_status_model);
      const showTraceIds = maybeBool((diagnostics as any).user_error_show_trace_ids);

      return {
        user_error_detail: val,
        ...(showCulpritVar !== undefined ? { user_error_show_culprit_var: showCulpritVar } : {}),
        ...(showCulpritValue !== undefined ? { user_error_show_culprit_value: showCulpritValue } : {}),
        ...(showStatusModel !== undefined ? { user_error_show_status_model: showStatusModel } : {}),
        ...(showTraceIds !== undefined ? { user_error_show_trace_ids: showTraceIds } : {}),
      };
    })(),
    router: {
      deterministic_enabled: clampBool(router.deterministic_enabled, DEFAULT_BEHAVIOR.router.deterministic_enabled),
      attribution: {
        http_referer: clampString(
          coerceJsonObject(router.attribution as any).http_referer,
          DEFAULT_BEHAVIOR.router.attribution.http_referer,
          220,
        ),
        x_title: clampString(
          coerceJsonObject(router.attribution as any).x_title,
          DEFAULT_BEHAVIOR.router.attribution.x_title,
          220,
        ),
      },
    },
  };

  return behavior;
}

export function getDefaultModelCatalog(): string[] {
  const cfg = getConfig();
  return uniqStrings([
    cfg.openrouterModelFast,
    cfg.openrouterModelCreative,
    cfg.openrouterModelPlanner,
    cfg.openrouterModelMaker,
    cfg.openrouterModelCritic,
  ]);
}

export function getDefaultAssistantSettings(): AssistantSettings {
  const cfg = getConfig();
  const baseUrl = String(cfg.openrouterBaseUrl ?? DEFAULT_OPENROUTER_BASE_URL).trim() || DEFAULT_OPENROUTER_BASE_URL;

  // Prefer env-provided models, otherwise fall back to a stable free model so the assistant still works out-of-the-box.
  const modelFast = String(cfg.openrouterModelFast ?? "").trim() || DEFAULT_OPENROUTER_MODEL;
  const modelCreative = String(cfg.openrouterModelCreative ?? "").trim() || modelFast;
  const modelPlanner = String(cfg.openrouterModelPlanner ?? "").trim() || modelFast;
  const modelMaker = String(cfg.openrouterModelMaker ?? "").trim() || modelCreative;
  const modelCritic = String(cfg.openrouterModelCritic ?? "").trim() || modelFast;

  return {
    id: 1,
    openrouter_base_url: baseUrl,
    model_fast: modelFast,
    model_creative: modelCreative,
    model_planner: modelPlanner,
    model_maker: modelMaker,
    model_critic: modelCritic,
    fallback_models: [],
    model_catalog: uniqStrings([modelFast, modelCreative, modelPlanner, modelMaker, modelCritic, ...getDefaultModelCatalog()]),
    default_instructions: null,
    params: { ...DEFAULT_PARAMS },
    behavior: resolveAssistantBehavior(null),
    created_at: null,
    updated_at: null,
  };
}

async function upsertDefaults(client: any, defaults: AssistantSettings): Promise<void> {
  const payload: any = {
    id: 1,
    openrouter_base_url: defaults.openrouter_base_url ?? null,
    model_fast: defaults.model_fast ?? null,
    model_creative: defaults.model_creative ?? null,
    model_planner: defaults.model_planner ?? null,
    model_maker: defaults.model_maker ?? null,
    model_critic: defaults.model_critic ?? null,
    fallback_models: defaults.fallback_models ?? [],
    model_catalog: defaults.model_catalog ?? [],
    default_instructions: defaults.default_instructions ?? null,
    params: defaults.params ?? {},
    behavior: defaults.behavior ?? resolveAssistantBehavior(null),
    updated_at: new Date().toISOString(),
  };

  // Backwards compatibility: if the DB schema doesn't have behavior yet.
  let { error } = await client.from("assistant_settings").upsert(payload);
  if (error && /behavior/i.test(String(error.message ?? ""))) {
    const { behavior: _ignore, ...fallback } = payload;
    ({ error } = await client.from("assistant_settings").upsert(fallback));
  }
  if (error) throw error;
}

export async function getAssistantSettings(svc?: any): Promise<AssistantSettings> {
  const client = svc ?? getAdminClient();
  const defaults = getDefaultAssistantSettings();
  const { data, error } = await client.from("assistant_settings").select("*").eq("id", 1).maybeSingle();

  if (error && String(error.message ?? "").includes("assistant_settings")) {
    throw error;
  }

  if (error || !data) {
    if (!data) {
      await upsertDefaults(client, defaults);
    }
    return defaults;
  }

  const row = data as AssistantSettingsRow;
  return {
    id: row.id,
    openrouter_base_url:
      String(row.openrouter_base_url ?? "").trim() || String(defaults.openrouter_base_url ?? "").trim() || null,
    model_fast: String(row.model_fast ?? "").trim() || String(defaults.model_fast ?? "").trim() || null,
    model_creative: String(row.model_creative ?? "").trim() || String(defaults.model_creative ?? "").trim() || null,
    model_planner: String(row.model_planner ?? "").trim() || String(defaults.model_planner ?? "").trim() || null,
    model_maker: String(row.model_maker ?? "").trim() || String(defaults.model_maker ?? "").trim() || null,
    model_critic: String(row.model_critic ?? "").trim() || String(defaults.model_critic ?? "").trim() || null,
    fallback_models: uniqStrings([...(row.fallback_models ?? []), ...(defaults.fallback_models ?? [])]),
    model_catalog: uniqStrings([...(row.model_catalog ?? []), ...(defaults.model_catalog ?? [])]),
    default_instructions: row.default_instructions ?? null,
    params: {
      ...DEFAULT_PARAMS,
      ...normalizeParams(row.params),
    },
    behavior: resolveAssistantBehavior((row as any).behavior ?? null),
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}
