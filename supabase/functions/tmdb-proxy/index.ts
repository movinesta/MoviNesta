// supabase/functions/tmdb-proxy/index.ts
//
// TMDb proxy Edge Function that injects the server-side read token and
// forwards requests from the frontend to TMDb.
//
// This version is intentionally more permissive:
// - It accepts *any* TMDb path string starting with "/".
// - It accepts any params object and just forwards it as query params.
// - It still uses the server-side TMDB read access token from getConfig().

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

import { handleOptions, jsonError, jsonResponse } from "../_shared/http.ts";
import { log } from "../_shared/logger.ts";
import { getConfig } from "../_shared/config.ts";
import { getUserClient } from "../_shared/supabase.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { fetchJsonWithTimeout } from "../_shared/fetch.ts";

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

const MAX_QUERY_LEN = 200;
const MAX_PAGE = 50;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildTmdbUrl(path: string, params: Record<string, unknown>): URL {
  const url = new URL(TMDB_BASE_URL + path);

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    url.searchParams.set(key, String(value));
  }

  // Default language if not provided by the client
  if (!url.searchParams.has("language")) {
    url.searchParams.set("language", "en-US");
  }

  return url;
}

function isAllowedPath(path: string): boolean {
  return ALLOWED_PATHS.some((re) => re.test(path));
}

function sanitizeParams(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(raw)) {
    if (!ALLOWED_PARAMS.has(k)) continue;
    if (v === undefined || v === null) continue;

    if (k === "page") {
      const n = typeof v === "number" ? v : Number.parseInt(String(v), 10);
      if (!Number.isFinite(n)) continue;
      out.page = Math.max(1, Math.min(MAX_PAGE, Math.floor(n)));
      continue;
    }

    if (k === "query") {
      const s = String(v).trim();
      if (!s) continue;
      out.query = s.slice(0, MAX_QUERY_LEN);
      continue;
    }

    out[k] = v;
  }

  return out;
}

// Rate limiting handled by shared helper (DB-backed).

async function fetchFromTmdb(url: URL, token: string): Promise<unknown> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };
  return await fetchJsonWithTimeout(url.toString(), { method: "GET", headers }, 8000);
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

  const rl = await enforceRateLimit(req, { action: "tmdb", maxPerMinute: 120 });
  if (!rl.ok) {
    return jsonError(req, "Rate limit exceeded", 429, "RATE_LIMIT", { retryAfterSeconds: rl.retryAfterSeconds });
  }

  try {
    const url = buildTmdbUrl(payload.path, sanitizeParams(params));
    const data = await fetchFromTmdb(url, tmdbApiReadAccessToken);
    return jsonResponse(req, { ok: true, data });
  } catch (err) {
    log(logCtx, "Unhandled error", { error: String(err) });
    return jsonError(req, "Internal server error", 500, "INTERNAL_ERROR");
  }
}

serve(handler);
