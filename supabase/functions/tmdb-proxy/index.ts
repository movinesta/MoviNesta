// supabase/functions/tmdb-proxy/index.ts
//
// TMDb proxy Edge Function that injects the server-side read token and
// restricts requests to a small set of allowed paths/params to avoid abuse.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

import {
  corsHeaders,
  handleOptions,
  jsonError,
  jsonResponse,
} from "../_shared/http.ts";

const TMDB_TOKEN = Deno.env.get("TMDB_API_READ_ACCESS_TOKEN");
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

const allowedParams: Record<string, Set<string>> = {
  "/search/multi": new Set(["query", "page", "include_adult", "language", "region"]),
  "/trending/all/week": new Set(["page", "language"]),
};

const defaultLanguage = "en-US";

type ProxyPayload = {
  path: string;
  params?: Record<string, unknown>;
};

type NormalizedPayload = {
  path: string;
  params: Record<string, string>;
};

function normalizePath(path: string | null | undefined): string | null {
  if (!path || typeof path !== "string") return null;
  const trimmed = path.trim();
  if (!trimmed.startsWith("/")) return null;
  return trimmed;
}

function validateAndNormalize(body: unknown): NormalizedPayload | Response {
  const payload = body as ProxyPayload;
  const path = normalizePath(payload?.path);
  if (!path || !(path in allowedParams)) {
    return jsonError("Unsupported TMDb path", 400, "BAD_REQUEST_UNSUPPORTED_PATH");
  }

  const params: Record<string, string> = {};
  const rawParams = payload?.params ?? {};
  const allowedKeys = allowedParams[path];

  if (typeof rawParams !== "object" || Array.isArray(rawParams)) {
    return jsonError("params must be an object", 400, "BAD_REQUEST_INVALID_PARAMS");
  }

  for (const [key, value] of Object.entries(rawParams)) {
    if (!allowedKeys.has(key)) continue;
    if (value === undefined || value === null) continue;

    if (key === "query") {
      if (typeof value !== "string" || !value.trim()) {
        return jsonError("query is required", 400, "BAD_REQUEST_MISSING_QUERY");
      }
      params[key] = value.slice(0, 200);
      continue;
    }

    if (key === "page") {
      const page = Number(value);
      if (!Number.isFinite(page) || page < 1 || page > 1000) {
        return jsonError("page must be between 1 and 1000", 400, "BAD_REQUEST_INVALID_PAGE");
      }
      params[key] = String(Math.floor(page));
      continue;
    }

    if (key === "include_adult") {
      params[key] = String(value === true || value === "true");
      continue;
    }

    params[key] = String(value);
  }

  if (path === "/search/multi" && !params.query) {
    return jsonError("query is required", 400, "BAD_REQUEST_MISSING_QUERY");
  }

  if (!params.language) {
    params.language = defaultLanguage;
  }

  return { path, params };
}

async function fetchFromTmdb(payload: NormalizedPayload): Promise<Response> {
  const { path, params } = payload;
  const url = new URL(`${TMDB_BASE_URL}${path}`);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const res = await fetch(url.toString(), {
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${TMDB_TOKEN}`,
    },
  });

  if (!res.ok) {
    console.error(`[tmdb-proxy] TMDb request failed ${res.status} ${res.statusText}`);
    return jsonError("TMDb request failed", res.status, "TMDB_REQUEST_FAILED");
  }

  const data = await res.json();
  return jsonResponse({ ok: true, data });
}

serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  if (!TMDB_TOKEN) {
    console.error("[tmdb-proxy] Missing TMDB_API_READ_ACCESS_TOKEN");
    return jsonError("TMDb not configured", 500, "TMDB_NOT_CONFIGURED");
  }

  if (req.method !== "POST") {
    return jsonError("Method not allowed", 405, "METHOD_NOT_ALLOWED");
  }

  try {
    const body = (await req.json().catch(() => null)) as ProxyPayload | null;
    const normalized = validateAndNormalize(body);
    if (normalized instanceof Response) {
      return normalized;
    }

    return await fetchFromTmdb(normalized);
  } catch (err) {
    console.error("[tmdb-proxy] Unhandled error", err);
    return jsonError("Internal server error", 500, "INTERNAL_ERROR");
  }
});
