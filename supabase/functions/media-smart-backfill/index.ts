// supabase/functions/media-smart-backfill/index.ts
// Full, production-ready Edge Function with:
// ✅ cache-first TMDb/OMDb
// ✅ fill-only-empty columns
// ✅ proactive dedupe_scan
// ✅ SAFE merge when attaching imdb/tmdb (prevents unique constraint failures)
// ✅ works even if request has no Content-Type

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { safeInsertJobRunLog } from "../_shared/joblog.ts";
import { requireInternalJob } from "../_shared/internal.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const TMDB_API_READ_ACCESS_TOKEN = Deno.env.get("TMDB_API_READ_ACCESS_TOKEN") ?? null;
const OMDB_API_KEY = Deno.env.get("OMDB_API_KEY") ?? null;

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

type MediaKind = "movie" | "series" | "other";

type Counters = {
  rows_scanned: number;
  rows_processed: number;
  rows_updated: number;
  rows_merged: number;
  rows_deleted: number;

  tmdb_cache_hits: number;
  tmdb_cache_misses: number;
  tmdb_api_calls: number;

  tmdb_external_cache_hits: number;
  tmdb_external_api_calls: number;

  omdb_cache_hits: number;
  omdb_cache_misses: number;
  omdb_api_calls: number;

  rows_skipped_no_cache: number;
  retries_total: number;
};

function makeCounters(): Counters {
  return {
    rows_scanned: 0,
    rows_processed: 0,
    rows_updated: 0,
    rows_merged: 0,
    rows_deleted: 0,
    tmdb_cache_hits: 0,
    tmdb_cache_misses: 0,
    tmdb_api_calls: 0,
    tmdb_external_cache_hits: 0,
    tmdb_external_api_calls: 0,
    omdb_cache_hits: 0,
    omdb_cache_misses: 0,
    omdb_api_calls: 0,
    rows_skipped_no_cache: 0,
    retries_total: 0,
  };
}

function nowIso() {
  return new Date().toISOString();
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// Accept JSON even without content-type
async function readJsonBody(req: Request): Promise<any> {
  const ct = req.headers.get("content-type") ?? "";
  if (ct.toLowerCase().includes("application/json")) return await req.json();
  const raw = await req.text();
  if (!raw || !raw.trim()) return {};
  return JSON.parse(raw);
}

async function sleep(ms: number) {
  if (ms <= 0) return;
  await new Promise((r) => setTimeout(r, ms));
}

function isEmpty(v: any): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") {
    const t = v.trim();
    return t === "" || t.toUpperCase() === "N/A";
  }
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

// Only fill if DB field is empty and incoming is not empty
function fillOnlyEmpty(row: Record<string, any>, incoming: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(incoming)) {
    if (v === undefined || v === null) continue;
    if (isEmpty(row[k]) && !isEmpty(v)) out[k] = v;
  }
  return out;
}

function msDays(days: number) {
  return days * 24 * 60 * 60 * 1000;
}

function ageDays(iso: string | null | undefined) {
  if (!iso) return Infinity;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return Infinity;
  return (Date.now() - t) / msDays(1);
}

function parseRetryAfterMs(h: string | null): number | null {
  if (!h) return null;
  const n = Number(h);
  if (Number.isFinite(n) && n > 0) return Math.floor(n * 1000);
  const dt = Date.parse(h);
  if (Number.isFinite(dt)) {
    const ms = dt - Date.now();
    return ms > 0 ? ms : 0;
  }
  return null;
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  opts: { maxRetries: number; baseDelayMs: number; jitterMs: number; label: string; counters: Counters },
) {
  let attempt = 0;
  while (true) {
    attempt++;
    const res = await fetch(url, init);
    if (res.ok) return res;

    const status = res.status;
    const retryable = status === 429 || status === 500 || status === 502 || status === 503 || status === 504;

    if (!retryable || attempt > opts.maxRetries) return res;

    opts.counters.retries_total++;

    const ra = parseRetryAfterMs(res.headers.get("retry-after"));
    const backoff = ra ??
      Math.min(
        30_000,
        opts.baseDelayMs * Math.pow(2, attempt - 1) + Math.floor(Math.random() * opts.jitterMs),
      );

    try {
      await res.arrayBuffer();
    } catch {
      // ignore
    }
    await sleep(backoff);
  }
}

async function fetchJsonWithRetry(
  url: string,
  init: RequestInit,
  opts: { maxRetries: number; baseDelayMs: number; jitterMs: number; label: string; counters: Counters },
) {
  const res = await fetchWithRetry(url, init, opts);
  const text = await res.text();
  if (!res.ok) throw new Error(`${opts.label} failed: ${res.status} ${text}`);
  return JSON.parse(text);
}

// -------------------- DB helpers --------------------

async function updateRow(id: string, patch: Record<string, any>, counters?: Counters) {
  const keys = Object.keys(patch);
  if (keys.length === 0) return;
  const { error } = await db.from("media_items").update(patch).eq("id", id);
  if (error) throw error;
  if (counters) counters.rows_updated++;
}

async function deleteRow(id: string, counters?: Counters) {
  const { error } = await db.from("media_items").delete().eq("id", id);
  if (error) throw error;
  if (counters) counters.rows_deleted++;
}

async function getRowByImdbId(imdbId: string) {
  const { data, error } = await db.from("media_items").select("*").eq("omdb_imdb_id", imdbId).maybeSingle();
  if (error) throw error;
  return data;
}

async function getRowByTmdb(kind: MediaKind, tmdbId: number) {
  const { data, error } = await db
    .from("media_items")
    .select("*")
    .eq("kind", kind)
    .eq("tmdb_id", tmdbId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// -------------------- completeness --------------------

const OMDB_FIELDS = [
  "omdb_title",
  "omdb_year",
  "omdb_rated",
  "omdb_released",
  "omdb_runtime",
  "omdb_genre",
  "omdb_director",
  "omdb_writer",
  "omdb_actors",
  "omdb_plot",
  "omdb_language",
  "omdb_country",
  "omdb_awards",
  "omdb_poster",
  "omdb_metascore",
  "omdb_imdb_rating",
  "omdb_imdb_votes",
  "omdb_type",
  "omdb_box_office",
  "omdb_production",
  "omdb_total_seasons",
  "omdb_rating_internet_movie_database",
  "omdb_rating_rotten_tomatoes",
  "omdb_rating_metacritic",
] as const;

const TMDB_MOVIE_FIELDS = [
  "tmdb_title",
  "tmdb_original_title",
  "tmdb_release_date",
  "tmdb_overview",
  "tmdb_poster_path",
  "tmdb_backdrop_path",
  "tmdb_vote_average",
  "tmdb_vote_count",
  "tmdb_genre_ids",
  "tmdb_original_language",
  "tmdb_popularity",
  "tmdb_media_type",
] as const;

const TMDB_TV_FIELDS = [
  "tmdb_name",
  "tmdb_original_name",
  "tmdb_first_air_date",
  "tmdb_overview",
  "tmdb_poster_path",
  "tmdb_backdrop_path",
  "tmdb_vote_average",
  "tmdb_vote_count",
  "tmdb_genre_ids",
  "tmdb_original_language",
  "tmdb_origin_country",
  "tmdb_popularity",
  "tmdb_media_type",
] as const;


// -------------------- selection columns (CPU/memory optimization) --------------------
// Edge runtime CPU is tight. Avoid SELECT * because it drags large jsonb fields (tmdb_raw/omdb_raw) and wastes CPU parsing.
// We select only the columns we need for "fill-only-empty" logic + merge/scoring + status fields.
// NOTE: we intentionally DO NOT select tmdb_raw / omdb_raw.

const TMDB_FILLABLE_FIELDS = [
  "tmdb_id",
  "tmdb_adult",
  "tmdb_backdrop_path",
  "tmdb_genre_ids",
  "tmdb_original_language",
  "tmdb_original_title",
  "tmdb_overview",
  "tmdb_popularity",
  "tmdb_poster_path",
  "tmdb_release_date",
  "tmdb_title",
  "tmdb_video",
  "tmdb_vote_average",
  "tmdb_vote_count",
  "tmdb_media_type",

  "tmdb_name",
  "tmdb_original_name",
  "tmdb_first_air_date",
  "tmdb_origin_country",

  // formerly GENERATED (now filled by code)
  "tmdb_source",
  "tmdb_budget",
  "tmdb_revenue",
  "tmdb_runtime",
  "tmdb_tagline",
  "tmdb_homepage",
  "tmdb_imdb_id",
  "tmdb_genres",
  "tmdb_spoken_languages",
  "tmdb_production_companies",
  "tmdb_production_countries",
  "tmdb_belongs_to_collection",
  "tmdb_release_status",
  "tmdb_origin_country_raw",
] as const;

const OMDB_FILLABLE_FIELDS = [
  // formerly GENERATED (now filled by code)
  "omdb_ratings",

  "omdb_title",
  "omdb_year",
  "omdb_rated",
  "omdb_released",
  "omdb_runtime",
  "omdb_genre",
  "omdb_director",
  "omdb_writer",
  "omdb_actors",
  "omdb_plot",
  "omdb_language",
  "omdb_country",
  "omdb_awards",
  "omdb_poster",
  "omdb_metascore",
  "omdb_imdb_rating",
  "omdb_imdb_votes",
  "omdb_imdb_id",
  "omdb_type",
  "omdb_dvd",
  "omdb_box_office",
  "omdb_production",
  "omdb_website",
  "omdb_total_seasons",
  "omdb_response",
  "omdb_rating_internet_movie_database",
  "omdb_rating_rotten_tomatoes",
  "omdb_rating_metacritic",
] as const;

const SELECT_COLS = Array.from(new Set([
  "id",
  "kind",
  "created_at",
  "updated_at",

  "tmdb_fetched_at",
  "tmdb_status",
  "tmdb_error",

  "omdb_fetched_at",
  "omdb_status",
  "omdb_error",

  // completeness metrics (optional columns)
  "filled_count",
  "missing_count",
  "completeness",

  ...TMDB_FILLABLE_FIELDS,
  ...OMDB_FILLABLE_FIELDS,
])).join(",");

function computeCompleteness(row: any) {
  const fields: string[] = [];
  if (row.tmdb_id) fields.push(...(row.kind === "series" ? TMDB_TV_FIELDS : TMDB_MOVIE_FIELDS));
  if (row.omdb_imdb_id) fields.push(...OMDB_FIELDS);

  if (fields.length === 0) return { filled_count: 0, missing_count: 0, completeness: 0 };

  let filled = 0;
  let missing = 0;
  for (const f of fields) {
    if (isEmpty(row[f])) missing++;
    else filled++;
  }
  return { filled_count: filled, missing_count: missing, completeness: filled / (filled + missing) };
}

async function updateCompletenessIfPossible(id: string, row: any, counters: Counters) {
  const stats = computeCompleteness(row);
  try {
    await updateRow(id, { ...stats, updated_at: nowIso() }, counters);
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    // If you didn't add these columns, ignore
    if (msg.includes("filled_count") || msg.includes("missing_count") || msg.includes("completeness")) return;
    throw e;
  }
}

// -------------------- needs checks --------------------

function needsTmdbContent(row: any): boolean {
  if (!row.tmdb_id) return false;
  const missingCommon =
    isEmpty(row.tmdb_overview) || isEmpty(row.tmdb_poster_path) || isEmpty(row.tmdb_backdrop_path) ||
    isEmpty(row.tmdb_vote_average) || isEmpty(row.tmdb_vote_count) || isEmpty(row.tmdb_genre_ids) ||
    isEmpty(row.tmdb_original_language) || isEmpty(row.tmdb_media_type);

  if (row.kind === "movie") {
    return missingCommon || isEmpty(row.tmdb_title) || isEmpty(row.tmdb_original_title) || isEmpty(row.tmdb_release_date);
  }
  if (row.kind === "series") {
    return missingCommon || isEmpty(row.tmdb_name) || isEmpty(row.tmdb_original_name) || isEmpty(row.tmdb_first_air_date) ||
      isEmpty(row.tmdb_origin_country);
  }
  return true;
}

function needsOmdbContent(row: any): boolean {
  if (!row.omdb_imdb_id) return false;
  for (const f of OMDB_FIELDS) if (isEmpty(row[f])) return true;
  return false;
}

function onlyNeededFilter(include_omdb: boolean) {
  // Note: PostgREST OR syntax
  const parts: string[] = [
    // tmdb needs
    "tmdb_id.not.is.null,tmdb_fetched_at.is.null",
    "tmdb_id.not.is.null,tmdb_status.is.null",
    "tmdb_id.not.is.null,tmdb_status.eq.failed",
    "tmdb_id.not.is.null,tmdb_status.eq.skipped",
    "tmdb_id.not.is.null,tmdb_overview.is.null",
    "tmdb_id.not.is.null,tmdb_poster_path.is.null",
    "tmdb_id.not.is.null,tmdb_backdrop_path.is.null",
    "tmdb_id.not.is.null,tmdb_media_type.is.null",
  ];

  if (include_omdb) {
    parts.push(
      "omdb_imdb_id.not.is.null,omdb_fetched_at.is.null",
      "omdb_imdb_id.not.is.null,omdb_status.is.null",
      "omdb_imdb_id.not.is.null,omdb_status.eq.failed",
      "omdb_imdb_id.not.is.null,omdb_status.eq.skipped",
      "omdb_imdb_id.not.is.null,omdb_title.is.null",
      "omdb_imdb_id.not.is.null,omdb_plot.is.null",
      "omdb_imdb_id.not.is.null,omdb_poster.is.null",
    );
  }

  return parts.join(",");
}

// -------------------- Cache helpers --------------------

type CacheEntry = { raw: any; fetched_at: string | null };

async function getTmdbCache(kind: MediaKind, tmdbId: number): Promise<CacheEntry | null> {
  try {
    const { data, error } = await db
      .from("tmdb_cache")
      .select("raw,fetched_at")
      .eq("kind", kind)
      .eq("tmdb_id", tmdbId)
      .maybeSingle();
    if (error || !data) return null;
    return { raw: data.raw, fetched_at: data.fetched_at };
  } catch {
    return null;
  }
}

async function putTmdbCache(kind: MediaKind, tmdbId: number, raw: any) {
  try {
    await db.from("tmdb_cache").upsert({ kind, tmdb_id: tmdbId, fetched_at: nowIso(), raw });
  } catch {
    // ignore
  }
}

async function getOmdbCache(imdbId: string): Promise<CacheEntry | null> {
  try {
    const { data, error } = await db.from("omdb_cache").select("raw,fetched_at").eq("imdb_id", imdbId).maybeSingle();
    if (error || !data) return null;
    return { raw: data.raw, fetched_at: data.fetched_at };
  } catch {
    return null;
  }
}

async function putOmdbCache(kind: MediaKind, imdbId: string, raw: any) {
  try {
    await db.from("omdb_cache").upsert({ kind, imdb_id: imdbId, fetched_at: nowIso(), raw });
  } catch {
    // ignore
  }
}

// -------------------- TMDb API --------------------

function tmdbAuthHeaders(url: URL) {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (TMDB_API_READ_ACCESS_TOKEN) headers["Authorization"] = `Bearer ${TMDB_API_READ_ACCESS_TOKEN}`;
  else throw new Error("Missing TMDb auth: set TMDB_API_READ_ACCESS_TOKEN");
  return headers;
}

async function tmdbFetch(path: string, params: Record<string, unknown>, counters: Counters, label: string) {
  const url = new URL(`https://api.themoviedb.org/3/${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    url.searchParams.set(k, String(v));
  }
  const headers = tmdbAuthHeaders(url);
  counters.tmdb_api_calls++;
  return await fetchJsonWithRetry(url.toString(), { headers }, {
    maxRetries: 3,
    baseDelayMs: 600,
    jitterMs: 400,
    label,
    counters,
  });
}

async function tmdbMovieDetails(tmdbId: number, counters: Counters) {
  return await tmdbFetch(`movie/${tmdbId}`, {}, counters, `TMDb movie/${tmdbId}`);
}

async function tmdbTvDetails(tmdbId: number, counters: Counters) {
  return await tmdbFetch(`tv/${tmdbId}`, {}, counters, `TMDb tv/${tmdbId}`);
}

async function tmdbMovieExternalIds(tmdbId: number, counters: Counters) {
  counters.tmdb_external_api_calls++;
  return await tmdbFetch(`movie/${tmdbId}/external_ids`, {}, counters, `TMDb movie/${tmdbId}/external_ids`);
}

async function tmdbTvExternalIds(tmdbId: number, counters: Counters) {
  counters.tmdb_external_api_calls++;
  return await tmdbFetch(`tv/${tmdbId}/external_ids`, {}, counters, `TMDb tv/${tmdbId}/external_ids`);
}

async function tmdbFindByImdb(imdbId: string, counters: Counters) {
  return await tmdbFetch(`find/${imdbId}`, { external_source: "imdb_id" }, counters, `TMDb find/${imdbId}`);
}

function genresToIdsFromDetails(genres: any): number[] | null {
  if (!Array.isArray(genres)) return null;
  const ids = genres.map((g) => Number(g?.id)).filter((n) => Number.isFinite(n));
  return ids.length ? ids : null;
}

function mapTmdbMovieDetailsToCols(details: any) {
  return {
    tmdb_raw: { source: "tmdb_details_movie", details },

    // Core TMDb columns
    tmdb_id: details?.id ?? null,
    tmdb_adult: details?.adult ?? null,
    tmdb_backdrop_path: details?.backdrop_path ?? null,
    tmdb_genre_ids: genresToIdsFromDetails(details?.genres),
    tmdb_original_language: details?.original_language ?? null,
    tmdb_original_title: details?.original_title ?? null,
    tmdb_overview: details?.overview ?? null,
    tmdb_popularity: details?.popularity != null ? Number(details.popularity) : null,
    tmdb_poster_path: details?.poster_path ?? null,
    tmdb_release_date: details?.release_date ?? null,
    tmdb_title: details?.title ?? null,
    tmdb_video: details?.video ?? null,
    tmdb_vote_average: details?.vote_average != null ? Number(details.vote_average) : null,
    tmdb_vote_count: details?.vote_count != null ? Number(details.vote_count) : null,
    tmdb_media_type: "movie",

    // Columns that used to be GENERATED from tmdb_raw (now filled by code)
    tmdb_source: "tmdb_details_movie",
    tmdb_budget: details?.budget != null ? Number(details.budget) : null,
    tmdb_revenue: details?.revenue != null ? Number(details.revenue) : null,
    tmdb_runtime: details?.runtime != null ? Number(details.runtime) : null,
    tmdb_tagline: details?.tagline ?? null,
    tmdb_homepage: details?.homepage ?? null,
    tmdb_imdb_id: details?.imdb_id ?? null,
    tmdb_genres: Array.isArray(details?.genres) ? details.genres : null,
    tmdb_spoken_languages: Array.isArray(details?.spoken_languages) ? details.spoken_languages : null,
    tmdb_production_companies: Array.isArray(details?.production_companies) ? details.production_companies : null,
    tmdb_production_countries: Array.isArray(details?.production_countries) ? details.production_countries : null,
    tmdb_belongs_to_collection: details?.belongs_to_collection ?? null,
    tmdb_release_status: details?.status ?? null,
    tmdb_origin_country_raw: Array.isArray(details?.origin_country) ? details.origin_country : null,
  };
}

function mapTmdbTvDetailsToCols(details: any) {
  const runtime =
    details?.runtime != null
      ? Number(details.runtime)
      : Array.isArray(details?.episode_run_time) && details.episode_run_time.length
      ? Number(details.episode_run_time[0])
      : null;

  return {
    tmdb_raw: { source: "tmdb_details_tv", details },

    // Core TMDb columns
    tmdb_id: details?.id ?? null,
    tmdb_adult: details?.adult ?? null,
    tmdb_backdrop_path: details?.backdrop_path ?? null,
    tmdb_genre_ids: genresToIdsFromDetails(details?.genres),
    tmdb_original_language: details?.original_language ?? null,
    tmdb_overview: details?.overview ?? null,
    tmdb_popularity: details?.popularity != null ? Number(details.popularity) : null,
    tmdb_poster_path: details?.poster_path ?? null,
    tmdb_vote_average: details?.vote_average != null ? Number(details.vote_average) : null,
    tmdb_vote_count: details?.vote_count != null ? Number(details.vote_count) : null,
    tmdb_media_type: "tv",
    tmdb_name: details?.name ?? null,
    tmdb_original_name: details?.original_name ?? null,
    tmdb_first_air_date: details?.first_air_date ?? null,
    tmdb_origin_country: Array.isArray(details?.origin_country) ? details.origin_country : null,

    // Columns that used to be GENERATED from tmdb_raw (now filled by code)
    tmdb_source: "tmdb_details_tv",
    tmdb_budget: details?.budget != null ? Number(details.budget) : null,
    tmdb_revenue: details?.revenue != null ? Number(details.revenue) : null,
    tmdb_runtime: runtime,
    tmdb_tagline: details?.tagline ?? null,
    tmdb_homepage: details?.homepage ?? null,
    tmdb_imdb_id: details?.imdb_id ?? null,
    tmdb_genres: Array.isArray(details?.genres) ? details.genres : null,
    tmdb_spoken_languages: Array.isArray(details?.spoken_languages) ? details.spoken_languages : null,
    tmdb_production_companies: Array.isArray(details?.production_companies) ? details.production_companies : null,
    tmdb_production_countries: Array.isArray(details?.production_countries) ? details.production_countries : null,
    tmdb_belongs_to_collection: details?.belongs_to_collection ?? null,
    tmdb_release_status: details?.status ?? null,
    tmdb_origin_country_raw: Array.isArray(details?.origin_country) ? details.origin_country : null,
  };
}


// -------------------- OMDb API --------------------

async function omdbByImdbId(imdbId: string, counters: Counters) {
  if (!OMDB_API_KEY) throw new Error("include_omdb=true but OMDB_API_KEY is missing");
  const url =
    `https://www.omdbapi.com/?apikey=${encodeURIComponent(OMDB_API_KEY)}` +
    `&i=${encodeURIComponent(imdbId)}&plot=full`;

  counters.omdb_api_calls++;
  const js = await fetchJsonWithRetry(url, {}, {
    maxRetries: 3,
    baseDelayMs: 700,
    jitterMs: 500,
    label: "OMDb",
    counters,
  });
  if (js?.Response === "False") return null;
  return js;
}

function mapOmdbToCols(omdb: any) {
  const ratings = Array.isArray(omdb?.Ratings) ? omdb.Ratings : [];
  const bySource = new Map<string, string>();
  for (const r of ratings) if (r?.Source && r?.Value) bySource.set(r.Source, r.Value);

  return {
    omdb_raw: omdb,
    omdb_ratings: Array.isArray(omdb?.Ratings) ? omdb.Ratings : null,
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
    omdb_metascore: omdb?.Metascore ?? null,
    omdb_imdb_rating: omdb?.imdbRating ? Number(omdb.imdbRating) : null,
    omdb_imdb_votes: omdb?.imdbVotes ?? null,
    omdb_imdb_id: omdb?.imdbID ?? null,
    omdb_type: omdb?.Type ?? null,
    omdb_dvd: omdb?.DVD ?? null,
    omdb_box_office: omdb?.BoxOffice ?? null,
    omdb_production: omdb?.Production ?? null,
    omdb_website: omdb?.Website ?? null,
    omdb_total_seasons: omdb?.totalSeasons ? Number(omdb.totalSeasons) : null,
    omdb_response: omdb?.Response ? omdb.Response === "True" : null,
    omdb_rating_internet_movie_database: bySource.get("Internet Movie Database") ?? null,
    omdb_rating_rotten_tomatoes: bySource.get("Rotten Tomatoes") ?? null,
    omdb_rating_metacritic: bySource.get("Metacritic") ?? null,
  };
}

// -------------------- safer merge (KEY FIX) --------------------

function rowQualityScore(r: any): number {
  let s = 0;
  if (r?.omdb_imdb_id) s += 50;
  if (r?.tmdb_id) s += 50;
  if (r?.omdb_imdb_id && r?.tmdb_id) s += 50;
  if (r?.kind === "movie" || r?.kind === "series") s += 20;
  try {
    const stats = computeCompleteness(r);
    s += Math.min(100, stats.filled_count);
  } catch {
    // ignore
  }
  if (r?.tmdb_status === "failed") s -= 10;
  if (r?.omdb_status === "failed") s -= 10;
  return s;
}

function wantsTransferImdb(source: any, target: any) {
  return !!(source?.omdb_imdb_id && !target?.omdb_imdb_id);
}

function wantsTransferTmdb(source: any, target: any) {
  return !!(source?.tmdb_id && !target?.tmdb_id && (source?.kind === "movie" || source?.kind === "series"));
}

function buildMergePatch(target: any, source: any) {
  // Fill empties normally
  const patch = fillOnlyEmpty(target, source);

  // IMPORTANT: promote target from other -> movie/series if source has tmdb_id
  if (target?.kind === "other" && (source?.kind === "movie" || source?.kind === "series") && source?.tmdb_id) {
    patch.kind = source.kind;
    patch.tmdb_id = source.tmdb_id;
  }

  // If target has kind other but already has tmdb_id somehow, also promote to source kind (rare)
  if (target?.kind === "other" && target?.tmdb_id && (source?.kind === "movie" || source?.kind === "series")) {
    patch.kind = source.kind;
  }

  patch.updated_at = nowIso();
  return patch;
}

async function mergeRows(opts: {
  source: any;
  target: any;
  delete_duplicates: boolean;
  counters: Counters;
}) {
  const { source, target, counters } = opts;

  const transferImdb = wantsTransferImdb(source, target);
  const transferTmdb = wantsTransferTmdb(source, target);

  // Build patch that we want to apply to target
  const targetPatch = buildMergePatch(target, source);

  // To avoid UNIQUE constraint failures when transferring keys:
  // we first "detach" the keys from source (without violating check constraint)
  const detachPatch: Record<string, any> = {};
  if (transferImdb) {
    detachPatch.omdb_imdb_id = null;
  }
  if (transferTmdb) {
    detachPatch.kind = "other";
    detachPatch.tmdb_id = null;
  }

  // Detach first (so target can safely take the unique key)
  if (Object.keys(detachPatch).length) {
    detachPatch.updated_at = nowIso();
    await updateRow(source.id, detachPatch, counters);
  }

  // Apply patch to target
  if (Object.keys(targetPatch).length) {
    await updateRow(target.id, targetPatch, counters);
  }

  // Delete or mark source
  if (opts.delete_duplicates) {
    await deleteRow(source.id, counters);
  } else {
    await updateRow(
      source.id,
      {
        tmdb_fetched_at: nowIso(),
        tmdb_status: "skipped",
        tmdb_error: "merged into another row",
        updated_at: nowIso(),
      },
      counters,
    );
  }

  counters.rows_merged++;

  return {
    merged: true,
    into_id: target.id,
    from_id: source.id,
    deleted: opts.delete_duplicates,
    transferred_imdb: transferImdb,
    transferred_tmdb: transferTmdb,
  };
}

function isUniqueViolation(err: any): boolean {
  const code = err?.code ?? err?.details?.code;
  if (code === "23505") return true;
  const msg = String(err?.message ?? err);
  return msg.includes("duplicate key value") ||
    msg.includes("media_items_omdb_imdb_id_uq") ||
    msg.includes("media_items_kind_tmdb_id_uq");
}

async function attachImdbIdSafe(opts: {
  row: any;
  imdbId: string;
  delete_duplicates: boolean;
  counters: Counters;
}) {
  const { row, imdbId, counters } = opts;

  const existing = await getRowByImdbId(imdbId);
  if (existing && existing.id !== row.id) {
    const scoreRow = rowQualityScore(row);
    const scoreExisting = rowQualityScore(existing);
    const target = scoreExisting >= scoreRow ? existing : row;
    const source = scoreExisting >= scoreRow ? row : existing;

    const merged = await mergeRows({ source, target, delete_duplicates: opts.delete_duplicates, counters });
    return { merged: true, ...merged };
  }

  try {
    await updateRow(row.id, { omdb_imdb_id: imdbId, updated_at: nowIso() }, counters);
    return { merged: false, row_id: row.id };
  } catch (e: any) {
    if (isUniqueViolation(e)) {
      const again = await getRowByImdbId(imdbId);
      if (again && again.id !== row.id) {
        const scoreRow = rowQualityScore(row);
        const scoreAgain = rowQualityScore(again);
        const target = scoreAgain >= scoreRow ? again : row;
        const source = scoreAgain >= scoreRow ? row : again;
        const merged = await mergeRows({ source, target, delete_duplicates: opts.delete_duplicates, counters });
        return { merged: true, ...merged };
      }
    }
    throw e;
  }
}

async function attachTmdbIdSafe(opts: {
  row: any;
  kind: MediaKind;
  tmdbId: number;
  delete_duplicates: boolean;
  counters: Counters;
}) {
  const { row, kind, tmdbId, counters } = opts;

  const existing = await getRowByTmdb(kind, tmdbId);
  if (existing && existing.id !== row.id) {
    const scoreRow = rowQualityScore(row);
    const scoreExisting = rowQualityScore(existing);
    const target = scoreExisting >= scoreRow ? existing : row;
    const source = scoreExisting >= scoreRow ? row : existing;

    const merged = await mergeRows({ source, target, delete_duplicates: opts.delete_duplicates, counters });
    return { merged: true, ...merged };
  }

  // Promote kind from other -> kind if setting tmdb_id
  const patch: Record<string, any> = {
    tmdb_id: tmdbId,
    updated_at: nowIso(),
  };
  if (row.kind === "other") patch.kind = kind;

  try {
    await updateRow(row.id, patch, counters);
    return { merged: false, row_id: row.id };
  } catch (e: any) {
    if (isUniqueViolation(e)) {
      const again = await getRowByTmdb(kind, tmdbId);
      if (again && again.id !== row.id) {
        const scoreRow = rowQualityScore(row);
        const scoreAgain = rowQualityScore(again);
        const target = scoreAgain >= scoreRow ? again : row;
        const source = scoreAgain >= scoreRow ? row : again;
        const merged = await mergeRows({ source, target, delete_duplicates: opts.delete_duplicates, counters });
        return { merged: true, ...merged };
      }
    }
    throw e;
  }
}

// -------------------- processing --------------------

async function processRow(
  row0: any,
  opts: {
    include_omdb: boolean;
    use_cache: boolean;
    tmdb_ttl_days: number;
    omdb_ttl_days: number;
    attach_imdb_from_tmdb: boolean;
    delete_duplicates: boolean;
    request_delay_ms: number;
    force_cache_fill: boolean;
    no_api: boolean;
    refresh_cache: boolean;
    refresh_if_older_than_days: number;
    dedupe_scan: boolean;
    counters: Counters;
  },
) {
  const actions: string[] = [];
  const errors: string[] = [];

  opts.counters.rows_processed++;

  let row: any = { ...row0 };
  let kind: MediaKind = (row.kind ?? "other") as MediaKind;
  let tmdbId: number | null = row.tmdb_id ? Number(row.tmdb_id) : null;
  let imdbId: string | null = row.omdb_imdb_id ? String(row.omdb_imdb_id) : null;

  // PROACTIVE DEDUPE SCAN
  if (opts.dedupe_scan) {
    try {
      if (imdbId && imdbId.startsWith("tt")) {
        const existing = await getRowByImdbId(imdbId);
        if (existing && existing.id !== row.id) {
          const scoreRow = rowQualityScore(row);
          const scoreExisting = rowQualityScore(existing);
          const target = scoreExisting >= scoreRow ? existing : row;
          const source = scoreExisting >= scoreRow ? row : existing;

          const merged = await mergeRows({ source, target, delete_duplicates: opts.delete_duplicates, counters: opts.counters });
          actions.push("dedupe_scan(imdb)");
          return { id: row.id, ok: true, merged: true, actions, errors, merge: merged };
        }
      }

      if (tmdbId && (kind === "movie" || kind === "series")) {
        const existing = await getRowByTmdb(kind, tmdbId);
        if (existing && existing.id !== row.id) {
          const scoreRow = rowQualityScore(row);
          const scoreExisting = rowQualityScore(existing);
          const target = scoreExisting >= scoreRow ? existing : row;
          const source = scoreExisting >= scoreRow ? row : existing;

          const merged = await mergeRows({ source, target, delete_duplicates: opts.delete_duplicates, counters: opts.counters });
          actions.push("dedupe_scan(tmdb)");
          return { id: row.id, ok: true, merged: true, actions, errors, merge: merged };
        }
      }
    } catch (e: any) {
      errors.push(String(e?.message ?? e));
    }
  }

  // If we have imdb but no tmdb and API allowed, link via TMDb find (helps merge twins)
  if (!tmdbId && imdbId && imdbId.startsWith("tt") && !opts.no_api) {
    try {
      await sleep(opts.request_delay_ms);
      const found = await tmdbFindByImdb(imdbId, opts.counters);

      const tv = Array.isArray(found?.tv_results) ? found.tv_results : [];
      const mv = Array.isArray(found?.movie_results) ? found.movie_results : [];

      let chosen: { kind: MediaKind; tmdb_id: number } | null = null;

      // prefer tv first for series-ish, otherwise movie
      if (tv.length > 0) chosen = { kind: "series", tmdb_id: Number(tv[0].id) };
      else if (mv.length > 0) chosen = { kind: "movie", tmdb_id: Number(mv[0].id) };

      if (chosen && Number.isFinite(chosen.tmdb_id) && chosen.tmdb_id > 0) {
        const attach = await attachTmdbIdSafe({
          row,
          kind: chosen.kind,
          tmdbId: chosen.tmdb_id,
          delete_duplicates: opts.delete_duplicates,
          counters: opts.counters,
        });

        actions.push("tmdb_find(api)");

        if ((attach as any).merged) {
          actions.push("merge(tmdb_from_find)");
          return { id: row.id, ok: true, merged: true, actions, errors, merge: attach };
        }

        // update local view
        row = { ...row, tmdb_id: chosen.tmdb_id, kind: row.kind === "other" ? chosen.kind : row.kind };
        kind = row.kind as MediaKind;
        tmdbId = chosen.tmdb_id;
      }
    } catch (e: any) {
      // don't fail the row; just record
      errors.push(String(e?.message ?? e));
    }
  }

  const wantTmdbFill = Boolean(tmdbId) && (opts.force_cache_fill || needsTmdbContent(row));
  const wantOmdbFill = opts.include_omdb && imdbId && imdbId.startsWith("tt") && (opts.force_cache_fill || needsOmdbContent(row));

  // ---------- TMDb details ----------
  if (tmdbId && wantTmdbFill) {
    try {
      let details: any | null = null;
      let detailsKind: MediaKind | null = null;

      const cacheCandidates: MediaKind[] =
        kind === "movie" ? ["movie"] : kind === "series" ? ["series"] : ["series", "movie"];

      let cache: CacheEntry | null = null;
      let cacheKindUsed: MediaKind | null = null;

      if (opts.use_cache) {
        for (const ck of cacheCandidates) {
          const ce = await getTmdbCache(ck, tmdbId);
          if (ce?.raw?.details) {
            cache = ce;
            cacheKindUsed = ck;
            break;
          }
        }
      }

      const cacheFresh = cache?.fetched_at ? ageDays(cache.fetched_at) <= opts.tmdb_ttl_days : false;
      const cacheStaleForRefresh = cache?.fetched_at
        ? ageDays(cache.fetched_at) >= opts.refresh_if_older_than_days
        : false;

      if (cache?.raw?.details && (cacheFresh || opts.no_api)) {
        details = cache.raw.details;
        detailsKind = cacheKindUsed!;
        opts.counters.tmdb_cache_hits++;
        actions.push(detailsKind === "series" ? "tmdb_details(cache_tv)" : "tmdb_details(cache_movie)");
      } else {
        opts.counters.tmdb_cache_misses++;

        if (opts.no_api) {
          actions.push("tmdb_details(skipped_no_api)");
          opts.counters.rows_skipped_no_cache++;
          await updateRow(
            row.id,
            {
              tmdb_fetched_at: nowIso(),
              tmdb_status: "skipped",
              tmdb_error: "no_api=true and tmdb_cache miss/expired",
              updated_at: nowIso(),
            },
            opts.counters,
          );
        } else {
          await sleep(opts.request_delay_ms);

          const mustRefresh = opts.refresh_cache && cacheStaleForRefresh;
          if (!cache || !cacheFresh || mustRefresh) {
            if (kind === "series") {
              details = await tmdbTvDetails(tmdbId, opts.counters);
              detailsKind = "series";
            } else if (kind === "movie") {
              details = await tmdbMovieDetails(tmdbId, opts.counters);
              detailsKind = "movie";
            } else {
              try {
                details = await tmdbTvDetails(tmdbId, opts.counters);
                detailsKind = "series";
              } catch {
                details = await tmdbMovieDetails(tmdbId, opts.counters);
                detailsKind = "movie";
              }
            }

            actions.push("tmdb_details(api)");
            await putTmdbCache(detailsKind!, tmdbId, { ...(cache?.raw ?? {}), details, kind: detailsKind });
          }
        }
      }

      if (details) {
        const incoming = detailsKind === "series" ? mapTmdbTvDetailsToCols(details) : mapTmdbMovieDetailsToCols(details);

        // If row.kind is other, promote kind using detailsKind
        const promoted = row.kind === "other" ? { kind: detailsKind, ...incoming } : incoming;

        const fill = fillOnlyEmpty(row, promoted);

        await updateRow(
          row.id,
          {
            ...fill,
            tmdb_fetched_at: nowIso(),
            tmdb_status: "ok",
            tmdb_error: null,
            updated_at: nowIso(),
          },
          opts.counters,
        );

        row = { ...row, ...fill, kind: row.kind === "other" ? detailsKind : row.kind };
        kind = row.kind as MediaKind;

        // Movie details may contain imdb_id
        const imdbFromDetails =
          detailsKind === "movie" && details?.imdb_id && String(details.imdb_id).startsWith("tt")
            ? String(details.imdb_id)
            : null;

        if (imdbFromDetails && isEmpty(row.omdb_imdb_id)) {
          const attach = await attachImdbIdSafe({
            row,
            imdbId: imdbFromDetails,
            delete_duplicates: opts.delete_duplicates,
            counters: opts.counters,
          });

          if ((attach as any).merged) {
            actions.push("merge(imdb_from_tmdb_details)");
            return { id: row.id, ok: true, merged: true, actions, errors, merge: attach };
          }

          row = { ...row, omdb_imdb_id: imdbFromDetails };
          imdbId = imdbFromDetails;
        }
      }
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      errors.push(msg);
      await updateRow(
        row.id,
        {
          tmdb_fetched_at: nowIso(),
          tmdb_status: "failed",
          tmdb_error: msg,
          updated_at: nowIso(),
        },
        opts.counters,
      );
    }
  }

  // refresh locals
  kind = (row.kind ?? kind) as MediaKind;
  tmdbId = row.tmdb_id ? Number(row.tmdb_id) : tmdbId;
  imdbId = row.omdb_imdb_id ? String(row.omdb_imdb_id) : imdbId;

  // ---------- TMDb external_ids (for TV, mainly) ----------
  const shouldAttachImdb = opts.attach_imdb_from_tmdb || opts.include_omdb;

  if (tmdbId && shouldAttachImdb && (!imdbId || !imdbId.startsWith("tt"))) {
    try {
      let ext: any | null = null;

      if (opts.use_cache && (kind === "movie" || kind === "series")) {
        const ce = await getTmdbCache(kind, tmdbId);
        const fresh = ce?.fetched_at ? ageDays(ce.fetched_at) <= opts.tmdb_ttl_days : false;
        if (ce?.raw?.external_ids && (fresh || opts.no_api)) {
          ext = ce.raw.external_ids;
          opts.counters.tmdb_external_cache_hits++;
          actions.push("tmdb_external_ids(cache)");
        }
      }

      if (!ext) {
        if (opts.no_api) {
          actions.push("tmdb_external_ids(skipped_no_api)");
        } else {
          await sleep(opts.request_delay_ms);
          ext = kind === "series"
            ? await tmdbTvExternalIds(tmdbId, opts.counters)
            : await tmdbMovieExternalIds(tmdbId, opts.counters);

          actions.push("tmdb_external_ids(api)");

          if (opts.use_cache && (kind === "movie" || kind === "series")) {
            const ce = await getTmdbCache(kind, tmdbId);
            await putTmdbCache(kind, tmdbId, { ...(ce?.raw ?? {}), external_ids: ext, kind });
          }
        }
      }

      const imdbFromExt = ext?.imdb_id && String(ext.imdb_id).startsWith("tt") ? String(ext.imdb_id) : null;
      if (imdbFromExt) {
        const attach = await attachImdbIdSafe({
          row,
          imdbId: imdbFromExt,
          delete_duplicates: opts.delete_duplicates,
          counters: opts.counters,
        });

        if ((attach as any).merged) {
          actions.push("merge(imdb_from_external_ids)");
          return { id: row.id, ok: true, merged: true, actions, errors, merge: attach };
        }

        // attach succeeded on same row
        row = { ...row, omdb_imdb_id: imdbFromExt };
        imdbId = imdbFromExt;
        actions.push("db_update(attach_imdb_id)");
      }
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      errors.push(msg);
      await updateRow(
        row.id,
        {
          tmdb_fetched_at: nowIso(),
          tmdb_status: "failed",
          tmdb_error: msg,
          updated_at: nowIso(),
        },
        opts.counters,
      );
    }
  }

  // ---------- OMDb fill ----------
  imdbId = row.omdb_imdb_id ? String(row.omdb_imdb_id) : imdbId;

  const wantOmdb = opts.include_omdb && imdbId && imdbId.startsWith("tt") && (opts.force_cache_fill || needsOmdbContent(row));
  if (wantOmdb) {
    try {
      let omdb: any | null = null;

      const ce = opts.use_cache ? await getOmdbCache(imdbId) : null;
      const cacheFresh = ce?.fetched_at ? ageDays(ce.fetched_at) <= opts.omdb_ttl_days : false;
      const cacheStaleForRefresh = ce?.fetched_at
        ? ageDays(ce.fetched_at) >= opts.refresh_if_older_than_days
        : false;

      if (ce?.raw && (cacheFresh || opts.no_api)) {
        omdb = ce.raw;
        opts.counters.omdb_cache_hits++;
        actions.push("omdb(cache)");
      } else {
        opts.counters.omdb_cache_misses++;

        if (opts.no_api) {
          actions.push("omdb(skipped_no_api)");
          opts.counters.rows_skipped_no_cache++;
          await updateRow(
            row.id,
            {
              omdb_fetched_at: nowIso(),
              omdb_status: "skipped",
              omdb_error: "no_api=true and omdb_cache miss/expired",
              updated_at: nowIso(),
            },
            opts.counters,
          );
        } else {
          const mustRefresh = opts.refresh_cache && cacheStaleForRefresh;
          if (!ce || !cacheFresh || mustRefresh) {
            await sleep(opts.request_delay_ms);
            omdb = await omdbByImdbId(imdbId, opts.counters);
            actions.push("omdb(api)");
            if (omdb) await putOmdbCache(row.kind ?? "other", imdbId, omdb);
          }
        }
      }

      if (omdb) {
        const incoming = mapOmdbToCols(omdb);
        const fill = fillOnlyEmpty(row, incoming);

        await updateRow(
          row.id,
          {
            ...fill,
            omdb_fetched_at: nowIso(),
            omdb_status: "ok",
            omdb_error: null,
            updated_at: nowIso(),
          },
          opts.counters,
        );

        row = { ...row, ...fill };
      }
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      errors.push(msg);
      await updateRow(
        row.id,
        {
          omdb_fetched_at: nowIso(),
          omdb_status: "failed",
          omdb_error: msg,
          updated_at: nowIso(),
        },
        opts.counters,
      );
    }
  }

  // completeness
  try {
    await updateCompletenessIfPossible(row.id, row, opts.counters);
  } catch (e: any) {
    errors.push(String(e?.message ?? e));
  }

  return { id: row.id, ok: errors.length === 0, merged: false, actions, errors };
}

// -------------------- main --------------------

serve(async (req) => {
  const counters = makeCounters();
  const startedAt = nowIso();

  const respondWithLog = async (payload: any, status = 200) => {
    try {
      await safeInsertJobRunLog(db, {
        started_at: startedAt,
        finished_at: nowIso(),
        job_name: "media-smart-backfill",
        provider: null,
        model: null,
        ok: Boolean(payload?.ok),
        scanned: typeof payload?.scanned === "number" ? payload.scanned : counters.rows_scanned,
        embedded: counters.rows_updated,
        skipped_existing: null,
        total_tokens: null,
        error_code: payload?.code ?? null,
        error_message: payload?.error ?? payload?.message ?? null,
        meta: { mode: payload?.mode ?? null, counters },
      });
    } catch {
      // best-effort
    }
    return json(payload, status);
  };

  try {
    const internalGuard = requireInternalJob(req);
    if (internalGuard) {
      return await respondWithLog({ ok: false, code: "INVALID_JOB_TOKEN", error: "Unauthorized" }, 401);
    }

    const body = await readJsonBody(req);

    const limit = Math.max(1, Math.min(Number(body?.limit ?? 10), 500));
    const concurrency = Math.max(1, Math.min(Number(body?.concurrency ?? 2), 10));

    const include_omdb = Boolean(body?.include_omdb ?? false);
    const use_cache = Boolean(body?.use_cache ?? true);

    const tmdb_ttl_days = Math.max(1, Math.min(Number(body?.tmdb_ttl_days ?? 30), 3650));
    const omdb_ttl_days = Math.max(1, Math.min(Number(body?.omdb_ttl_days ?? 30), 3650));

    const attach_imdb_from_tmdb = Boolean(body?.attach_imdb_from_tmdb ?? include_omdb);
    const delete_duplicates = Boolean(body?.delete_duplicates ?? true);

    const request_delay_ms = Math.max(0, Math.min(Number(body?.request_delay_ms ?? 200), 3000));

    const force_cache_fill = Boolean(body?.force_cache_fill ?? false);
    const no_api = Boolean(body?.no_api ?? false);

    const refresh_cache = Boolean(body?.refresh_cache ?? false);
    const refresh_if_older_than_days = Math.max(1, Math.min(Number(body?.refresh_if_older_than_days ?? 90), 3650));

    const only_needed = Boolean(body?.only_needed ?? true);
    const dedupe_scan = Boolean(body?.dedupe_scan ?? false);

    const cooldown_minutes = Math.max(0, Math.min(Number(body?.cooldown_minutes ?? 2), 1440));

    const order_by = body?.order_by === "created_at" ? "created_at" : "updated_at";
    const order_dir = body?.order_dir === "desc" ? "desc" : "asc";

    if (body?.ping === true) {
      return json({
        ok: true,
        tmdb_auth_mode: TMDB_API_READ_ACCESS_TOKEN ? "bearer_token" : "missing",
        has_OMDB_API_KEY: Boolean(OMDB_API_KEY),
      });
    }

    if (!no_api && include_omdb && !OMDB_API_KEY) {
      return await respondWithLog({ ok: false, code: "MISSING_OMDB_KEY", error: "include_omdb=true but OMDB_API_KEY secret is missing" }, 400);
    }

    let q = db.from("media_items").select(SELECT_COLS);

    if (force_cache_fill || !only_needed) {
      // "process anything with an id"
      q = q.or("tmdb_id.not.is.null,omdb_imdb_id.not.is.null");
    } else {
      q = q.or(onlyNeededFilter(include_omdb));
    }

    if (cooldown_minutes > 0) {
      const cutoff = new Date(Date.now() - cooldown_minutes * 60_000).toISOString();
      q = q.lt("updated_at", cutoff);
    }

    q = q.order(order_by, { ascending: order_dir === "asc" }).limit(limit);

    const { data: rows, error } = await q;
    if (error) throw error;

    const list = rows ?? [];
    counters.rows_scanned = list.length;

    let idx = 0;
    const results: any[] = new Array(list.length);

    const workers = Array.from({ length: concurrency }, async () => {
      while (true) {
        const i = idx++;
        if (i >= list.length) break;

        try {
          results[i] = await processRow(list[i], {
            include_omdb,
            use_cache,
            tmdb_ttl_days,
            omdb_ttl_days,
            attach_imdb_from_tmdb,
            delete_duplicates,
            request_delay_ms,
            force_cache_fill,
            no_api,
            refresh_cache,
            refresh_if_older_than_days,
            dedupe_scan,
        cooldown_minutes,
            counters,
          });
        } catch (e: any) {
          results[i] = { id: list[i]?.id, ok: false, merged: false, actions: [], errors: [String(e?.message ?? e)] };
        }
      }
    });

    await Promise.all(workers);

    const payload = {
      scanned: counters.rows_scanned,
      processed: counters.rows_processed,
      success: results.filter((r) => r?.ok).length,
      failed: results.filter((r) => r && !r.ok).length,
      mode: {
        include_omdb,
        use_cache,
        tmdb_ttl_days,
        omdb_ttl_days,
        attach_imdb_from_tmdb,
        delete_duplicates,
        request_delay_ms,
        force_cache_fill,
        no_api,
        refresh_cache,
        refresh_if_older_than_days,
        only_needed,
        dedupe_scan,
        cooldown_minutes,
        order_by,
        order_dir,
      },
      counters,
      results,
    };

    return await respondWithLog(payload, 200);
  } catch (e: any) {
    console.error("media-smart-backfill error:", e);
    console.error("stack:", e?.stack);
    return await respondWithLog({ ok: false, error: String(e?.message ?? e), counters }, 500);
  }
});
