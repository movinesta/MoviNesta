// supabase/functions/catalog-sync/index.ts
//
// Universal seeding function for titles.
//
// - TMDb → tmdb_* columns
// - OMDb → omdb_* columns
// - Canonical fields (primary_title, release_year, poster_url, etc.)
//   use OMDb first, then TMDb as fallback.
// - NO onConflict, NO upsert – we use insert/update by title_id.
// - NO YouTube.
// - IMPORTANT: TMDb media_type ("movie"/"tv") is mapped to DB enum content_type ("movie"/"series").

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- Env vars ---

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const TMDB_TOKEN = Deno.env.get("TMDB_API_READ_ACCESS_TOKEN") ?? "";
const OMDB_API_KEY = Deno.env.get("OMDB_API_KEY") ?? "";

const TMDB_BASE = "https://api.themoviedb.org/3";
const OMDB_BASE = "https://www.omdbapi.com/";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// --- Request body ---

type TitleModePayload = {
  external: {
    tmdbId?: number;
    imdbId?: string;
    // TMDb media type
    type?: "movie" | "tv";
  };
  options?: {
    syncOmdb?: boolean;
    forceRefresh?: boolean;
  };
};

// --- Supabase client ---

function getSupabaseAdminClient(req: Request) {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    global: {
      headers: {
        Authorization: req.headers.get("Authorization") ?? "",
      },
    },
  });
}

// --- Main handler ---

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      console.error("[catalog-sync] Missing SUPABASE_URL or SERVICE_ROLE_KEY");
      return jsonError("Server misconfigured", 500);
    }

    const supabase = getSupabaseAdminClient(req);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("[catalog-sync] auth error:", authError.message);
      return jsonError("Unauthorized", 401);
    }
    if (!user) {
      return jsonError("Unauthorized", 401);
    }

    const body = (await req.json().catch(() => ({}))) as TitleModePayload;

    return await handleTitleMode(supabase, body);
  } catch (err) {
    console.error("[catalog-sync] unhandled error:", err);
    return jsonError("Internal server error", 500);
  }
});

// ============================================================================
// Sync a single title
// ============================================================================

async function handleTitleMode(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  payload: TitleModePayload,
): Promise<Response> {
  if (!TMDB_TOKEN) {
    console.error("[catalog-sync:title] Missing TMDB_API_READ_ACCESS_TOKEN");
    return jsonError("TMDb not configured", 500);
  }

  const { external, options } = payload;
  const { tmdbId: tmdbIdRaw, imdbId: imdbIdRaw, type: typeRaw } = external ?? {};

  if (!tmdbIdRaw && !imdbIdRaw) {
    return jsonError("Either external.tmdbId or external.imdbId is required", 400);
  }

  // TMDb media type
  let tmdbMediaType: "movie" | "tv" = typeRaw ?? "movie";

  let tmdbId: number | null = tmdbIdRaw ?? null;
  let imdbId: string | null = imdbIdRaw ?? null;

  // If only IMDb id is provided, resolve TMDb id via /find
  if (!tmdbId && imdbId) {
    const resolved = await tmdbFindByImdbId(imdbId);
    if (!resolved) {
      return jsonError("Could not resolve TMDb id from IMDb id", 502);
    }
    tmdbId = resolved.id;
    tmdbMediaType = resolved.media_type; // "movie" | "tv"
  }

  if (!tmdbId) {
    return jsonError("Could not determine TMDb id", 500);
  }

  // TMDb details
  const tmdbDetails = await tmdbGetDetails(tmdbId, tmdbMediaType);
  if (!tmdbDetails) {
    return jsonError("TMDb details fetch failed", 502);
  }

  // IMDb id from TMDb if missing
  if (!imdbId && tmdbDetails.imdb_id) {
    imdbId = String(tmdbDetails.imdb_id);
  }

  const tmdbBlock = buildTmdbBlock(tmdbDetails, tmdbMediaType);

  // OMDb (optional)
  let omdbBlock: OmdbBlock | null = null;
  if ((options?.syncOmdb ?? true) && OMDB_API_KEY && imdbId) {
    omdbBlock = await fetchOmdbBlock(imdbId);
  }

  // Map TMDb media type -> DB enum content_type
  // 🔴 IMPORTANT: if your enum uses something else (e.g. "show"),
  // change "series" here to that value.
  const dbContentType: "movie" | "series" =
    tmdbMediaType === "movie" ? "movie" : "series";

  // Find existing row
  const { data: existing, error: existingError } = await supabase
    .from("titles")
    .select("title_id, tmdb_id, omdb_imdb_id, omdb_last_synced_at")
    .or(
      [
        tmdbId ? `tmdb_id.eq.${tmdbId}` : "",
        imdbId ? `omdb_imdb_id.eq.${imdbId}` : "",
      ]
        .filter(Boolean)
        .join(","),
    )
    .limit(1)
    .maybeSingle();

  if (existingError) {
    console.error("[catalog-sync:title] select existing error:", existingError.message);
    return jsonError("Database error", 500);
  }

  const now = new Date().toISOString();
  const titleId = existing?.title_id ?? crypto.randomUUID();

  const normalized = buildNormalizedFields({
    mediaType: tmdbMediaType,
    tmdb: tmdbBlock,
    omdb: omdbBlock,
  });

  const baseRow: Record<string, any> = {
    title_id: titleId,
    content_type: dbContentType, // ✅ always "movie" or "series" now

    // canonical fields
    ...normalized,

    // provider-specific blocks
    ...tmdbBlock,
    ...omdbBlock,

    tmdb_last_synced_at: now,
    omdb_last_synced_at: omdbBlock ? now : existing?.omdb_last_synced_at ?? null,
    last_synced_at: now,

    updated_at: now,
  };

  let mutationError = null;

  if (existing) {
    // UPDATE existing row
    const { error } = await supabase
      .from("titles")
      .update(baseRow)
      .eq("title_id", titleId);
    mutationError = error;
  } else {
    // INSERT new row
    const { error } = await supabase.from("titles").insert(baseRow);
    mutationError = error;
  }

  if (mutationError) {
    console.error(
      "[catalog-sync:title] mutation error:",
      mutationError.message,
    );
    return jsonError("Failed to upsert title", 500);
  }

  return jsonOk({
    ok: true,
    titleId,
    tmdbId,
    imdbId,
  });
}

// ============================================================================
// TMDb helpers
// ============================================================================

async function tmdbRequest(path: string, params: Record<string, string> = {}) {
  const url = new URL(TMDB_BASE + path);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${TMDB_TOKEN}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    console.error("[TMDb] request failed", res.status, await res.text());
    return null;
  }
  return await res.json();
}

async function tmdbFindByImdbId(imdbId: string): Promise<
  | {
      id: number;
      media_type: "movie" | "tv";
    }
  | null
> {
  const data = await tmdbRequest(`/find/${encodeURIComponent(imdbId)}`, {
    external_source: "imdb_id",
  });
  if (!data) return null;

  if (Array.isArray(data.movie_results) && data.movie_results.length > 0) {
    return { id: data.movie_results[0].id, media_type: "movie" };
  }
  if (Array.isArray(data.tv_results) && data.tv_results.length > 0) {
    return { id: data.tv_results[0].id, media_type: "tv" };
  }
  return null;
}

async function tmdbGetDetails(
  tmdbId: number,
  type: "movie" | "tv",
): Promise<any | null> {
  const path = type === "tv" ? `/tv/${tmdbId}` : `/movie/${tmdbId}`;
  return await tmdbRequest(path, {
    append_to_response: "credits,release_dates",
  });
}

type TmdbBlock = Record<string, any>;

function buildTmdbBlock(details: any, type: "movie" | "tv"): TmdbBlock {
  if (!details) return {};

  const posterPath = details.poster_path ?? null;
  const backdropPath = details.backdrop_path ?? null;

  const genresArray: string[] =
    Array.isArray(details.genres) && details.genres.length
      ? details.genres.map((g: any) => String(g.name))
      : [];

  return {
    tmdb_id: details.id ?? null,
    tmdb_media_type: type, // "movie" | "tv"
    tmdb_original_title:
      details.original_title ?? details.original_name ?? null,
    tmdb_poster_path: posterPath,
    tmdb_backdrop_path: backdropPath,
    tmdb_popularity: details.popularity ?? null,
    tmdb_vote_average: details.vote_average ?? null,
    tmdb_vote_count: details.vote_count ?? null,
    tmdb_release_date: details.release_date ?? null,
    tmdb_first_air_date: details.first_air_date ?? null,
    tmdb_runtime: details.runtime ?? null,
    tmdb_episode_run_time: details.episode_run_time ?? null,
    tmdb_overview: details.overview ?? null,
    tmdb_raw: details,
    tmdb_title: details.title ?? details.name ?? null,
    tmdb_genre_names: genresArray,
  };
}

// ============================================================================
// OMDb helpers
// ============================================================================

type OmdbBlock = Record<string, any>;

async function fetchOmdbBlock(imdbId: string): Promise<OmdbBlock | null> {
  if (!OMDB_API_KEY) return null;

  const url = new URL(OMDB_BASE);
  url.searchParams.set("apikey", OMDB_API_KEY);
  url.searchParams.set("i", imdbId);
  url.searchParams.set("plot", "full");

  const res = await fetch(url.toString());
  if (!res.ok) {
    console.error("[OMDb] request failed", res.status, await res.text());
    return null;
  }
  const data = await res.json();
  if (data.Response === "False") {
    console.warn("[OMDb] Response false:", data.Error);
    return null;
  }

  const imdbRating = parseFloatSafe(data.imdbRating);
  const imdbVotes = parseIntSafe(data.imdbVotes);
  const rtPct = extractRottenTomatoesPct(data.Ratings);
  const metascore = parseIntSafe(data.Metascore);

  const runtimeMinutes = parseIntSafe(
    typeof data.Runtime === "string" ? data.Runtime.replace(" min", "") : "",
  );

  const genresArray: string[] =
    typeof data.Genre === "string" && data.Genre.length
      ? data.Genre.split(",").map((g: string) => g.trim())
      : [];

  return {
    omdb_imdb_id: data.imdbID ?? imdbId,
    omdb_title: data.Title ?? null,
    omdb_year: parseIntSafe(data.Year),
    omdb_runtime_minutes: runtimeMinutes,
    omdb_plot: data.Plot ?? null,
    omdb_poster_url: data.Poster && data.Poster !== "N/A" ? data.Poster : null,
    omdb_imdb_rating: imdbRating,
    omdb_imdb_votes: imdbVotes,
    omdb_rt_rating_pct: rtPct,
    omdb_metacritic_score: metascore,
    omdb_genre_names: genresArray,
    omdb_raw: data,
  };
}

function extractRottenTomatoesPct(ratings: any): number | null {
  if (!Array.isArray(ratings)) return null;
  const rt = ratings.find(
    (r: any) => r.Source === "Rotten Tomatoes" && typeof r.Value === "string",
  );
  if (!rt) return null;
  const match = (rt.Value as string).match(/(\d+)%/);
  return match ? parseIntSafe(match[1]) : null;
}

// ============================================================================
// Normalization – canonical fields from TMDb/OMDb to titles.*
// ============================================================================

function buildNormalizedFields({
  mediaType,
  tmdb,
  omdb,
}: {
  mediaType: "movie" | "tv";
  tmdb: TmdbBlock;
  omdb: OmdbBlock | null;
}) {
  const primary_title =
    omdb?.omdb_title ??
    tmdb.tmdb_title ??
    tmdb.tmdb_original_title ??
    null;

  const original_title = tmdb.tmdb_original_title ?? omdb?.omdb_title ?? null;

  const release_year =
    omdb?.omdb_year ??
    extractYear(
      tmdb.tmdb_release_date ??
        (mediaType === "tv" ? tmdb.tmdb_first_air_date : null),
    );

  const runtime_minutes =
    omdb?.omdb_runtime_minutes ??
    (typeof tmdb.tmdb_runtime === "number"
      ? tmdb.tmdb_runtime
      : Array.isArray(tmdb.tmdb_episode_run_time) &&
          tmdb.tmdb_episode_run_time.length
        ? tmdb.tmdb_episode_run_time[0]
        : null);

  const plot = omdb?.omdb_plot ?? tmdb.tmdb_overview ?? null;

  const poster_url =
    omdb?.omdb_poster_url ??
    (tmdb.tmdb_poster_path
      ? `https://image.tmdb.org/t/p/w500${tmdb.tmdb_poster_path}`
      : null);

  const backdrop_url =
    tmdb.tmdb_backdrop_path
      ? `https://image.tmdb.org/t/p/w780${tmdb.tmdb_backdrop_path}`
      : null;

  const imdb_rating = omdb?.omdb_imdb_rating ?? null;
  const imdb_votes = omdb?.omdb_imdb_votes ?? null;
  const rt_tomato_pct = omdb?.omdb_rt_rating_pct ?? null;
  const metascore = omdb?.omdb_metacritic_score ?? null;

  const genresSet = new Set<string>();
  if (Array.isArray(omdb?.omdb_genre_names)) {
    for (const g of omdb!.omdb_genre_names) genresSet.add(g);
  }
  if (Array.isArray(tmdb.tmdb_genre_names)) {
    for (const g of tmdb.tmdb_genre_names) genresSet.add(g);
  }
  const genres = Array.from(genresSet);

  return {
    primary_title,
    original_title,
    release_year,
    runtime_minutes,
    plot,
    poster_url,
    backdrop_url,
    imdb_rating,
    imdb_votes,
    rt_tomato_pct,
    metascore,
    genres,
  };
}

// ============================================================================
// Small helpers
// ============================================================================

function parseFloatSafe(value: any): number | null {
  const n = parseFloat(String(value).replace(",", ""));
  return Number.isFinite(n) ? n : null;
}

function parseIntSafe(value: any): number | null {
  const n = parseInt(String(value).replace(/,/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

function extractYear(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const match = dateStr.match(/^(\d{4})/);
  return match ? parseIntSafe(match[1]) : null;
}

function jsonOk(body: unknown, status: number): Response {
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
