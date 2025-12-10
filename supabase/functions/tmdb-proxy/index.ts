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

import {
  handleOptions,
  jsonError,
  jsonResponse,
} from "../_shared/http.ts";
import { log } from "../_shared/logger.ts";
import { getConfig } from "../_shared/config.ts";

const FN_NAME = "tmdb-proxy";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

interface ProxyPayload {
  path: string;
  params?: Record<string, unknown>;
}

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

async function fetchFromTmdb(url: URL) {
  const { tmdbApiReadAccessToken } = getConfig();

  const res = await fetch(url.toString(), {
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${tmdbApiReadAccessToken}`,
    },
  });

  if (!res.ok) {
    log({ fn: FN_NAME }, "TMDb request failed", {
      status: res.status,
      url: url.toString(),
    });
    throw new Error(`TMDb request failed with status ${res.status}`);
  }

  return await res.json();
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
    return jsonError("Server misconfigured", 500, "SERVER_MISCONFIGURED");
  }

  if (req.method !== "POST") {
    return jsonError("Method not allowed", 405, "METHOD_NOT_ALLOWED");
  }

  let payload: ProxyPayload;
  try {
    payload = (await req.json()) as ProxyPayload;
  } catch (err) {
    log(logCtx, "Invalid JSON body", { error: String(err) });
    return jsonError("Invalid JSON body", 400, "BAD_REQUEST_INVALID_JSON");
  }

  if (!payload || typeof payload.path !== "string" || !payload.path.startsWith("/search/")) {
    return jsonError("Invalid path", 400, "BAD_REQUEST_INVALID_PATH");
  }

  const rawParams = payload.params;
  const params: Record<string, unknown> =
    rawParams && typeof rawParams === "object" && !Array.isArray(rawParams)
      ? (rawParams as Record<string, unknown>)
      : {};

  try {
    const url = buildTmdbUrl(payload.path, params);
    const data = await fetchFromTmdb(url);
    return jsonResponse({ ok: true, data });
  } catch (err) {
    log(logCtx, "Unhandled error", { error: String(err) });
    return jsonError("Internal server error", 500, "INTERNAL_ERROR");
  }
}

serve(handler);
