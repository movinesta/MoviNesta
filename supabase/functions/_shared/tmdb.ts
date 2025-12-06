// supabase/functions/_shared/tmdb.ts
//
// Centralized TMDb helpers so all Edge Functions share the same logic.
// Uses the TMDB v4 "read access" bearer token.
//
// Env:
//   TMDB_API_READ_ACCESS_TOKEN
//

import { getConfig } from "./config.ts";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMG_BASE = "https://image.tmdb.org/t/p";

export type TmdbMediaType = "movie" | "tv";

export interface TmdbTitleData {
  mediaType: TmdbMediaType;
  tmdbId: number;
  main: any;
  externalIds: any | null;
}

/**
 * Low-level TMDb fetch with bearer auth.
 */
async function tmdbFetch(path: string, params: Record<string, string> = {}): Promise<any> {
  const { tmdbApiReadAccessToken } = getConfig();
  if (!tmdbApiReadAccessToken) {
    throw new Error("TMDB_API_READ_ACCESS_TOKEN is not configured");
  }

  const url = new URL(TMDB_BASE_URL + path);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${tmdbApiReadAccessToken}`,
    },
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`[tmdb] ${path} failed with ${res.status}: ${txt}`);
  }

  return res.json();
}

/**
 * Fetch a movie or TV item with its basic details + external_ids.
 */
export async function fetchTmdbTitle(
  mediaType: TmdbMediaType,
  tmdbId: number,
): Promise<TmdbTitleData> {
  const [main, externalIds] = await Promise.all([
    tmdbFetch(`/${mediaType}/${tmdbId}`),
    tmdbFetch(`/${mediaType}/${tmdbId}/external_ids`),
  ]);

  return {
    mediaType,
    tmdbId,
    main,
    externalIds,
  };
}

/**
 * Find a TMDb item by IMDb ID.
 * Returns the first movie or tv result plus its media_type, or null.
 */
export async function findTmdbByImdbId(
  imdbId: string,
): Promise<{ mediaType: TmdbMediaType; tmdbId: number } | null> {
  const data = await tmdbFetch(`/find/${encodeURIComponent(imdbId)}`, {
    external_source: "imdb_id",
  });

  const movie = Array.isArray(data.movie_results) && data.movie_results[0];
  if (movie?.id) {
    return { mediaType: "movie", tmdbId: movie.id };
  }

  const tv = Array.isArray(data.tv_results) && data.tv_results[0];
  if (tv?.id) {
    return { mediaType: "tv", tmdbId: tv.id };
  }

  return null;
}

/**
 * Fetch trending list from TMDb.
 */
export async function fetchTmdbTrending(
  mediaType: TmdbMediaType,
  window: "day" | "week" = "day",
): Promise<any> {
  return tmdbFetch(`/trending/${mediaType}/${window}`);
}

/**
 * Discover content by popularity (basic helper used by backfill).
 */
export async function fetchTmdbDiscover(
  mediaType: TmdbMediaType,
  page: number = 1,
): Promise<any> {
  const sortBy = "popularity.desc";
  const path = mediaType === "movie" ? "/discover/movie" : "/discover/tv";

  return tmdbFetch(path, {
    sort_by: sortBy,
    include_adult: "false",
    page: String(page),
  });
}

export function tmdbPosterUrl(path: string | null | undefined, size: string = "w500"): string | null {
  if (!path) return null;
  return `${TMDB_IMG_BASE}/${size}${path}`;
}

export function tmdbBackdropUrl(path: string | null | undefined, size: string = "w780"): string | null {
  if (!path) return null;
  return `${TMDB_IMG_BASE}/${size}${path}`;
}
