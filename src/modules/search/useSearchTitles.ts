import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { searchExternalTitles } from "./externalMovieSearch";

export type TitleType = "movie" | "series" | "anime" | "short";

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
    queryFn: async () => {
      const columns = `
        id,
        title,
        year,
        type,
        poster_url,
        original_language,
        age_rating,
        imdb_id,
        tmdb_id,
        external_ratings (
          imdb_rating,
          rt_tomato_meter
        )
      `;
      const selectColumns = filters?.genreIds?.length
        ? `${columns}, title_genres!inner(genre_id, genres(id, name))`
        : columns;
      let builder = supabase
        .from("titles")
        .select(selectColumns, { distinct: true })
        .order("year", { ascending: false })
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
        if (trimmedQuery.length >= 3) {
          builder = builder.textSearch("search_vector", trimmedQuery, {
            type: "plain",
          });
        } else {
          builder = builder.ilike("title", `%${trimmedQuery}%`);
        }
      }

      if (filters?.type && filters.type !== "all") {
        builder = builder.eq("type", filters.type);
      }

      if (typeof filters?.minYear === "number") {
        builder = builder.gte("year", filters.minYear);
      }

      if (typeof filters?.maxYear === "number") {
        builder = builder.lte("year", filters.maxYear);
      }

      if (filters?.originalLanguage) {
        builder = builder.eq("original_language", filters.originalLanguage);
      }

      if (filters?.genreIds?.length) {
        builder = builder.in("title_genres.genre_id", filters.genreIds);
      }

      let supabaseResults: TitleSearchResult[] = [];
      try {
        const { data, error } = await builder;

        if (error) {
          throw new Error(error.message);
        }

        const rows = (data ?? []) as any[];

        supabaseResults = rows.map((row: any): TitleSearchResult => {
          const external = row.external_ratings ?? null;

          return {
            id: row.id as string,
            title: (row.title as string | null) ?? "Untitled",
            year: (row.year as number | null) ?? null,
            type: (row.type as TitleType | null) ?? null,
            posterUrl: (row.poster_url as string | null) ?? null,
            originalLanguage: (row.original_language as string | null) ?? null,
            ageRating: (row.age_rating as string | null) ?? null,
            imdbRating: external?.imdb_rating ?? null,
            rtTomatoMeter: external?.rt_tomato_meter ?? null,
            imdbId: (row.imdb_id as string | null) ?? null,
            tmdbId: (row.tmdb_id as number | null) ?? null,
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
            const { data: syncResult } = await supabase.functions.invoke<{ titleId?: string }>(
              "sync-title-metadata",
              {
                body: {
                  tmdbId: item.tmdbId,
                  type: item.type === "tv" ? "tv" : "movie",
                },
              },
            );

            if (syncResult?.titleId) {
              titleId = syncResult.titleId;
            }
          } catch (err) {
            console.warn("[useSearchTitles] Failed to sync TMDb title", item.tmdbId, err);
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
