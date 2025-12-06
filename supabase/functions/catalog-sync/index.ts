// supabase/functions/catalog-sync/index.ts
//
// Universal seeding function for `public.titles`.
//
// - Fetches and merges data from TMDb and OMDb.
// - Populates tmdb_*, omdb_*, and canonical columns.
// - Handles movies and series.
// - Upserts the final record into `public.titles`.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

import { handleOptions, jsonError, jsonResponse, validateRequest } from "../_shared/http.ts";
import { log } from "../_shared/logger.ts";
import { getAdminClient } from "../_shared/supabase.ts";
import type { Database } from "../../../src/types/supabase.ts";

const FN_NAME = "catalog-sync";

// Environment variables
const TMDB_API_READ_ACCESS_TOKEN = Deno.env.get("TMDB_API_READ_ACCESS_TOKEN") ?? "";
const OMDB_API_KEY = Deno.env.get("OMDB_API_KEY") ?? "";
const TMDB_BASE = "https://api.themoviedb.org/3";
const OMDB_BASE = "https://www.omdbapi.com/";

// Type definitions
type Title = Database["public"]["Tables"]["titles"]["Row"];
type TitleInsert = Database["public"]["Tables"]["titles"]["Insert"];
type ContentType = "movie" | "series";
type TmdbMediaType = "movie" | "tv";

interface SyncRequest {
  tmdbId?: number | null;
  imdbId?: string | null;
  contentType?: ContentType | null;
  options?: {
    syncOmdb?: boolean;
    forceRefresh?: boolean;
  };
}

// ============================================================================
// Main request handler
// ============================================================================

serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  if (req.method !== "POST") {
    return jsonError("Method not allowed", 405);
  }

  const { data, errorResponse } = await validateRequest<SyncRequest>(req, parseRequestBody, {
    logPrefix: `[${FN_NAME}]`,
  });
  if (errorResponse) return errorResponse;

  return await handleTitleSync(req, data);
});

function parseRequestBody(body: unknown): SyncRequest {
  if (typeof body !== "object" || body === null) {
    throw new Error("Request body must be an object");
  }

  const { tmdbId, imdbId, contentType, options } = body as Record<string, unknown>;

  if (tmdbId !== undefined && (typeof tmdbId !== "number" || !Number.isInteger(tmdbId))) {
    throw new Error("Invalid 'tmdbId': must be an integer");
  }
  if (imdbId !== undefined && (typeof imdbId !== "string" || !/^tt\d+$/.test(imdbId))) {
    throw new Error("Invalid 'imdbId': must be a valid IMDb ID string (e.g., 'tt0123456')");
  }
  if (
    contentType !== undefined &&
    contentType !== null &&
    !["movie", "series"].includes(contentType as string)
  ) {
    throw new Error("Invalid 'contentType': must be 'movie' or 'series'");
  }
  if (!tmdbId && !imdbId) {
    throw new Error("Either 'tmdbId' or 'imdbId' must be provided");
  }

  return {
    tmdbId: tmdbId ?? null,
    imdbId: imdbId ?? null,
    contentType: contentType as ContentType | null,
    options: options as SyncRequest["options"],
  };
}

// ============================================================================
// Title sync logic
// ============================================================================

async function handleTitleSync(req: Request, body: SyncRequest): Promise<Response> {
  const supabase = getAdminClient();
  const logCtx = { fn: FN_NAME, tmdbId: body.tmdbId, imdbId: body.imdbId };

  log(logCtx, "Starting title sync", { body });

  // 1. Resolve IDs
  const ids = await resolveIds(body.tmdbId, body.imdbId, body.contentType);
  if (!ids.tmdbId && !ids.imdbId) {
    log(logCtx, "Could not resolve any valid external ID");
    return jsonError("Could not resolve external ID", 404, "ID_NOT_FOUND");
  }
  log(logCtx, "Resolved IDs", ids);

  // 2. Find existing title
  const existingTitle = await findExistingTitle(supabase, ids.tmdbId, ids.imdbId);
  const titleId = existingTitle?.title_id ?? crypto.randomUUID();
  log(logCtx, existingTitle ? "Found existing title" : "Creating new title", { titleId });

  // 3. Fetch data from external APIs
  const tmdbDetails = ids.tmdbId ? await tmdbGetDetails(ids.tmdbId, ids.tmdbMediaType) : null;
  const finalImdbId = ids.imdbId ?? tmdbDetails?.imdb_id ?? tmdbDetails?.external_ids?.imdb_id ?? null;
  const omdbDetails = finalImdbId && (body.options?.syncOmdb ?? true)
    ? await omdbGetDetails(finalImdbId)
    : null;

  // 4. Build the final database row
  const titleRow = buildTitleRow({
    titleId,
    contentType: ids.contentType,
    tmdb: tmdbDetails,
    omdb: omdbDetails,
  });

  // 5. Upsert to database
  const { data: finalTitle, error } = await upsertTitle(supabase, titleId, titleRow, !!existingTitle);
  if (error) {
    log(logCtx, "Upsert failed", { error: error.message });
    return jsonError("Failed to sync title", 500, "DATABASE_ERROR");
  }

  // 6. Ensure detail tables exist
  await ensureDetailTables(supabase, finalTitle.title_id, ids.contentType);

  log(logCtx, "Sync successful", { titleId: finalTitle.title_id });
  return jsonResponse({
    ok: true,
    title_id: finalTitle.title_id,
    tmdb_id: ids.tmdbId,
    imdb_id: finalImdbId,
    content_type: ids.contentType,
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

async function resolveIds(tmdbId: number | null, imdbId: string | null, contentType: ContentType | null) {
  let finalTmdbId = tmdbId;
  let finalImdbId = imdbId;
  let tmdbMediaType: TmdbMediaType = contentType === "series" ? "tv" : "movie";

  if (!finalTmdbId && finalImdbId) {
    const resolved = await tmdbFindByImdb(finalImdbId);
    if (resolved) {
      finalTmdbId = resolved.id;
      tmdbMediaType = resolved.media_type;
    }
  }

  const finalContentType = tmdbMediaType === "tv" ? "series" : "movie";

  return {
    tmdbId: finalTmdbId,
    imdbId: finalImdbId,
    tmdbMediaType,
    contentType: finalContentType,
  };
}

async function findExistingTitle(
  supabase: SupabaseClient<Database>,
  tmdbId: number | null,
  imdbId: string | null,
): Promise<Title | null> {
  if (!tmdbId && !imdbId) return null;

  const query = supabase.from("titles").select("*");
  if (tmdbId) {
    query.eq("tmdb_id", tmdbId);
  } else if (imdbId) {
    query.eq("omdb_imdb_id", imdbId);
  }

  const { data, error } = await query.limit(1).maybeSingle();
  if (error) {
    log({ fn: FN_NAME }, "Error finding existing title", { error: error.message });
    return null;
  }
  return data;
}

async function upsertTitle(
  supabase: SupabaseClient<Database>,
  titleId: string,
  row: TitleInsert,
  isUpdate: boolean,
) {
  const query = isUpdate
    ? supabase.from("titles").update(row).eq("title_id", titleId)
    : supabase.from("titles").insert(row);

  let { data, error } = await query.select().single();

  // Handle race condition where another sync inserted the same tmdb_id
  if (error && error.code === "23505" && row.tmdb_id && !isUpdate) {
    log({ fn: FN_NAME }, "Duplicate tmdb_id on insert, retrying as update", { tmdbId: row.tmdb_id });
    const existing = await findExistingTitle(supabase, row.tmdb_id, null);
    if (existing) {
      return await supabase.from("titles")
        .update(row)
        .eq("title_id", existing.title_id)
        .select()
        .single();
    }
  }

  return { data, error };
}

async function ensureDetailTables(supabase: SupabaseClient<Database>, titleId: string, contentType: ContentType) {
  const table = contentType === "movie" ? "movies" : "series";
  const { error } = await supabase.from(table).upsert({ title_id: titleId }, { onConflict: "title_id" });
  if (error) {
    log({ fn: FN_NAME }, `Failed to upsert into ${table}`, { titleId, error: error.message });
  }
}

// ============================================================================
// Data Transformation
// ============================================================================

function buildTitleRow(args: {
  titleId: string;
  contentType: ContentType;
  tmdb: any | null;
  omdb: any | null;
}): TitleInsert {
  const { titleId, contentType, tmdb, omdb } = args;
  const tmdbBlock = buildTmdbBlock(tmdb, contentType);
  const omdbBlock = buildOmdbBlock(omdb);

  // Canonical fields (OMDb -> TMDb -> null)
  const primaryTitle = tmdb?.title ?? tmdb?.name ?? omdb?.Title ?? null;

  return {
    title_id: titleId,
    content_type: contentType,
    ...tmdbBlock,
    ...omdbBlock,
    // Canonical fields
    primary_title: primaryTitle,
    original_title: tmdb?.original_title ?? tmdb?.original_name ?? omdb?.Title ?? null,
    sort_title: buildSortTitle(primaryTitle),
    release_date: tmdb?.release_date ?? tmdb?.first_air_date ?? null,
    release_year: parseIntSafe(
      (tmdb?.release_date ?? tmdb?.first_air_date ?? "0").substring(0, 4),
    ),
    runtime_minutes: parseIntSafe(omdb?.Runtime) ?? tmdbBlock.tmdb_runtime ?? null,
    poster_url: omdb?.Poster ?? tmdbBlock.tmdb_poster_url ?? null,
    backdrop_url: tmdbBlock.tmdb_backdrop_url,
    plot: omdb?.Plot ?? tmdb?.overview ?? null,
    tagline: tmdb?.tagline ?? null,
    genres: (omdb?.Genre ?? "").split(", ") ?? tmdbBlock.tmdb_genre_names ?? null,
    language: (omdb?.Language ?? "").split(", ")[0] ?? tmdb?.original_language ?? null,
    country: (omdb?.Country ?? "").split(", ")[0] ?? tmdb?.production_countries?.[0]?.iso_3166_1 ?? null,
    imdb_rating: parseFloatSafe(omdb?.imdbRating),
    imdb_votes: parseIntSafe((omdb?.imdbVotes ?? "").replace(/,/g, "")),
    metascore: parseIntSafe(omdb?.Metascore),
    rt_tomato_pct: extractRottenTomatoesPct(omdb?.Ratings),
    last_synced_at: new Date().toISOString(),
    deleted_at: null,
  };
}

function buildTmdbBlock(tmdb: any, contentType: ContentType) {
  if (!tmdb) return {};
  const isMovie = contentType === "movie";
  return {
    tmdb_id: tmdb.id,
    tmdb_adult: tmdb.adult,
    tmdb_video: tmdb.video,
    tmdb_genre_ids: (tmdb.genres ?? []).map((g: any) => g.id),
    tmdb_original_language: tmdb.original_language,
    tmdb_overview: tmdb.overview,
    tmdb_popularity: tmdb.popularity,
    tmdb_vote_average: tmdb.vote_average,
    tmdb_vote_count: tmdb.vote_count,
    tmdb_release_date: isMovie ? tmdb.release_date : null,
    tmdb_first_air_date: !isMovie ? tmdb.first_air_date : null,
    tmdb_poster_path: tmdb.poster_path,
    tmdb_poster_url: buildTmdbImageUrl(tmdb.poster_path, "w500"),
    tmdb_backdrop_path: tmdb.backdrop_path,
    tmdb_backdrop_url: buildTmdbImageUrl(tmdb.backdrop_path, "w1280"),
    tmdb_runtime: isMovie ? tmdb.runtime : tmdb.episode_run_time?.[0],
    tmdb_genre_names: (tmdb.genres ?? []).map((g: any) => g.name),
    tmdb_last_synced_at: new Date().toISOString(),
    tmdb_raw: tmdb,
  };
}

function buildOmdbBlock(omdb: any) {
  if (!omdb) return {};
  return {
    omdb_imdb_id: omdb.imdbID,
    omdb_rated: omdb.Rated,
    omdb_released: omdb.Released,
    omdb_director: omdb.Director,
    omdb_writer: omdb.Writer,
    omdb_actors: omdb.Actors,
    omdb_language: omdb.Language,
    omdb_country: omdb.Country,
    omdb_awards: omdb.Awards,
    omdb_dvd: omdb.DVD,
    omdb_box_office_str: omdb.BoxOffice,
    omdb_box_office: parseCurrency(omdb.BoxOffice),
    omdb_production: omdb.Production,
    omdb_website: omdb.Website,
    omdb_response_ok: omdb.Response === "True",
    omdb_rt_rating_pct: extractRottenTomatoesPct(omdb.Ratings),
    omdb_last_synced_at: new Date().toISOString(),
    omdb_raw: omdb,
  };
}

// ============================================================================
// External API Fetchers
// ============================================================================

async function tmdbRequest(path: string, params?: Record<string, string>): Promise<any | null> {
  const url = new URL(TMDB_BASE + path);
  if (params) {
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  }

  try {
    const res = await fetch(url.toString(), {
      headers: { accept: "application/json", Authorization: `Bearer ${TMDB_API_READ_ACCESS_TOKEN}` },
    });
    if (!res.ok) {
      log({ fn: FN_NAME }, "TMDb request failed", { status: res.status, path });
      return null;
    }
    return await res.json();
  } catch (error) {
    log({ fn: FN_NAME }, "TMDb fetch error", { error: error.message, path });
    return null;
  }
}

async function tmdbFindByImdb(imdbId: string): Promise<{ id: number; media_type: TmdbMediaType } | null> {
  const data = await tmdbRequest(`/find/${imdbId}`, { external_source: "imdb_id" });
  const result = data?.movie_results?.[0] ?? data?.tv_results?.[0];
  if (!result) return null;
  const media_type = data.movie_results?.[0] ? "movie" : "tv";
  return { id: result.id, media_type };
}

async function tmdbGetDetails(tmdbId: number, type: TmdbMediaType): Promise<any | null> {
  return await tmdbRequest(`/${type}/${tmdbId}`, { append_to_response: "credits,release_dates,external_ids" });
}

async function omdbGetDetails(imdbId: string): Promise<any | null> {
  const url = new URL(OMDB_BASE);
  url.searchParams.set("apikey", OMDB_API_KEY);
  url.searchParams.set("i", imdbId);
  url.searchParams.set("plot", "full");

  try {
    const res = await fetch(url.toString());
    if (!res.ok) {
      log({ fn: FN_NAME }, "OMDb request failed", { status: res.status, imdbId });
      return null;
    }
    const data = await res.json();
    if (data.Response === "False") {
      log({ fn: FN_NAME }, "OMDb API returned an error", { imdbId, error: data.Error });
      return null;
    }
    return data;
  } catch (error) {
    log({ fn: FN_NAME }, "OMDb fetch error", { error: error.message, imdbId });
    return null;
  }
}

// ============================================================================
// Utils
// ============================================================================

const buildSortTitle = (title: string | null): string | null => {
  if (!title) return null;
  const lower = title.toLowerCase().trim();
  return lower.replace(/^(the|a|an)\s+/, "");
};

const buildTmdbImageUrl = (path: string | null, size: string) =>
  path ? `https://image.tmdb.org/t/p/${size}${path}` : null;

const parseIntSafe = (v: any) => (v === null || v === undefined || v === "" || isNaN(parseInt(v, 10))) ? null : parseInt(v, 10);
const parseFloatSafe = (v: any) => (v === null || v === undefined || v === "" || isNaN(parseFloat(v))) ? null : parseFloat(v);
const parseCurrency = (v: any) => v && v !== "N/A" ? parseFloatSafe(String(v).replace(/[^0-9.]/g, "")) : null;

function extractRottenTomatoesPct(ratings: any[]): number | null {
  const rt = ratings?.find((r: any) => r.Source === "Rotten Tomatoes");
  return rt ? parseIntSafe(rt.Value.replace("%", "")) : null;
}
