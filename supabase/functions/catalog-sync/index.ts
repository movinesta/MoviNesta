// supabase/functions/catalog-sync/index.ts
//
// Backfills a single TMDB title into `public.media_items`.
// Schema source of truth: schema_full_20251224_004751.sql

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

import type { Database } from "../../../src/types/supabase.ts";
import { getConfig } from "../_shared/config.ts";
import { handleOptions, jsonError, jsonResponse, validateRequest } from "../_shared/http.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { getAdminClient, getUserClient } from "../_shared/supabase.ts";

const FN_NAME = "catalog-sync";

type MediaKind = Database["public"]["Enums"]["media_kind"]; // 'movie' | 'series' | ...

type MediaItemRow = Database["public"]["Tables"]["media_items"]["Row"];

type SyncOptions = {
  syncOmdb?: boolean;
  forceRefresh?: boolean;
};

type ExternalInput = {
  tmdbId?: number | null;
  imdbId?: string | null;
  type?: "movie" | "tv" | "series" | null;
};

type SyncRequest = {
  // supported input shapes (historical + current)
  external?: ExternalInput | null;
  tmdbId?: number | null;
  imdbId?: string | null;
  contentType?: "movie" | "series" | null;
  options?: SyncOptions | null;
};

type SyncResponse = {
  ok: true;
  media_item_id: string;
  kind: MediaKind;
  tmdb_id: number | null;
  omdb_imdb_id: string | null;
};

type TmdbMovieDetails = {
  id: number;
  imdb_id?: string | null;
  title?: string;
  original_title?: string;
  release_date?: string;
  runtime?: number | null;
  overview?: string | null;
  original_language?: string | null;
  popularity?: number | null;
  vote_average?: number | null;
  vote_count?: number | null;
  poster_path?: string | null;
  backdrop_path?: string | null;
  tagline?: string | null;
  genres?: Array<{ id: number; name: string }>;
  spoken_languages?: Array<{ english_name?: string; name?: string; iso_639_1?: string }>;
  production_companies?: Array<{ id: number; name: string; origin_country?: string }>;
  production_countries?: Array<{ iso_3166_1: string; name: string }>;
  belongs_to_collection?: any;
  budget?: number | null;
  revenue?: number | null;
  homepage?: string | null;
  adult?: boolean;
  video?: boolean;
};

type TmdbTvDetails = {
  id: number;
  name?: string;
  original_name?: string;
  first_air_date?: string;
  episode_run_time?: number[];
  overview?: string | null;
  original_language?: string | null;
  popularity?: number | null;
  vote_average?: number | null;
  vote_count?: number | null;
  poster_path?: string | null;
  backdrop_path?: string | null;
  tagline?: string | null;
  genres?: Array<{ id: number; name: string }>;
  spoken_languages?: Array<{ english_name?: string; name?: string; iso_639_1?: string }>;
  production_companies?: Array<{ id: number; name: string; origin_country?: string }>;
  production_countries?: Array<{ iso_3166_1: string; name: string }>;
  homepage?: string | null;
  adult?: boolean;
};

type OmdbResponse = Record<string, any>;

function toKind(inputType: ExternalInput["type"], contentType: SyncRequest["contentType"]): MediaKind {
  if (inputType === "tv" || inputType === "series" || contentType === "series") return "series";
  return "movie";
}

function pickFirst<T>(arr: T[] | undefined): T | null {
  return Array.isArray(arr) && arr.length ? arr[0] : null;
}

function safeNum(v: any): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function extractOmdbRating(rotten: boolean, omdb: OmdbResponse): string | null {
  const ratings = Array.isArray(omdb?.Ratings) ? omdb.Ratings : [];
  for (const r of ratings) {
    if (!r || typeof r !== "object") continue;
    const source = String(r.Source ?? "");
    const value = String(r.Value ?? "");
    if (rotten && source.toLowerCase().includes("rotten")) return value || null;
  }
  return null;
}

function normalizeExternal(reqBody: SyncRequest): { external: ExternalInput; options: SyncOptions } {
  const ext: ExternalInput = {
    tmdbId: reqBody.external?.tmdbId ?? reqBody.tmdbId ?? null,
    imdbId: reqBody.external?.imdbId ?? reqBody.imdbId ?? null,
    type: reqBody.external?.type ?? reqBody.contentType ?? null,
  };

  const options: SyncOptions = {
    syncOmdb: reqBody.options?.syncOmdb ?? true,
    forceRefresh: reqBody.options?.forceRefresh ?? false,
  };

  return { external: ext, options };
}

async function tmdbFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const { tmdbApiReadAccessToken } = getConfig();
  if (!tmdbApiReadAccessToken) throw new Error("Missing TMDB_API_READ_ACCESS_TOKEN");

  const url = new URL(`https://api.themoviedb.org/3/${path.replace(/^\//, "")}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${tmdbApiReadAccessToken}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`TMDB request failed: ${res.status} ${text}`);
  }
  return (await res.json()) as T;
}

async function resolveTmdbByImdb(imdbId: string): Promise<{ tmdbId: number; kind: MediaKind } | null> {
  const data = await tmdbFetch<any>(`find/${encodeURIComponent(imdbId)}`, {
    external_source: "imdb_id",
  });

  const movie = pickFirst<any>(data?.movie_results);
  if (movie?.id) return { tmdbId: Number(movie.id), kind: "movie" };

  const tv = pickFirst<any>(data?.tv_results);
  if (tv?.id) return { tmdbId: Number(tv.id), kind: "series" };

  return null;
}

async function fetchOmdb(imdbId: string): Promise<OmdbResponse | null> {
  const { omdbApiKey } = getConfig();
  if (!omdbApiKey) return null;

  const url = new URL("https://www.omdbapi.com/");
  url.searchParams.set("apikey", omdbApiKey);
  url.searchParams.set("i", imdbId);
  url.searchParams.set("plot", "short");

  const res = await fetch(url);
  if (!res.ok) return null;

  const json = (await res.json()) as OmdbResponse;
  if (String(json?.Response ?? "").toLowerCase() === "false") return null;
  return json;
}

async function findExisting(
  supabase: SupabaseClient<Database>,
  kind: MediaKind,
  tmdbId: number | null,
  imdbId: string | null,
): Promise<Pick<MediaItemRow, "id" | "kind" | "tmdb_id" | "omdb_imdb_id" | "tmdb_raw" | "omdb_raw"> | null> {
  if (tmdbId != null) {
    const res = await supabase
      .from("media_items")
      .select("id, kind, tmdb_id, omdb_imdb_id, tmdb_raw, omdb_raw")
      .eq("kind", kind)
      .eq("tmdb_id", tmdbId)
      .maybeSingle();
    if (!res.error && res.data) return res.data;
  }

  if (imdbId) {
    const res = await supabase
      .from("media_items")
      .select("id, kind, tmdb_id, omdb_imdb_id, tmdb_raw, omdb_raw")
      .eq("omdb_imdb_id", imdbId)
      .maybeSingle();
    if (!res.error && res.data) return res.data;
  }

  return null;
}

async function upsertMediaItem(
  supabase: SupabaseClient<Database>,
  row: Database["public"]["Tables"]["media_items"]["Insert"],
  onConflict: string,
): Promise<Pick<MediaItemRow, "id" | "kind" | "tmdb_id" | "omdb_imdb_id">> {
  const res = await supabase
    .from("media_items")
    .upsert(row, { onConflict })
    .select("id, kind, tmdb_id, omdb_imdb_id")
    .single();

  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export async function handler(req: Request) {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  if (req.method !== "POST") {
    return jsonError("Method not allowed", 405);
  }

  const rate = await enforceRateLimit(req, { action: "catalog-sync", maxPerMinute: 60 });
  if (!rate.ok) return jsonError(rate.message, rate.status);

  const { data, errorResponse } = await validateRequest<SyncRequest>(
    req,
    (body: unknown) => body as SyncRequest,
    { logPrefix: `[${FN_NAME}]`, requireJson: true },
  );
  if (errorResponse) return errorResponse;

  const { supabaseUrl, supabaseAnonKey } = getConfig();
  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonError("Server misconfigured", 500, "SERVER_MISCONFIGURED");
  }

  const userClient = getUserClient(req);
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData?.user?.id) {
    return jsonError("Unauthorized", 401, "UNAUTHORIZED");
  }

  const adminClient = getAdminClient(req);

  const { external, options } = normalizeExternal(data);
  let kind: MediaKind = toKind(external.type ?? null, data.contentType);

  let tmdbId: number | null = external.tmdbId ?? null;
  let imdbId: string | null = external.imdbId ?? null;

  if (tmdbId == null && imdbId) {
    const resolved = await resolveTmdbByImdb(imdbId);
    if (resolved) {
      tmdbId = resolved.tmdbId;
      kind = resolved.kind;
    }
  }

  if (tmdbId == null && !imdbId) {
    return jsonError("Missing tmdbId or imdbId", 400, "MISSING_IDS");
  }

  const existing = await findExisting(adminClient, kind, tmdbId, imdbId);
  if (existing && !options.forceRefresh) {
    // If we already have TMDB data, and OMDb is either disabled or present, we can return early.
    const hasTmdb = Boolean(existing.tmdb_raw);
    const hasOmdb = Boolean(existing.omdb_raw);
    if (hasTmdb && (!options.syncOmdb || hasOmdb)) {
      return jsonResponse<SyncResponse>({
        ok: true,
        media_item_id: existing.id,
        kind: existing.kind,
        tmdb_id: existing.tmdb_id ?? null,
        omdb_imdb_id: existing.omdb_imdb_id ?? null,
      });
    }
  }

  const fetchedAt = new Date().toISOString();

  // Fetch TMDB details (and record freshness metadata).
  let tmdbDetails: TmdbMovieDetails | TmdbTvDetails | null = null;
  let tmdbStatus: "ok" | "failed" | null = null;
  let tmdbError: string | null = null;

  if (tmdbId != null) {
    try {
      tmdbDetails = kind === "series"
        ? await tmdbFetch<TmdbTvDetails>(`tv/${tmdbId}`)
        : await tmdbFetch<TmdbMovieDetails>(`movie/${tmdbId}`);
      tmdbStatus = "ok";
    } catch (err) {
      tmdbDetails = null;
      tmdbStatus = "failed";
      tmdbError = err instanceof Error ? err.message : String(err);
    }
  }

  // Resolve imdb id from TMDB if not provided.
  if (!imdbId && kind === "movie" && (tmdbDetails as TmdbMovieDetails | null)?.imdb_id) {
    imdbId = (tmdbDetails as TmdbMovieDetails).imdb_id ?? null;
  }

  // Fetch OMDb details if requested (and record freshness metadata).
  let omdbStatus: "ok" | "failed" | null = null;
  let omdbError: string | null = null;

  const omdb = options.syncOmdb && imdbId
    ? await (async () => {
      try {
        const res = await fetchOmdb(imdbId);
        omdbStatus = "ok";
        return res;
      } catch (err) {
        omdbStatus = "failed";
        omdbError = err instanceof Error ? err.message : String(err);
        return null;
      }
    })()
    : null;


  const genres = Array.isArray((tmdbDetails as any)?.genres) ? (tmdbDetails as any).genres : [];
  const genreIds = genres.map((g: any) => Number(g.id)).filter((n) => Number.isFinite(n));

  const tmdbRuntime = kind === "series"
    ? (Array.isArray((tmdbDetails as any)?.episode_run_time)
      ? safeNum((tmdbDetails as any).episode_run_time[0])
      : null)
    : safeNum((tmdbDetails as any)?.runtime);

  const insert: Database["public"]["Tables"]["media_items"]["Insert"] = {
    kind,
    tmdb_id: tmdbId,
    tmdb_media_type: kind === "series" ? "tv" : "movie",
    tmdb_title: kind === "movie" ? ((tmdbDetails as any)?.title ?? null) : null,
    tmdb_name: kind === "series" ? ((tmdbDetails as any)?.name ?? null) : null,
    tmdb_original_title: kind === "movie" ? ((tmdbDetails as any)?.original_title ?? null) : null,
    tmdb_original_name: kind === "series" ? ((tmdbDetails as any)?.original_name ?? null) : null,
    tmdb_release_date: kind === "movie" ? ((tmdbDetails as any)?.release_date ?? null) : null,
    tmdb_first_air_date: kind === "series" ? ((tmdbDetails as any)?.first_air_date ?? null) : null,
    tmdb_runtime: tmdbRuntime != null ? Math.floor(tmdbRuntime) : null,
    tmdb_overview: (tmdbDetails as any)?.overview ?? null,
    tmdb_original_language: (tmdbDetails as any)?.original_language ?? null,
    tmdb_popularity: safeNum((tmdbDetails as any)?.popularity),
    tmdb_vote_average: safeNum((tmdbDetails as any)?.vote_average),
    tmdb_vote_count: safeNum((tmdbDetails as any)?.vote_count),
    tmdb_poster_path: (tmdbDetails as any)?.poster_path ?? null,
    tmdb_backdrop_path: (tmdbDetails as any)?.backdrop_path ?? null,
    tmdb_tagline: (tmdbDetails as any)?.tagline ?? null,
    tmdb_spoken_languages: (tmdbDetails as any)?.spoken_languages ?? null,
    tmdb_production_companies: (tmdbDetails as any)?.production_companies ?? null,
    tmdb_production_countries: (tmdbDetails as any)?.production_countries ?? null,
    tmdb_belongs_to_collection: (tmdbDetails as any)?.belongs_to_collection ?? null,
    tmdb_budget: safeNum((tmdbDetails as any)?.budget),
    tmdb_revenue: safeNum((tmdbDetails as any)?.revenue),
    tmdb_homepage: (tmdbDetails as any)?.homepage ?? null,
    tmdb_adult: (tmdbDetails as any)?.adult ?? null,
    tmdb_video: (tmdbDetails as any)?.video ?? null,
    tmdb_genres: genres,
    tmdb_genre_ids: genreIds as any,
    tmdb_raw: tmdbDetails as any,

    omdb_raw: omdb as any,
    omdb_title: omdb?.Title ?? null,
    omdb_year: omdb?.Year ?? null,
    omdb_rated: omdb?.Rated ?? null,
    omdb_released: omdb?.Released ?? null,
    omdb_runtime: omdb?.Runtime ?? null,
    omdb_genre: omdb?.Genre ?? null,
    omdb_director: omdb?.Director ?? null,
    omdb_writer: omdb?.Writer ?? null,
    omdb_actors: omdb?.Actors ?? null,
    omdb_plot: omdb?.Plot ?? null,
    omdb_language: omdb?.Language ?? null,
    omdb_country: omdb?.Country ?? null,
    omdb_awards: omdb?.Awards ?? null,
    omdb_poster: omdb?.Poster ?? null,
    omdb_imdb_id: imdbId ?? omdb?.imdbID ?? null,
    omdb_imdb_rating: safeNum(omdb?.imdbRating),
    omdb_imdb_votes: omdb?.imdbVotes ?? null,
    omdb_rating_rotten_tomatoes: extractOmdbRating(true, omdb) ?? null,
    ...(tmdbId != null ? {
      tmdb_fetched_at: fetchedAt,
      tmdb_status: tmdbStatus,
      tmdb_error: tmdbError,
    } : {}),
    ...(options.syncOmdb && imdbId ? {
      omdb_fetched_at: fetchedAt,
      omdb_status: omdbStatus,
      omdb_error: omdbError,
    } : {}),
  };

  const onConflict = tmdbId != null ? "kind,tmdb_id" : "omdb_imdb_id";
  const saved = await upsertMediaItem(adminClient, insert, onConflict);

  return jsonResponse<SyncResponse>({
    ok: true,
    media_item_id: saved.id,
    kind: saved.kind,
    tmdb_id: saved.tmdb_id ?? null,
    omdb_imdb_id: saved.omdb_imdb_id ?? null,
  });
}

serve(handler);
