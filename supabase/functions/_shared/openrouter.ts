// supabase/functions/_shared/openrouter.ts
//
// Minimal OpenRouter client (OpenAI-compatible responses API).

import { getConfig } from "./config.ts";
import { readOpenRouterParametersCache, sanitizeOpenRouterBaseUrl, writeOpenRouterParametersCache } from "./openrouterCache.ts";
import { getOpenRouterModelCatalog } from "./openrouterCapabilities.ts";
import { fetchJsonWithTimeout, fetchStreamWithTimeout } from "./fetch.ts";
import { getAdminClient } from "./supabase.ts";
import { safeCircuitGetSkipSet, safeCircuitOnFailure, safeCircuitOnSuccess } from "./openrouterCircuit.ts";

function parseRetryAfterSeconds(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  // "Retry-After" can be either seconds or an HTTP date.
  const asNum = Number(raw);
  if (Number.isFinite(asNum) && asNum > 0) return Math.trunc(asNum);
  const asDate = Date.parse(raw);
  if (!Number.isFinite(asDate)) return null;
  const secs = Math.ceil((asDate - Date.now()) / 1000);
  return secs > 0 ? secs : null;
}

export type OpenRouterMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type OpenRouterInputTextPart = { type: "input_text"; text: string };

export type OpenRouterInputImagePart = {
  type: "input_image";
  image_url:
    | string
    | {
        url: string;
        detail?: "auto" | "low" | "high";
      };
};

export type OpenRouterInputAudioPart = {
  type: "input_audio";
  audio_url?: string;
  audio?: {
    data: string;
    format?: string;
  };
};

export type OpenRouterInputContentPart =
  | OpenRouterInputTextPart
  | OpenRouterInputImagePart
  | OpenRouterInputAudioPart;

export type OpenRouterInputMessage = {
  role: "system" | "user" | "assistant";
  content: string | OpenRouterInputContentPart[];
};

// OpenAI/OpenRouter Responses API input items (canonical shape).
// We keep these loose because providers may add item types over time.
export type OpenRouterResponsesInputMessage = {
  type: "message";
  role: "system" | "user" | "assistant";
  content: OpenRouterInputContentPart[];
};

export type OpenRouterResponsesInputItem = OpenRouterResponsesInputMessage | Record<string, unknown>;

// OpenAI-compatible structured outputs.
// Keep this intentionally loose because providers/models vary.
export type OpenRouterResponseFormat =
  | {
      type: "json_schema";
      json_schema: {
        name: string;
        strict?: boolean;
        schema: Record<string, unknown>;
      };
    }
  | { type: "json_object" };

export type OpenRouterPlugin = { id: string; [k: string]: unknown };

export type OpenRouterProviderRouting = {
  /** Provider ordering preference, used in `provider.order`. */
  order?: string[];
  /** Restrict to only these providers. OpenRouter calls this `provider.only`. */
  only?: string[];
  /** Legacy aliases (MoviNesta historical). Mapped into `only` at request-time. */
  require?: string[];
  allow?: string[];
  /** Exclude these providers. */
  ignore?: string[];
  /** Whether to allow fallback providers when the preferred one fails. */
  allow_fallbacks?: boolean;
  /** If true, filters providers to those that support all requested parameters. */
  require_parameters?: boolean;
  /** Optional data-collection policy (OpenRouter). */
  data_collection?: "allow" | "deny";
  /** Optional ZDR hint (OpenRouter). */
  zdr?: boolean;
  /** Optional quantization preferences (OpenRouter). */
  quantizations?: string[];
  /** Optional sorting strategy (disables default load balancing when set). */
  sort?:
    | "price"
    | "throughput"
    | "latency"
    | { by: "price" | "throughput" | "latency"; partition?: "model" | "none" };

  preferred_min_throughput?: number | { p50?: number; p75?: number; p90?: number; p99?: number };
  preferred_max_latency?: number | { p50?: number; p75?: number; p90?: number; p99?: number };
  max_price?: { prompt?: number; completion?: number; request?: number; image?: number };
  enforce_distillable_text?: boolean;
};
function normalizeProviderRouting(input: unknown): OpenRouterProviderRouting | undefined {
  if (!input || typeof input !== "object") return undefined;
  const obj = input as Record<string, unknown>;

  const toStrArray = (v: unknown): string[] =>
    Array.isArray(v) ? v.map((x) => String(x ?? "").trim()).filter(Boolean) : [];

  const uniq = (arr: string[]) => Array.from(new Set(arr));

  const order = toStrArray(obj["order"]);
  const ignore = toStrArray(obj["ignore"]);

  // New schema
  let only = toStrArray(obj["only"]);

  // Legacy schema (MoviNesta historical)
  const legacyRequire = toStrArray(obj["require"]);
  const legacyAllow = toStrArray(obj["allow"]);
  const legacyOnly = uniq([...legacyRequire, ...legacyAllow]);
  if (legacyOnly.length) {
    only = only.length ? uniq([...only, ...legacyOnly]) : legacyOnly;
  }

  const allow_fallbacks = typeof obj["allow_fallbacks"] === "boolean" ? (obj["allow_fallbacks"] as boolean) : undefined;
  const require_parameters = typeof obj["require_parameters"] === "boolean"
    ? (obj["require_parameters"] as boolean)
    : undefined;

  const data_collection =
    obj["data_collection"] === "allow" || obj["data_collection"] === "deny"
      ? (obj["data_collection"] as "allow" | "deny")
      : undefined;

  const zdr = typeof obj["zdr"] === "boolean" ? (obj["zdr"] as boolean) : undefined;
  const quantizations = toStrArray(obj["quantizations"]);

  const sortVal = obj["sort"];
  let sort: OpenRouterProviderRouting["sort"] | undefined = undefined;
  if (typeof sortVal === "string") {
    const s = sortVal.trim();
    if (s === "price" || s === "throughput" || s === "latency") sort = s;
  } else if (sortVal && typeof sortVal === "object" && !Array.isArray(sortVal)) {
    const by = String((sortVal as any)["by"] ?? "").trim();
    if (by === "price" || by === "throughput" || by === "latency") {
      const pr = String((sortVal as any)["partition"] ?? "").trim();
      const partition = pr === "model" || pr === "none" ? pr : undefined;
      sort = { by, ...(partition ? { partition } : {}) } as any;
    }
  }

  const normalizePercentiles = (
    v: unknown,
  ): number | { p50?: number; p75?: number; p90?: number; p99?: number } | undefined => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim()) {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const out: any = {};
      for (const k of ["p50", "p75", "p90", "p99"] as const) {
        const n = Number((v as any)[k]);
        if (Number.isFinite(n)) out[k] = n;
      }
      return Object.keys(out).length ? out : undefined;
    }
    return undefined;
  };

  const preferred_min_throughput = normalizePercentiles(obj["preferred_min_throughput"]);
  const preferred_max_latency = normalizePercentiles(obj["preferred_max_latency"]);

  const normalizeMaxPrice = (v: unknown):
    | { prompt?: number; completion?: number; request?: number; image?: number }
    | undefined => {
    if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
    const out: any = {};
    for (const k of ["prompt", "completion", "request", "image"] as const) {
      const n = Number((v as any)[k]);
      if (Number.isFinite(n)) out[k] = n;
    }
    return Object.keys(out).length ? out : undefined;
  };

  const max_price = normalizeMaxPrice(obj["max_price"]);
  const enforce_distillable_text =
    typeof obj["enforce_distillable_text"] === "boolean" ? (obj["enforce_distillable_text"] as boolean) : undefined;

  const out: OpenRouterProviderRouting = {};

  if (order.length) out.order = order;
  if (only.length) out.only = only;
  if (ignore.length) out.ignore = ignore;
  if (typeof allow_fallbacks === "boolean") out.allow_fallbacks = allow_fallbacks;
  if (typeof require_parameters === "boolean") out.require_parameters = require_parameters;
  if (data_collection) out.data_collection = data_collection;
  if (typeof zdr === "boolean") out.zdr = zdr;
  if (quantizations.length) out.quantizations = quantizations;
  if (sort) out.sort = sort;
  if (preferred_min_throughput !== undefined) out.preferred_min_throughput = preferred_min_throughput as any;
  if (preferred_max_latency !== undefined) out.preferred_max_latency = preferred_max_latency as any;
  if (max_price) out.max_price = max_price;
  if (typeof enforce_distillable_text === "boolean") out.enforce_distillable_text = enforce_distillable_text;

  return Object.keys(out).length ? out : undefined;
}


// Optional OpenRouter attribution headers.
// These are non-secret and can be safely configured by admins.
export type OpenRouterAttribution = {
  /** Sent as OpenRouter "HTTP-Referer" header */
  http_referer?: string;
  /** Sent as OpenRouter "X-Title" header */
  x_title?: string;
};

export interface OpenRouterChatOptions {
  model: string;
  input?: string | OpenRouterInputMessage[] | OpenRouterResponsesInputItem[];
  messages?: OpenRouterMessage[];
  instructions?: string;
  attribution?: OpenRouterAttribution;
  max_output_tokens?: number;
  temperature?: number;
  top_p?: number;
  // OpenRouter Responses API extras
  verbosity?: "low" | "medium" | "high" | string;
  reasoning?: Record<string, unknown>;
  timeout_ms?: number;
  stop?: string | string[];
  presence_penalty?: number;
  frequency_penalty?: number;
  seed?: number;
  stream?: boolean;
  metadata?: Record<string, unknown>;
  user?: string;
  logprobs?: boolean;
  top_logprobs?: number;
  tools?: unknown[];
  tool_choice?: unknown;
  parallel_tool_calls?: boolean;
  response_format?: OpenRouterResponseFormat;
  plugins?: OpenRouterPlugin[];
  // OpenRouter usage accounting.
  usage?: { include: boolean };
  provider?: OpenRouterProviderRouting;
  payload_variants?: string[];
  base_url?: string;
}

export type OpenRouterChatResult = {
  content: string;
  model?: string;
  usage?: unknown;
  raw?: unknown;
  variant?: string | null;
};

export type OpenRouterStreamChunk = {
  text: string;
  raw?: unknown;
};

export type OpenRouterChatStreamResult = {
  stream: AsyncIterable<OpenRouterStreamChunk>;
  result: Promise<OpenRouterChatResult>;
};

const getBaseUrl = (override?: string) => {
  const cfg = getConfig();
  const DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
  const v = String(override ?? cfg.openrouterBaseUrl ?? DEFAULT_OPENROUTER_BASE_URL).trim();
  if (!v) throw new Error("Missing OpenRouter base URL");
  // Strict allowlist validation: prevents accidental key exfiltration to untrusted hosts.
  // normalize/sanitize also pins the path to /api/v1.
  return sanitizeOpenRouterBaseUrl(v);
};

function payloadUsesAdvancedParams(payload: Record<string, unknown>): boolean {
  const rf = (payload as any)?.response_format;
  if (rf && typeof rf === "object") return true;

  const plugins = (payload as any)?.plugins;
  if (Array.isArray(plugins) && plugins.length) return true;

  const tools = (payload as any)?.tools;
  if (Array.isArray(tools) && tools.length) return true;
  if ((payload as any)?.tool_choice !== undefined) return true;
  if (typeof (payload as any)?.parallel_tool_calls === "boolean") return true;

  // Responses extras
  if (typeof (payload as any)?.verbosity === "string" && (payload as any).verbosity.trim()) return true;
  if ((payload as any)?.reasoning && typeof (payload as any).reasoning === "object") return true;

  return false;
}

type OpenRouterPayloadVariant = { tag: string; payload: Record<string, unknown> };

function extractSupportedParameters(payload: unknown): Set<string> | null {
  if (!payload || typeof payload !== "object") return null;
  const p: any = payload as any;
  const arr =
    (Array.isArray(p?.data?.supported_parameters) ? p.data.supported_parameters : null) ??
    (Array.isArray(p?.supported_parameters) ? p.supported_parameters : null);
  if (!Array.isArray(arr) || !arr.length) return null;

  const out = new Set<string>();
  for (const v of arr) {
    const s = String(v ?? "").trim();
    if (s) out.add(s);
  }
  return out.size ? out : null;
}



type SupportedParametersSource = "db_cache" | "model_catalog" | "live_fetch" | null;

const SUPPORTED_PARAMS_MEMO_TTL_MS = 2 * 60 * 1000;
const supportedParamsMemo = new Map<string, { atMs: number; supported: Set<string> | null; source: Exclude<SupportedParametersSource, null> }>();
const supportedParamsInflight = new Map<string, Promise<{ supported: Set<string> | null; source: SupportedParametersSource }>>();

function makeSupportedParamsKey(baseUrl: string, modelId: string, provider: string | null): string {
  return `${baseUrl}::${modelId}::${provider ?? ""}`;
}

function parseModelPath(modelId: string): { author: string; slug: string } {
  // OpenRouter model ids can include suffixes like ":free". The parameters endpoint expects author/slug.
  const clean = String(modelId ?? "").trim().split(":")[0];
  const parts = clean.split("/").map((s) => s.trim()).filter(Boolean);
  const author = parts.shift() ?? "";
  const slug = parts.join("/");
  if (!author || !slug) {
    throw new Error("Invalid model id. Expected 'author/slug'.");
  }
  return { author, slug };
}

async function fetchAndCacheSupportedParametersLive(
  baseUrl: string,
  modelId: string,
  provider: string | null,
): Promise<{ supported: Set<string> | null; source: SupportedParametersSource }> {
  const key = makeSupportedParamsKey(baseUrl, modelId, provider);

  const cached = supportedParamsMemo.get(key);
  if (cached && Date.now() - cached.atMs <= SUPPORTED_PARAMS_MEMO_TTL_MS) {
    return { supported: cached.supported, source: cached.source };
  }

  const inflight = supportedParamsInflight.get(key);
  if (inflight) return inflight;

  const p = (async () => {
    const cfg = getConfig();
    const apiKey = cfg.openrouterApiKey;
    if (!apiKey) return { supported: null, source: null as SupportedParametersSource };

    // Only attempt live fetch for OpenRouter-hosted base URLs.
    if (!/openrouter\.ai/i.test(baseUrl)) return { supported: null, source: null as SupportedParametersSource };

    // Respect circuit breaker: if this model is in cooldown, skip the preflight fetch.
    try {
      const svc = getAdminClient();
      const skip = await safeCircuitGetSkipSet(svc as any, [modelId]);
      if (skip.has(modelId)) return { supported: null, source: null as SupportedParametersSource };
    } catch {
      // ignore
    }

    try {
      const { author, slug } = parseModelPath(modelId);

      const qs: string[] = [];
      if (provider) qs.push(`provider=${encodeURIComponent(provider)}`);

      const endpoint = `${baseUrl}/parameters/${encodeURIComponent(author)}/${encodeURIComponent(slug)}${qs.length ? `?${qs.join("&")}` : ""}`;

      const referer = String(cfg.openrouterHttpReferer ?? "https://movinesta.app/").trim() || "https://movinesta.app/";
      const titleBase = String(cfg.openrouterXTitle ?? "MoviNesta").trim() || "MoviNesta";

      const payload = await fetchJsonWithTimeout(
        endpoint,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": referer,
            "X-Title": titleBase,
          },
        },
        2_500,
      );

      const supported = extractSupportedParameters(payload);

      // Best-effort: write cache so subsequent calls can avoid hitting OpenRouter.
      try {
        const svc = getAdminClient();
        // writeOpenRouterParametersCache is imported from openrouterCache.ts
        await writeOpenRouterParametersCache(svc as any, baseUrl, modelId, provider, payload);
      } catch {
        // ignore
      }

      supportedParamsMemo.set(key, { atMs: Date.now(), supported, source: "live_fetch" });
      return { supported, source: "live_fetch" };
    } catch {
      return { supported: null, source: null as SupportedParametersSource };
    }
  })();

  supportedParamsInflight.set(key, p);
  try {
    return await p;
  } finally {
    supportedParamsInflight.delete(key);
  }
}

async function loadSupportedParametersFromCache(
  baseUrl: string,
  modelId: string,
  provider: string | null,
): Promise<Set<string> | null> {
  try {
    const svc = getAdminClient();
    const row = await readOpenRouterParametersCache(svc, baseUrl, modelId, provider);
    const supported = extractSupportedParameters(row?.payload);
    return supported;
  } catch {
    return null;
  }
}

async function loadSupportedParameters(
  baseUrl: string,
  modelId: string,
  provider: string | null,
): Promise<{ supported: Set<string> | null; source: SupportedParametersSource }> {
  const key = makeSupportedParamsKey(baseUrl, modelId, provider);

  const memo = supportedParamsMemo.get(key);
  if (memo && Date.now() - memo.atMs <= SUPPORTED_PARAMS_MEMO_TTL_MS) {
    return { supported: memo.supported, source: memo.source };
  }

  const fromCache = await loadSupportedParametersFromCache(baseUrl, modelId, provider);
  if (fromCache) {
    supportedParamsMemo.set(key, { atMs: Date.now(), supported: fromCache, source: "db_cache" });
    return { supported: fromCache, source: "db_cache" };
  }

  // If a single provider is explicitly selected, skip catalog and try the provider-scoped parameters endpoint.
  if (provider) {
    const live = await fetchAndCacheSupportedParametersLive(baseUrl, modelId, provider);
    if (live.supported) return live;
    return { supported: null, source: null };
  }

  // Fallback: the /models catalog often includes `supported_parameters`.
  try {
    const catalog = await getOpenRouterModelCatalog({ base_url: baseUrl });
    const entry = catalog.find((m: any) => String(m?.id ?? "") === String(modelId));
    const supported = extractSupportedParameters(entry ? { supported_parameters: (entry as any).supported_parameters } : null);
    if (supported) {
      supportedParamsMemo.set(key, { atMs: Date.now(), supported, source: "model_catalog" });
      return { supported, source: "model_catalog" };
    }
  } catch {
    // ignore
  }

  // Last resort: fetch /parameters live (model-scoped) and persist cache.
  const live = await fetchAndCacheSupportedParametersLive(baseUrl, modelId, null);
  if (live.supported) return live;

  return { supported: null, source: null };
}

function gatePayloadBySupportedParameters(payload: Record<string, any>, supported: Set<string>): string[] {
  const gated: string[] = [];

  const rules: Array<{
    name: string;
    payloadKeys: string[];
    supportedAny: string[];
  }> = [
    {
      name: "tools",
      payloadKeys: ["tools", "tool_choice", "parallel_tool_calls"],
      supportedAny: ["tools", "tool_choice"],
    },
    {
      name: "response_format",
      payloadKeys: ["response_format"],
      supportedAny: ["response_format", "structured_outputs"],
    },
    {
      name: "reasoning",
      payloadKeys: ["reasoning", "include_reasoning"],
      supportedAny: ["reasoning", "include_reasoning"],
    },
    {
      name: "logprobs",
      payloadKeys: ["logprobs", "top_logprobs"],
      supportedAny: ["logprobs"],
    },
    { name: "stop", payloadKeys: ["stop"], supportedAny: ["stop"] },
    { name: "seed", payloadKeys: ["seed"], supportedAny: ["seed"] },
    {
      name: "frequency_penalty",
      payloadKeys: ["frequency_penalty"],
      supportedAny: ["frequency_penalty"],
    },
    {
      name: "presence_penalty",
      payloadKeys: ["presence_penalty"],
      supportedAny: ["presence_penalty"],
    },
    { name: "temperature", payloadKeys: ["temperature"], supportedAny: ["temperature"] },
    { name: "top_p", payloadKeys: ["top_p"], supportedAny: ["top_p"] },
    {
      name: "max_output_tokens",
      payloadKeys: ["max_output_tokens"],
      supportedAny: ["max_output_tokens", "max_tokens"],
    },
    { name: "verbosity", payloadKeys: ["verbosity"], supportedAny: ["verbosity"] },
  ];

  for (const rule of rules) {
    const hasAny = rule.payloadKeys.some((k) => payload?.[k] !== undefined);
    if (!hasAny) continue;
    const ok = rule.supportedAny.some((p) => supported.has(p));
    if (ok) continue;
    for (const k of rule.payloadKeys) {
      if (payload?.[k] !== undefined) delete payload[k];
    }
    gated.push(rule.name);
  }

  return gated;
}

function maybeAutoRequireParameters(
  payload: Record<string, any>,
  providerRequireIsExplicit: boolean,
): void {
  if (providerRequireIsExplicit) return;
  const provider = payload?.provider;
  if (!provider || typeof provider !== "object") return;
  if (payloadUsesAdvancedParams(payload)) {
    provider.require_parameters = true;
  } else if (provider.require_parameters !== undefined) {
    delete provider.require_parameters;
  }
}

async function applySupportedParametersToVariants(
  opts: OpenRouterChatOptions,
  baseUrl: string,
  variants: OpenRouterPayloadVariant[],
): Promise<{ variants: OpenRouterPayloadVariant[]; supported: Set<string> | null; source: SupportedParametersSource }>
{
  const providerBase = normalizeProviderRouting(opts.provider);
  const providerRequireIsExplicit = providerBase?.require_parameters !== undefined;
  const providerForParams = providerBase?.only && Array.isArray(providerBase.only) && providerBase.only.length === 1 ? String(providerBase.only[0]) : null;
  const { supported, source } = await loadSupportedParameters(baseUrl, opts.model, providerForParams);
  if (!supported) return { variants, supported: null, source: null };

  const next: OpenRouterPayloadVariant[] = [];
  const seen = new Set<string>();

  for (const v of variants) {
    // Deep clone because we will mutate the payload in-place.
    const cloned = JSON.parse(JSON.stringify(v.payload ?? {})) as Record<string, unknown>;
    gatePayloadBySupportedParameters(cloned as any, supported);
    maybeAutoRequireParameters(cloned as any, providerRequireIsExplicit);

    const sig = JSON.stringify(cloned);
    if (seen.has(sig)) continue;
    seen.add(sig);
    next.push({ tag: v.tag, payload: cloned });
  }

  return { variants: next.length ? next : variants, supported, source };
}

function buildInputFromMessages(messages: OpenRouterMessage[]): OpenRouterInputMessage[] {
  return messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));
}

export function normalizeInputForResponsesApi(
  input: string | OpenRouterInputMessage[] | OpenRouterResponsesInputItem[],
): string | OpenRouterResponsesInputItem[] {
  if (typeof input === "string") return input;

  if (!Array.isArray(input)) return input as any;
  if (input.length === 0) return input as any;

  // If it already looks like canonical Responses API items (has a `type` field), pass through.
  const first = input[0] as any;
  if (first && typeof first === "object" && typeof first.type === "string") {
    return input as any;
  }

  const normalizeRole = (r: any): "system" | "user" | "assistant" => {
    return r === "system" || r === "assistant" ? r : "user";
  };

  const normalizeParts = (content: any): OpenRouterInputContentPart[] => {
    const parts: OpenRouterInputContentPart[] = [];
    if (Array.isArray(content)) {
      for (const c of content) {
        if (typeof c === "string") {
          const t = c.trim();
          if (t) parts.push({ type: "input_text", text: t });
          continue;
        }
        if (c && typeof c === "object") {
          // If it already looks like an input part (input_text/input_image/input_audio), keep it.
          if (typeof (c as any).type === "string") {
            parts.push(c as any);
            continue;
          }
          // Best-effort: treat unknown objects as text.
          const maybeText = (c as any).text ?? (c as any).content ?? null;
          if (maybeText != null) {
            const t = String(maybeText).trim();
            if (t) parts.push({ type: "input_text", text: t });
          }
        }
      }
      return parts;
    }

    const t = typeof content === "string" ? content.trim() : String(content ?? "").trim();
    if (t) parts.push({ type: "input_text", text: t });
    return parts;
  };

  // Convert legacy chat-message format into canonical Responses API items.
  return (input as any[]).map((m) => ({
    type: "message",
    role: normalizeRole((m as any)?.role),
    content: normalizeParts((m as any)?.content),
  }));
}

function extractResponseText(data: any): string {
  // OpenRouter's OpenAI-compatible Responses API sometimes returns `output_text: ""` even when
  // the real content is present in `output[].content[]`. If we return the empty string here,
  // the caller treats it as an "empty completion" and fails all fallbacks.
  const direct = data?.output_text;
  if (typeof direct === "string" && direct.trim().length > 0) return direct;

  const output = Array.isArray(data?.output) ? data.output : [];
  const parts: string[] = [];

  const pushText = (v: unknown) => {
    if (typeof v === "string" && v.length) parts.push(v);
    // Some proxies/models wrap text as { value: "..." }
    else if (v && typeof v === "object" && typeof (v as any).value === "string") parts.push((v as any).value);
  };

  const readContent = (content: unknown) => {
    if (typeof content === "string") {
      pushText(content);
      return;
    }
    if (!Array.isArray(content)) return;
    for (const c of content) {
      if (typeof c === "string") {
        pushText(c);
        continue;
      }
      if (!c || typeof c !== "object") continue;

      // OpenAI Responses: { type: "output_text" | "text", text: "..." }
      pushText((c as any).text);
      // Sometimes: { text: { value: "..." } }
      pushText((c as any)?.text?.value);
      // Some proxies: { content: "..." }
      pushText((c as any).content);
    }
  };

  for (const item of output) {
    if (!item) continue;
    // OpenAI Responses typically uses { type: "message", content: [...] }
    // but some proxies omit/rename `type`, so we don't hard-require it.
    readContent((item as any).content);
    // Some proxies nest a `message` object.
    readContent((item as any)?.message?.content);
    pushText((item as any).text);
    pushText((item as any)?.text?.value);
  }

  if (parts.length) return parts.join("");

  return (
    data?.choices?.[0]?.message?.content ??
    data?.choices?.[0]?.text ??
    ""
  );
}

function extractStreamDelta(data: any): string | null {
  if (!data) return null;

  const readContentText = (content: any): string | null => {
    if (!content) return null;
    const out: string[] = [];
    const pushText = (value: any) => {
      if (typeof value === "string" && value) out.push(value);
    };
    const visitItem = (item: any) => {
      if (!item || typeof item !== "object") return;
      pushText(item.text);
      pushText(item?.text?.value);
      pushText(item?.output_text);
      if (typeof item?.content === "string") pushText(item.content);
      if (Array.isArray(item?.content)) {
        for (const part of item.content) visitItem(part);
      }
    };
    if (Array.isArray(content)) {
      for (const item of content) visitItem(item);
    } else {
      visitItem(content);
    }
    return out.length ? out.join("") : null;
  };

  // Responses API streaming emits many event types (including tool-call arguments).
  // We only forward *user-visible text* deltas.
  if (typeof data?.type === "string") {
    if (data.type === "response.output_text.delta") {
      if (typeof data?.delta === "string") return data.delta;
      if (typeof data?.delta?.text === "string") return data.delta.text;
      const nested = readContentText(data?.delta?.content ?? data?.delta);
      if (nested) return nested;
    }
    if (data.type === "response.content_part.delta") {
      if (typeof data?.delta === "string") return data.delta;
      if (typeof data?.delta?.text === "string") return data.delta.text;
      const nested = readContentText(data?.delta?.content ?? data?.delta);
      if (nested) return nested;
    }
    if (data.type === "response.output_text") {
      if (typeof data?.text === "string") return data.text;
      const nested = readContentText(data?.content ?? data?.text);
      if (nested) return nested;
    }
    // Anything else (e.g., tool-call streaming) is intentionally ignored.
    return null;
  }

  // Some providers may stream Chat Completions style payloads.
  const choice = Array.isArray(data?.choices) ? data.choices[0] : null;
  if (choice?.delta?.content) return choice.delta.content;
  if (typeof choice?.text === "string") return choice.text;
  return null;
}

function buildOpenRouterVariants(opts: OpenRouterChatOptions): {
  url: string;
  timeoutMs: number;
  attribution: Required<OpenRouterAttribution>;
  variants: Array<{ tag: string; payload: Record<string, unknown> }>;
  baseUrl: string;
} {
  const baseUrl = getBaseUrl(opts.base_url);
  const url = `${baseUrl}/responses`;
  const timeoutMs = typeof opts.timeout_ms === "number" ? opts.timeout_ms : 12_000;

  // Optional, but recommended by OpenRouter to attribute traffic.
  // Prefer env-configured values when present, otherwise fall back to MoviNesta defaults.
  const cfg = getConfig();
  const DEFAULT_ATTRIBUTION: Required<OpenRouterAttribution> = {
    http_referer: String(cfg.openrouterHttpReferer ?? "https://movinesta.app").trim() || "https://movinesta.app",
    x_title: String(cfg.openrouterXTitle ?? "MoviNesta").trim() || "MoviNesta",
  };

  const sanitizeHeaderValue = (v: unknown, fallback: string, maxLen = 200): string => {
    const s = typeof v === "string" ? v.trim() : "";
    const out = s || fallback;
    return out.length > maxLen ? out.slice(0, maxLen) : out;
  };

  const attribution: Required<OpenRouterAttribution> = {
    http_referer: sanitizeHeaderValue(opts.attribution?.http_referer, DEFAULT_ATTRIBUTION.http_referer),
    x_title: sanitizeHeaderValue(opts.attribution?.x_title, DEFAULT_ATTRIBUTION.x_title),
  };

  const rawInput = opts.input ?? (opts.messages ? buildInputFromMessages(opts.messages) : undefined);
  const input = rawInput ? normalizeInputForResponsesApi(rawInput as any) : undefined;
  if (!input) {
    throw new Error("Missing input/messages for OpenRouter responses");
  }
  const providerBase = normalizeProviderRouting(opts.provider);
  const providerRequireIsExplicit = providerBase?.require_parameters !== undefined;

  const payloadHasAdvancedParams = (payload: Record<string, unknown>): boolean => {
    const rf = payload["response_format"];
    if (rf && typeof rf === "object") return true;

    const plugins = payload["plugins"];
    if (Array.isArray(plugins) && plugins.length) return true;

    const tools = payload["tools"];
    if (Array.isArray(tools) && tools.length) return true;

    if (payload["tool_choice"] != null) return true;
    if (typeof payload["parallel_tool_calls"] === "boolean") return true;

    // Responses extras
    if (typeof payload["verbosity"] === "string" && String(payload["verbosity"]).trim()) return true;
    if (payload["reasoning"] && typeof payload["reasoning"] === "object") return true;

    return false;
  };

  const applyProviderRouting = (payload: Record<string, unknown>) => {
    if (!providerBase) return;

    // Copy so per-variant tweaks don't mutate the shared object.
    const p: OpenRouterProviderRouting = { ...providerBase };

    // Auto-enforcement: when the request uses advanced params (tools/plugins/response_format),
    // require providers that support all requested parameters. But if the admin explicitly set
    // require_parameters, do not override it.
    if (!providerRequireIsExplicit) {
      const need = payloadHasAdvancedParams(payload);
      if (need) p.require_parameters = true;
      else delete (p as any).require_parameters;
    }

    payload["provider"] = p;
  };

  const basePayload: Record<string, unknown> = {
    model: opts.model,
    input,
    ...(opts.instructions ? { instructions: opts.instructions } : {}),
    ...(typeof opts.temperature === "number" ? { temperature: opts.temperature } : {}),
    ...(typeof opts.top_p === "number" ? { top_p: opts.top_p } : {}),
    ...(typeof opts.verbosity === "string" && opts.verbosity.trim().length ? { verbosity: opts.verbosity } : {}),
    ...(opts.reasoning && typeof opts.reasoning === "object" ? { reasoning: opts.reasoning } : {}),
    ...(typeof opts.max_output_tokens === "number" ? { max_output_tokens: opts.max_output_tokens } : {}),
    ...(opts.usage ? { usage: opts.usage } : {}),
    ...(opts.stop ? { stop: opts.stop } : {}),
    ...(typeof opts.presence_penalty === "number" ? { presence_penalty: opts.presence_penalty } : {}),
    ...(typeof opts.frequency_penalty === "number" ? { frequency_penalty: opts.frequency_penalty } : {}),
    ...(typeof opts.seed === "number" ? { seed: opts.seed } : {}),
    ...(typeof opts.stream === "boolean" ? { stream: opts.stream } : { stream: false }),
    ...(opts.metadata ? { metadata: opts.metadata } : {}),
    ...(opts.user ? { user: opts.user } : {}),
    ...(typeof opts.logprobs === "boolean" ? { logprobs: opts.logprobs } : {}),
    ...(typeof opts.top_logprobs === "number" ? { top_logprobs: opts.top_logprobs } : {}),
    ...(opts.tools ? { tools: opts.tools } : {}),
    ...(opts.tool_choice ? { tool_choice: opts.tool_choice } : {}),
    ...(typeof opts.parallel_tool_calls === "boolean" ? { parallel_tool_calls: opts.parallel_tool_calls } : {}),
    ...(opts.response_format ? { response_format: opts.response_format } : {}),
    ...(opts.plugins ? { plugins: opts.plugins } : {}),
  };

  const variants: Array<{ tag: string; payload: Record<string, unknown> }> = [];
  variants.push({ tag: "base", payload: basePayload });

  // Some models/providers don't support `reasoning` or `verbosity`.
  // Keep a variant that preserves tools/structured outputs but drops these fields.
  if (basePayload["reasoning"] != null) {
    variants.push({ tag: "drop_reasoning", payload: { ...basePayload, reasoning: undefined } });
  }
  if (typeof basePayload["verbosity"] === "string" && String(basePayload["verbosity"]).trim()) {
    variants.push({ tag: "drop_verbosity", payload: { ...basePayload, verbosity: undefined } });
  }

  const rf = opts.response_format as any;
  if (rf?.type === "json_schema") {
    variants.push({ tag: "rf_json_object", payload: { ...basePayload, response_format: { type: "json_object" } } });
  }

  if (opts.plugins?.length) {
    variants.push({ tag: "drop_plugins", payload: { ...basePayload, plugins: undefined } });
    if (rf?.type === "json_schema") {
      variants.push({ tag: "drop_plugins_rf_json_object", payload: { ...basePayload, plugins: undefined, response_format: { type: "json_object" } } });
    }
  }

  if (opts.tools?.length || opts.tool_choice || typeof opts.parallel_tool_calls === "boolean") {
    variants.push({ tag: "drop_tools", payload: { ...basePayload, tools: undefined, tool_choice: undefined, parallel_tool_calls: undefined } });
  }

  // A maximally compatible variant: drop all "advanced" fields so that even minimal providers can answer.
  variants.push({
    tag: "bare",
    payload: {
      ...basePayload,
      plugins: undefined,
      response_format: undefined,
      tools: undefined,
      tool_choice: undefined,
      parallel_tool_calls: undefined,
      reasoning: undefined,
      verbosity: undefined,
      logprobs: undefined,
      top_logprobs: undefined,
    },
  });

  // Apply provider routing (and auto require_parameters) per variant. This is intentionally done
  // AFTER variants are assembled so variants that drop advanced params can relax require_parameters.
  for (const v of variants) {
    applyProviderRouting(v.payload);
  }

  return { url, timeoutMs, attribution, variants, baseUrl };
}

export async function openrouterChat(opts: OpenRouterChatOptions): Promise<OpenRouterChatResult> {
  const { openrouterApiKey } = getConfig();
  if (!openrouterApiKey) {
    throw new Error("Missing OPENROUTER_API_KEY");
  }

  const {
    url,
    timeoutMs,
    attribution,
    variants: baseVariants,
    baseUrl,
  } = buildOpenRouterVariants(opts);

  // If we have per-model supported parameters cached, proactively strip unsupported request
  // fields before the first attempt (reduces 400s and makes fallbacks faster).
  const { variants, supported, source: supportedSource } = await applySupportedParametersToVariants(opts, baseUrl, baseVariants);

  let lastErr: any = null;
  let data: any = null;
  let usedVariant: string | null = null;
  const allowedVariants = Array.isArray(opts.payload_variants)
    ? opts.payload_variants.map((v) => String(v ?? "").trim()).filter(Boolean)
    : [];
  let allowedSet = allowedVariants.length ? new Set(allowedVariants) : null;
  if (allowedSet && !variants.some((v) => allowedSet?.has(v.tag))) {
    allowedSet = null;
  }
  for (const v of variants) {
    if (allowedSet && !allowedSet.has(v.tag)) continue;
    try {
      // Best-effort retry for 429s (helps when we're at a per-second limit but still below daily cap).
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          data = (await fetchJsonWithTimeout(
            url,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${openrouterApiKey}`,
                // Optional, but recommended by OpenRouter to attribute traffic.
                "HTTP-Referer": attribution.http_referer,
                "X-Title": attribution.x_title,
              },
              body: JSON.stringify(v.payload),
            },
            timeoutMs,
          )) as any;
          break;
        } catch (e: any) {
          const status = Number(e?.status ?? 0);
          if (attempt === 0 && status === 429) {
            const retryAfterSeconds = parseRetryAfterSeconds((e as any)?.retryAfter) ?? 0.25;
            const delayMs = Math.min(1200, Math.max(100, Math.floor(retryAfterSeconds * 1000)));
            await new Promise((r) => setTimeout(r, delayMs));
            continue;
          }
          throw e;
        }
      }
      usedVariant = v.tag;
      if (data) break;
    } catch (e: any) {
      lastErr = e;
      // Attach context for better, user-facing diagnostics upstream.
      try {
        (lastErr as any).openrouter = {
          ...(typeof (lastErr as any).openrouter === "object" ? (lastErr as any).openrouter : {}),
          variant: v.tag,
          model: opts.model,
          base_url: baseUrl,
          timeout_ms: timeoutMs,
          supported_parameters_count: supported ? supported.size : null,
          supported_parameters_source: supportedSource ?? null,
          upstreamRequestId: (e as any)?.upstreamRequestId ?? null,
          retryAfter: (e as any)?.retryAfter ?? null,
        };
      } catch {
        // ignore
      }
      // Decide whether to try the next variant.
      // - 400: payload variant might be invalid (try the next variant)
      // - 429/5xx/timeouts: transient/provider/load issues (try the next variant)
      const status = Number(e?.status ?? 0);
      const transient = Boolean(e?.aborted) || status === 408 || status === 429 || (status >= 500 && status <= 599);
      if (status === 400 || transient) {
        continue;
      }
      break;
    }
  }

  if (!data) {
    // Re-throw with useful context.
    if (lastErr?.status) {
      const details = typeof lastErr?.data === "string" ? lastErr.data : JSON.stringify(lastErr.data ?? null);
      const msg = `upstream_error_${lastErr.status}: ${details?.slice?.(0, 900) ?? ""}`;
      const err: any = lastErr instanceof Error ? lastErr : new Error(msg);
      // Preserve original error object (and any attached context) but improve the message.
      try {
        err.message = msg;
      } catch {
        // ignore
      }
      err.status = lastErr.status;
      err.data = lastErr.data;
      throw err;
    }
    throw lastErr ?? new Error("OpenRouter request failed");
  }

  const content = extractResponseText(data);

  return {
    content: typeof content === "string" ? content : JSON.stringify(content),
    model: data?.model,
    usage: data?.usage,
    raw: data,
    variant: usedVariant,
  };
}

async function* parseSseStream(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let dataLines: string[] = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, idx).replace(/\r$/, "");
      buffer = buffer.slice(idx + 1);
      if (!line.trim()) {
        if (dataLines.length) {
          yield dataLines.join("\n");
          dataLines = [];
        }
        continue;
      }
      if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trimStart());
      }
    }
  }
  if (dataLines.length) {
    yield dataLines.join("\n");
  }
}

export async function openrouterChatStream(opts: OpenRouterChatOptions): Promise<OpenRouterChatStreamResult> {
  const { openrouterApiKey } = getConfig();
  if (!openrouterApiKey) {
    throw new Error("Missing OPENROUTER_API_KEY");
  }

  const {
    url,
    timeoutMs,
    attribution,
    variants: baseVariants,
    baseUrl,
  } = buildOpenRouterVariants({ ...opts, stream: true });

  const { variants, supported, source: supportedSource } = await applySupportedParametersToVariants(opts, baseUrl, baseVariants);

  let lastErr: any = null;
  let usedVariant: string | null = null;
  let res: Response | null = null;
  const allowedVariants = Array.isArray(opts.payload_variants)
    ? opts.payload_variants.map((v) => String(v ?? "").trim()).filter(Boolean)
    : [];
  let allowedSet = allowedVariants.length ? new Set(allowedVariants) : null;
  if (allowedSet && !variants.some((v) => allowedSet?.has(v.tag))) {
    allowedSet = null;
  }

  for (const v of variants) {
    if (allowedSet && !allowedSet.has(v.tag)) continue;
    try {
      // Best-effort retry for 429s before moving to the next variant.
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          res = await fetchStreamWithTimeout(
            url,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${openrouterApiKey}`,
                "HTTP-Referer": attribution.http_referer,
                "X-Title": attribution.x_title,
              },
              body: JSON.stringify(v.payload),
            },
            timeoutMs,
          );
          break;
        } catch (e: any) {
          const status = Number(e?.status ?? 0);
          if (attempt === 0 && status === 429) {
            const retryAfterSeconds = parseRetryAfterSeconds((e as any)?.retryAfter) ?? 0.25;
            const delayMs = Math.min(1200, Math.max(100, Math.floor(retryAfterSeconds * 1000)));
            await new Promise((r) => setTimeout(r, delayMs));
            continue;
          }
          throw e;
        }
      }
      usedVariant = v.tag;
      if (res) break;
    } catch (e: any) {
      lastErr = e;
      try {
        (lastErr as any).openrouter = {
          ...(typeof (lastErr as any).openrouter === "object" ? (lastErr as any).openrouter : {}),
          variant: v.tag,
          model: opts.model,
          base_url: baseUrl,
          timeout_ms: timeoutMs,
          supported_parameters_count: supported ? supported.size : null,
          supported_parameters_source: supportedSource ?? null,
          upstreamRequestId: (e as any)?.upstreamRequestId ?? null,
        };
      } catch {
        // ignore
      }
      const status = Number(e?.status ?? 0);
      const transient = Boolean(e?.aborted) || status === 408 || status === 429 || (status >= 500 && status <= 599);
      if (status === 400 || transient) {
        continue;
      }
      break;
    }
  }

  if (!res?.body) {
    if (lastErr?.status) {
      const details = typeof lastErr?.data === "string" ? lastErr.data : JSON.stringify(lastErr.data ?? null);
      const msg = `upstream_error_${lastErr.status}: ${details?.slice?.(0, 900) ?? ""}`;
      const err: any = lastErr instanceof Error ? lastErr : new Error(msg);
      try {
        err.message = msg;
      } catch {
        // ignore
      }
      err.status = lastErr.status;
      err.data = lastErr.data;
      throw err;
    }
    throw lastErr ?? new Error("OpenRouter request failed");
  }

  let resolveFinal: (value: OpenRouterChatResult) => void;
  let rejectFinal: (reason?: unknown) => void;
  const result = new Promise<OpenRouterChatResult>((resolve, reject) => {
    resolveFinal = resolve;
    rejectFinal = reject;
  });

  const stream = (async function* () {
    let fullText = "";
    let lastRaw: any = null;
    let model: string | undefined;
    let usage: unknown;
    try {
      for await (const data of parseSseStream(res.body)) {
        if (!data) continue;
        if (data === "[DONE]") break;
        let parsed: any = null;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = null;
        }
        if (parsed) {
          lastRaw = parsed;
          if (parsed?.response?.model) model = parsed.response.model;
          if (parsed?.response?.usage) usage = parsed.response.usage;
          const delta = extractStreamDelta(parsed);
          if (delta) {
            fullText += delta;
            yield { text: delta, raw: parsed };
          }
        }
      }
      const content = fullText || extractResponseText(lastRaw?.response ?? lastRaw);
      resolveFinal({
        content: typeof content === "string" ? content : JSON.stringify(content),
        model,
        usage,
        raw: lastRaw,
        variant: usedVariant,
      });
    } catch (err) {
      rejectFinal(err);
      throw err;
    }
  })();

  return { stream, result };
}


export interface OpenRouterChatStreamWithFallbackOptions {
  models: string[]; // ordered
  input?: string | OpenRouterInputMessage[] | OpenRouterResponsesInputItem[];
  messages?: OpenRouterMessage[];
  instructions?: string;
  attribution?: OpenRouterAttribution;
  max_output_tokens?: number;
  temperature?: number;
  top_p?: number;
  // OpenRouter Responses API extras
  verbosity?: "low" | "medium" | "high" | string;
  reasoning?: Record<string, unknown>;
  timeout_ms?: number;
  stop?: string | string[];
  presence_penalty?: number;
  frequency_penalty?: number;
  seed?: number;
  metadata?: Record<string, unknown>;
  user?: string;
  logprobs?: boolean;
  top_logprobs?: number;
  tools?: unknown[];
  tool_choice?: unknown;
  parallel_tool_calls?: boolean;
  response_format?: OpenRouterResponseFormat;
  plugins?: OpenRouterPlugin[];
  usage?: { include: boolean };
  provider?: OpenRouterProviderRouting;
  payload_variants?: string[];
  base_url?: string;
  defaults?: Partial<Omit<OpenRouterChatOptions, "model" | "input" | "messages" | "stream">>;
}

/**
 * Streaming variant of openrouterChatWithFallback.
 *
 * NOTE: Fallback is only attempted before any tokens are emitted.
 * If a model errors mid-stream, the stream will throw.
 */
export async function openrouterChatStreamWithFallback(
  opts: OpenRouterChatStreamWithFallbackOptions,
): Promise<OpenRouterChatStreamResult & { attempted: Array<{ model: string; status: number | null; message: string; variant: string | null; upstreamRequestId: string | null }> }> {
  const models = Array.isArray(opts.models) ? opts.models.filter(Boolean) : [];
  if (!models.length) throw new Error("No models provided");

  // DB-backed circuit breaker (best-effort). If unavailable, no-op.
  let svc: any | null = null;
  const getSvc = () => {
    if (svc) return svc;
    svc = getAdminClient();
    return svc;
  };
  let skipSet = new Set<string>();
  try {
    skipSet = await safeCircuitGetSkipSet(getSvc(), models);
  } catch {
    // ignore
  }

  let lastErr: any = null;
  const attempted: Array<{ model: string; status: number | null; message: string; variant: string | null; upstreamRequestId: string | null }> = [];

  for (const model of models) {
    if (skipSet.has(model)) {
      attempted.push({
        model,
        status: null,
        message: "circuit_open",
        variant: null,
        upstreamRequestId: null,
      });
      continue;
    }
    try {
      const defaults = opts.defaults ?? {};
      const merged: Partial<OpenRouterChatOptions> = { ...defaults };
      const assignIfDefined = <K extends keyof OpenRouterChatOptions>(key: K, value: OpenRouterChatOptions[K]) => {
        if (value !== undefined && value !== null) (merged as any)[key] = value;
      };

      assignIfDefined("input", opts.input as any);
      assignIfDefined("messages", opts.messages as any);
      assignIfDefined("instructions", opts.instructions as any);
      assignIfDefined("attribution", opts.attribution as any);
      assignIfDefined("max_output_tokens", opts.max_output_tokens as any);
      assignIfDefined("temperature", opts.temperature as any);
      assignIfDefined("top_p", opts.top_p as any);
      assignIfDefined("verbosity", (opts as any).verbosity);
      assignIfDefined("reasoning", (opts as any).reasoning);
      assignIfDefined("timeout_ms", opts.timeout_ms as any);
      assignIfDefined("stop", opts.stop as any);
      assignIfDefined("presence_penalty", opts.presence_penalty as any);
      assignIfDefined("frequency_penalty", opts.frequency_penalty as any);
      assignIfDefined("seed", opts.seed as any);
      assignIfDefined("metadata", opts.metadata as any);
      assignIfDefined("user", opts.user as any);
      assignIfDefined("logprobs", opts.logprobs as any);
      assignIfDefined("top_logprobs", opts.top_logprobs as any);
      assignIfDefined("tools", opts.tools as any);
      assignIfDefined("tool_choice", opts.tool_choice as any);
      assignIfDefined("parallel_tool_calls", opts.parallel_tool_calls as any);
      assignIfDefined("response_format", opts.response_format as any);
      assignIfDefined("plugins", opts.plugins as any);
      assignIfDefined("usage", opts.usage as any);
      assignIfDefined("provider", opts.provider as any);
      assignIfDefined("payload_variants", opts.payload_variants as any);
      assignIfDefined("base_url", opts.base_url as any);

      const res = await openrouterChatStream({
        ...(merged as Omit<OpenRouterChatOptions, "model">),
        model,
        stream: true,
      });
      try {
        await safeCircuitOnSuccess(getSvc(), model);
      } catch {
        // ignore
      }
      return { ...res, attempted };
    } catch (e: any) {
      lastErr = e;
      const status = Number((e as any)?.status ?? 0);
      const msg = e instanceof Error ? e.message : String(e ?? "OpenRouter error");
      const variant = (e as any)?.openrouter?.variant ?? null;
      const upstreamRequestId = (e as any)?.upstreamRequestId ?? (e as any)?.openrouter?.upstreamRequestId ?? null;
      const retryAfterSeconds = parseRetryAfterSeconds((e as any)?.retryAfter);
      attempted.push({
        model,
        status: Number.isFinite(status) && status > 0 ? status : null,
        message: msg.slice(0, 240),
        variant: typeof variant === "string" ? variant : null,
        upstreamRequestId: typeof upstreamRequestId === "string" ? upstreamRequestId : null,
      });

      try {
        await safeCircuitOnFailure(getSvc(), {
          model,
          status: Number.isFinite(status) && status > 0 ? Math.trunc(status) : null,
          error: msg,
          retryAfterSeconds,
        });
      } catch {
        // ignore
      }
      // continue
    }
  }

  if (lastErr) {
    try {
      (lastErr as any).modelsTried = attempted;
      (lastErr as any).models = models;
    } catch {
      // ignore
    }
    throw lastErr;
  }

  const err: any = new Error("All models failed");
  err.modelsTried = attempted;
  err.models = models;
  throw err;
}


export interface OpenRouterChatWithFallbackOptions {
  models: string[]; // ordered
  input?: string | OpenRouterInputMessage[] | OpenRouterResponsesInputItem[];
  messages?: OpenRouterMessage[];
  instructions?: string;
  attribution?: OpenRouterAttribution;
  max_output_tokens?: number;
  temperature?: number;
  top_p?: number;
  // OpenRouter Responses API extras
  verbosity?: "low" | "medium" | "high" | string;
  reasoning?: Record<string, unknown>;
  timeout_ms?: number;
  stop?: string | string[];
  presence_penalty?: number;
  frequency_penalty?: number;
  seed?: number;
  stream?: boolean;
  metadata?: Record<string, unknown>;
  user?: string;
  logprobs?: boolean;
  top_logprobs?: number;
  tools?: unknown[];
  tool_choice?: unknown;
  parallel_tool_calls?: boolean;
  response_format?: OpenRouterResponseFormat;
  plugins?: OpenRouterPlugin[];
  usage?: { include: boolean };
  provider?: OpenRouterProviderRouting;
  payload_variants?: string[];
  base_url?: string;
  defaults?: Partial<Omit<OpenRouterChatOptions, "model" | "input" | "messages">>;
}

/**
 * Try multiple models in order. Useful for reliability and cost control.
 * The first model that returns a non-empty response wins.
 */
export async function openrouterChatWithFallback(
  opts: OpenRouterChatWithFallbackOptions,
): Promise<OpenRouterChatResult> {
  const models = Array.isArray(opts.models) ? opts.models.filter(Boolean) : [];
  if (!models.length) {
    throw new Error("No models provided");
  }

  // DB-backed circuit breaker (best-effort). If unavailable, no-op.
  let svc: any | null = null;
  const getSvc = () => {
    if (svc) return svc;
    svc = getAdminClient();
    return svc;
  };
  let skipSet = new Set<string>();
  try {
    skipSet = await safeCircuitGetSkipSet(getSvc(), models);
  } catch {
    // ignore
  }

  let lastErr: any = null;
  const tried: Array<{
    model: string;
    status: number | null;
    message: string;
    variant: string | null;
    upstreamRequestId: string | null;
  }> = [];
  for (const model of models) {
    if (skipSet.has(model)) {
      tried.push({
        model,
        status: null,
        message: "circuit_open",
        variant: null,
        upstreamRequestId: null,
      });
      continue;
    }
    try {
      const defaults = opts.defaults ?? {};
      const merged: Partial<OpenRouterChatOptions> = { ...defaults };
      const assignIfDefined = <K extends keyof OpenRouterChatOptions>(key: K, value: OpenRouterChatOptions[K]) => {
        if (value !== undefined && value !== null) merged[key] = value;
      };

      assignIfDefined("input", opts.input);
      assignIfDefined("messages", opts.messages);
      assignIfDefined("instructions", opts.instructions);
      assignIfDefined("attribution", opts.attribution);
      assignIfDefined("max_output_tokens", opts.max_output_tokens);
      assignIfDefined("temperature", opts.temperature);
      assignIfDefined("top_p", opts.top_p);
      assignIfDefined("verbosity", (opts as any).verbosity);
      assignIfDefined("reasoning", (opts as any).reasoning);
      assignIfDefined("timeout_ms", opts.timeout_ms);
      assignIfDefined("stop", opts.stop);
      assignIfDefined("presence_penalty", opts.presence_penalty);
      assignIfDefined("frequency_penalty", opts.frequency_penalty);
      assignIfDefined("seed", opts.seed);
      assignIfDefined("stream", opts.stream);
      assignIfDefined("metadata", opts.metadata);
      assignIfDefined("user", opts.user);
      assignIfDefined("logprobs", opts.logprobs);
      assignIfDefined("top_logprobs", opts.top_logprobs);
      assignIfDefined("tools", opts.tools);
      assignIfDefined("tool_choice", opts.tool_choice);
      assignIfDefined("parallel_tool_calls", opts.parallel_tool_calls);
      assignIfDefined("response_format", opts.response_format);
      assignIfDefined("plugins", opts.plugins);
      assignIfDefined("usage", opts.usage);
      assignIfDefined("provider", opts.provider);
      assignIfDefined("payload_variants", opts.payload_variants);
      assignIfDefined("base_url", opts.base_url);

      const res = await openrouterChat({
        ...(merged as Omit<OpenRouterChatOptions, "model">),
        model,
      });
      if (res?.content && String(res.content).trim()) {
        try {
          await safeCircuitOnSuccess(getSvc(), model);
        } catch {
          // ignore
        }
        return res;
      }
    } catch (e: any) {
      lastErr = e;
      const status = Number((e as any)?.status ?? 0);
      const msg = e instanceof Error ? e.message : String(e ?? "OpenRouter error");
      const variant = (e as any)?.openrouter?.variant ?? null;
      const upstreamRequestId =
        (e as any)?.upstreamRequestId ?? (e as any)?.openrouter?.upstreamRequestId ?? null;
      const retryAfterSeconds = parseRetryAfterSeconds((e as any)?.retryAfter);

      tried.push({
        model,
        status: Number.isFinite(status) && status > 0 ? status : null,
        message: msg.slice(0, 240),
        variant: typeof variant === "string" ? variant : null,
        upstreamRequestId: typeof upstreamRequestId === "string" ? upstreamRequestId : null,
      });

      // Trip circuit on transient failures (429/5xx/timeouts) so future calls can skip this model briefly.
      try {
        await safeCircuitOnFailure(getSvc(), {
          model,
          status: Number.isFinite(status) && status > 0 ? Math.trunc(status) : null,
          error: msg,
          retryAfterSeconds,
        });
      } catch {
        // ignore
      }

      try {
        (lastErr as any).attemptedModel = model;
        (lastErr as any).modelsTried = tried;
      } catch {
        // ignore
      }
      // continue
    }
  }
  if (lastErr) {
    try {
      (lastErr as any).modelsTried = tried;
      (lastErr as any).models = models;
    } catch {
      // ignore
    }
    throw lastErr;
  }
  const err: any = new Error("All models failed");
  err.modelsTried = tried;
  err.models = models;
  throw err;
}
