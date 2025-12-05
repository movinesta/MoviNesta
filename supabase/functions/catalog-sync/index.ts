// supabase/functions/catalog-sync/index.ts
//
// Universal seeding function for `public.titles`.
//
// - TMDb → tmdb_* columns
// - OMDb → omdb_* columns
// - Canonical columns (primary_title, release_year, poster_url, imdb_rating, etc.)
//   are filled as OMDb → TMDb → null.
// - Handles movies and series (content_type enum: "movie" | "series").
// - Uses TMDb external_ids to get IMDb ID for TV (Breaking Bad, etc).
// - Handles duplicate tmdb_id by updating the existing row instead of failing.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  corsHeaders,
  handleOptions,
  jsonError,
  jsonResponse,
  validateRequest,
} from "../_shared/http.ts";
import { getAdminClient } from "../_shared/supabase.ts";

const TMDB_API_READ_ACCESS_TOKEN =
  Deno.env.get("TMDB_API_READ_ACCESS_TOKEN") ?? "";
const OMDB_API_KEY = Deno.env.get("OMDB_API_KEY") ?? "";
const TMDB_BASE = "https://api.themoviedb.org/3";
const OMDB_BASE = "https://www.omdbapi.com/";

type TitleModeBody = {
  external?: {
    tmdbId?: number | null;
    imdbId?: string | null;
    type?: "movie" | "tv" | null;
  };
  tmdbId?: number | null;
  imdbId?: string | null;
  contentType?: "movie" | "series" | null;
  options?: {
    syncOmdb?: boolean;
    forceRefresh?: boolean;
  };
};

type CatalogSyncBody = {
  mode?: "title";
} & TitleModeBody;

serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  if (req.method !== "POST") {
    return jsonError("Method not allowed", 405);
  }

  const { data, errorResponse } = await validateRequest<CatalogSyncBody>(
    req,
    (raw) => raw as CatalogSyncBody,
    { logPrefix: "[catalog-sync]" },
  );
  if (errorResponse) return errorResponse;

  const body = data ?? {};
  const mode = body.mode ?? "title";

  // For now we only support "title" mode (sync single title).
  if (mode === "title") {
    return handleTitleMode(req, body);
  }

  return jsonError("Unsupported mode", 400, "CATALOG_SYNC_UNSUPPORTED_MODE");
});

// -----------------------------------------------------------------------------
// Title mode: sync a single movie/series into public.titles
// -----------------------------------------------------------------------------

async function handleTitleMode(
  req: Request,
  body: TitleModeBody,
): Promise<Response> {
  const supabase = getAdminClient(req);
  const external = body.external ?? {};
  const options = body.options ?? {};

  // Input can come from `external` or top-level fields for backwards compat.
  let tmdbId: number | null =
    external.tmdbId ??
    body.tmdbId ??
    null;
  let imdbId: string | null =
    external.imdbId ??
    body.imdbId ??
    null;
  let contentType: "movie" | "series" | null = body.contentType ?? null;

  console.log("[catalog-sync:title] incoming body:", JSON.stringify(body));

  // We must have at least one external ID.
  if (!tmdbId && !imdbId) {
    return jsonError(
      "Missing tmdbId or imdbId",
      400,
      "CATALOG_SYNC_MISSING_EXTERNAL",
    );
  }

  // ---------------------------------------------------------------------------
  // Try to resolve TMDb metadata
  // ---------------------------------------------------------------------------

  let tmdbMediaType: "movie" | "tv" | null = external.type ?? null;

  // If we only have IMDb ID, try to look up TMDb ID via /find.
  if (!tmdbId && imdbId) {
    const resolved = await tmdbFindByImdb(imdbId);
    if (!resolved) {
      console.warn(
        "[catalog-sync:title] TMDb /find could not resolve IMDb ID",
        imdbId,
      );
    } else {
      tmdbId = resolved.id;
      tmdbMediaType = resolved.media_type === "tv" ? "tv" : "movie";
      console.log(
        "[catalog-sync:title] resolved TMDb from IMDb",
        imdbId,
        "→",
        tmdbId,
        tmdbMediaType,
      );
    }
  }

  // If we still don't know TMDb media type, infer from contentType or default.
  if (!tmdbMediaType && contentType === "series") tmdbMediaType = "tv";
  if (!tmdbMediaType && contentType === "movie") tmdbMediaType = "movie";
  if (!tmdbMediaType) tmdbMediaType = "movie"; // safe default

  // Normalize contentType to match DB enum.
  contentType = tmdbMediaType === "tv" ? "series" : "movie";

  if (!tmdbId) {
    console.warn(
      "[catalog-sync:title] still no tmdbId after /find; proceeding with OMDb only",
    );
  }

  // ---------------------------------------------------------------------------
  // Look up or provision a title_id
  // ---------------------------------------------------------------------------

  let titleId: string | null = null;
  let existing = false;

  if (tmdbId) {
    // Prefer match via tmdb_id
    const { data: existingByTmdb, error: existingByTmdbError } = await supabase
      .from("titles")
      .select("title_id")
      .eq("tmdb_id", tmdbId)
      .limit(1)
      .maybeSingle();

    if (existingByTmdbError) {
      console.warn(
        "[catalog-sync:title] lookup existing by tmdb_id error",
        existingByTmdbError,
      );
    }

    if (existingByTmdb?.title_id) {
      titleId = existingByTmdb.title_id;
      existing = true;
      console.log(
        "[catalog-sync:title] found existing title by tmdb_id:",
        titleId,
      );
    }
  }

  if (!titleId && imdbId) {
    // Then try match via omdb_imdb_id
    const { data: existingByImdb, error: existingByImdbError } = await supabase
      .from("titles")
      .select("title_id")
      .eq("omdb_imdb_id", imdbId)
      .limit(1)
      .maybeSingle();

    if (existingByImdbError) {
      console.warn(
        "[catalog-sync:title] lookup existing by omdb_imdb_id error",
        existingByImdbError,
      );
    }

    if (existingByImdb?.title_id) {
      titleId = existingByImdb.title_id;
      existing = true;
      console.log(
        "[catalog-sync:title] found existing title by omdb_imdb_id:",
        titleId,
      );
    }
  }

  if (!titleId) {
    titleId = crypto.randomUUID();
    existing = false;
    console.log("[catalog-sync:title] creating new title_id:", titleId);
  }

  // ---------------------------------------------------------------------------
  // TMDb details
  // ---------------------------------------------------------------------------

  let tmdbDetails: any | null = null;

  if (tmdbId) {
    tmdbDetails = await tmdbGetDetails(tmdbId, tmdbMediaType);
    if (!tmdbDetails) {
      console.warn("[catalog-sync:title] TMDb details fetch failed");
    }
  }

  // If we have TMDb details, use them to resolve IMDb ID for TV as well.
  if (tmdbDetails && !imdbId) {
    const imdbFromMovie = tmdbDetails.imdb_id;
    const imdbFromExternal =
      tmdbDetails.external_ids?.imdb_id ??
      tmdbDetails.external_ids?.imdb ??
      null;

    const resolvedImdb = imdbFromMovie ?? imdbFromExternal ?? null;
    if (resolvedImdb) {
      imdbId = String(resolvedImdb);
      console.log("[catalog-sync:title] resolved imdbId from TMDb:", imdbId);
    } else {
      console.log("[catalog-sync:title] no imdbId available from TMDb details");
    }
  }

  const tmdbBlock = buildTmdbBlock(tmdbDetails, tmdbMediaType);

  // ---------------------------------------------------------------------------
  // OMDb enrichment (optional)
  // ---------------------------------------------------------------------------

  let omdbBlock: OmdbBlock | null = null;
  if ((options?.syncOmdb ?? true) && OMDB_API_KEY && imdbId) {
    omdbBlock = await fetchOmdbBlock(imdbId);
    if (!omdbBlock) {
      console.warn("[catalog-sync:title] OMDb fetch returned null");
    }
  }

  // ---------------------------------------------------------------------------
  // Canonical fields (OMDb → TMDb → null)
  // ---------------------------------------------------------------------------

  const canonical = buildCanonicalBlock(tmdbBlock, omdbBlock, {
    contentType,
  });

  const baseRow = {
    title_id: titleId,
    content_type: contentType,
    ...tmdbBlock,
    ...omdbBlock,
    ...canonical,
    deleted_at: null,
  };

  // ---------------------------------------------------------------------------
  // Upsert into public.titles
  // ---------------------------------------------------------------------------

  let mutationError: any = null;
  let finalTitleId: string = titleId;

  if (existing) {
    const { error } = await supabase
      .from("titles")
      .update(baseRow)
      .eq("title_id", titleId);
    mutationError = error;
  } else {
    const { error } = await supabase.from("titles").insert(baseRow);
    mutationError = error;
  }

  // Duplicate tmdb_id → update existing row
  if (mutationError && mutationError.code === "23505" && tmdbId) {
    console.warn(
      "[catalog-sync:title] duplicate tmdb_id; attempting update existing row",
    );
    const { data, error: lookupError } = await supabase
      .from("titles")
      .select("title_id")
      .eq("tmdb_id", tmdbId)
      .limit(1)
      .maybeSingle();

    if (lookupError) {
      console.error(
        "[catalog-sync:title] lookup existing by tmdb_id failed",
        lookupError,
      );
      return jsonError("Failed to sync title", 500);
    }

    if (!data?.title_id) {
      console.error(
        "[catalog-sync:title] duplicate tmdb_id but no existing row found",
      );
      return jsonError("Failed to sync title", 500);
    }

    finalTitleId = data.title_id;

    const { error: updateExistingError } = await supabase
      .from("titles")
      .update(baseRow)
      .eq("title_id", finalTitleId);

    if (updateExistingError) {
      console.error(
        "[catalog-sync:title] update existing row by tmdb_id failed",
        updateExistingError,
      );
      return jsonError("Failed to sync title", 500);
    }
  } else if (mutationError) {
    console.error("[catalog-sync:title] upsert error", mutationError);
    return jsonError("Failed to sync title", 500);
  }

  // Ensure detail tables (movies/series) exist
  if (finalTitleId && contentType) {
    try {
      if (contentType === "movie") {
        await supabase.from("movies").upsert(
          { title_id: finalTitleId },
          { onConflict: "title_id" },
        );
      } else if (contentType === "series") {
        await supabase.from("series").upsert(
          { title_id: finalTitleId },
          { onConflict: "title_id" },
        );
      }
    } catch (err) {
      console.warn("[catalog-sync:title] upsertDetailTables error:", err);
    }
  }

  return jsonResponse({
    ok: true,
    mode: "title",
    title_id: finalTitleId,
    tmdb_id: tmdbId,
    imdb_id: imdbId,
    content_type: contentType,
  });
}

// -----------------------------------------------------------------------------
// TMDb helpers
// -----------------------------------------------------------------------------

async function tmdbRequest(
  path: string,
  params?: Record<string, string>,
): Promise<any | null> {
  if (!TMDB_API_READ_ACCESS_TOKEN) {
    console.error(
      "[TMDb] TMDB_API_READ_ACCESS_TOKEN is not set; cannot fetch from TMDb",
    );
    return null;
  }

  const url = new URL(TMDB_BASE + path);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${TMDB_API_READ_ACCESS_TOKEN}`,
    },
  });

  if (!res.ok) {
    console.error("[TMDb] request failed", res.status, await res.text());
    return null;
  }

  return await res.json();
}

async function tmdbFindByImdb(imdbId: string): Promise<any | null> {
  const normalized = normalizeImdbId(imdbId);
  if (!normalized) {
    console.warn("[TMDb] invalid IMDb ID for /find", imdbId);
    return null;
  }

  const data = await tmdbRequest(`/find/${normalized}`, {
    external_source: "imdb_id",
  });

  if (!data) return null;

  const movie = Array.isArray(data.movie_results)
    ? data.movie_results[0]
    : null;
  const tv = Array.isArray(data.tv_results) ? data.tv_results[0] : null;

  if (movie?.id) {
    return { ...movie, media_type: "movie" };
  }
  if (tv?.id) {
    return { ...tv, media_type: "tv" };
  }

  return null;
}

async function tmdbGetDetails(
  tmdbId: number,
  type: "movie" | "tv",
): Promise<any | null> {
  const path = type === "tv" ? `/tv/${tmdbId}` : `/movie/${tmdbId}`;
  // external_ids is needed for TV IMDb IDs
  return await tmdbRequest(path, {
    append_to_response: "credits,release_dates,external_ids",
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

  const genreIds: number[] =
    Array.isArray(details.genres) && details.genres.length
      ? details.genres
        .map((g: any) => (typeof g.id === "number" ? g.id : null))
        .filter((x: any) => x !== null)
      : [];

  const runtimeMinutes =
    typeof details.runtime === "number" && details.runtime > 0
      ? details.runtime
      : Array.isArray(details.episode_run_time) &&
        typeof details.episode_run_time[0] === "number"
        ? details.episode_run_time[0]
        : null;

  const releaseDate =
    typeof details.release_date === "string"
      ? details.release_date
      : typeof details.first_air_date === "string"
        ? details.first_air_date
        : null;

  const releaseYear =
    releaseDate && releaseDate.length >= 4
      ? parseIntSafe(releaseDate.slice(0, 4))
      : null;

  const voteAverage =
    typeof details.vote_average === "number" ? details.vote_average : null;
  const voteCount =
    typeof details.vote_count === "number" ? details.vote_count : null;

  const tmdbPopularity =
    typeof details.popularity === "number" ? details.popularity : null;

  // Some useful movie/TV-specific fields
  const title = type === "tv" ? details.name : details.title;
  const originalTitle =
    type === "tv" ? details.original_name : details.original_title;

  const productionCountries = Array.isArray(details.production_countries)
    ? details.production_countries
      .map((c: any) => (typeof c.iso_3166_1 === "string" ? c.iso_3166_1 : null))
      .filter((c: any) => c !== null)
    : [];

  const spokenLanguages = Array.isArray(details.spoken_languages)
    ? details.spoken_languages
      .map((l: any) => (typeof l.iso_639_1 === "string" ? l.iso_639_1 : null))
      .filter((c: any) => c !== null)
    : [];

  return {
    tmdb_id: details.id ?? null,
    tmdb_title: title ?? null,
    tmdb_original_title: originalTitle ?? null,
    tmdb_overview: details.overview ?? null,
    tmdb_poster_path: posterPath,
    tmdb_backdrop_path: backdropPath,
    tmdb_genre_ids: genreIds.length ? genreIds : null,
    tmdb_genre_names: genresArray.length ? genresArray : null,
    tmdb_release_date: details.release_date ?? null,
    tmdb_first_air_date: details.first_air_date ?? null,
    tmdb_vote_average: voteAverage,
    tmdb_vote_count: voteCount,
    tmdb_popularity: tmdbPopularity,
    tmdb_adult: details.adult ?? null,
    tmdb_original_language: details.original_language ?? null,
    tmdb_media_type: type,
    tmdb_runtime: runtimeMinutes,
    tmdb_episode_run_time: Array.isArray(details.episode_run_time) ? details.episode_run_time : null,
    tmdb_genre_names: genresArray.length ? genresArray : null,

    tmdb_raw: details,
  };
}

// -----------------------------------------------------------------------------
// OMDb helpers
// -----------------------------------------------------------------------------

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

  if (!data || data.Response === "False") {
    console.warn("[OMDb] Response was False or missing", data);
    return null;
  }

  const imdbRating = parseFloatSafe(data.imdbRating);
  const imdbVotes =
    typeof data.imdbVotes === "string"
      ? parseIntSafe(data.imdbVotes.replace(/,/g, ""))
      : null;
  const metascore = parseIntSafe(data.Metascore);

  const runtimeMinutes = parseIntSafe(
    typeof data.Runtime === "string" ? data.Runtime.replace(" min", "") : "",
  );

  const genresArray: string[] =
    typeof data.Genre === "string" && data.Genre.length
      ? data.Genre.split(",").map((g: string) => g.trim())
      : [];

  const boxOfficeNumeric = parseCurrency(data.BoxOffice);

  const rtPct = extractRottenTomatoesPct(data.Ratings);

  return {
    omdb_imdb_id: data.imdbID ?? imdbId,
    omdb_title: data.Title ?? null,
    omdb_year: parseIntSafe(
      typeof data.Year === "string" ? data.Year.split(/–/)[0] : data.Year,
    ),

    omdb_rated: nullIfEmpty(data.Rated),
    omdb_released: nullIfEmpty(data.Released),
    omdb_runtime: nullIfEmpty(data.Runtime),
    omdb_runtime_minutes: runtimeMinutes,
    omdb_genre: nullIfEmpty(data.Genre),
    omdb_genre_names: genresArray,
    omdb_director: nullIfEmpty(data.Director),
    omdb_writer: nullIfEmpty(data.Writer),
    omdb_actors: nullIfEmpty(data.Actors),
    omdb_plot: nullIfEmpty(data.Plot),
    omdb_language: nullIfEmpty(data.Language),
    omdb_country: nullIfEmpty(data.Country),
    omdb_awards: nullIfEmpty(data.Awards),
    omdb_poster: nullIfEmpty(data.Poster),
    omdb_poster_url:
      data.Poster && data.Poster !== "N/A" ? data.Poster : null,
    omdb_type: nullIfEmpty(data.Type),
    omdb_dvd: nullIfEmpty(data.DVD),
    omdb_box_office_str: nullIfEmpty(data.BoxOffice),
    omdb_box_office: boxOfficeNumeric,
    omdb_production: nullIfEmpty(data.Production),
    omdb_website: nullIfEmpty(data.Website),
    omdb_response: nullIfEmpty(data.Response),
    omdb_response_ok: data.Response === "True",

    omdb_imdb_rating: imdbRating,
    omdb_imdb_votes: imdbVotes,
    omdb_rt_rating_pct: rtPct,
    omdb_metacritic_score: metascore,

    omdb_raw: data,
  };
}

function extractRottenTomatoesPct(ratings: any): number | null {
  if (!Array.isArray(ratings)) return null;

  const rt = ratings.find((r: any) => r.Source === "Rotten Tomatoes");
  if (!rt || typeof rt.Value !== "string") return null;

  const match = rt.Value.match(/^(\d+)%$/);
  if (!match) return null;

  const pct = parseIntSafe(match[1]);
  return pct ?? null;
}

// -----------------------------------------------------------------------------
// Canonical block builder (OMDb → TMDb → null)
// -----------------------------------------------------------------------------

function buildCanonicalBlock(
  tmdb: TmdbBlock,
  omdb: OmdbBlock | null,
  options: { contentType: "movie" | "series" | null },
) {
  const contentType = options.contentType;

  const tmdbTitle = tmdb.tmdb_title ?? null;
  const tmdbOriginalTitle = tmdb.tmdb_original_title ?? null;
  const tmdbReleaseDate =
    tmdb.tmdb_release_date ?? tmdb.tmdb_first_air_date ?? null;
  const tmdbReleaseYear =
    tmdbReleaseDate && tmdbReleaseDate.length >= 4
      ? parseIntSafe(tmdbReleaseDate.slice(0, 4))
      : null;

  const tmdbGenres =
    Array.isArray(tmdb.tmdb_genre_names) && tmdb.tmdb_genre_names.length
      ? tmdb.tmdb_genre_names
      : null;

  const tmdbRuntimeMinutes = tmdb.tmdb_runtime ?? null;
  const tmdbPosterUrl = buildTmdbImageUrl(tmdb.tmdb_poster_path, "w500");
  const tmdbBackdropUrl = buildTmdbImageUrl(tmdb.tmdb_backdrop_path, "w780");

  const omdbTitle = omdb?.omdb_title ?? null;
  const omdbYear = omdb?.omdb_year ?? null;
  const omdbGenres =
    Array.isArray(omdb?.omdb_genre_names) && omdb.omdb_genre_names.length
      ? omdb.omdb_genre_names
      : null;
  const omdbRuntimeMinutes = omdb?.omdb_runtime_minutes ?? null;
  const omdbPosterUrl = omdb?.omdb_poster_url ?? null;
  const omdbPlot = omdb?.omdb_plot ?? null;

  const primaryTitle = omdbTitle ?? tmdbTitle ?? null;
  const originalTitle =
    tmdbOriginalTitle ??
    tmdbTitle ??
    omdbTitle ??
    null;

  const releaseYear = omdbYear ?? tmdbReleaseYear ?? null;

  const runtimeMinutes =
    omdbRuntimeMinutes ??
    tmdbRuntimeMinutes ??
    null;

  const genres =
    omdbGenres ??
    tmdbGenres ??
    null;

  const posterUrl = omdbPosterUrl ?? tmdbPosterUrl ?? null;
  const backdropUrl = tmdbBackdropUrl ?? null;

  const imdbRating =
    omdb?.omdb_imdb_rating ?? null;

  const sortTitle = buildSortTitle(primaryTitle);

  const plot =
    omdbPlot ??
    tmdb.tmdb_overview ??
    null;

  return {
    primary_title: primaryTitle,
    original_title: originalTitle,
    sort_title: sortTitle,
    release_year: releaseYear,
    runtime_minutes: runtimeMinutes,
    poster_url: posterUrl,
    backdrop_url: backdropUrl,
    imdb_rating: imdbRating,
    rt_tomato_pct: omdb?.omdb_rt_rating_pct ?? null,
    genres,
    plot,
  };
}

function buildTmdbImageUrl(path: string | null | undefined, size: string) {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

function buildSortTitle(title: string | null): string | null {
  if (!title) return null;
  const lower = title.toLowerCase().trim();
  if (lower.startsWith("the ")) return lower.slice(4);
  if (lower.startsWith("a ")) return lower.slice(2);
  if (lower.startsWith("an ")) return lower.slice(3);
  return lower;
}

// -----------------------------------------------------------------------------
// Small utils
// -----------------------------------------------------------------------------

function parseIntSafe(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = parseInt(String(value), 10);
  return Number.isFinite(n) ? n : null;
}

function parseFloatSafe(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

function parseCurrency(value: any): number | null {
  if (!value || value === "N/A") return null;
  const s = String(value).replace(/[^0-9.]/g, "");
  if (!s) return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function normalizeImdbId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!/^tt\d+$/.test(trimmed)) return null;
  return trimmed;
}

function nullIfEmpty(value: any): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}
