// supabase/functions/_shared/openrouterGeneration.ts
//
// Helpers for OpenRouter "generation" introspection.
//
// This is used to enrich request logs with the final generation stats
// (provider, native tokens, cost, latency, etc.).

import { getConfig } from "./config.ts";
import { fetchJsonWithTimeout } from "./fetch.ts";
import { sanitizeOpenRouterBaseUrl } from "./openrouterCache.ts";

export type GenerationStats = Record<string, unknown>;

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterMs(retryAfter: unknown): number | null {
  const raw = typeof retryAfter === "string" ? retryAfter.trim() : "";
  if (!raw) return null;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(10_000, Math.round(seconds * 1000));
  const dt = Date.parse(raw);
  if (Number.isFinite(dt)) {
    const ms = dt - Date.now();
    if (ms > 0) return Math.min(10_000, ms);
  }
  return null;
}

export function getOpenRouterAttributionHeaders(): Record<string, string> {
  const cfg = getConfig();
  const referer = String(cfg.openrouterHttpReferer ?? "https://movinesta.app/").trim() || "https://movinesta.app/";
  const title = String(cfg.openrouterXTitle ?? "MoviNesta").trim() || "MoviNesta";
  return {
    "HTTP-Referer": referer,
    "X-Title": title,
  };
}

export function normalizeSafeOpenRouterBaseUrl(value?: unknown): string {
  const cfg = getConfig();
  const raw = String(value ?? "").trim();
  const candidate = raw || String(cfg.openrouterBaseUrl ?? "").trim() || DEFAULT_BASE_URL;
  try {
    // Ensures https and canonical /api/v1 (and whitelists openrouter.ai host).
    return sanitizeOpenRouterBaseUrl(candidate);
  } catch {
    return DEFAULT_BASE_URL;
  }
}

function extractGenerationData(payload: unknown): GenerationStats | null {
  if (!payload || typeof payload !== "object") return null;
  const data = (payload as any).data;
  if (data && typeof data === "object") return data as GenerationStats;
  return payload as GenerationStats;
}

/**
 * Fetch generation stats from OpenRouter.
 *
 * Retries a small number of times on transient errors (429/5xx).
 */
export async function fetchOpenRouterGenerationStats(args: {
  baseUrl?: unknown;
  apiKey: string;
  generationId: string;
  timeoutMs?: number;
  maxRetries?: number;
}): Promise<GenerationStats | null> {
  const apiKey = String(args.apiKey ?? "").trim();
  const id = String(args.generationId ?? "").trim();
  if (!apiKey || !id) return null;

  const baseUrl = normalizeSafeOpenRouterBaseUrl(args.baseUrl);
  const timeoutMs = Number.isFinite(args.timeoutMs) ? Math.max(250, Math.min(15_000, Number(args.timeoutMs))) : 1500;
  const maxRetries = Number.isFinite(args.maxRetries) ? Math.max(0, Math.min(3, Number(args.maxRetries))) : 2;

  const url = `${baseUrl}/generation?id=${encodeURIComponent(id)}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    Accept: "application/json",
    ...getOpenRouterAttributionHeaders(),
  };

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const payload = await fetchJsonWithTimeout(url, { method: "GET", headers }, timeoutMs);
      return extractGenerationData(payload);
    } catch (e: any) {
      const status = Number(e?.status ?? NaN);
      const transient = status === 429 || status === 502 || status === 503 || status === 504;
      if (!transient || attempt >= maxRetries) return null;

      const ra = parseRetryAfterMs(e?.retryAfter);
      const backoff = ra ?? Math.min(2000, 250 * Math.pow(2, attempt));
      await sleep(backoff);
    }
  }

  return null;
}
