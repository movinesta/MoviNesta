// supabase/functions/tmdb-proxy/index.ts
//
// TMDb proxy Edge Function that injects the server-side read token and
// forwards requests from the frontend to TMDb.
//
// Security model:
// - Requires a valid Supabase session (authenticated user)
// - Uses server-side TMDB read access token (secret) from getConfig()
// - Applies DB-backed rate limiting per user
//
// Admin-controlled (server-only, non-secret) settings are loaded from app_settings:
// - integrations.tmdb_proxy.*

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

import { handleOptions, jsonError, jsonResponse } from "../_shared/http.ts";
import { log } from "../_shared/logger.ts";
import { getConfig } from "../_shared/config.ts";
import { getAdminClient, getUserClient } from "../_shared/supabase.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { fetchJsonWithTimeout } from "../_shared/fetch.ts";
import { loadAppSettingsForScopes } from "../_shared/appSettings.ts";

const FN_NAME = "tmdb-proxy";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

interface ProxyPayload {
  path: string;
  params?: Record<string, unknown>;
}

const ALLOWED_PATHS: RegExp[] = [
  /^\/search\/(movie|tv|person|multi)$/,
  /^\/(movie|tv)\/[0-9]+(?:\/\w+)?$/,
  /^\/person\/[0-9]+(?:\/\w+)?$/,
  /^\/genre\/(movie|tv)\/list$/,
  /^\/discover\/(movie|tv)$/,
  /^\/trending\/(movie|tv|all)\/(day|week)$/,
];

const ALLOWED_PARAMS = new Set([
  "query",
  "page",
  "language",
  "include_adult",
  "year",
  "primary_release_year",
  "first_air_date_year",
  "with_genres",
  "sort_by",
  "region",
]);

type TmdbProxyCfg = {
  defaultLanguage: string;
  maxQueryLen: number;
  maxPage: number;
  timeoutMs: number;
  maxPerMinute: number;
};

const DEFAULT_CFG: TmdbProxyCfg = {
  defaultLanguage: "en-US",
  maxQueryLen: 200,
  maxPage: 50,
  timeoutMs: 8000,
  maxPerMinute: 120,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildTmdbUrl(path: string, params: Record<string, unknown>, defaultLanguage: string): URL {
  const url = new URL(TMDB_BASE_URL + path);

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    url.searchParams.set(key, String(value));
  }

  // Default language if not provided by the client
  if (!url.searchParams.has("language")) {
    url.searchParams.set("language", defaultLanguage);
  }

  return url;
}

function isAllowedPath(path: string): boolean {
  return ALLOWED_PATHS.some((re) => re.test(path));
}

function sanitizeParams(raw: Record<string, unknown>, cfg: TmdbProxyCfg): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(raw)) {
    if (!ALLOWED_PARAMS.has(k)) continue;
    if (v === undefined || v === null) continue;

    if (k === "page") {
      const n = typeof v === "number" ? v : Number.parseInt(String(v), 10);
      if (!Number.isFinite(n)) continue;
      out.page = Math.max(1, Math.min(cfg.maxPage, Math.floor(n)));
      continue;
    }

    if (k === "query") {
      const s = String(v).trim();
      if (!s) continue;
      out.query = s.slice(0, cfg.maxQueryLen);
      continue;
    }

    out[k] = v;
  }

  return out;
}

async function fetchFromTmdb(url: URL, token: string, timeoutMs: number): Promise<unknown> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };
  return await fetchJsonWithTimeout(url.toString(), { method: "GET", headers }, timeoutMs);
}

function clampInt(n: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, Math.floor(n)));
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function handler(req: Request) {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  const logCtx = { fn: FN_NAME };

  const { tmdbApiReadAccessToken } = getConfig();
  if (!tmdbApiReadAccessToken) {
    log(logCtx, "TMDB_API_READ_ACCESS_TOKEN is not configured");
    return jsonError(req, "Server misconfigured", 500, "SERVER_MISCONFIGURED");
  }

  if (req.method !== "POST") {
    return jsonError(req, "Method not allowed", 405, "METHOD_NOT_ALLOWED");
  }

  // Require a valid Supabase session.
  const supabaseAuth = getUserClient(req);
  const { data: authData, error: authErr } = await supabaseAuth.auth.getUser();
  if (authErr || !authData?.user?.id) {
    return jsonError(req, "Unauthorized", 401, "UNAUTHORIZED");
  }

  let payload: ProxyPayload;
  try {
    payload = (await req.json()) as ProxyPayload;
  } catch (err) {
    log(logCtx, "Invalid JSON body", { error: String(err) });
    return jsonError(req, "Invalid JSON body", 400, "BAD_REQUEST_INVALID_JSON");
  }

  if (!payload || typeof payload.path !== "string" || !payload.path.startsWith("/")) {
    return jsonError(req, "Invalid path", 400, "BAD_REQUEST_INVALID_PATH");
  }

  if (!isAllowedPath(payload.path)) {
    return jsonError(req, "Path not allowed", 400, "BAD_REQUEST_PATH_NOT_ALLOWED");
  }

  const rawParams = payload.params;
  const params: Record<string, unknown> =
    rawParams && typeof rawParams === "object" && !Array.isArray(rawParams)
      ? (rawParams as Record<string, unknown>)
      : {};

  // Load admin-controlled server-only config (best-effort; fallback to defaults).
  let cfg: TmdbProxyCfg = { ...DEFAULT_CFG };
  try {
    const admin = getAdminClient();
    const env = await loadAppSettingsForScopes(admin as any, ["server_only"], { cacheTtlMs: 60_000 });
    const s = env.settings ?? {};
    cfg = {
      defaultLanguage: String((s as any)["integrations.tmdb_proxy.default_language"] ?? cfg.defaultLanguage),
      maxQueryLen: clampInt(Number((s as any)["integrations.tmdb_proxy.max_query_len"] ?? cfg.maxQueryLen), 10, 500),
      maxPage: clampInt(Number((s as any)["integrations.tmdb_proxy.max_page"] ?? cfg.maxPage), 1, 500),
      timeoutMs: clampInt(Number((s as any)["integrations.tmdb_proxy.timeout_ms"] ?? cfg.timeoutMs), 1000, 30000),
      maxPerMinute: clampInt(Number((s as any)["integrations.tmdb_proxy.max_per_minute"] ?? cfg.maxPerMinute), 10, 600),
    };
  } catch {
    // ignore; keep defaults
  }

  const rl = await enforceRateLimit(req, { action: "tmdb", maxPerMinute: cfg.maxPerMinute });
  if (!rl.ok) {
    return jsonError(req, "Rate limit exceeded", 429, "RATE_LIMIT", { retryAfterSeconds: rl.retryAfterSeconds });
  }

  try {
    const url = buildTmdbUrl(payload.path, sanitizeParams(params, cfg), cfg.defaultLanguage);
    const data = await fetchFromTmdb(url, tmdbApiReadAccessToken, cfg.timeoutMs);
    return jsonResponse(req, { ok: true, data });
  } catch (err) {
    log(logCtx, "Unhandled error", { error: String(err) });
    return jsonError(req, "Internal server error", 500, "INTERNAL_ERROR");
  }
}

serve(handler);
