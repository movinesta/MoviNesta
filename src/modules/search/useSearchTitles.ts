import { useQuery } from "@tanstack/react-query";
import { searchTitles, type TitleSearchFilters, type TitleSearchResult } from "./search.service";

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
    queryFn: ({ signal }) => searchTitles({ query: trimmedQuery, filters, signal }),
  });
};
