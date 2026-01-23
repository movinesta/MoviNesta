// supabase/functions/_shared/openrouterCapabilities.ts
//
// OpenRouter model capability lookups + caching for catalog metadata.

import { getConfig } from "./config.ts";
import { fetchJsonWithTimeout } from "./fetch.ts";

export type OpenRouterCapability = "streaming" | "routing" | "multimodal" | "plugins";

export type OpenRouterCapabilityMap = Record<OpenRouterCapability, boolean>;

export type OpenRouterModelCapabilities = OpenRouterCapabilityMap & {
  model: string;
  base_url: string;
  source: "catalog" | "fallback";
};

export type OpenRouterCapabilitiesSummary = {
  combined: OpenRouterCapabilityMap;
  by_model: Record<string, OpenRouterModelCapabilities>;
  catalog_size: number;
};

type OpenRouterModelEntry = {
  id?: string;
  name?: string;
  supported_parameters?: string[];
  architecture?: {
    modality?: string | string[];
    input?: string | string[];
    output?: string | string[];
  };
  modalities?: string[];
  input_modalities?: string[];
  output_modalities?: string[];
  capabilities?: {
    streaming?: boolean;
    plugins?: boolean;
    multimodal?: boolean;
  };
};

type OpenRouterModelCatalogResponse = {
  data?: OpenRouterModelEntry[];
  models?: OpenRouterModelEntry[];
};

const DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 4_000;

const catalogCache = new Map<string, { atMs: number; models: OpenRouterModelEntry[] }>();
const capabilityCache = new Map<string, { atMs: number; capabilities: OpenRouterModelCapabilities }>();

function normalizeBaseUrl(baseUrl?: string) {
  const cfg = getConfig();
  const v = String(baseUrl ?? cfg.openrouterBaseUrl ?? DEFAULT_OPENROUTER_BASE_URL).trim();
  return (v || DEFAULT_OPENROUTER_BASE_URL).replace(/\/+$/, "");
}

function isOpenRouterBaseUrl(baseUrl: string): boolean {
  return /openrouter\.ai/i.test(baseUrl);
}

function extractModels(payload: OpenRouterModelCatalogResponse | null): OpenRouterModelEntry[] {
  if (!payload || typeof payload !== "object") return [];
  const data = Array.isArray(payload.data) ? payload.data : null;
  if (data?.length) return data;
  const models = Array.isArray(payload.models) ? payload.models : null;
  if (models?.length) return models;
  return [];
}

function toModalities(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v));
  if (typeof value === "string") {
    return value
      .split(/[,\s]+/)
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

function detectMultimodal(entry: OpenRouterModelEntry | null): boolean {
  if (!entry) return false;
  if (entry.capabilities?.multimodal === true) return true;
  const modals = new Set<string>([
    ...toModalities(entry.architecture?.modality),
    ...toModalities(entry.architecture?.input),
    ...toModalities(entry.architecture?.output),
    ...toModalities(entry.modalities),
    ...toModalities(entry.input_modalities),
    ...toModalities(entry.output_modalities),
  ].map((v) => v.toLowerCase()));
  return modals.has("image") || modals.has("vision") || modals.has("audio") || modals.has("multimodal");
}

function supportsParam(entry: OpenRouterModelEntry | null, param: string): boolean | null {
  const params = Array.isArray(entry?.supported_parameters) ? entry?.supported_parameters ?? [] : [];
  if (!params.length) return null;
  return params.map((p) => p.toLowerCase()).includes(param.toLowerCase());
}

function inferModelCapabilities(model: string, baseUrl: string, entry: OpenRouterModelEntry | null): OpenRouterModelCapabilities {
  const supportsStreaming = entry?.capabilities?.streaming ?? supportsParam(entry, "stream") ?? true;
  const supportsPlugins = isOpenRouterBaseUrl(baseUrl) ? true : (entry?.capabilities?.plugins ?? supportsParam(entry, "plugins") ?? false);
  const supportsMultimodal = detectMultimodal(entry);
  const supportsRouting = isOpenRouterBaseUrl(baseUrl) && /^openrouter\/auto/.test(model);

  return {
    model,
    base_url: baseUrl,
    streaming: Boolean(supportsStreaming),
    routing: Boolean(supportsRouting),
    multimodal: Boolean(supportsMultimodal),
    plugins: Boolean(supportsPlugins),
    source: entry ? "catalog" : "fallback",
  };
}

export async function getOpenRouterModelCatalog(opts?: {
  base_url?: string;
  cacheTtlMs?: number;
  timeoutMs?: number;
}): Promise<OpenRouterModelEntry[]> {
  const baseUrl = normalizeBaseUrl(opts?.base_url);
  const cacheTtlMs = opts?.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const cached = catalogCache.get(baseUrl);
  if (cached && Date.now() - cached.atMs <= cacheTtlMs) return cached.models;
  const cfg = getConfig();
  const openrouterApiKey = cfg.openrouterApiKey;
  const referer =
    String(cfg.openrouterHttpReferer ?? "https://movinesta.github.io/MoviNesta/").trim() ||
    "https://movinesta.github.io/MoviNesta/";
  const titleBase = String(cfg.openrouterXTitle ?? "MoviNesta").trim() || "MoviNesta";
  try {
    const payload = (await fetchJsonWithTimeout(
      `${baseUrl}/models`,
      {
        method: "GET",
        headers: {
          ...(openrouterApiKey ? { Authorization: `Bearer ${openrouterApiKey}` } : {}),
          "HTTP-Referer": referer,
          "X-Title": titleBase,
        },
      },
      timeoutMs,
    )) as OpenRouterModelCatalogResponse;
    const models = extractModels(payload).filter((m) => m && typeof m.id === "string");
    catalogCache.set(baseUrl, { atMs: Date.now(), models });
    return models;
  } catch {
    if (cached) return cached.models;
    return [];
  }
}

export async function getOpenRouterCapabilities(opts: {
  models: string[];
  base_url?: string;
  cacheTtlMs?: number;
  timeoutMs?: number;
}): Promise<OpenRouterCapabilitiesSummary> {
  const baseUrl = normalizeBaseUrl(opts.base_url);
  const cacheTtlMs = opts.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;

  const catalog = await getOpenRouterModelCatalog({
    base_url: baseUrl,
    cacheTtlMs,
    timeoutMs: opts.timeoutMs,
  });

  const modelMap = new Map<string, OpenRouterModelEntry>();
  for (const entry of catalog) {
    if (entry?.id) modelMap.set(String(entry.id), entry);
  }

  const now = Date.now();
  const byModel: Record<string, OpenRouterModelCapabilities> = {};

  for (const model of opts.models ?? []) {
    const trimmed = String(model ?? "").trim();
    if (!trimmed) continue;
    const cacheKey = `${baseUrl}::${trimmed}`;
    const cached = capabilityCache.get(cacheKey);
    if (cached && now - cached.atMs <= cacheTtlMs) {
      byModel[trimmed] = cached.capabilities;
      continue;
    }
    const entry = modelMap.get(trimmed) ?? null;
    const capabilities = inferModelCapabilities(trimmed, baseUrl, entry);
    capabilityCache.set(cacheKey, { atMs: now, capabilities });
    byModel[trimmed] = capabilities;
  }

  const combined: OpenRouterCapabilityMap = {
    streaming: true,
    routing: true,
    multimodal: true,
    plugins: true,
  };

  const modelValues = Object.values(byModel);
  if (!modelValues.length) {
    combined.streaming = false;
    combined.routing = false;
    combined.multimodal = false;
    combined.plugins = false;
  } else {
    for (const caps of modelValues) {
      combined.streaming = combined.streaming && caps.streaming;
      combined.routing = combined.routing && caps.routing;
      combined.multimodal = combined.multimodal && caps.multimodal;
      combined.plugins = combined.plugins && caps.plugins;
    }
  }

  return {
    combined,
    by_model: byModel,
    catalog_size: catalog.length,
  };
}
