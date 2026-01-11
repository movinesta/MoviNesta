// supabase/functions/_shared/openrouter.ts
//
// Minimal OpenRouter client (OpenAI-compatible responses API).

import { getConfig } from "./config.ts";
import { fetchJsonWithTimeout, fetchStreamWithTimeout } from "./fetch.ts";

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
  order?: string[];
  require?: string[];
  allow?: string[];
  ignore?: string[];
  allow_fallbacks?: boolean;
  sort?: "price" | "throughput" | "latency";
};

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
  input?: string | OpenRouterInputMessage[];
  messages?: OpenRouterMessage[];
  instructions?: string;
  attribution?: OpenRouterAttribution;
  max_output_tokens?: number;
  temperature?: number;
  top_p?: number;
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
  return v.replace(/\/+$/, "");
};

function buildInputFromMessages(messages: OpenRouterMessage[]): OpenRouterInputMessage[] {
  return messages.map((m) => ({
    role: m.role,
    content: m.content,
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
  if (typeof data?.delta === "string") return data.delta;
  if (typeof data?.text === "string") return data.text;
  if (data?.type === "response.output_text.delta" && typeof data?.delta === "string") return data.delta;
  if (data?.type === "response.output_text" && typeof data?.text === "string") return data.text;
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

  const DEFAULT_ATTRIBUTION: Required<OpenRouterAttribution> = {
    http_referer: "https://movinesta.app",
    x_title: "MoviNesta Assistant",
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

  const input = opts.input ?? (opts.messages ? buildInputFromMessages(opts.messages) : undefined);
  if (!input) {
    throw new Error("Missing input/messages for OpenRouter responses");
  }

  const basePayload: Record<string, unknown> = {
    model: opts.model,
    input,
    ...(opts.instructions ? { instructions: opts.instructions } : {}),
    ...(typeof opts.temperature === "number" ? { temperature: opts.temperature } : {}),
    ...(typeof opts.top_p === "number" ? { top_p: opts.top_p } : {}),
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
    ...(opts.provider ? { provider: opts.provider } : {}),
  };

  const variants: Array<{ tag: string; payload: Record<string, unknown> }> = [];
  variants.push({ tag: "base", payload: basePayload });

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

  variants.push({
    tag: "bare",
    payload: {
      ...basePayload,
      plugins: undefined,
      response_format: undefined,
      tools: undefined,
      tool_choice: undefined,
      parallel_tool_calls: undefined,
    },
  });

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
    variants,
    baseUrl,
  } = buildOpenRouterVariants(opts);

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
      usedVariant = v.tag;
      break;
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
          upstreamRequestId: (e as any)?.upstreamRequestId ?? null,
        };
      } catch {
        // ignore
      }
      // Only retry simplifications for 400 (invalid request).
      if (e?.status !== 400) {
        break;
      }
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
    variants,
    baseUrl,
  } = buildOpenRouterVariants({ ...opts, stream: true });

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
      usedVariant = v.tag;
      break;
    } catch (e: any) {
      lastErr = e;
      try {
        (lastErr as any).openrouter = {
          ...(typeof (lastErr as any).openrouter === "object" ? (lastErr as any).openrouter : {}),
          variant: v.tag,
          model: opts.model,
          base_url: baseUrl,
          timeout_ms: timeoutMs,
          upstreamRequestId: (e as any)?.upstreamRequestId ?? null,
        };
      } catch {
        // ignore
      }
      if (e?.status !== 400) {
        break;
      }
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


export interface OpenRouterChatWithFallbackOptions {
  models: string[]; // ordered
  input?: string | OpenRouterInputMessage[];
  messages?: OpenRouterMessage[];
  instructions?: string;
  attribution?: OpenRouterAttribution;
  max_output_tokens?: number;
  temperature?: number;
  top_p?: number;
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
  let lastErr: any = null;
  const tried: Array<{
    model: string;
    status: number | null;
    message: string;
    variant: string | null;
    upstreamRequestId: string | null;
  }> = [];
  for (const model of models) {
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
        return res;
      }
    } catch (e: any) {
      lastErr = e;
      const status = Number((e as any)?.status ?? 0);
      const msg = e instanceof Error ? e.message : String(e ?? "OpenRouter error");
      const variant = (e as any)?.openrouter?.variant ?? null;
      const upstreamRequestId =
        (e as any)?.upstreamRequestId ?? (e as any)?.openrouter?.upstreamRequestId ?? null;

      tried.push({
        model,
        status: Number.isFinite(status) && status > 0 ? status : null,
        message: msg.slice(0, 240),
        variant: typeof variant === "string" ? variant : null,
        upstreamRequestId: typeof upstreamRequestId === "string" ? upstreamRequestId : null,
      });

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
