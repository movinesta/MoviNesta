import { getConfig } from "./config.ts";

const DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

type OpenRouterCacheTable =
  | "openrouter_models_cache"
  | "openrouter_credits_cache"
  | "openrouter_usage_cache"
  | "openrouter_endpoints_cache";

export function normalizeOpenRouterBaseUrl(value?: string | null): string {
  const raw = String(value ?? "").trim();
  const fallback = raw || getConfig().openrouterBaseUrl || DEFAULT_OPENROUTER_BASE_URL;
  return String(fallback).trim().replace(/\/+$/, "");
}

export async function resolveOpenRouterBaseUrl(svc: any, override?: string | null): Promise<string> {
  const overrideTrimmed = String(override ?? "").trim();
  if (overrideTrimmed) return normalizeOpenRouterBaseUrl(overrideTrimmed);

  try {
    const { data } = await svc
      .from("assistant_settings")
      .select("openrouter_base_url")
      .eq("id", 1)
      .maybeSingle();
    const stored = (data as { openrouter_base_url?: string | null } | null)?.openrouter_base_url ?? null;
    if (stored && String(stored).trim()) return normalizeOpenRouterBaseUrl(stored);
  } catch {
    // ignore and fall back to config/default
  }

  return normalizeOpenRouterBaseUrl(undefined);
}

export async function readOpenRouterCache(
  svc: any,
  table: OpenRouterCacheTable,
  baseUrl: string,
): Promise<{ base_url: string; fetched_at: string; payload: unknown } | null> {
  const { data, error } = await svc
    .from(table)
    .select("base_url,fetched_at,payload")
    .eq("base_url", baseUrl)
    .maybeSingle();

  if (error || !data) return null;
  return data as { base_url: string; fetched_at: string; payload: unknown };
}

export async function writeOpenRouterCache(
  svc: any,
  table: OpenRouterCacheTable,
  baseUrl: string,
  payload: unknown,
  fetchedAt?: string,
): Promise<void> {
  await svc
    .from(table)
    .upsert(
      {
        base_url: baseUrl,
        fetched_at: fetchedAt ?? new Date().toISOString(),
        payload: payload ?? {},
      },
      { onConflict: "base_url" },
    );
}
