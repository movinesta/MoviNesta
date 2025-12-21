import { supabase } from "../../lib/supabase";
import { callSupabaseFunction } from "../../lib/callSupabaseFunction";
import { searchExternalTitles } from "./externalMovieSearch";
import { TitleType } from "@/types/supabase-helpers";
import { mapMediaItemToSummary, type MediaItemRow } from "@/lib/mediaItems";

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

const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) {
    throw signal.reason ?? new DOMException("Aborted", "AbortError");
  }
};
const mapMediaItemRowToResult = (row: MediaItemRow): TitleSearchResult => {
  const summary = mapMediaItemToSummary(row);

  return {
    id: summary.id,
    title: summary.title,
    year: summary.year,
    type: summary.type,
    source: "library",
    posterUrl: summary.posterUrl ?? summary.backdropUrl,
    originalLanguage: summary.originalLanguage,
    ageRating: summary.ageRating,
    imdbRating: summary.imdbRating,
    rtTomatoMeter: summary.rtTomatoMeter,
    imdbId: summary.imdbId,
    tmdbId: summary.tmdbId,
  } satisfies TitleSearchResult;
};

const PAGE_SIZE = 20;
const BATCH_SYNC_LIMIT = 5;

const searchSupabaseTitles = async (
  query: string,
  filters: TitleSearchFilters | undefined,
  page: number,
  signal: AbortSignal | undefined,
): Promise<TitleSearchResultPage> => {
  throwIfAborted(signal);

  // Prefer server-side search so we can optionally apply Voyage rerank-2.5.
  // Falls back to direct table search if the Edge Function isn't deployed yet.
  try {
    const resp = await callSupabaseFunction<{
      ok: boolean;
      results: MediaItemRow[];
      hasMore: boolean;
    }>(
      "media-search",
      {
        query: query.trim(),
        page,
        limit: PAGE_SIZE,
        filters: filters ?? {},
      },
      { signal, timeoutMs: 20000 },
    );

    if (resp?.ok && Array.isArray(resp.results)) {
      throwIfAborted(signal);
      return {
        results: (resp.results as MediaItemRow[]).map(mapMediaItemRowToResult),
        hasMore: Boolean(resp.hasMore),
      };
    }
  } catch (err) {
    console.warn("[search.service] media-search Edge Function failed, falling back", err);
  }

  const columns = `
    id,
    kind,
    tmdb_id,
    tmdb_title,
    tmdb_name,
    tmdb_original_title,
    tmdb_original_name,
    tmdb_release_date,
    tmdb_first_air_date,
    tmdb_poster_path,
    tmdb_backdrop_path,
    tmdb_original_language,
    tmdb_genre_ids,
    omdb_title,
    omdb_year,
    omdb_language,
    omdb_imdb_id,
    omdb_imdb_rating,
    omdb_rating_rotten_tomatoes,
    omdb_poster,
    omdb_rated
  `;

  const offset = (page - 1) * PAGE_SIZE;

  let builder = supabase.from("media_items").select(columns, { count: "exact" });

  builder = builder.range(offset, offset + PAGE_SIZE - 1);

  if (signal) {
    builder = builder.abortSignal(signal);
  }

  if (query) {
    const ilikeQuery = `%${query}%`;
    builder = builder.or(
      `tmdb_title.ilike.${ilikeQuery},tmdb_name.ilike.${ilikeQuery},omdb_title.ilike.${ilikeQuery}`,
    );
  }

  if (filters?.type && filters.type !== "all") {
    builder = builder.eq("kind", filters.type === "series" ? "series" : filters.type);
  }

  if (filters?.genreIds?.length) {
    builder = builder.overlaps("tmdb_genre_ids", filters.genreIds);
  }

  if (typeof filters?.minYear === "number") {
    const minDate = `${filters.minYear}-01-01`;
    builder = builder.or(`tmdb_release_date.gte.${minDate},tmdb_first_air_date.gte.${minDate}`);
  }

  if (typeof filters?.maxYear === "number") {
    const maxDate = `${filters.maxYear}-12-31`;
    builder = builder.or(`tmdb_release_date.lte.${maxDate},tmdb_first_air_date.lte.${maxDate}`);
  }

  if (filters?.originalLanguage) {
    builder = builder.eq("tmdb_original_language", filters.originalLanguage);
  }

  builder = builder
    .order("tmdb_release_date", { ascending: false, nullsLast: true })
    .order("tmdb_first_air_date", { ascending: false, nullsLast: true })
    .order("tmdb_title", { ascending: true, nullsLast: false });

  const { data, error, count } = await builder;

  if (error) {
    throw new Error(error.message);
  }

  throwIfAborted(signal);

  const rows = (data as MediaItemRow[]) ?? [];
  const totalCount = typeof count === "number" ? count : undefined;
  const hasMore = totalCount ? offset + rows.length < totalCount : rows.length === PAGE_SIZE;

  return { results: rows.map(mapMediaItemRowToResult), hasMore };
};

export const searchTitles = async (params: {
  query: string;
  filters?: TitleSearchFilters;
  page?: number;
  signal?: AbortSignal;
}): Promise<TitleSearchResultPage> => {
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

  const { results: externalResults, hasMore: externalHasMore } = await searchExternalTitles(
    trimmedQuery,
    page,
    signal,
  );

  throwIfAborted(signal);
  if (!externalResults.length && supabaseResults.length > 0) {
    return { results: supabaseResults, hasMore: supabaseHasMore };
  }

  const seenTmdbIds = new Set<number>();
  const seenImdbIds = new Set<string>();

  for (const item of supabaseResults) {
    if (item.tmdbId) {
      seenTmdbIds.add(item.tmdbId);
    }
    if (item.imdbId) {
      seenImdbIds.add(item.imdbId);
    }
  }

  const filteredExternal = externalResults.filter((item) => {
    if (item.tmdbId && seenTmdbIds.has(item.tmdbId)) return false;
    if (item.imdbId && seenImdbIds.has(item.imdbId)) return false;
    return true;
  });

  const upsertedByTmdb = new Map<number, string>();

  if (filteredExternal.length) {
    try {
      const { data, error } = await supabase
        .from("media_items")
        .upsert(
          filteredExternal.slice(0, BATCH_SYNC_LIMIT).map((item) => ({
            tmdb_id: item.tmdbId,
            omdb_imdb_id: item.imdbId ?? null,
            kind: item.type === "tv" ? "series" : "movie",
            tmdb_title: item.title,
            tmdb_release_date: item.year ? `${item.year}-01-01` : null,
          })),
          { onConflict: "kind,tmdb_id" },
        )
        .select("id, tmdb_id");

      if (error) {
        console.warn("[search.service] Failed to upsert media_items", error.message);
      }

      (data ?? []).forEach((row) => {
        if (row.tmdb_id != null && row.id) {
          upsertedByTmdb.set(Number(row.tmdb_id), row.id);
        }
      });
    } catch (err) {
      console.warn("[search.service] media_items upsert failed", err);
    }
  }

  const hydratedExternal = await Promise.all(
    filteredExternal.map(async (item) => {
      throwIfAborted(signal);

      const type: TitleType = item.type === "tv" ? "series" : "movie";
      const resolvedId = item.tmdbId && upsertedByTmdb.get(item.tmdbId)
        ? upsertedByTmdb.get(item.tmdbId)!
        : `tmdb-${item.tmdbId ?? Math.random()}`;
      const isSynced = !resolvedId.startsWith("tmdb-");

      if (item.tmdbId) {
        seenTmdbIds.add(item.tmdbId);
      }
      if (item.imdbId) {
        seenImdbIds.add(item.imdbId);
      }

      return {
        id: resolvedId,
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

  const combined = [...supabaseResults, ...hydratedExternal.filter((item) => !!item)];

  return {
    results: combined,
    hasMore: supabaseHasMore || externalHasMore,
  };
};
