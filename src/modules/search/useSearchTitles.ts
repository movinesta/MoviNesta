import { keepPreviousData, useInfiniteQuery, type InfiniteData } from "@tanstack/react-query";
import {
  searchTitles,
  type TitleSearchFilters,
  type TitleSearchResultPage,
} from "./search.service";

import { hasActiveTitleFilters } from "./searchState";

export type {
  TitleSearchResult,
  TitleSearchFilters,
  TitleSearchResultPage,
} from "./search.service";

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
  const hasFilters = hasActiveTitleFilters(filters);

  return useInfiniteQuery<
    TitleSearchResultPage,
    Error,
    InfiniteData<TitleSearchResultPage>,
    [string, string, { query: string; filters?: TitleSearchFilters }],
    number
  >({
    queryKey: ["search", "titles", { query: trimmedQuery, filters }],
    enabled: trimmedQuery.length >= 2 || hasFilters,
    // Keep the previous pages visible while a new query/filter set is fetching (reduces flicker).
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) => (lastPage.hasMore ? pages.length + 1 : undefined),
    queryFn: ({ signal, pageParam }) =>
      searchTitles({ query: trimmedQuery, filters, page: pageParam ?? 1, signal }),
  });
};
