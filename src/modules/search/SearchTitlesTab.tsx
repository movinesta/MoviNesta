// src/modules/search/SearchTitlesTab.tsx
import React from "react";
import { Link } from "react-router-dom";
import { Film, Star, SlidersHorizontal } from "lucide-react";
import { Virtuoso } from "react-virtuoso";
import { Button } from "@/components/ui/Button";
import { supabase } from "../../lib/supabase";
import {
  useSearchTitles,
  type TitleSearchFilters,
  type TitleSearchResult,
} from "./useSearchTitles";

interface SearchTitlesTabProps {
  query: string;
  filters: TitleSearchFilters;
  onResetFilters?: () => void;
}

export const TitleSearchResultRow: React.FC<{ item: TitleSearchResult }> = ({ item }) => {
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
    <div>
      <Link
        to={`/title/${item.id}`}
        className="flex gap-3 rounded-2xl border border-border bg-background/60 p-2 hover:bg-card/80"
      >
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
            <p className="truncate text-[12px] font-medium text-foreground">{item.title}</p>
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
    </div>
  );
};

const SearchTitlesTab: React.FC<SearchTitlesTabProps> = ({ query, filters, onResetFilters }) => {
  const trimmedQuery = query.trim();

  const { data, isLoading, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useSearchTitles({
      query: trimmedQuery,
      filters,
    });

  // 🔥 FIX: flatten react-query infinite data
  const results = data?.pages.flatMap((page) => page.results) ?? [];
  const totalResults = results.length;

  const activeFilterLabels: string[] = [];
  if (filters.type && filters.type !== "all") {
    activeFilterLabels.push(filters.type === "movie" ? "Movies" : "Series");
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

    toSync.forEach((item) => {
      already.add(item.id);

      supabase.functions
        .invoke("catalog-sync", {
          body: {
            external: {
              tmdbId: item.tmdbId ?? undefined,
              imdbId: item.imdbId ?? undefined,
              // TitleType "series" maps to TMDb "tv"
              type: item.type === "series" ? "tv" : "movie",
            },
            options: {
              syncOmdb: true,
              forceRefresh: false,
            },
          },
        })
        .catch((err) => {
          console.warn("[SearchTitlesTab] catalog-sync failed for", item.id, err);
        });
    });
  }, [results]);

  if (!trimmedQuery) {
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
          Searching for <span className="font-semibold text-foreground">{trimmedQuery}</span>…
        </p>
        <p className="text-xs text-muted-foreground">
          Fetching matching titles from your catalog and external sources.
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
          Something went wrong while searching for titles.
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
          No titles found matching{" "}
          <span className="font-semibold text-foreground">{trimmedQuery}</span>.
        </p>
        <p className="text-xs text-muted-foreground">
          Try adjusting your search or removing some filters to see more results.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Showing <span className="font-semibold text-foreground">{totalResults}</span> result
          {totalResults === 1 ? "" : "s"} across your catalog and external sources for{" "}
          <span className="font-semibold text-foreground">{trimmedQuery}</span>.
        </p>
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
      </div>

      <div className="rounded-2xl border border-border bg-background/60 p-3">
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
            <SlidersHorizontal className="h-3 w-3" aria-hidden="true" />
          </span>
          <span className="truncate">{filterSummary}</span>
        </p>
      </div>

      <Virtuoso
        style={{ height: "70vh" }}
        data={results}
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
        itemContent={(index, item) => <TitleSearchResultRow item={item} />}
      />
    </div>
  );
};

export default SearchTitlesTab;
