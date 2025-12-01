// supabase/functions/catalog-search/index.ts
//
// Read-only catalog search function.
//
// - Takes a query string
// - Searches TMDb (movie + TV)
// - Looks up existing rows in public.titles by tmdb_id
// - Returns merged result: { tmdb: ..., local: ... }
// - NO writes, NO upsert, NO onConflict, NO YouTube.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
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

function getSupabaseAdminClient(req: Request) {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    global: {
      headers: {
        Authorization: req.headers.get("Authorization") ?? "",
      },
    },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      console.error("[catalog-search] Missing SUPABASE_URL or SERVICE_ROLE_KEY");
      return jsonError("Server misconfigured", 500);
    }
    if (!TMDB_TOKEN) {
      console.error("[catalog-search] Missing TMDB_API_READ_ACCESS_TOKEN");
      return jsonError("TMDb not configured", 500);
    }

    const supabase = getSupabaseAdminClient(req);

    // Require authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("[catalog-search] auth error:", authError.message);
      return jsonError("Unauthorized", 401);
    }
    if (!user) {
      return jsonError("Unauthorized", 401);
    }

    const body = (await req.json().catch(() => ({}))) as SearchPayload;
    const query = body.query?.trim();
    if (!query) {
      return jsonError("query is required", 400);
    }

    const page = body.page && body.page > 0 ? body.page : 1;
    const type = body.type ?? "multi";

    return await handleSearch(supabase, { query, page, type });
  } catch (err) {
    console.error("[catalog-search] unhandled error:", err);
    return jsonError("Internal server error", 500);
  }
});

// ============================================================================
// Search logic
// ============================================================================

async function handleSearch(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  args: { query: string; page: number; type: "movie" | "tv" | "multi" },
): Promise<Response> {
  const { query, page, type } = args;

  // 1) Search TMDb
  const tmdbResults = await tmdbSearch(query, page, type);
  if (!tmdbResults) {
    return jsonError("TMDb search failed", 502);
  }

  const items = (tmdbResults.results ?? []).filter((item: any) =>
    item.media_type === "movie" ||
    item.media_type === "tv" ||
    type === "movie" ||
    type === "tv"
  );

  const movieAndTv = items.filter((item: any) =>
    item.media_type === "movie" ||
    item.media_type === "tv" ||
    type === "movie" ||
    type === "tv"
  );

  const tmdbIds = movieAndTv
    .map((r: any) => r.id)
    .filter((id: any) => typeof id === "number");

  // 2) Load local titles by tmdb_id
  let localMap = new Map<number, any>();
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
  const merged = movieAndTv.map((item: any) => {
    const mediaType: "movie" | "tv" =
      item.media_type === "tv" || type === "tv" ? "tv" : "movie";

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

  return jsonOk({
    ok: true,
    query,
    page: tmdbResults.page,
    total_pages: tmdbResults.total_pages,
    total_results: tmdbResults.total_results,
    results: merged,
  }, 200);
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

function jsonError(message: string, status: number): Response {
  return jsonOk({ ok: false, error: message }, status);
}
