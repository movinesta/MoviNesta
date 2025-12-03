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
} from "../_shared/http.ts";
import { getAdminClient } from "../_shared/supabase.ts";

const TMDB_TOKEN = Deno.env.get("TMDB_API_READ_ACCESS_TOKEN") ?? "";
const OMDB_API_KEY = Deno.env.get("OMDB_API_KEY") ?? "";

const TMDB_BASE = "https://api.themoviedb.org/3";
const OMDB_BASE = "https://www.omdbapi.com/";

type TitleModePayload = {
  external?: {
    tmdbId?: number;
    imdbId?: string;
    // TMDb media_type
    type?: "movie" | "tv";
  };
  options?: {
    syncOmdb?: boolean;
    forceRefresh?: boolean;
  };
  // flat fields allowed as fallback
  tmdbId?: number;
  imdbId?: string;
  type?: "movie" | "tv";
};

serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  if (req.method !== "POST") {
    return jsonError("Method not allowed", 405);
  }

  let body: TitleModePayload;
  try {
    body = (await req.json()) as TitleModePayload;
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  let supabase;
  try {
    supabase = getAdminClient(req);
  } catch (error) {
    console.error("[catalog-sync] Supabase configuration error", error);
    return jsonError("Server misconfigured", 500);
  }

  try {
    return await handleTitleMode(supabase, body);
  } catch (err) {
    console.error("[catalog-sync] unhandled error:", err);
    return jsonError("Internal server error", 500);
  }
});

// ============================================================================
// Main handler
// ============================================================================

async function handleTitleMode(
  supabase: ReturnType<typeof getAdminClient>,
  payload: TitleModePayload,
): Promise<Response> {
  if (!TMDB_TOKEN) {
    console.error("[catalog-sync:title] Missing TMDB_API_READ_ACCESS_TOKEN");
    return jsonError("TMDb not configured", 500);
  }

  const external = payload.external ?? {
    tmdbId: payload.tmdbId,
    imdbId: payload.imdbId,
    type: payload.type,
  };
  const options = payload.options;

  const { tmdbId: tmdbIdRaw, imdbId: imdbIdRaw, type: typeRaw } = external ?? {};

  if (!tmdbIdRaw && !imdbIdRaw) {
    return jsonError(
      "Either external.tmdbId or external.imdbId is required",
      400,
    );
  }

  let tmdbMediaType: "movie" | "tv" = typeRaw ?? "movie";
  let tmdbId: number | null = tmdbIdRaw ?? null;
  const rawImdbId: string | null = imdbIdRaw ?? null;
  let imdbId: string | null = normalizeImdbId(rawImdbId);

  // If only IMDb ID is provided, resolve TMDb via /find
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

  // --- TMDb details ---
  const tmdbDetails = await tmdbGetDetails(tmdbId, tmdbMediaType);
  if (!tmdbDetails) {
    return jsonError("TMDb details fetch failed", 502);
  }

  // Resolve IMDb ID from TMDb, including external_ids for TV
  if (!imdbId) {
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

  // --- OMDb ---
  let omdbBlock: OmdbBlock | null = null;
  if ((options?.syncOmdb ?? true) && OMDB_API_KEY && imdbId) {
    omdbBlock = await fetchOmdbBlock(imdbId);
  } else if ((options?.syncOmdb ?? true) && OMDB_API_KEY && rawImdbId && !imdbId) {
    console.warn(
      "[catalog-sync:title] Skipping OMDb sync due to invalid IMDb ID format:",
      rawImdbId,
    );
  }

  // Map TMDb media_type -> DB enum content_type ("movie" | "series")
  const dbContentType: "movie" | "series" =
    tmdbMediaType === "movie" ? "movie" : "series";

  // Existing row?
  const { data: existing, error: existingError } = await supabase
    .from("titles")
    .select(
      "title_id, tmdb_id, omdb_imdb_id, omdb_last_synced_at, last_synced_at",
    )
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
    console.error(
      "[catalog-sync:title] select existing error:",
      existingError.message,
    );
    return jsonError("Database error", 500);
  }

  // Skip fresh rows unless forceRefresh
  if (existing && !options?.forceRefresh) {
    const lastSyncedRaw = (existing as any).last_synced_at as
      | string
      | null
      | undefined;
    if (lastSyncedRaw) {
      const lastSyncedTime = Date.parse(lastSyncedRaw);
      if (!Number.isNaN(lastSyncedTime)) {
        const nowMs = Date.now();
        const ageMs = nowMs - lastSyncedTime;
        const twentyFourHoursMs = 24 * 60 * 60 * 1000;
        if (ageMs >= 0 && ageMs < twentyFourHoursMs) {
          console.log(
            "[catalog-sync:title] skipping refresh for",
            (existing as any).title_id,
            "last_synced_at=",
            lastSyncedRaw,
          );
          return jsonOk(
            {
              ok: true,
              titleId: (existing as any).title_id,
              tmdbId,
              imdbId,
              skipped: true,
              reason: "recently_synced",
            },
            200,
          );
        }
      }
    }
  }

  const now = new Date().toISOString();
  const titleId = existing?.title_id ?? crypto.randomUUID();

  // Canonical fields (OMDb → TMDb)
  const normalized = buildNormalizedFields({
    mediaType: tmdbMediaType,
    tmdb: tmdbBlock,
    omdb: omdbBlock,
  });

  const baseRow: Record<string, any> = {
    title_id: titleId,
    content_type: dbContentType,

    // canonical
    ...normalized,

    // provider-specific
    ...tmdbBlock,
    ...omdbBlock,

    // bookkeeping
    tmdb_last_synced_at: now,
    omdb_last_synced_at: omdbBlock
      ? now
      : existing?.omdb_last_synced_at ?? null,
    last_synced_at: now,
    updated_at: now,

    data_source: omdbBlock ? "omdb" : "tmdb",
    source_priority: omdbBlock ? 1 : 2,
    raw_payload: {
      tmdb: tmdbBlock.tmdb_raw ?? null,
      omdb: omdbBlock?.omdb_raw ?? null,
    },
  };

  async function upsertDetailTables(
    supabase: ReturnType<typeof getSupabaseAdminClient>,
    contentType: "movie" | "series",
    titleId: string,
  ): Promise<void> {
    try {
      if (contentType === "movie") {
        await supabase.from("movies").upsert(
          { title_id: titleId },
          { onConflict: "title_id" },
        );
      } else if (contentType === "series") {
        await supabase.from("series").upsert(
          { title_id: titleId },
          { onConflict: "title_id" },
        );
      }
    } catch (err) {
      console.warn("[catalog-sync:title] upsertDetailTables error:", err);
    }
  }

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
  if (mutationError) {
    const code = (mutationError as any).code;
    const msg = (mutationError as any).message ?? "";

    if (code === "23505" && msg.includes("titles_tmdb_id_key") &&
      tmdbBlock.tmdb_id != null) {
      console.warn(
        "[catalog-sync:title] duplicate tmdb_id detected, updating existing row instead",
      );

      const { data: conflictRow, error: conflictSelectError } = await supabase
        .from("titles")
        .select("title_id")
        .eq("tmdb_id", tmdbBlock.tmdb_id)
        .maybeSingle();

      if (!conflictSelectError && conflictRow?.title_id) {
        finalTitleId = conflictRow.title_id;

        const { error: updateError } = await supabase
          .from("titles")
          .update({
            ...baseRow,
            title_id: conflictRow.title_id,
          })
          .eq("title_id", conflictRow.title_id);

        if (!updateError) {
          await upsertDetailTables(supabase, dbContentType, conflictRow.title_id);

          return jsonOk(
            {
              ok: true,
              titleId: conflictRow.title_id,
              tmdbId,
              imdbId,
            },
            200,
          );
        }

        console.error(
          "[catalog-sync:title] conflict update error:",
          updateError.message,
        );
        return jsonError("Failed to update existing title", 500);
      }

      console.error(
        "[catalog-sync:title] conflict select error:",
        conflictSelectError?.message,
      );
      return jsonError("Failed to resolve duplicate tmdb_id", 500);
    }

    console.error("[catalog-sync:title] mutation error:", mutationError.message);
    return jsonError("Failed to upsert title", 500);
  }

  await upsertDetailTables(supabase, dbContentType, finalTitleId);

  return jsonOk(
    {
      ok: true,
      titleId: finalTitleId,
      tmdbId,
      imdbId,
    },
    200,
  );
}

// ============================================================================
// TMDb helpers → tmdb_*
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

  const releaseDate = safeDateOrNull(details.release_date);
  const firstAirDate = safeDateOrNull(details.first_air_date);

  return {
    tmdb_id: details.id ?? null,
    tmdb_media_type: type,
    tmdb_adult: details.adult ?? null,
    tmdb_video: details.video ?? null,
    tmdb_genre_ids: genreIds.length ? genreIds : null,
    tmdb_original_language: details.original_language ?? null,
    tmdb_original_title:
      details.original_title ?? details.original_name ?? null,
    tmdb_title: details.title ?? details.name ?? null,
    tmdb_overview: details.overview ?? null,
    tmdb_popularity: details.popularity ?? null,
    tmdb_vote_average: details.vote_average ?? null,
    tmdb_vote_count: details.vote_count ?? null,
    tmdb_release_date: releaseDate,
    tmdb_first_air_date: firstAirDate,
    tmdb_runtime: details.runtime ?? null,
    tmdb_episode_run_time: details.episode_run_time ?? null,
    tmdb_poster_path: posterPath,
    tmdb_backdrop_path: backdropPath,
    tmdb_genre_names: genresArray,
    tmdb_raw: details,
  };
}

// ============================================================================
// OMDb helpers → omdb_*
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
    console.warn("[OMDb] Response false for imdbId", imdbId, ":", data.Error);
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

  const boxOfficeNumeric = parseCurrency(data.BoxOffice);

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
  const rt = ratings.find(
    (r: any) => r.Source === "Rotten Tomatoes" && typeof r.Value === "string",
  );
  if (!rt) return null;
  const match = (rt.Value as string).match(/(\d+)%/);
  return match ? parseIntSafe(match[1]) : null;
}

// ============================================================================
// Canonical columns: OMDb → TMDb → null
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
  const tmdbRaw = tmdb.tmdb_raw ?? {};

  const primary_title =
    omdb?.omdb_title ??
    tmdb.tmdb_title ??
    tmdb.tmdb_original_title ??
    null;

  const original_title =
    tmdb.tmdb_original_title ??
    omdb?.omdb_title ??
    null;

  const sort_title = primary_title ? buildSortTitle(primary_title) : null;

  const omdbReleaseIso = omdb?.omdb_released
    ? parseOmdbDateToISO(omdb.omdb_released)
    : null;

  const release_date =
    omdbReleaseIso ??
    tmdb.tmdb_release_date ??
    (mediaType === "tv" ? tmdb.tmdb_first_air_date : null) ??
    null;

  const release_year =
    omdb?.omdb_year ??
    extractYear(
      release_date ??
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

  const plot =
    omdb?.omdb_plot ??
    tmdb.tmdb_overview ??
    null;

  const tagline = tmdbRaw?.tagline ?? null;

  const poster_url =
    omdb?.omdb_poster_url ??
    (tmdb.tmdb_poster_path
      ? `https://image.tmdb.org/t/p/w500${tmdb.tmdb_poster_path}`
      : null);

  const backdrop_url =
    tmdb.tmdb_backdrop_path
      ? `https://image.tmdb.org/t/p/w780${tmdb.tmdb_backdrop_path}`
      : null;

  const tmdbSpoken =
    Array.isArray(tmdbRaw.spoken_languages) ? tmdbRaw.spoken_languages : [];
  const tmdbLangName =
    tmdbSpoken.length > 0
      ? tmdbSpoken[0].english_name ?? tmdbSpoken[0].name ?? null
      : null;

  const tmdbCountries =
    Array.isArray(tmdbRaw.production_countries)
      ? tmdbRaw.production_countries
      : [];
  const tmdbCountryName =
    tmdbCountries.length > 0
      ? tmdbCountries[0].name ?? tmdbCountries[0].iso_3166_1 ?? null
      : null;

  const language =
    (omdb?.omdb_language
      ? omdb.omdb_language.split(",")[0].trim()
      : null) ??
    tmdbLangName ??
    tmdb.tmdb_original_language ??
    null;

  const country =
    (omdb?.omdb_country
      ? omdb.omdb_country.split(",")[0].trim()
      : null) ??
    tmdbCountryName ??
    null;

  const imdb_rating =
    omdb?.omdb_imdb_rating ??
    (typeof tmdb.tmdb_vote_average === "number"
      ? Math.round(tmdb.tmdb_vote_average * 10) / 10
      : null);

  const imdb_votes =
    omdb?.omdb_imdb_votes ??
    (typeof tmdb.tmdb_vote_count === "number"
      ? tmdb.tmdb_vote_count
      : null);

  const rt_tomato_pct =
    omdb?.omdb_rt_rating_pct ??
    null;

  const metascore =
    omdb?.omdb_metacritic_score ??
    null;

  const genresSet = new Set<string>();
  if (Array.isArray(omdb?.omdb_genre_names)) {
    for (const g of omdb!.omdb_genre_names) {
      if (g) genresSet.add(g);
    }
  }
  if (Array.isArray(tmdb.tmdb_genre_names)) {
    for (const g of tmdb.tmdb_genre_names) {
      if (g) genresSet.add(g);
    }
  }
  const genres = genresSet.size ? Array.from(genresSet) : null;

  const is_adult = tmdb.tmdb_adult ?? false;

  return {
    primary_title,
    original_title,
    sort_title,
    release_year,
    release_date,
    runtime_minutes,
    is_adult,
    plot,
    tagline,
    poster_url,
    backdrop_url,
    genres,
    language,
    country,
    imdb_rating,
    imdb_votes,
    rt_tomato_pct,
    metascore,
  };
}

// ============================================================================
// Helpers
// ============================================================================

function safeDateOrNull(value: any): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  return trimmed;
}

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

function nullIfEmpty(value: any): string | null {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  if (!s || s === "N/A") return null;
  return s;
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

function parseOmdbDateToISO(value: string): string | null {
  const v = value?.trim();
  if (!v || v === "N/A") return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildSortTitle(title: string): string {
  const lower = title.trim().toLowerCase();
  const articles = ["the ", "a ", "an "];
  for (const art of articles) {
    if (lower.startsWith(art)) {
      return lower.slice(art.length);
    }
  }
  return lower;
}

function jsonOk(body: unknown, status: number): Response {
  return jsonResponse(body, status);
}
