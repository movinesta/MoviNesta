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
import { getConfig } from "../_shared/config.ts";
import type { Database } from "../../../src/types/supabase.ts";

const FN_NAME = "catalog-sync";

// Environment variables
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
// Main Request Handler
// ============================================================================

export async function handler(req: Request) {
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
}

serve(handler);

// ============================================================================
// Request Body Parsing / Validation
// ============================================================================

function parseRequestBody(body: unknown): SyncRequest {
  if (typeof body !== "object" || body === null) {
    throw new Error("Request body must be an object");
  }

  const raw = body as Record<string, unknown>;
  // If you want to debug what you actually receive, uncomment:
  // console.log(`[${FN_NAME}] incoming body`, raw);

  // Support two shapes:
  // 1) Direct: { tmdbId, imdbId, contentType, options }
  // 2) Nested: { external: { tmdbId, imdbId, type }, options }
  const external = (raw.external ?? null) as Record<string, unknown> | null;

  const tmdbSource =
    (external?.tmdbId ?? external?.tmdb_id) ??
    raw.tmdbId ??
    raw.tmdb_id;

  const imdbSource =
    (external?.imdbId ?? external?.imdb_id) ??
    raw.imdbId ??
    raw.imdb_id;

  const contentTypeSource =
    raw.contentType ??
    raw.content_type ??
    (external?.type === "tv"
      ? "series"
      : external?.type === "movie"
        ? "movie"
        : undefined);

  const optionsSource = raw.options;

  // ---------- tmdbId ----------
  let tmdbId: number | null = null;
  if (tmdbSource != null) {
    const parsed =
      typeof tmdbSource === "string" ? parseInt(tmdbSource, 10) : tmdbSource;

    if (typeof parsed !== "number" || !Number.isInteger(parsed)) {
      throw new Error("Invalid 'tmdbId': must be an integer");
    }
    tmdbId = parsed;
  }

  // ---------- imdbId ----------
  let imdbId: string | null = null;
  if (imdbSource != null) {
    if (typeof imdbSource !== "string" || !/^tt\d+$/.test(imdbSource)) {
      throw new Error(
        "Invalid 'imdbId': must be a valid IMDb ID string (e.g., 'tt0123456')",
      );
    }
    imdbId = imdbSource;
  }

  // ---------- contentType ----------
  let contentType: ContentType | null = null;
  if (contentTypeSource != null) {
    if (contentTypeSource !== "movie" && contentTypeSource !== "series") {
      throw new Error("Invalid 'contentType': must be 'movie' or 'series'");
    }
    contentType = contentTypeSource as ContentType;
  }

  // Only reject when both are truly missing
  if (tmdbId == null && imdbId == null) {
    throw new Error("Either 'tmdbId' or 'imdbId' must be provided");
  }

  // ---------- options ----------
  let options: SyncRequest["options"] | undefined;
  if (optionsSource != null) {
    if (typeof optionsSource !== "object") {
      throw new Error("Invalid 'options': must be an object");
    }
    const o = optionsSource as Record<string, unknown>;
    options = {
      syncOmdb:
        o.syncOmdb === undefined ? undefined : Boolean(o.syncOmdb),
      forceRefresh:
        o.forceRefresh === undefined ? undefined : Boolean(o.forceRefresh),
    };
  }

  return {
    tmdbId,
    imdbId,
    contentType,
    options,
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
  const ids = await resolveIds(body.tmdbId ?? null, body.imdbId ?? null, body.contentType ?? null);
  if (!ids.tmdbId && !ids.imdbId) {
    log(logCtx, "Could not resolve any valid external ID");
    return jsonError("Could not resolve external ID", 404, "ID_NOT_FOUND");
  }
  log(logCtx, "Resolved IDs", ids);

  // 2. Find existing title
  const existingTitle = await findExistingTitle(supabase, ids.tmdbId, ids.imdbId);
  const titleId = existingTitle?.title_id ?? crypto.randomUUID();
  log(
    logCtx,
    existingTitle ? "Found existing title" : "Creating new title",
    { titleId },
  );

  // 3. Fetch data from external APIs
  const tmdbDetails = ids.tmdbId
    ? await tmdbGetDetails(ids.tmdbId, ids.tmdbMediaType)
    : null;
  const finalImdbId =
    ids.imdbId ??
    tmdbDetails?.imdb_id ??
    tmdbDetails?.external_ids?.imdb_id ??
    null;
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
  const { data: finalTitle, error } = await upsertTitle(
    supabase,
    titleId,
    titleRow,
    !!existingTitle,
  );
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

async function resolveIds(
  tmdbId: number | null,
  imdbId: string | null,
  contentType: ContentType | null,
) {
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
    log({ fn: FN_NAME }, "Error finding existing title", {
      error: error.message,
    });
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
    log(
      { fn: FN_NAME },
      "Duplicate tmdb_id on insert, retrying as update",
      { tmdbId: row.tmdb_id },
    );
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

async function ensureDetailTables(
  supabase: SupabaseClient<Database>,
  titleId: string,
  contentType: ContentType,
) {
  const table = contentType === "movie" ? "movies" : "series";
  const { error } = await supabase.from(table).upsert(
    { title_id: titleId },
    { onConflict: "title_id" },
  );
  if (error) {
    log(
      { fn: FN_NAME },
      `Failed to upsert into ${table}`,
      { titleId, error: error.message },
    );
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
    original_title:
      tmdb?.original_title ??
      tmdb?.original_name ??
      omdb?.Title ??
      null,
    sort_title: buildSortTitle(primaryTitle),
    release_date: tmdb?.release_date ?? tmdb?.first_air_date ?? null,
    release_year: parseIntSafe(
      (tmdb?.release_date ?? tmdb?.first_air_date ?? "0").substring(0, 4),
    ),
    runtime_minutes:
      parseIntSafe(omdb?.Runtime) ??
      tmdbBlock.tmdb_runtime ??
      null,
    poster_url:
      omdb?.Poster ??
      buildTmdbImageUrl(tmdb?.poster_path, "w500") ??
      null,
    backdrop_url: buildTmdbImageUrl(tmdb?.backdrop_path, "w1280"),
    plot: omdb?.Plot ?? tmdb?.overview ?? null,
    tagline: tmdb?.tagline ?? null,
    genres:
      (omdb?.Genre ?? "").split(", ") ??
      tmdbBlock.tmdb_genre_names ??
      null,
    language:
      (omdb?.Language ?? "").split(", ")[0] ??
      tmdb?.original_language ??
      null,
    country:
      (omdb?.Country ?? "").split(", ")[0] ??
      tmdb?.production_countries?.[0]?.iso_3166_1 ??
      null,
    imdb_rating: parseFloatSafe(omdb?.imdbRating),
    imdb_votes: parseIntSafe(
      (omdb?.imdbVotes ?? "").replace(/,/g, ""),
    ),
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
    tmdb_runtime: isMovie
      ? tmdb.runtime
      : tmdb.episode_run_time?.[0],
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

async function tmdbRequest(
  path: string,
  params?: Record<string, string>,
): Promise<any | null> {
  const { tmdbApiReadAccessToken } = getConfig();
  const TMDB_BASE = "https://api.themoviedb.org/3";
  const url = new URL(TMDB_BASE + path);
  if (params) {
    Object.entries(params).forEach(([key, value]) =>
      url.searchParams.set(key, value)
    );
  }

  try {
    const res = await fetch(url.toString(), {
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${tmdbApiReadAccessToken}`,
      },
    });
    if (!res.ok) {
      log({ fn: FN_NAME }, "TMDb request failed", {
        status: res.status,
        path,
      });
      return null;
    }
    return await res.json();
  } catch (error: any) {
    log({ fn: FN_NAME }, "TMDb fetch error", {
      error: error.message,
      path,
    });
    return null;
  }
}

async function tmdbFindByImdb(
  imdbId: string,
): Promise<{ id: number; media_type: TmdbMediaType } | null> {
  const data = await tmdbRequest(`/find/${imdbId}`, {
    external_source: "imdb_id",
  });
  const result = data?.movie_results?.[0] ?? data?.tv_results?.[0];
  if (!result) return null;
  const media_type = data.movie_results?.[0] ? "movie" : "tv";
  return { id: result.id, media_type };
}

async function tmdbGetDetails(
  tmdbId: number,
  type: TmdbMediaType,
): Promise<any | null> {
  return await tmdbRequest(`/${type}/${tmdbId}`, {
    append_to_response: "credits,release_dates,external_ids",
  });
}

async function omdbGetDetails(imdbId: string): Promise<any | null> {
  const OMDB_BASE = "https://www.omdbapi.com/";
  const OMDB_API_KEY = Deno.env.get("OMDB_API_KEY");

  if (!OMDB_API_KEY) {
    log(
      { fn: FN_NAME },
      "OMDB_API_KEY missing, skipping OMDb enrichment",
      { imdbId },
    );
    return null;
  }

  const url = new URL(OMDB_BASE);
  url.searchParams.set("apikey", OMDB_API_KEY);
  url.searchParams.set("i", imdbId);
  url.searchParams.set("plot", "full");

  try {
    const res = await fetch(url.toString());
    if (!res.ok) {
      log({ fn: FN_NAME }, "OMDb request failed", {
        status: res.status,
        imdbId,
      });
      return null;
    }

    const data = await res.json();
    if (data.Response === "False") {
      log(
        { fn: FN_NAME },
        "OMDb API returned an error",
        { imdbId, error: data.Error },
      );
      return null;
    }

    return data;
  } catch (error: any) {
    log({ fn: FN_NAME }, "OMDb fetch error", {
      error: error.message,
      imdbId,
    });
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

const parseIntSafe = (v: any) =>
  v === null || v === undefined || v === "" || isNaN(parseInt(v, 10))
    ? null
    : parseInt(v, 10);

const parseFloatSafe = (v: any) =>
  v === null || v === undefined || v === "" || isNaN(parseFloat(v))
    ? null
    : parseFloat(v);

const parseCurrency = (v: any) =>
  v && v !== "N/A"
    ? parseFloatSafe(String(v).replace(/[^0-9.]/g, ""))
    : null;

function extractRottenTomatoesPct(ratings: any[]): number | null {
  const rt = ratings?.find((r: any) => r.Source === "Rotten Tomatoes");
  return rt ? parseIntSafe(rt.Value.replace("%", "")) : null;
}
