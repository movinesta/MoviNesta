import {
  OpenRouterCacheCategory,
  readOpenRouterCache,
  readOpenRouterParametersCache,
  resolveOpenRouterBaseUrl
} from "./openrouterCache.ts";

export async function loadOpenRouterCache(
  svc: any,
  category: OpenRouterCacheCategory,
  baseUrlOverride?: string | null,
): Promise<{
  base_url: string;
  fetched_at: string | null;
  age_seconds: number | null;
  payload: unknown | null;
}> {
  const baseUrl = await resolveOpenRouterBaseUrl(svc, baseUrlOverride);
  const row = await readOpenRouterCache(svc, category, baseUrl);
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
  const row = await readOpenRouterParametersCache(svc, baseUrl, modelId, provider);

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

