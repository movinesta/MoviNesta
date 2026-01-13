import { getConfig } from "./config.ts";

const DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

type OpenRouterCacheTable =
  | "openrouter_models_cache"
  | "openrouter_credits_cache"
  | "openrouter_usage_cache"
  | "openrouter_endpoints_cache"
  | "openrouter_key_cache";

export function normalizeOpenRouterBaseUrl(value?: string | null): string {
  const raw = String(value ?? "").trim();
  const fallback = raw || getConfig().openrouterBaseUrl || DEFAULT_OPENROUTER_BASE_URL;
  return String(fallback).trim().replace(/\/+$/, "");
}

export function sanitizeOpenRouterBaseUrl(value?: string | null): string {
  const raw = String(value ?? "").trim();
  if (!raw) throw new Error("Missing OpenRouter base_url");
  const normalized = raw.replace(/\/+$/, "");
  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    throw new Error(`Invalid OpenRouter base_url: ${raw}`);
  }

  if (url.protocol !== "https:") {
    throw new Error("OpenRouter base_url must use https");
  }

  const host = url.hostname.toLowerCase();
  if (!(host === "openrouter.ai" || host.endsWith(".openrouter.ai"))) {
    throw new Error(`OpenRouter base_url host not allowed: ${host}`);
  }

  const path = url.pathname.replace(/\/+$/, "");
  const finalPath = path === "" || path === "/" ? "/api/v1" : path;
  if (finalPath !== "/api/v1") {
    throw new Error(`OpenRouter base_url path must be /api/v1 (got: ${url.pathname})`);
  }

  return `${url.origin}/api/v1`;
}


export async function resolveOpenRouterBaseUrl(svc: any, override?: string | null): Promise<string> {
  const overrideTrimmed = String(override ?? "").trim();
  if (overrideTrimmed) {
    // Strictly validate overrides to avoid accidental key exfiltration to untrusted hosts.
    return sanitizeOpenRouterBaseUrl(overrideTrimmed);
  }

  // Prefer DB-configured base URL when present (admin-controlled).
  try {
    const { data } = await svc
      .from("assistant_settings")
      .select("openrouter_base_url")
      .eq("id", 1)
      .maybeSingle();

    const stored = (data as { openrouter_base_url?: string | null } | null)?.openrouter_base_url ?? null;
    if (stored && String(stored).trim()) {
      try {
        return sanitizeOpenRouterBaseUrl(stored);
      } catch {
        // ignore invalid DB value and fall back
      }
    }
  } catch {
    // ignore and fall back to config/default
  }

  // Fallback chain: env-configured base url, then project default.
  const candidate = normalizeOpenRouterBaseUrl(undefined);
  try {
    return sanitizeOpenRouterBaseUrl(candidate);
  } catch {
    return DEFAULT_OPENROUTER_BASE_URL;
  }
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


// Parameters cache is keyed by (base_url, model_id, provider) because supported parameters
// can differ by provider endpoint.
export type OpenRouterParametersCacheRow = {
  base_url: string;
  model_id: string;
  provider: string;
  fetched_at: string;
  payload: unknown;
};

export async function writeOpenRouterParametersCache(
  svc: any,
  baseUrl: string,
  modelId: string,
  provider: string | null,
  payload: unknown,
  fetchedAt?: string,
): Promise<void> {
  await svc
    .from("openrouter_parameters_cache")
    .upsert(
      {
        base_url: baseUrl,
        model_id: modelId,
        provider: provider ?? "",
        fetched_at: fetchedAt ?? new Date().toISOString(),
        payload: payload ?? {},
      },
      { onConflict: "base_url,model_id,provider" },
    );
}

export async function readOpenRouterParametersCache(
  svc: any,
  baseUrl: string,
  modelId: string,
  provider: string | null,
): Promise<OpenRouterParametersCacheRow | null> {
  const { data, error } = await svc
    .from("openrouter_parameters_cache")
    .select("base_url,model_id,provider,fetched_at,payload")
    .eq("base_url", baseUrl)
    .eq("model_id", modelId)
    .eq("provider", provider ?? "")
    .maybeSingle();

  if (error || !data) return null;
  return data as OpenRouterParametersCacheRow;
}
