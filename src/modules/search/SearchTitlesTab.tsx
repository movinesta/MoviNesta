// src/modules/search/SearchTitlesTab.tsx
import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { BookmarkCheck, BookmarkPlus, Film, Loader2, Star, SlidersHorizontal } from "lucide-react";
import { Virtuoso } from "react-virtuoso";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/modules/auth/AuthProvider";
import { useDiaryLibraryMutations } from "@/modules/diary/useDiaryLibrary";
import { callSupabaseFunction } from "@/lib/callSupabaseFunction";
import { qk } from "@/lib/queryKeys";
import { getOrCreateMediaSwipeSessionId, sendMediaSwipeEvent } from "@/modules/swipe/mediaSwipeApi";
import { supabase } from "../../lib/supabase";
import {
  useSearchTitles,
  type TitleSearchFilters,
  type TitleSearchResult,
} from "./useSearchTitles";
import { hasActiveTitleFilters } from "./searchState";
import { defaultSortForQuery, sortTitles, type TitleSortKey } from "./titleSorting";
import { HighlightText } from "./HighlightText";
import { useTitleDiaryBulk } from "./useTitleDiaryBulk";

interface SearchTitlesTabProps {
  query: string;
  filters: TitleSearchFilters;
  sortKey?: TitleSortKey;
  onChangeSort?: (next: TitleSortKey) => void;
  onResetFilters?: () => void;
}

export const TitleSearchResultRow: React.FC<{
  item: TitleSearchResult;
  query?: string;
  right?: React.ReactNode;
}> = ({ item, query, right }) => {
  const metaPieces: string[] = [];
  if (item.year) metaPieces.push(String(item.year));
  if (item.type === "movie") metaPieces.push("Movie");
  if (item.type === "series") metaPieces.push("Series");
  if (item.originalLanguage) metaPieces.push(`Language: ${item.originalLanguage}`);
  if (item.ageRating) metaPieces.push(item.ageRating);
  if (item.imdbRating) metaPieces.push(`IMDb ${item.imdbRating.toFixed(1)}`);
  if (item.rtTomatoMeter) metaPieces.push(`RT ${item.rtTomatoMeter}%`);

  const sourceLabel: Record<TitleSearchResult["source"], string> = {
    library: "Library",
    "external-synced": "Synced",
    "external-only": "External",
  };

  const sourceStyles: Record<TitleSearchResult["source"], string> = {
    library: "bg-primary/10 text-primary border-primary/40",
    "external-synced": "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    "external-only": "bg-card text-muted-foreground border-border",
  };

  return (
    <div className="flex items-center gap-2 rounded-2xl border border-border bg-background/60 p-2 hover:bg-card/80 focus-within:ring-1 focus-within:ring-primary/50">
      <Link to={`/title/${item.id}`} className="flex min-w-0 flex-1 gap-3">
        {item.posterUrl ? (
          <img
            src={item.posterUrl}
            alt={item.title}
            className="h-20 w-14 rounded-2xl object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-20 w-14 items-center justify-center rounded-2xl bg-muted">
            <Film className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <div className="flex items-center gap-2">
            <p className="truncate text-[12px] font-medium text-foreground">
              <HighlightText text={item.title} query={query} firstOnly className="truncate" />
            </p>
            <span
              className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${sourceStyles[item.source]}`}
            >
              {sourceLabel[item.source]}
            </span>
          </div>
          {metaPieces.length > 0 && (
            <p className="text-xs text-muted-foreground">{metaPieces.join(" • ")}</p>
          )}
        </div>
      </Link>

      {right ? <div className="shrink-0 pr-1">{right}</div> : null}
    </div>
  );
};

const isUuid = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(
    value,
  );
};

const SearchTitlesTab: React.FC<SearchTitlesTabProps> = ({
  query,
  filters,
  sortKey,
  onChangeSort,
  onResetFilters,
}) => {
  const trimmedQuery = query.trim();
  const hasFilters = hasActiveTitleFilters(filters);
  const isBrowseMode = !trimmedQuery && hasFilters;
  const showMinimumQueryHint = trimmedQuery.length > 0 && trimmedQuery.length < 2 && !isBrowseMode;

  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
  } = useSearchTitles({
    query: trimmedQuery,
    filters,
  });

  const effectiveSort: TitleSortKey = sortKey ?? defaultSortForQuery(trimmedQuery);

  // Sort *within* each loaded page to keep scrolling stable as new pages append.
  const results = React.useMemo(() => {
    const pages = data?.pages ?? [];
    return pages.flatMap((page) =>
      sortTitles({ items: page.results ?? [], query: trimmedQuery, sortKey: effectiveSort }),
    );
  }, [data, effectiveSort, trimmedQuery]);

  const { user } = useAuth();
  const queryClient = useQueryClient();
  const diaryMutations = useDiaryLibraryMutations();

  const [resolvedTitleIds, setResolvedTitleIds] = React.useState<Record<string, string>>({});
  const resolvedTitleIdsRef = React.useRef(resolvedTitleIds);

  React.useEffect(() => {
    resolvedTitleIdsRef.current = resolvedTitleIds;
  }, [resolvedTitleIds]);

  const effectiveUuidIds = React.useMemo(() => {
    const out: string[] = [];
    for (const r of results) {
      const resolved = resolvedTitleIds[r.id] ?? r.id;
      if (isUuid(resolved)) out.push(resolved);
    }
    return out;
  }, [results, resolvedTitleIds]);

  const diaryBulk = useTitleDiaryBulk(effectiveUuidIds);
  const diaryMap = React.useMemo(() => diaryBulk.data ?? new Map(), [diaryBulk.data]);

  const [busyRowId, setBusyRowId] = React.useState<string | null>(null);

  const ensureCanonicalId = React.useCallback(
    async (item: TitleSearchResult): Promise<string | null> => {
      const rawId = item.id;
      if (isUuid(rawId)) return rawId;

      const cached = resolvedTitleIdsRef.current[rawId];
      if (cached && isUuid(cached)) return cached;

      if (!item.tmdbId) return null;

      const kind = item.type === "series" ? "series" : "movie";

      try {
        const res = await callSupabaseFunction<any>("catalog-sync", { kind, tmdbId: item.tmdbId });
        const nextId = res?.data?.id as string | undefined;
        if (nextId && isUuid(nextId)) {
          setResolvedTitleIds((prev) => (prev[rawId] ? prev : { ...prev, [rawId]: nextId }));
          return nextId;
        }
      } catch (err) {
        console.warn("[SearchTitlesTab] catalog-sync failed", err);
      }

      return null;
    },
    [],
  );

  const toggleWatchlist = React.useCallback(
    async (item: TitleSearchResult) => {
      if (!user) return;

      setBusyRowId(item.id);

      try {
        const canonicalId = await ensureCanonicalId(item);
        if (!canonicalId) return;

        const diary = diaryMap.get(canonicalId);
        const inWatchlist = diary?.status === "want_to_watch";

        const sessionId = getOrCreateMediaSwipeSessionId();
        await sendMediaSwipeEvent({
          sessionId,
          mediaItemId: canonicalId,
          source: "search",
          eventType: "watchlist",
          inWatchlist: !inWatchlist,
        });

        if (inWatchlist) {
          const { error } = await supabase
            .from("library_entries")
            .delete()
            .eq("user_id", user.id)
            .eq("title_id", canonicalId)
            .eq("status", "want_to_watch");

          if (error) throw error;
        } else {
          await diaryMutations.updateStatus.mutateAsync({
            titleId: canonicalId,
            status: "want_to_watch",
            type: item.type === "series" ? "series" : "movie",
            title: item.title,
            year: item.year,
            posterUrl: item.posterUrl,
          });
        }

        queryClient.invalidateQueries({ queryKey: ["search", "titleDiaryBulk", user.id] });
        queryClient.invalidateQueries({ queryKey: qk.diaryLibrary(user.id) });
        queryClient.invalidateQueries({ queryKey: qk.titleDiary(user.id, canonicalId) });
      } catch (err) {
        console.warn("[SearchTitlesTab] watchlist toggle failed", err);
      } finally {
        setBusyRowId(null);
      }
    },
    [diaryMap, diaryMutations.updateStatus, ensureCanonicalId, queryClient, user],
  );

  const totalResults = results.length;

  const activeFilterLabels: string[] = [];

  if (filters.type && filters.type !== "all") {
    const labelByType: Record<string, string> = {
      movie: "Movies",
      series: "Series",
    };

    activeFilterLabels.push(labelByType[filters.type] ?? "Titles");
  }
  if (typeof filters.minYear === "number") {
    activeFilterLabels.push(`From ${filters.minYear}`);
  }
  if (typeof filters.maxYear === "number") {
    activeFilterLabels.push(`Up to ${filters.maxYear}`);
  }
  if (filters.originalLanguage) {
    activeFilterLabels.push(
      `Language: ${filters.originalLanguage === "en" ? "English" : filters.originalLanguage}`,
    );
  }
  if (filters.genreIds?.length) {
    activeFilterLabels.push(`Genres: ${filters.genreIds.length}`);
  }

  const filterSummary = activeFilterLabels.length
    ? activeFilterLabels.join(" • ")
    : "No filters applied";

  // Lazily trigger metadata sync (TMDb + OMDb) for titles that are missing external ratings.
  const syncedIdsRef = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    if (!results || !Array.isArray(results)) return;
    const already = syncedIdsRef.current;

    const toSync = results
      .filter((item) => {
        if (already.has(item.id)) return false;
        if (!item.imdbId && !item.tmdbId) return false;
        if (item.imdbRating || item.rtTomatoMeter) return false;
        return true;
      })
      .slice(0, 3);

    const syncBatch = async () => {
      for (const item of toSync) {
        already.add(item.id);

        try {
          const { error } = await supabase
            .from("media_items")
            .upsert(
              {
                tmdb_id: item.tmdbId ?? null,
                omdb_imdb_id: item.imdbId ?? null,
                kind: item.type === "series" ? "series" : (item.type ?? "movie"),
                tmdb_title: item.title,
                tmdb_release_date: item.year ? `${item.year}-01-01` : null,
              },
              // media_items has a unique constraint on (kind, tmdb_id).
              { onConflict: "kind,tmdb_id" },
            )
            .select("id");

          if (error) {
            console.warn("[SearchTitlesTab] media_items upsert failed for", item.id, error.message);
          }
        } catch (err) {
          console.warn("[SearchTitlesTab] media_items upsert threw for", item.id, err);
        }
      }
    };

    void syncBatch();
  }, [results]);

  if (showMinimumQueryHint) {
    return (
      <div className="space-y-2">
        <p className="text-[12px] text-muted-foreground">
          Keep typing to search titles — enter at least{" "}
          <span className="font-semibold text-foreground">2 characters</span>.
        </p>
        <p className="text-xs text-muted-foreground">
          Tip: You can also browse without typing by using filters (genres, year, language).
        </p>
      </div>
    );
  }

  if (!trimmedQuery && !isBrowseMode) {
    return (
      <div className="space-y-3">
        <p className="text-[12px] text-muted-foreground">
          Start typing a title, director, or genre to search the catalog. As you wire Supabase
          search, results will appear here.
        </p>

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-foreground">Try searching for</p>
          <div className="flex flex-wrap gap-1.5 text-xs">
            {[
              "Sci-fi romance",
              "Feel-good comedies",
              "Films from 2020s",
              "Cozy rainy-day movies",
            ].map((label) => (
              <span
                key={label}
                className="inline-flex items-center rounded-full border border-border px-2 py-1 text-muted-foreground"
              >
                <Film className="mr-1 h-3 w-3 text-muted-foreground" aria-hidden="true" />
                {label}
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-1.5 rounded-2xl border border-border bg-background/60 p-3">
          <p className="flex items-center gap-1 text-xs font-medium text-foreground">
            <Star className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            <span>Trending this week</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Once analytics are wired up, you can show what your friends and the community are
            watching the most here.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <p className="text-[12px] text-muted-foreground">
          {trimmedQuery ? (
            <>
              Searching for <span className="font-semibold text-foreground">{trimmedQuery}</span>…
            </>
          ) : (
            <>Browsing titles…</>
          )}
        </p>
        <p className="text-xs text-muted-foreground">
          {trimmedQuery
            ? "Fetching matching titles from your catalog and external sources."
            : "Fetching titles that match your selected filters."}
        </p>

        <div className="space-y-2">
          {[0, 1, 2].map((idx) => (
            <div
              key={idx}
              className="flex gap-3 rounded-2xl border border-border bg-background/60 p-2"
            >
              <div className="h-16 w-11 animate-pulse rounded-xl bg-card/60" />
              <div className="flex flex-1 flex-col justify-center space-y-1.5">
                <div className="h-3 w-2/3 animate-pulse rounded bg-card/60" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-card/40" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-3">
        <p className="text-[12px] text-destructive">
          Something went wrong while {trimmedQuery ? "searching" : "browsing"} titles.
        </p>
        {error && (
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold">Details: </span>
            {error.message}
          </p>
        )}
      </div>
    );
  }

  if (!totalResults) {
    return (
      <div className="space-y-3">
        <p className="text-[12px] text-muted-foreground">
          {trimmedQuery ? (
            <>
              No titles found matching{" "}
              <span className="font-semibold text-foreground">{trimmedQuery}</span>.
            </>
          ) : (
            <>No titles match these filters.</>
          )}
        </p>
        <p className="text-xs text-muted-foreground">
          {trimmedQuery
            ? "Try adjusting your search or removing some filters to see more results."
            : "Try removing a few filters to broaden the results."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Showing <span className="font-semibold text-foreground">{totalResults}</span> result
          {totalResults === 1 ? "" : "s"}{" "}
          {trimmedQuery ? "across your catalog and external sources for " : "in your catalog for "}
          {trimmedQuery ? (
            <span className="font-semibold text-foreground">{trimmedQuery}</span>
          ) : (
            <span className="font-semibold text-foreground">your filters</span>
          )}
          .
        </p>
        {onResetFilters ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-auto rounded-full border-border px-2 py-1 text-muted-foreground hover:border-border hover:text-foreground"
            onClick={onResetFilters}
          >
            <SlidersHorizontal className="h-3 w-3" aria-hidden="true" />
            <span>Reset filters</span>
          </Button>
        ) : null}
      </div>

      {isFetching && !isFetchingNextPage ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          Updating results…
        </div>
      ) : null}

      <div className="rounded-2xl border border-border bg-background/60 p-3">
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
            <SlidersHorizontal className="h-3 w-3" aria-hidden="true" />
          </span>
          <span className="truncate">{filterSummary}</span>
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-medium text-muted-foreground">Sort</p>
        {(
          [
            { key: "relevance", label: "Relevance" },
            { key: "newest", label: "Newest" },
            { key: "rating", label: "Rating" },
          ] as const
        )
          .filter((opt) => (trimmedQuery ? true : opt.key !== "relevance"))
          .map((opt) => {
            const active = effectiveSort === opt.key;
            return (
              <Button
                key={opt.key}
                type="button"
                size="sm"
                variant={active ? "default" : "outline"}
                className="h-8 rounded-full px-3"
                onClick={() => onChangeSort?.(opt.key)}
              >
                {opt.label}
              </Button>
            );
          })}
      </div>

      <Virtuoso
        style={{ height: "calc(100dvh - 340px)" }}
        data={results}
        overscan={200}
        increaseViewportBy={{ top: 200, bottom: 700 }}
        endReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        }}
        components={{
          List: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
            function List(props, ref) {
              return <div ref={ref} className="space-y-2" {...props} />;
            },
          ),
          Footer: () =>
            hasNextPage ? (
              <div className="flex justify-center py-3">
                <Button
                  type="button"
                  className="inline-flex items-center justify-center rounded-full bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                >
                  {isFetchingNextPage ? "Loading more…" : "Load more results"}
                </Button>
              </div>
            ) : null,
        }}
        itemContent={(_index, item) => {
          const resolvedId = isUuid(item.id) ? item.id : (resolvedTitleIds[item.id] ?? null);
          const diary = resolvedId ? diaryMap.get(resolvedId) : null;
          const inWatchlist = diary?.status === "want_to_watch";
          const canSave = Boolean(user) && (isUuid(item.id) || Boolean(item.tmdbId));
          const busy = busyRowId === item.id;

          const right = user ? (
            <div className="flex items-center gap-2">
              {typeof diary?.rating === "number" ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card/50 px-2 py-1 text-[11px] text-muted-foreground">
                  <Star className="h-3 w-3" aria-hidden="true" />
                  {diary.rating}
                </span>
              ) : null}

              <Button
                type="button"
                size="icon"
                variant={inWatchlist ? "secondary" : "outline"}
                className="h-9 w-9 rounded-full"
                onClick={() => toggleWatchlist(item)}
                disabled={!canSave || busy || diaryMutations.updateStatus.isPending}
                title={inWatchlist ? "Remove from watchlist" : "Add to watchlist"}
                aria-label={inWatchlist ? "Remove from watchlist" : "Add to watchlist"}
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : inWatchlist ? (
                  <BookmarkCheck className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <BookmarkPlus className="h-4 w-4" aria-hidden="true" />
                )}
              </Button>
            </div>
          ) : null;

          return <TitleSearchResultRow item={item} query={trimmedQuery} right={right} />;
        }}
      />
    </div>
  );
};

export default SearchTitlesTab;
