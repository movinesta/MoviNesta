import { readOpenRouterCache, resolveOpenRouterBaseUrl } from "./openrouterCache.ts";

type OpenRouterCacheTable =
  | "openrouter_models_cache"
  | "openrouter_credits_cache"
  | "openrouter_usage_cache"
  | "openrouter_endpoints_cache"
  | "openrouter_key_cache";

export async function loadOpenRouterCache(
  svc: any,
  table: OpenRouterCacheTable,
  baseUrlOverride?: string | null,
): Promise<{
  base_url: string;
  fetched_at: string | null;
  age_seconds: number | null;
  payload: unknown | null;
}> {
  const baseUrl = await resolveOpenRouterBaseUrl(svc, baseUrlOverride);
  const row = await readOpenRouterCache(svc, table, baseUrl);
  if (!row?.fetched_at) {
    return { base_url: baseUrl, fetched_at: null, age_seconds: null, payload: null };
  }

  const fetchedAtMs = Date.parse(row.fetched_at);
  const ageSeconds = Number.isFinite(fetchedAtMs)
    ? Math.max(0, Math.floor((Date.now() - fetchedAtMs) / 1000))
    : null;

  return {
    base_url: baseUrl,
    fetched_at: row.fetched_at,
    age_seconds: ageSeconds,
    payload: row.payload ?? null,
  };
}


export async function loadOpenRouterParametersCache(
  svc: any,
  modelId: string,
  provider: string | null,
  baseUrlOverride?: string | null,
): Promise<{
  base_url: string;
  model_id: string;
  provider: string | null;
  fetched_at: string | null;
  age_seconds: number | null;
  payload: unknown;
}> {
  const baseUrl = await resolveOpenRouterBaseUrl(svc, baseUrlOverride);

  const { data, error } = await svc
    .from("openrouter_parameters_cache")
    .select("base_url,model_id,provider,fetched_at,payload")
    .eq("base_url", baseUrl)
    .eq("model_id", modelId)
    .eq("provider", provider ?? "")
    .maybeSingle();

  if (error) throw error;

  const row = (data as any) ?? null;
  if (!row) {
    return {
      base_url: baseUrl,
      model_id: modelId,
      provider: provider ?? null,
      fetched_at: null,
      age_seconds: null,
      payload: null,
    };
  }

  const fetchedAtMs = Date.parse(row.fetched_at);
  const ageSeconds = Number.isFinite(fetchedAtMs)
    ? Math.max(0, Math.floor((Date.now() - fetchedAtMs) / 1000))
    : null;

  return {
    base_url: baseUrl,
    model_id: row.model_id,
    provider: (row.provider ? row.provider : null),
    fetched_at: row.fetched_at,
    age_seconds: ageSeconds,
    payload: row.payload ?? null,
  };
}
