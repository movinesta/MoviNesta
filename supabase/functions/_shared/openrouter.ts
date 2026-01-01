// supabase/functions/_shared/openrouter.ts
//
// Minimal OpenRouter client (OpenAI-compatible chat.completions).

import { getConfig } from "./config.ts";
import { fetchJsonWithTimeout } from "./fetch.ts";

export type OpenRouterMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export interface OpenRouterChatOptions {
  model: string;
  messages: OpenRouterMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  // OpenRouter supports provider routing, but we keep it simple for v0.
}

export type OpenRouterChatResult = {
  content: string;
  model?: string;
  usage?: unknown;
  raw?: unknown;
};

const getBaseUrl = () => {
  const { openrouterBaseUrl } = getConfig();
  return (openrouterBaseUrl ?? "https://openrouter.ai/api/v1").replace(/\/+$/, "");
};

export async function openrouterChat(opts: OpenRouterChatOptions): Promise<OpenRouterChatResult> {
  const { openrouterApiKey } = getConfig();
  if (!openrouterApiKey) {
    throw new Error("Missing OPENROUTER_API_KEY");
  }

  const url = `${getBaseUrl()}/chat/completions`;

  const payload = {
    model: opts.model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.7,
    top_p: opts.top_p ?? 1,
    max_tokens: opts.max_tokens ?? 500,
  };

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


export interface OpenRouterChatWithFallbackOptions {
  models: string[]; // ordered
  messages: OpenRouterMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
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
