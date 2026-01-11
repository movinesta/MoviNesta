import { normalizeOpenRouterBaseUrl, readOpenRouterCache, resolveOpenRouterBaseUrl } from "./openrouterCache.ts";

type OpenRouterEndpoint = Record<string, unknown>;

export type ZdrEndpointSummary = {
  base_url: string;
  id?: string | null;
  name?: string | null;
  description?: string | null;
  privacy?: string | null;
  tags?: string[];
};

export type OpenRouterZdrDiscovery = {
  base_url: string;
  fetched_at: string | null;
  age_seconds: number | null;
  payload: unknown | null;
  endpoints_count: number;
  zdr_endpoints: ZdrEndpointSummary[];
};

export type ZdrRoutingMeta = {
  enabled: boolean;
  requested: boolean;
  sensitive: boolean;
  mode: "sensitive_only" | "all";
  allow_fallback: boolean;
  used: boolean;
  source: "override" | "discovery" | "fallback" | "disabled";
  base_url: string;
  candidate_count: number;
  reason?: string | null;
};

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

const discoveryCache = new Map<string, { atMs: number; data: OpenRouterZdrDiscovery }>();

function asString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function normalizeBaseUrl(value?: string | null): string | null {
  const trimmed = asString(value);
  if (!trimmed) return null;
  return normalizeOpenRouterBaseUrl(trimmed);
}

function coerceStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v)).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(/[\s,]+/)
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

function findFirstArray(payload: any, keys: string[]): any[] | null {
  for (const key of keys) {
    const val = payload?.[key];
    if (Array.isArray(val)) return val;
    if (val && typeof val === "object" && Array.isArray(val.data)) return val.data;
  }
  return null;
}

export function extractOpenRouterEndpoints(payload: unknown): OpenRouterEndpoint[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as OpenRouterEndpoint[];
  if (typeof payload !== "object") return [];

  const data = payload as any;
  const candidates = findFirstArray(data, ["data", "endpoints", "items", "providers", "entries"]);
  if (candidates) return candidates as OpenRouterEndpoint[];

  if (data?.endpoints && typeof data.endpoints === "object") {
    const nested = findFirstArray(data.endpoints, ["data", "endpoints", "items"]);
    if (nested) return nested as OpenRouterEndpoint[];
  }

  return [];
}

function pickEndpointBaseUrl(endpoint: OpenRouterEndpoint): string | null {
  const keys = [
    "base_url",
    "baseUrl",
    "url",
    "endpoint",
    "api_base",
    "api_base_url",
    "apiBase",
    "openai_base_url",
    "openaiBaseUrl",
  ];
  for (const k of keys) {
    const v = normalizeBaseUrl((endpoint as any)?.[k]);
    if (v) return v;
  }
  const nested = (endpoint as any)?.urls ?? (endpoint as any)?.links ?? null;
  if (nested && typeof nested === "object") {
    for (const k of ["base", "api", "openai"]) {
      const v = normalizeBaseUrl((nested as any)?.[k]);
      if (v) return v;
    }
  }
  return null;
}

function endpointMatchesZdr(endpoint: OpenRouterEndpoint): boolean {
  const boolKeys = ["zdr", "zero_data_retention", "zeroDataRetention", "no_data_retention", "zdr_enabled"];
  for (const key of boolKeys) {
    if ((endpoint as any)?.[key] === true) return true;
  }

  const privacy =
    asString((endpoint as any)?.privacy) ??
    asString((endpoint as any)?.privacy_policy) ??
    asString((endpoint as any)?.data_retention) ??
    asString((endpoint as any)?.policy) ??
    null;
  if (privacy && /(zdr|zero\s*data\s*retention|no\s*data\s*retention)/i.test(privacy)) return true;

  const privacyObj = (endpoint as any)?.privacy ?? (endpoint as any)?.privacy_policy ?? null;
  if (privacyObj && typeof privacyObj === "object") {
    const retention = asString((privacyObj as any)?.data_retention ?? (privacyObj as any)?.retention ?? null);
    if (retention && /(none|no|zero)/i.test(retention)) return true;
  }

  const name = asString((endpoint as any)?.name ?? (endpoint as any)?.id ?? (endpoint as any)?.provider ?? null);
  if (name && /zdr|zero\s*data\s*retention/i.test(name)) return true;

  const tags = coerceStringArray((endpoint as any)?.tags ?? (endpoint as any)?.labels ?? null).map((t) => t.toLowerCase());
  if (tags.some((t) => t.includes("zdr") || t.includes("zero-data"))) return true;

  return false;
}

export function summarizeZdrEndpoints(payload: unknown): ZdrEndpointSummary[] {
  const endpoints = extractOpenRouterEndpoints(payload);
  const summaries: ZdrEndpointSummary[] = [];
  const seen = new Set<string>();

  for (const endpoint of endpoints) {
    if (!endpointMatchesZdr(endpoint)) continue;
    const baseUrl = pickEndpointBaseUrl(endpoint);
    if (!baseUrl || seen.has(baseUrl)) continue;
    seen.add(baseUrl);

    summaries.push({
      base_url: baseUrl,
      id: asString((endpoint as any)?.id),
      name: asString((endpoint as any)?.name),
      description: asString((endpoint as any)?.description),
      privacy: asString((endpoint as any)?.privacy) ?? asString((endpoint as any)?.privacy_policy),
      tags: coerceStringArray((endpoint as any)?.tags ?? (endpoint as any)?.labels ?? null),
    });
  }

  return summaries;
}

function computeAgeSeconds(fetchedAt: string | null): number | null {
  if (!fetchedAt) return null;
  const ms = Date.parse(fetchedAt);
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.floor((Date.now() - ms) / 1000));
}

export async function loadOpenRouterZdrDiscovery(
  svc: any,
  baseUrlOverride?: string | null,
  opts?: { cacheTtlMs?: number },
): Promise<OpenRouterZdrDiscovery> {
  const baseUrl = await resolveOpenRouterBaseUrl(svc, baseUrlOverride);
  const cacheTtlMs = opts?.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  const cached = discoveryCache.get(baseUrl);
  if (cached && Date.now() - cached.atMs <= cacheTtlMs) return cached.data;

  const row = await readOpenRouterCache(svc, "openrouter_endpoints_cache", baseUrl);
  const fetchedAt = row?.fetched_at ?? null;
  const payload = row?.payload ?? null;
  const endpoints = extractOpenRouterEndpoints(payload);
  const zdrEndpoints = summarizeZdrEndpoints(payload);

  const data: OpenRouterZdrDiscovery = {
    base_url: baseUrl,
    fetched_at: fetchedAt,
    age_seconds: computeAgeSeconds(fetchedAt),
    payload,
    endpoints_count: endpoints.length,
    zdr_endpoints: zdrEndpoints,
  };

  discoveryCache.set(baseUrl, { atMs: Date.now(), data });
  return data;
}

function normalizeMode(value: unknown): "sensitive_only" | "all" {
  const raw = String(value ?? "").trim().toLowerCase();
  return raw === "all" ? "all" : "sensitive_only";
}

export async function resolveZdrRouting(opts: {
  svc: any;
  base_url: string | null | undefined;
  behavior?: Record<string, unknown> | null;
  sensitive: boolean;
  cacheTtlMs?: number;
}): Promise<{ base_url: string; meta: ZdrRoutingMeta; discovery: OpenRouterZdrDiscovery | null }> {
  const mode = normalizeMode((opts.behavior as any)?.router?.zdr?.mode);
  const enabled = Boolean((opts.behavior as any)?.router?.zdr?.enabled);
  const allowFallback = (opts.behavior as any)?.router?.zdr?.allow_fallback !== false;
  const requested = enabled && (mode === "all" || (mode === "sensitive_only" && opts.sensitive));

  const fallbackBaseUrl = normalizeOpenRouterBaseUrl(opts.base_url ?? null);

  if (!requested) {
    return {
      base_url: fallbackBaseUrl,
      discovery: null,
      meta: {
        enabled,
        requested: false,
        sensitive: opts.sensitive,
        mode,
        allow_fallback: allowFallback,
        used: false,
        source: "disabled",
        base_url: fallbackBaseUrl,
        candidate_count: 0,
      },
    };
  }

  const overrideRaw = asString((opts.behavior as any)?.router?.zdr?.base_url ?? null);
  const override = overrideRaw ? normalizeOpenRouterBaseUrl(overrideRaw) : null;

  const discovery = override
    ? null
    : await loadOpenRouterZdrDiscovery(opts.svc, fallbackBaseUrl, { cacheTtlMs: opts.cacheTtlMs });
  const candidate = override ?? discovery?.zdr_endpoints?.[0]?.base_url ?? null;

  if (candidate) {
    return {
      base_url: candidate,
      discovery,
      meta: {
        enabled,
        requested,
        sensitive: opts.sensitive,
        mode,
        allow_fallback: allowFallback,
        used: true,
        source: override ? "override" : "discovery",
        base_url: candidate,
        candidate_count: discovery?.zdr_endpoints?.length ?? (override ? 1 : 0),
      },
    };
  }

  return {
    base_url: fallbackBaseUrl,
    discovery,
    meta: {
      enabled,
      requested,
      sensitive: opts.sensitive,
      mode,
      allow_fallback: allowFallback,
      used: false,
      source: "fallback",
      base_url: fallbackBaseUrl,
      candidate_count: discovery?.zdr_endpoints?.length ?? 0,
      reason: allowFallback ? "no_zdr_endpoint" : "zdr_required_unavailable",
    },
  };
}
