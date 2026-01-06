// supabase/functions/_shared/openrouter.ts
//
// Minimal OpenRouter client (OpenAI-compatible chat.completions).

import { getConfig } from "./config.ts";
import { fetchJsonWithTimeout } from "./fetch.ts";

export type OpenRouterMessage = {
  role: "system" | "user" | "assistant";
  content: string;
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

export interface OpenRouterChatOptions {
  model: string;
  messages: OpenRouterMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  response_format?: OpenRouterResponseFormat;
  plugins?: OpenRouterPlugin[];
  // OpenRouter usage accounting.
  usage?: { include: boolean };
  stream?: boolean;
  stream_options?: { include_usage?: boolean };
  // OpenRouter supports provider routing, but we keep it simple for v0.
}

export type OpenRouterChatResult = {
  content: string;
  model?: string;
  usage?: unknown;
  raw?: unknown;
};

// OpenRouter/providers often enforce a hard completion-token limit (especially for free tiers).
// Clamp `max_tokens` below that limit to avoid upstream truncation.
const MAX_COMPLETION_TOKENS_CAP = (() => {
  const raw = (globalThis as any)?.Deno?.env?.get?.("OPENROUTER_MAX_COMPLETION_TOKENS") ?? "495";
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 495;
})();

function clampMaxTokens(v?: number): number {
  const n = Number.isFinite(Number(v)) ? Math.floor(Number(v)) : MAX_COMPLETION_TOKENS_CAP;
  return Math.max(1, Math.min(n, MAX_COMPLETION_TOKENS_CAP));
}

const getBaseUrl = () => {
  const { openrouterBaseUrl } = getConfig();
  return (openrouterBaseUrl ?? "https://openrouter.ai/api/v1").replace(/\/+$/, "");
};

const STREAM_TIMEOUT_MS = 30_000;

async function readStreamedOpenRouterResponse(
  res: Response,
  opts: { timeoutMs: number },
): Promise<OpenRouterChatResult> {
  if (!res.ok) {
    const text = await res.text();
    let data: unknown = text;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    const err: any = new Error(`upstream_error_${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error("OpenRouter stream unavailable");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let model: string | undefined;
  let usage: unknown;
  let lastEvent: any = null;

  const timeoutId = setTimeout(() => {
    try {
      reader.cancel();
    } catch {
      // ignore
    }
  }, opts.timeoutMs);

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      while (true) {
        const boundary = buffer.indexOf("\n\n");
        if (boundary === -1) break;
        const rawEvent = buffer.slice(0, boundary).trim();
        buffer = buffer.slice(boundary + 2);
        if (!rawEvent) continue;

        const lines = rawEvent.split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload) continue;
          if (payload === "[DONE]") {
            return {
              content,
              model,
              usage,
              raw: lastEvent ?? null,
            };
          }
          try {
            const data = JSON.parse(payload);
            lastEvent = data;
            model = typeof data?.model === "string" ? data.model : model;
            usage = data?.usage ?? usage;
            const delta =
              data?.choices?.[0]?.delta?.content ??
              data?.choices?.[0]?.delta?.text ??
              data?.choices?.[0]?.text ??
              "";
            if (typeof delta === "string" && delta) {
              content += delta;
            }
          } catch {
            // ignore malformed SSE data chunk
          }
        }
      }
    }
  } finally {
    clearTimeout(timeoutId);
  }

  return {
    content,
    model,
    usage,
    raw: lastEvent ?? null,
  };
}

async function fetchOpenRouterChat(
  url: string,
  payload: Record<string, unknown>,
  opts: { stream: boolean },
): Promise<OpenRouterChatResult> {
  const { openrouterApiKey } = getConfig();
  if (!openrouterApiKey) {
    throw new Error("Missing OPENROUTER_API_KEY");
  }

  if (!opts.stream) {
    const data = (await fetchJsonWithTimeout(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openrouterApiKey}`,
          // Optional, but recommended by OpenRouter to attribute traffic.
          "HTTP-Referer": "https://movinesta.app",
          "X-Title": "MoviNesta Assistant",
        },
        body: JSON.stringify(payload),
      },
      12_000,
    )) as any;

    const content =
      data?.choices?.[0]?.message?.content ??
      data?.choices?.[0]?.text ??
      "";

    return {
      content: typeof content === "string" ? content : JSON.stringify(content),
      model: data?.model,
      usage: data?.usage,
      raw: data,
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort("timeout"), STREAM_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openrouterApiKey}`,
        "HTTP-Referer": "https://movinesta.app",
        "X-Title": "MoviNesta Assistant",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    return await readStreamedOpenRouterResponse(res, { timeoutMs: STREAM_TIMEOUT_MS });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function openrouterChat(opts: OpenRouterChatOptions): Promise<OpenRouterChatResult> {
  const { openrouterApiKey } = getConfig();
  if (!openrouterApiKey) {
    throw new Error("Missing OPENROUTER_API_KEY");
  }

  const url = `${getBaseUrl()}/chat/completions`;

  const basePayload: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.1,
    top_p: opts.top_p ?? 1,
    // Clamp to avoid provider caps causing truncation.
    max_tokens: clampMaxTokens(opts.max_tokens),
    // Enable usage accounting by default (adds a small overhead but is invaluable for cost tracking).
    usage: opts.usage ?? { include: true },
    ...(opts.response_format ? { response_format: opts.response_format } : {}),
    ...(opts.plugins ? { plugins: opts.plugins } : {}),
    ...(opts.stream
      ? {
          stream: true,
          stream_options: {
            include_usage: opts.stream_options?.include_usage ?? opts.usage?.include ?? true,
          },
        }
      : {}),
  };

  // OpenRouter/provider validation can reject some OpenAI-compatible fields (e.g., plugins/structured outputs)
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

  // Last resort: remove response_format + plugins.
  variants.push({ ...basePayload, plugins: undefined, response_format: undefined });

  let lastErr: any = null;
  let data: any = null;
  for (const payload of variants) {
    try {
      data = await fetchOpenRouterChat(url, payload, { stream: Boolean(opts.stream) });
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

  return data as OpenRouterChatResult;
}


export interface OpenRouterChatWithFallbackOptions {
  models: string[]; // ordered
  messages: OpenRouterMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  response_format?: OpenRouterResponseFormat;
  plugins?: OpenRouterPlugin[];
  usage?: { include: boolean };
  stream?: boolean;
  stream_options?: { include_usage?: boolean };
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
      const res = await openrouterChat({
        model,
        messages: opts.messages,
        max_tokens: opts.max_tokens,
        temperature: opts.temperature,
        top_p: opts.top_p,
        response_format: opts.response_format,
        plugins: opts.plugins,
        usage: opts.usage,
        stream: opts.stream,
        stream_options: opts.stream_options,
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
