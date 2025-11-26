import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { searchExternalTitles } from "./externalMovieSearch";

export type TitleType = "movie" | "series" | "anime" | "short";

export interface TitleSearchFilters {
  type?: TitleType | "all";
  minYear?: number;
  maxYear?: number;
  originalLanguage?: string;
  // TODO: genreIds: number[]; // requires join on title_genres/genres
}

export interface TitleSearchResult {
  id: string;
  title: string;
  year: number | null;
  type: TitleType | null;
  posterUrl: string | null;
  originalLanguage: string | null;
  ageRating: string | null;
}

/**
 * useSearchTitles
 *
 * Fetches titles from Supabase based on a simple text query and optional filters.
 * This is intentionally small and side-effect free so it can be reused by different
 * search experiences later.
 */
export const useSearchTitles = (params: {
  query: string;
  filters?: TitleSearchFilters;
}) => {
  const { query, filters } = params;
  const trimmedQuery = query.trim();

  return useQuery<TitleSearchResult[]>({
    queryKey: ["search", "titles", { query: trimmedQuery, filters }],
    enabled: trimmedQuery.length > 0,
    queryFn: async () => {
      let builder = supabase
        .from("titles")
        .select(
          "id, title, year, type, poster_url, original_language, age_rating",
        )
        .order("year", { ascending: false })
        .limit(20);

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

      const { data, error } = await builder;

      if (error) {
        throw new Error(error.message);
      }

      const rows = (data ?? []) as any[];

      // If Supabase finds nothing and the query is non-trivial, fall back to an external
      // TMDB/OMDb-based search handled entirely on the server side.
      if (!rows.length && trimmedQuery.length >= 3) {
        return searchExternalTitles(trimmedQuery);
      }

      return rows.map((row: any): TitleSearchResult => ({
        id: row.id as string,
        title: (row.title as string | null) ?? "Untitled",
        year: (row.year as number | null) ?? null,
        type: (row.type as TitleType | null) ?? null,
        posterUrl: (row.poster_url as string | null) ?? null,
        originalLanguage: (row.original_language as string | null) ?? null,
        ageRating: (row.age_rating as string | null) ?? null,
      }));
    },
  });
};
