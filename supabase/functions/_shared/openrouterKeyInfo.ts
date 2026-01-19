// supabase/functions/_shared/openrouterKeyInfo.ts
//
// Helpers for OpenRouter API key info (credits/limits).
// Docs: GET https://openrouter.ai/api/v1/key returns { data: { limit_remaining, ... } }.

import { fetchJsonWithTimeout } from "./fetch.ts";
import { getOpenRouterAttributionHeaders, normalizeSafeOpenRouterBaseUrl } from "./openrouterGeneration.ts";

export type OpenRouterKeyData = {
  label?: string;
  limit?: number | null;
  limit_reset?: string | null;
  limit_remaining?: number | null;
  include_byok_in_limit?: boolean;
  usage?: number;
  usage_daily?: number;
  usage_weekly?: number;
  usage_monthly?: number;
  byok_usage?: number;
  byok_usage_daily?: number;
  byok_usage_weekly?: number;
  byok_usage_monthly?: number;
  is_free_tier?: boolean;
  // Preserve forward-compat fields.
  [k: string]: unknown;
};

function extractKeyData(payload: unknown): OpenRouterKeyData | null {
  if (!payload || typeof payload !== "object") return null;
  const data = (payload as any).data;
  if (!data || typeof data !== "object") return null;
  return data as OpenRouterKeyData;
}

export async function fetchOpenRouterKeyInfo(args: {
  baseUrl?: unknown;
  apiKey: string;
  timeoutMs?: number;
}): Promise<OpenRouterKeyData | null> {
  const apiKey = String(args.apiKey ?? "").trim();
  if (!apiKey) return null;

  const baseUrl = normalizeSafeOpenRouterBaseUrl(args.baseUrl);
  const timeoutMs = Number.isFinite(args.timeoutMs)
    ? Math.max(250, Math.min(15_000, Number(args.timeoutMs)))
    : 1500;

  const url = `${baseUrl}/key`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    Accept: "application/json",
    ...getOpenRouterAttributionHeaders(),
  };

  try {
    const payload = await fetchJsonWithTimeout(url, { method: "GET", headers }, timeoutMs);
    return extractKeyData(payload);
  } catch {
    return null;
  }
}
