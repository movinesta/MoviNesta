// supabase/functions/_shared/openrouter.ts
//
// Minimal OpenRouter client (OpenAI-compatible responses API).

import { getConfig } from "./config.ts";
import { fetchJsonWithTimeout } from "./fetch.ts";

export type OpenRouterMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type OpenRouterInputMessage = {
  role: "system" | "user" | "assistant";
  content: string | Array<{ type: "input_text"; text: string }>;
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
  // OpenRouter supports provider routing, but we keep it simple for v0.
  base_url?: string;
}

export type OpenRouterChatResult = {
  content: string;
  model?: string;
  usage?: unknown;
  raw?: unknown;
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
};

export async function openrouterChat(opts: OpenRouterChatOptions): Promise<OpenRouterChatResult> {
  const { openrouterApiKey } = getConfig();
  if (!openrouterApiKey) {
    throw new Error("Missing OPENROUTER_API_KEY");
  }

  const url = `${getBaseUrl(opts.base_url)}/responses`;
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
  };

  // OpenRouter/provider validation can reject some Responses fields (e.g., plugins/structured outputs/tools)
  // depending on the selected model. To avoid hard failures, we retry a small set of progressively simpler
  // payload variants on 400 errors.
  const variants: Array<Record<string, unknown>> = [];
  variants.push(basePayload);

  // If structured outputs are requested, try degrading to json_object.
  const rf = opts.response_format as any;
  if (rf?.type === "json_schema") {
    variants.push({ ...basePayload, response_format: { type: "json_object" } });
  }

  // Try dropping plugins (e.g. response-healing) if rejected.
  if (opts.plugins?.length) {
    variants.push({ ...basePayload, plugins: undefined });
    if (rf?.type === "json_schema") {
      variants.push({ ...basePayload, plugins: undefined, response_format: { type: "json_object" } });
    }
  }

  // Try dropping tools/tool_choice if rejected.
  if (opts.tools?.length || opts.tool_choice || typeof opts.parallel_tool_calls === "boolean") {
    variants.push({ ...basePayload, tools: undefined, tool_choice: undefined, parallel_tool_calls: undefined });
  }

  // Last resort: remove response_format + plugins + tools.
  variants.push({
    ...basePayload,
    plugins: undefined,
    response_format: undefined,
    tools: undefined,
    tool_choice: undefined,
    parallel_tool_calls: undefined,
  });

  let lastErr: any = null;
  let data: any = null;
  for (const payload of variants) {
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
          body: JSON.stringify(payload),
        },
        timeoutMs,
      )) as any;
      break;
    } catch (e: any) {
      lastErr = e;
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
      const err: any = new Error(msg);
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
  };
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
      // continue
    }
  }
  throw lastErr ?? new Error("All models failed");
}
