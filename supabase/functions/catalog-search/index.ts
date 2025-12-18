// supabase/functions/catalog-search/index.ts
//
// Read-only catalog search function.
//
// - Takes a query string
// - Searches TMDb (movie + TV)
// - Looks up existing rows in public.titles by tmdb_id
// - Returns merged result: { tmdb: ..., local: ... }
// - NO writes, NO upsert, NO onConflict, NO YouTube.
// - NO auth requirement (public read), safe because it's just metadata.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

import { triggerCatalogSyncForTitle } from "../_shared/catalog-sync.ts";
import { handleOptions, jsonError, jsonResponse, validateRequest } from "../_shared/http.ts";
import { log } from "../_shared/logger.ts";
import { getUserClient } from "../_shared/supabase.ts";
import { getConfig } from "../_shared/config.ts";
import type { Database } from "../../../src/types/supabase.ts";

const FN_NAME = "catalog-search";

const TMDB_BASE = "https://api.themoviedb.org/3";

// Define types for better code quality and maintenance.
type Title = Database["public"]["Tables"]["titles"]["Row"];
type SearchType = "movie" | "tv" | "multi";

interface SearchRequest {
  query: string;
  page?: number;
  type?: SearchType;
}

interface TmdbSearchResultItem {
  id: number;
  media_type?: "movie" | "tv";
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string;
  backdrop_path?: string;
  popularity?: number;
  vote_average?: number;
  vote_count?: number;
}

interface TmdbSearchResponse {
  page: number;
  results: TmdbSearchResultItem[];
  total_pages: number;
  total_results: number;
}

// ============================================================================
// Main request handler
// ============================================================================

export async function handler(req: Request) {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  const logCtx = { fn: FN_NAME };

  if (req.method !== "POST") {
    return jsonError("Method not allowed", 405);
  }

  try {
    const { tmdbApiReadAccessToken } = getConfig();
    if (!tmdbApiReadAccessToken) {
      log(logCtx, "TMDB_API_READ_ACCESS_TOKEN is not configured");
      return jsonError("Server misconfigured", 500, "SERVER_MISCONFIGURED");
    }

    const { data, errorResponse } = await validateRequest<SearchRequest>(req, parseRequestBody, {
      logPrefix: `[${FN_NAME}]`,
    });
    if (errorResponse) return errorResponse;

    const { query, page = 1, type = "multi" } = data;
    const supabase = getUserClient(req);

    return await handleSearch(supabase, { query, page, type });
  } catch (err) {
    log(logCtx, "Unhandled error", { error: err.message, stack: err.stack });
    return jsonError("Internal server error", 500, "INTERNAL_ERROR");
  }
}

serve(handler);

function parseRequestBody(body: unknown): SearchRequest {
  if (typeof body !== "object" || body === null) {
    throw new Error("Request body must be an object.");
  }

  const { query, page, type } = body as Record<string, unknown>;

  if (typeof query !== "string" || !query.trim()) {
    throw new Error("'query' is a required string.");
  }
  if (page !== undefined && (typeof page !== "number" || page < 1)) {
    throw new Error("'page' must be a positive number.");
  }
  if (type !== undefined && !["movie", "tv", "multi"].includes(type as string)) {
    throw new Error("'type' must be one of 'movie', 'tv', or 'multi'.");
  }

  return { query: query.trim(), page, type: type as SearchType };
}

// ============================================================================
// Search logic
// ============================================================================

const LOCAL_TITLE_COLUMNS = [
  "title_id",
  "tmdb_id",
  "primary_title",
  "original_title",
  "release_year",
  "release_date",
  "runtime_minutes",
  "poster_url",
  "backdrop_url",
  "imdb_rating",
  "imdb_votes",
  "rt_tomato_pct",
  "metascore",
  "genres",
  "omdb_imdb_id",
].join(",");

async function handleSearch(
  supabase: SupabaseClient<Database>,
  args: Required<SearchRequest>,
): Promise<Response> {
  const { query, page, type } = args;
  const logCtx = { fn: FN_NAME, query, page, type };

  // 1) Search TMDb
  const tmdbResponse = await tmdbSearch(query, page, type);
  const tmdbItems = (tmdbResponse?.results ?? []).filter(
    (item) => type !== "multi" || ["movie", "tv"].includes(item.media_type ?? ""),
  );
  const tmdbIds = tmdbItems.map((item) => item.id).filter((id): id is number => !!id);

  // 2) Load local titles by tmdb_id
  const localMap = new Map<number, Title>();
  if (tmdbIds.length > 0) {
    const { data, error } = await supabase
      .from("titles")
      .select(LOCAL_TITLE_COLUMNS)
      .in("tmdb_id", tmdbIds);

    if (error) {
      log(logCtx, "Failed to fetch local titles", { error: error.message });
      // Non-fatal, proceed with empty localMap
    } else {
      for (const row of data) {
        if (row.tmdb_id) {
          localMap.set(row.tmdb_id, row as Title);
        }
      }
    }
  }

  // 3) Merge TMDB and local data
  const mergedResults = tmdbItems.map((tmdbItem) => ({
    tmdb: tmdbItem,
    local: localMap.get(tmdbItem.id) ?? null,
  }));

  // 4) Fire-and-forget sync for a few missing titles
  triggerBackgroundSync(mergedResults.slice(0, 5));

  return jsonResponse({
    ok: true,
    query,
    page: tmdbResponse?.page ?? 1,
    total_pages: tmdbResponse?.total_pages ?? 0,
    total_results: tmdbResponse?.total_results ?? 0,
    results: mergedResults,
  });
}

function triggerBackgroundSync(
  items: { tmdb: TmdbSearchResultItem; local: Title | null }[],
) {
  const syncCandidates = items.filter((item) => !item.local && item.tmdb?.id);

  if (syncCandidates.length === 0) return;

  // Create a request with no auth headers to use the anon key.
  const req = new Request("http://localhost/catalog-search-sync", { method: "POST" });
  const logCtx = { fn: FN_NAME };

  Promise.allSettled(
    syncCandidates.map((item) => {
      const contentType = (item.tmdb.media_type === "tv" || item.tmdb.name) ? "series" : "movie";
      return triggerCatalogSyncForTitle(
        req,
        {
          tmdbId: item.tmdb.id,
          imdbId: undefined,
          contentType,
        },
        { prefix: `[${FN_NAME}]` },
      );
    }),
  ).catch((err) => {
    log(logCtx, "Background catalog-sync failed", { error: err.message });
  });
}

// ============================================================================
// TMDb helpers
// ============================================================================

async function tmdbSearch(
  query: string,
  page: number,
  type: SearchType,
): Promise<TmdbSearchResponse | null> {
  const { tmdbApiReadAccessToken } = getConfig();
  const path = `/search/${type}`;
  const url = new URL(TMDB_BASE + path);
  url.searchParams.set("query", query);
  url.searchParams.set("page", String(page));
  url.searchParams.set("include_adult", "false");
  url.searchParams.set("language", "en-US");

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${tmdbApiReadAccessToken}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      log({ fn: FN_NAME }, "TMDb search request failed", { status: res.status });
      return null;
    }
    return await res.json();
  } catch (err) {
    log({ fn: FN_NAME }, "TMDb fetch error", { error: err.message });
    return null;
  }
}
