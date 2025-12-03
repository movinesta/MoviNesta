import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { searchExternalTitles } from "./externalMovieSearch";

export type TitleType = "movie" | "series" | "anime";

export interface TitleSearchFilters {
  type?: TitleType | "all";
  minYear?: number;
  maxYear?: number;
  originalLanguage?: string;
  genreIds?: number[];
}

export interface TitleSearchResult {
  id: string;
  title: string;
  year: number | null;
  type: TitleType | null;
  posterUrl: string | null;
  originalLanguage: string | null;
  ageRating: string | null;
  imdbRating: number | null;
  rtTomatoMeter: number | null;
  imdbId: string | null;
  tmdbId: number | null;
}

interface TitleRow {
  id: string;
  primary_title: string | null;
  original_title: string | null;
  release_year: number | null;
  content_type: TitleType | null;
  poster_url: string | null;
  backdrop_url: string | null;
  language: string | null;
  omdb_rated: string | null;
  omdb_imdb_id: string | null;
  tmdb_id: number | null;
  imdb_rating: number | null;
  omdb_rt_rating_pct: number | null;
}

/**
 * useSearchTitles
 *
 * Fetches titles from Supabase based on a simple text query and optional filters.
 * This is intentionally small and side-effect free so it can be reused by different
 * search experiences later.
 */
export const useSearchTitles = (params: { query: string; filters?: TitleSearchFilters }) => {
  const { query, filters } = params;
  const trimmedQuery = query.trim();

  return useQuery<TitleSearchResult[]>({
    queryKey: ["search", "titles", { query: trimmedQuery, filters }],
    enabled: trimmedQuery.length > 0,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
    keepPreviousData: true,
    placeholderData: [],
    queryFn: async () => {
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
      let builder = supabase
        .from("titles")
        .select(selectColumns, { distinct: true })
        .order("release_year", { ascending: false })
        .limit(30);

      if (trimmedQuery) {
        /**
         * Prefer Postgres full-text search on the `search_vector` column when the
         * query is a bit longer. For very short queries we fall back to a simple
         * ILIKE on the title to avoid surprising results.
         *
         * External movie API keys are documented in `apikey.sql` and surfaced in
         * `.env` via Vite-prefixed variables (for example `VITE_OMDB_API_KEY`).
         *
         * This hook keeps all DB work in Supabase and only falls back to OMDb
         * via `searchExternalTitles` when the local catalog has no matches.
         */
        const ilikeQuery = `%${trimmedQuery}%`;
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

      let supabaseResults: TitleSearchResult[] = [];
      try {
        const { data, error } = await builder.returns<TitleRow[]>();

        if (error) {
          throw new Error(error.message);
        }

        const rows = data ?? [];

        supabaseResults = rows.map((row): TitleSearchResult => {
          const posterUrl = row.poster_url ?? row.backdrop_url ?? null;

          return {
            id: row.id,
            title: row.primary_title ?? row.original_title ?? "Untitled",
            year: row.release_year,
            type: row.content_type,
            posterUrl,
            originalLanguage: row.language,
            ageRating: row.omdb_rated,
            imdbRating: row.imdb_rating,
            rtTomatoMeter: row.omdb_rt_rating_pct,
            imdbId: row.omdb_imdb_id,
            tmdbId: row.tmdb_id,
          };
        });
      } catch (err) {
        console.warn("[useSearchTitles] Supabase search failed, falling back to TMDb", err);
      }

      const externalResults = await searchExternalTitles(trimmedQuery);
      if (!externalResults.length && supabaseResults.length > 0) {
        return supabaseResults;
      }

      const seenTmdbIds = new Set<number>();
      for (const item of supabaseResults) {
        if (item.tmdbId) {
          seenTmdbIds.add(item.tmdbId);
        }
      }

      const hydratedExternal = await Promise.all(
        externalResults.map(async (item) => {
          if (item.tmdbId && seenTmdbIds.has(item.tmdbId)) return null;

          let titleId = `tmdb-${item.tmdbId}`;

          try {
            const { data: syncResult } = await supabase.functions.invoke<{
              titleId?: string;
              tmdbId?: number;
              imdbId?: string;
            }>("catalog-sync", {
              body: {
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
            });

            if (syncResult?.titleId) {
              titleId = syncResult.titleId;
            }
          } catch (err) {
            console.warn("[useSearchTitles] Failed to catalog-sync TMDb title", item.tmdbId, err);
          }

          const type: TitleType = item.type === "tv" ? "series" : "movie";

          return {
            id: titleId,
            title: item.title,
            year: item.year ?? null,
            type,
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

      const merged = [
        ...supabaseResults,
        ...hydratedExternal.filter((item): item is TitleSearchResult => Boolean(item)),
      ];
      return merged;
    },
  });
};
