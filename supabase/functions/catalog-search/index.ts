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

import { triggerCatalogSyncForTitle } from "../_shared/catalog-sync.ts";
import { getUserClient } from "../_shared/supabase.ts";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const TMDB_TOKEN = Deno.env.get("TMDB_API_READ_ACCESS_TOKEN") ?? "";

const TMDB_BASE = "https://api.themoviedb.org/3";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type SearchPayload = {
  query: string;
  page?: number;
  type?: "movie" | "tv" | "multi";
};

function getSupabaseClient(req: Request) {
  return getUserClient(req);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log("[catalog-search] incoming request");

  try {
    if (!SUPABASE_URL || !ANON_KEY) {
      console.error("[catalog-search] Missing SUPABASE_URL or SUPABASE_ANON_KEY");
      return jsonError("Server misconfigured", 500, "SERVER_MISCONFIGURED");
    }
    if (!TMDB_TOKEN) {
      console.error("[catalog-search] Missing TMDB_API_READ_ACCESS_TOKEN");
      return jsonError("TMDb not configured", 500, "TMDB_NOT_CONFIGURED");
    }

    const supabase = getSupabaseClient(req);

    const body = (await req.json().catch(() => ({}))) as SearchPayload;
    const query = body.query?.trim();
    if (!query) {
      return jsonError("query is required", 400, "BAD_REQUEST_MISSING_QUERY");
    }

    const page = body.page && body.page > 0 ? body.page : 1;
    const type = body.type ?? "multi";

    return await handleSearch(supabase, { query, page, type });
  } catch (err) {
    console.error("[catalog-search] unhandled error:", err);
    return jsonError("Internal server error", 500, "INTERNAL_ERROR");
  }
});

// ============================================================================
// Search logic
// ============================================================================

async function handleSearch(
  supabase: ReturnType<typeof getSupabaseClient>,
  args: { query: string; page: number; type: "movie" | "tv" | "multi" },
): Promise<Response> {
  const { query, page, type } = args;

  // 1) Search TMDb
  const tmdbResults = await tmdbSearch(query, page, type);
  if (!tmdbResults) {
    return jsonError("TMDb search failed", 502, "TMDB_SEARCH_FAILED");
  }

  let items = tmdbResults.results ?? [];
  if (type === "multi") {
    items = items.filter(
      (item: any) => item.media_type === "movie" || item.media_type === "tv",
    );
  }

  const tmdbIds = items
    .map((r: any) => r.id)
    .filter((id: any) => typeof id === "number");

  // 2) Load local titles by tmdb_id
  const localMap = new Map<number, any>();
  if (tmdbIds.length > 0) {
    const { data: localRows, error: localError } = await supabase
      .from("titles")
      .select(
        [
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
        ].join(","),
      )
      .in("tmdb_id", tmdbIds);

    if (localError) {
      console.error("[catalog-search] local titles error:", localError.message);
    } else if (localRows) {
      for (const row of localRows) {
        if (row.tmdb_id != null) {
          localMap.set(row.tmdb_id, row);
        }
      }
    }
  }

  // 3) Build merged results
  const merged = items.map((item: any) => {
    const mediaType: "movie" | "tv" =
      item.media_type === "tv" ? "tv" : "movie";

    const tmdbData = {
      id: item.id,
      mediaType,
      title: item.title ?? item.name ?? null,
      originalTitle: item.original_title ?? item.original_name ?? null,
      overview: item.overview ?? null,
      releaseDate: item.release_date ?? item.first_air_date ?? null,
      posterPath: item.poster_path ?? null,
      backdropPath: item.backdrop_path ?? null,
      popularity: item.popularity ?? null,
      voteAverage: item.vote_average ?? null,
      voteCount: item.vote_count ?? null,
    };

    const local = localMap.get(item.id) ?? null;

    return {
      tmdb: tmdbData,
      local,
    };
  });


  // Fire-and-forget catalog-sync for a small subset of TMDb results that are
  // not yet present locally. This helps keep the `titles` table fresh based
  // on what users actually search for, without blocking the search response.
  try {
    const syncCandidates = merged
      .filter((item) => !item.local && item.tmdb && item.tmdb.id)
      .slice(0, 5);

    for (const item of syncCandidates) {
      const mediaType =
        item.tmdb.media_type === "tv" ? "series" :
        item.tmdb.media_type === "movie" ? "movie" :
        item.tmdb.title ? "movie" : "series";

      triggerCatalogSyncForTitle(
        // We don't need auth for catalog-sync here, but we pass a fake Request
        // that carries no Authorization header; the helper will fall back to
        // the anon key.
        new Request("http://localhost/catalog-search-sync", { method: "POST" }),
        {
          tmdbId: item.tmdb.id,
          imdbId: undefined,
          contentType: mediaType as "movie" | "series",
        },
        { prefix: "[catalog-search]" },
      );
    }
  } catch (err) {
    console.warn("[catalog-search] background catalog-sync error:", err);
  }

  return jsonOk(
    {
      ok: true,
      query,
      page: tmdbResults.page,
      total_pages: tmdbResults.total_pages,
      total_results: tmdbResults.total_results,
      results: merged,
    },
    200,
  );
}

// ============================================================================
// TMDb helpers
// ============================================================================

async function tmdbSearch(
  query: string,
  page: number,
  type: "movie" | "tv" | "multi",
): Promise<any | null> {
  let path: string;
  switch (type) {
    case "movie":
      path = "/search/movie";
      break;
    case "tv":
      path = "/search/tv";
      break;
    default:
      path = "/search/multi";
  }

  const url = new URL(TMDB_BASE + path);
  url.searchParams.set("query", query);
  url.searchParams.set("page", String(page));
  url.searchParams.set("include_adult", "false");
  url.searchParams.set("language", "en-US");

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${TMDB_TOKEN}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    console.error("[TMDb] search failed", res.status, await res.text());
    return null;
  }
  return await res.json();
}

// ============================================================================
// Small helpers
// ============================================================================

function jsonOk(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function jsonError(message: string, status: number, code?: string): Response {
  return jsonOk({ ok: false, error: message, errorCode: code }, status);
}
