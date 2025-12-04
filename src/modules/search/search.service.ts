import type { Database } from "@/types/supabase";
import { supabase } from "../../lib/supabase";
import { callSupabaseFunction } from "@/lib/callSupabaseFunction";
import { searchExternalTitles } from "./externalMovieSearch";

export type TitleType = "movie" | "series" | "anime";

export interface TitleSearchFilters {
  type?: TitleType | "all";
  minYear?: number;
  maxYear?: number;
  originalLanguage?: string;
  genreIds?: number[];
}

export interface TitleSearchResultPage {
  results: TitleSearchResult[];
  hasMore: boolean;
}

export interface TitleSearchResult {
  id: string;
  title: string;
  year: number | null;
  type: TitleType | null;
  source: "library" | "external-synced" | "external-only";
  posterUrl: string | null;
  originalLanguage: string | null;
  ageRating: string | null;
  imdbRating: number | null;
  rtTomatoMeter: number | null;
  imdbId: string | null;
  tmdbId: number | null;
}

type TitleRow = Pick<
  Database["public"]["Tables"]["titles"]["Row"],
  | "id"
  | "primary_title"
  | "original_title"
  | "release_year"
  | "content_type"
  | "poster_url"
  | "backdrop_url"
  | "language"
  | "omdb_rated"
  | "omdb_imdb_id"
  | "tmdb_id"
  | "imdb_rating"
  | "omdb_rt_rating_pct"
>;

const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) {
    throw signal.reason ?? new DOMException("Aborted", "AbortError");
  }
};

const mapTitleRowToResult = (row: TitleRow): TitleSearchResult => {
  const posterUrl = row.poster_url ?? row.backdrop_url ?? null;

  return {
    id: row.id,
    title: row.primary_title ?? row.original_title ?? "Untitled",
    year: row.release_year,
    type: row.content_type,
    source: "library",
    posterUrl,
    originalLanguage: row.language,
    ageRating: row.omdb_rated,
    imdbRating: row.imdb_rating,
    rtTomatoMeter: row.omdb_rt_rating_pct,
    imdbId: row.omdb_imdb_id,
    tmdbId: row.tmdb_id,
  };
};

const PAGE_SIZE = 20;

const searchSupabaseTitles = async (
  query: string,
  filters: TitleSearchFilters | undefined,
  page: number,
  signal: AbortSignal | undefined,
): Promise<TitleSearchResultPage> => {
  throwIfAborted(signal);

  const columns = `
    id:title_id,
    primary_title,
    original_title,
    release_year,
    content_type,
    poster_url,
    backdrop_url,
    language,
    omdb_rated,
    omdb_imdb_id,
    tmdb_id,
    imdb_rating,
    omdb_rt_rating_pct
  `;

  const selectColumns = filters?.genreIds?.length
    ? `${columns}, title_genres!inner(genre_id, genres(id, name))`
    : columns;

  const offset = (page - 1) * PAGE_SIZE;

  let builder = supabase
    .from("titles")
    .select(selectColumns, { distinct: true, count: "exact" })
    .order("release_year", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (signal) {
    builder = builder.abortSignal(signal);
  }

  if (query) {
    const ilikeQuery = `%${query}%`;
    builder = builder.or(
      `primary_title.ilike.${ilikeQuery},original_title.ilike.${ilikeQuery}`,
    );
  }

  if (filters?.type && filters.type !== "all") {
    builder = builder.eq("content_type", filters.type);
  }

  if (typeof filters?.minYear === "number") {
    builder = builder.gte("release_year", filters.minYear);
  }

  if (typeof filters?.maxYear === "number") {
    builder = builder.lte("release_year", filters.maxYear);
  }

  if (filters?.originalLanguage) {
    builder = builder.eq("language", filters.originalLanguage);
  }

  if (filters?.genreIds?.length) {
    builder = builder.in("title_genres.genre_id", filters.genreIds);
  }

  const { data, error, count } = await builder.returns<TitleRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  throwIfAborted(signal);

  const rows = data ?? [];
  const totalCount = typeof count === "number" ? count : undefined;
  const hasMore = totalCount ? offset + rows.length < totalCount : rows.length === PAGE_SIZE;

  return { results: rows.map(mapTitleRowToResult), hasMore };
};

export const searchTitles = async (
  params: { query: string; filters?: TitleSearchFilters; page?: number; signal?: AbortSignal },
): Promise<TitleSearchResultPage> => {
  const { query, filters, page = 1, signal } = params;
  const trimmedQuery = query.trim();

  throwIfAborted(signal);

  let supabaseResults: TitleSearchResult[] = [];
  let supabaseHasMore = false;

  try {
    const { results, hasMore } = await searchSupabaseTitles(trimmedQuery, filters, page, signal);
    supabaseResults = results;
    supabaseHasMore = hasMore;
  } catch (err) {
    console.warn("[search.service] Supabase search failed, falling back to TMDb", err);
  }

  const { results: externalResults, hasMore: externalHasMore } = await searchExternalTitles(trimmedQuery, page, signal);

  throwIfAborted(signal);
  if (!externalResults.length && supabaseResults.length > 0) {
    return { results: supabaseResults, hasMore: supabaseHasMore };
  }

  const seenTmdbIds = new Set<number>();
  for (const item of supabaseResults) {
    if (item.tmdbId) {
      seenTmdbIds.add(item.tmdbId);
    }
  }

  const hydratedExternal = await Promise.all(
    externalResults.map(async (item) => {
      throwIfAborted(signal);

      if (item.tmdbId && seenTmdbIds.has(item.tmdbId)) return null;

      let titleId = `tmdb-${item.tmdbId}`;

      try {
        const syncResult = await callSupabaseFunction<{
          titleId?: string;
          tmdbId?: number;
          imdbId?: string;
        }>(
          "catalog-sync",
          {
            mode: "title",
            external: {
              tmdbId: item.tmdbId,
              imdbId: item.imdbId ?? undefined,
              type: item.type === "tv" ? "tv" : "movie",
            },
            options: {
              syncOmdb: true,
              syncYoutube: true,
              forceRefresh: false,
            },
          },
          { signal },
        );

        if (syncResult?.titleId) {
          titleId = syncResult.titleId;
        }
      } catch (err) {
        console.warn("[search.service] Failed to catalog-sync TMDb title", item.tmdbId, err);
      }

      throwIfAborted(signal);

      const type: TitleType = item.type === "tv" ? "series" : "movie";
      const isSynced = titleId && titleId.startsWith("tmdb-") === false;

      return {
        id: titleId,
        title: item.title,
        year: item.year ?? null,
        type,
        source: isSynced ? "external-synced" : "external-only",
        posterUrl: item.posterUrl,
        originalLanguage: null,
        ageRating: null,
        imdbRating: null,
        rtTomatoMeter: null,
        imdbId: item.imdbId ?? null,
        tmdbId: item.tmdbId,
      } satisfies TitleSearchResult;
    }),
  );

  const combined = [
    ...supabaseResults,
    ...hydratedExternal.filter((item): item is TitleSearchResult => Boolean(item)),
  ];

  return {
    results: combined,
    hasMore: supabaseHasMore || externalHasMore,
  };
};
