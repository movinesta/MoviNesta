import { keepPreviousData, useInfiniteQuery, type InfiniteData } from "@tanstack/react-query";
import {
  searchTitles,
  type TitleSearchFilters,
  type TitleSearchResultPage,
} from "./search.service";

import { hasActiveTitleFilters } from "./searchState";
import { usePublicSettings } from "@/providers/PublicSettingsProvider";

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

  const { getNumber } = usePublicSettings();
  const minQueryChars = getNumber("ux.search.min_query_chars", 2);
  const staleTimeMs = getNumber("ux.search.stale_time_ms", 1000 * 60 * 30);
  const gcTimeMs = getNumber("ux.search.gc_time_ms", 1000 * 60 * 60);

  return useInfiniteQuery<
    TitleSearchResultPage,
    Error,
    InfiniteData<TitleSearchResultPage>,
    [string, string, { query: string; filters?: TitleSearchFilters }],
    number
  >({
    queryKey: ["search", "titles", { query: trimmedQuery, filters }],
    enabled: trimmedQuery.length >= Math.max(1, Math.floor(minQueryChars)) || hasFilters,
    // Keep the previous pages visible while a new query/filter set is fetching (reduces flicker).
    placeholderData: keepPreviousData,
    staleTime: Math.max(0, Math.floor(staleTimeMs)),
    gcTime: Math.max(0, Math.floor(gcTimeMs)),
    refetchOnWindowFocus: false,
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) => (lastPage.hasMore ? pages.length + 1 : undefined),
    queryFn: ({ signal, pageParam }) =>
      searchTitles({ query: trimmedQuery, filters, page: pageParam ?? 1, signal }),
  });
};
