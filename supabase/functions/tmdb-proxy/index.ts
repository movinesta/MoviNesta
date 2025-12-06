// supabase/functions/tmdb-proxy/index.ts
//
// TMDb proxy Edge Function that injects the server-side read token and
// restricts requests to a small set of allowed paths/params to avoid abuse.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

import { handleOptions, jsonError, jsonResponse, validateRequest } from "../_shared/http.ts";
import { log } from "../_shared/logger.ts";

const FN_NAME = "tmdb-proxy";

const TMDB_TOKEN = Deno.env.get("TMDB_API_READ_ACCESS_TOKEN");
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

// ============================================================================
// Type and Schema Definitions
// ============================================================================

const ALLOWED_PATHS = ["/search/multi", "/trending/all/week"] as const;

const ProxyPayloadSchema = z.object({
  path: z.enum(ALLOWED_PATHS),
  params: z.record(z.unknown()).optional(),
});

type ProxyPayload = z.infer<typeof ProxyPayloadSchema>;

const SearchParamsSchema = z.object({
  query: z.string().min(1, "Query is required").max(200),
  page: z.number().int().min(1).max(1000).optional(),
  include_adult: z.boolean().optional(),
  language: z.string().optional(),
  region: z.string().optional(),
});

const TrendingParamsSchema = z.object({
  page: z.number().int().min(1).max(1000).optional(),
  language: z.string().optional(),
});

// ============================================================================
// Main Request Handler
// ============================================================================

serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  const logCtx = { fn: FN_NAME };

  if (!TMDB_TOKEN) {
    log(logCtx, "TMDB_API_READ_ACCESS_TOKEN is not configured");
    return jsonError("Server misconfigured", 500, "SERVER_MISCONFIGURED");
  }

  if (req.method !== "POST") {
    return jsonError("Method not allowed", 405, "METHOD_NOT_ALLOWED");
  }

  try {
    const { data: payload, errorResponse } = await validateRequest(req, (raw) =>
      ProxyPayloadSchema.parse(raw)
    );
    if (errorResponse) return errorResponse;

    const validatedParams = validateParams(payload.path, payload.params);
    const url = buildTmdbUrl(payload.path, validatedParams);

    const tmdbResponse = await fetchFromTmdb(url);
    return jsonResponse({ ok: true, data: tmdbResponse });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError("Invalid request body", 400, "BAD_REQUEST");
    }
    log(logCtx, "Unhandled error", { error: err.message, stack: err.stack });
    return jsonError("Internal server error", 500, "INTERNAL_ERROR");
  }
});

// ============================================================================
// Helper Functions
// ============================================================================

function validateParams(path: typeof ALLOWED_PATHS[number], params: Record<string, unknown> = {}) {
  const schema = path === "/search/multi" ? SearchParamsSchema : TrendingParamsSchema;
  return schema.parse(params);
}

function buildTmdbUrl(path: string, params: Record<string, any>): URL {
  const url = new URL(`${TMDB_BASE_URL}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  });
  if (!url.searchParams.has("language")) {
    url.searchParams.set("language", "en-US");
  }
  return url;
}

async function fetchFromTmdb(url: URL) {
  const res = await fetch(url.toString(), {
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${TMDB_TOKEN}`,
    },
  });

  if (!res.ok) {
    log({ fn: FN_NAME }, "TMDb request failed", { status: res.status, url: url.toString() });
    throw new Error(`TMDb request failed with status ${res.status}`);
  }

  return await res.json();
}
