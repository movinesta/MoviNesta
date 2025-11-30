import React from "react";
import { Link } from "react-router-dom";
import { Film, Star, SlidersHorizontal } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useSearchTitles, type TitleSearchFilters } from "./useSearchTitles";

interface SearchTitlesTabProps {
  query: string;
  filters: TitleSearchFilters;
  onResetFilters?: () => void;
}

const SearchTitlesTab: React.FC<SearchTitlesTabProps> = ({ query, filters, onResetFilters }) => {
  const trimmedQuery = query.trim();

  const { data, isLoading, isError, error } = useSearchTitles({
    query: trimmedQuery,
    filters,
  });

  const activeFilterLabels = React.useMemo(() => {
    const labels: string[] = [];

    if (filters.type && filters.type !== "all") {
      labels.push(`Type: ${filters.type.charAt(0).toUpperCase()}${filters.type.slice(1)}`);
    }

    if (filters.minYear || filters.maxYear) {
      const min = filters.minYear ?? "Any";
      const max = filters.maxYear ?? "Now";
      labels.push(`Years ${min}–${max}`);
    }

    if (filters.originalLanguage) {
      labels.push(`Language ${filters.originalLanguage.toUpperCase()}`);
    }

    return labels;
  }, [filters.maxYear, filters.minYear, filters.originalLanguage, filters.type]);

  const hasFiltersApplied =
    filters.type !== "all" ||
    typeof filters.minYear === "number" ||
    typeof filters.maxYear === "number" ||
    Boolean(filters.originalLanguage);

  const filterSummary = activeFilterLabels.length
    ? activeFilterLabels.join(" • ")
    : "No filters applied";

  // Lazily trigger metadata sync (TMDb + OMDb) for titles that are missing external ratings.
  // We only fire a few per search to avoid spamming the edge function.
  const syncedIdsRef = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    if (!data || !Array.isArray(data)) return;
    const already = syncedIdsRef.current;

    const toSync = data
      .filter((item) => {
        if (already.has(item.id)) return false;
        // Only sync when we have an ID to work with and no external ratings yet.
        if (!item.imdbId && !item.tmdbId) return false;
        if (item.imdbRating || item.rtTomatoMeter) return false;
        return true;
      })
      .slice(0, 3); // cap per render

    toSync.forEach((item) => {
      already.add(item.id);
      supabase.functions
        .invoke("sync-title-metadata", {
          body: {
            imdbId: item.imdbId ?? undefined,
            tmdbId: item.tmdbId ?? undefined,
            type: item.type ?? "movie",
          },
        })
        .catch((err) => {
          console.warn("[SearchTitlesTab] sync-title-metadata failed for", item.id, err);
        });
    });
  }, [data]);

  if (!trimmedQuery) {
    return (
      <div className="space-y-3">
        <p className="text-[12px] text-mn-text-secondary">
          Start typing a title, director, or genre to search the catalog. As you wire Supabase
          search, results will appear here.
        </p>

        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-mn-text-primary">Try searching for</p>
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            {[
              "Comfort movie for a rainy night",
              "Slow & cozy drama",
              "Animated comfort series",
              "Sci‑fi with found family",
            ].map((label) => (
              <span
                key={label}
                className="inline-flex items-center rounded-full border border-mn-border-subtle bg-mn-bg px-2 py-1 text-[11px] text-mn-text-secondary"
              >
                <Film className="mr-1 h-3 w-3 text-mn-text-muted" aria-hidden="true" />
                {label}
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-1.5 rounded-mn-card border border-mn-border-subtle bg-mn-bg/60 p-3">
          <p className="flex items-center gap-1 text-[11px] font-medium text-mn-text-primary">
            <Star className="h-3.5 w-3.5 text-mn-primary" aria-hidden="true" />
            <span>Trending this week</span>
          </p>
          <p className="text-[11px] text-mn-text-muted">
            Once analytics are wired up, you can show what your friends and the community are
            watching the most here.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="h-3 w-40 rounded bg-mn-border-subtle/40" />
          <div className="h-3 w-32 rounded bg-mn-border-subtle/30" />
        </div>
        <div className="space-y-1.5 rounded-mn-card border border-mn-border-subtle bg-mn-bg/60 p-2.5">
          {[0, 1, 2].map((idx) => (
            <div key={idx} className="flex items-center gap-3 rounded-xl px-1 py-1.5">
              <div className="h-9 w-9 rounded-lg bg-mn-border-subtle/40" />
              <div className="flex-1 space-y-1">
                <div className="h-3 w-32 rounded bg-mn-border-subtle/40" />
                <div className="h-2.5 w-24 rounded bg-mn-border-subtle/30" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div
        role="alert"
        className="space-y-1 rounded-mn-card border border-mn-error/60 bg-mn-error/10 p-3 text-[11px] text-mn-error"
      >
        <p className="font-medium">We couldn&apos;t search titles right now.</p>
        <p className="text-[10px] opacity-90">
          {error instanceof Error ? error.message : "Unknown error. Please try again."}
        </p>
      </div>
    );
  }

  const results = data ?? [];

  if (!results.length) {
    return (
      <div className="space-y-3">
        <div className="space-y-1">
          <p className="text-[12px] text-mn-text-secondary">
            No titles found for{" "}
            <span className="rounded border border-mn-border-subtle/80 bg-mn-bg px-1.5 py-0.5 text-[11px] font-medium text-mn-text-primary">
              &ldquo;{trimmedQuery}&rdquo;
            </span>
            . Try another spelling, a different title, or adjust your filters.
          </p>
          {hasFiltersApplied ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-mn-border-subtle/70 bg-mn-bg/70 px-2 py-1 text-[10px] text-mn-text-secondary">
              <SlidersHorizontal className="h-3 w-3" aria-hidden />
              <span className="leading-tight">
                Filters are active:{" "}
                {filterSummary === "No filters applied" ? "custom options" : filterSummary}.
              </span>
              {onResetFilters ? (
                <button
                  type="button"
                  onClick={onResetFilters}
                  className="rounded-full bg-mn-primary/10 px-2 py-1 text-[10px] font-semibold text-mn-primary transition hover:bg-mn-primary/15"
                >
                  Reset filters
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-mn-text-secondary" aria-live="polite">
          Showing {results.length} title{results.length === 1 ? "" : "s"} for{" "}
          <span className="rounded border border-mn-border-subtle/80 bg-mn-bg px-1.5 py-0.5 text-[11px] font-medium text-mn-text-primary">
            &ldquo;{trimmedQuery}&rdquo;
          </span>
          .
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex max-w-[60%] items-center gap-1 rounded-full border border-mn-border-subtle/70 bg-mn-bg/80 px-2 py-0.5 text-[10px] text-mn-text-muted">
            <SlidersHorizontal className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span
              className="line-clamp-2 text-left leading-tight text-mn-text-secondary"
              aria-live="polite"
            >
              {filterSummary}
            </span>
          </div>
          {hasFiltersApplied && onResetFilters ? (
            <button
              type="button"
              onClick={onResetFilters}
              className="inline-flex items-center gap-1 rounded-full border border-transparent bg-mn-primary/10 px-2 py-1 text-[10px] font-semibold text-mn-primary transition hover:bg-mn-primary/15"
            >
              Reset filters
            </button>
          ) : null}
        </div>
      </div>

      <ul className="divide-y divide-mn-border-subtle/60 rounded-mn-card border border-mn-border-subtle bg-mn-bg/60">
        {results.map((item) => {
          const metaPieces: string[] = [];
          if (item.type) {
            const typeLabel =
              item.type === "movie"
                ? "Movie"
                : item.type === "series"
                  ? "Series"
                  : item.type === "anime"
                    ? "Anime"
                    : null;

            if (typeLabel) {
              metaPieces.push(typeLabel);
            }
          }
          if (item.ageRating) {
            metaPieces.push(item.ageRating);
          }
          if (item.originalLanguage) {
            metaPieces.push(item.originalLanguage.toUpperCase());
          }

          const imdbRating =
            typeof item.imdbRating === "number" &&
            !Number.isNaN(item.imdbRating) &&
            item.imdbRating > 0
              ? item.imdbRating
              : null;
          const rtRating =
            typeof item.rtTomatoMeter === "number" &&
            !Number.isNaN(item.rtTomatoMeter) &&
            item.rtTomatoMeter > 0
              ? item.rtTomatoMeter
              : null;

          return (
            <li key={item.id}>
              <Link
                to={`/title/${item.id}`}
                className="flex gap-3 px-3 py-2 transition hover:bg-mn-border-subtle/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
              >
                <div className="relative mt-0.5 h-16 w-12 shrink-0 overflow-hidden rounded-md bg-mn-border-subtle/50">
                  {item.posterUrl ? (
                    <img
                      src={item.posterUrl}
                      alt={`Poster for ${item.title}`}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-mn-primary/70">
                      <Film className="h-5 w-5" aria-hidden="true" />
                      <span className="sr-only">No poster available</span>
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-[13px] font-medium text-mn-text-primary">
                      {item.title}
                      {item.year ? (
                        <span className="ml-1 text-[11px] font-normal text-mn-text-muted">
                          ({item.year})
                        </span>
                      ) : null}
                    </p>
                    <div
                      className="flex shrink-0 flex-wrap justify-end gap-1 text-[10px] text-mn-text-secondary"
                      aria-live="polite"
                    >
                      {imdbRating ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-mn-border-subtle bg-mn-bg px-2 py-0.5 font-semibold text-mn-text-primary">
                          <Star className="h-3 w-3 text-amber-500" aria-hidden />
                          IMDb {imdbRating.toFixed(1)}
                        </span>
                      ) : null}
                      {rtRating ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-mn-border-subtle bg-mn-bg px-2 py-0.5 font-semibold text-mn-text-primary">
                          <span aria-hidden className="text-[12px]">
                            🍅
                          </span>
                          RT {rtRating}%
                        </span>
                      ) : null}
                      {!imdbRating && !rtRating ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-mn-border-subtle/70 bg-mn-bg px-2 py-0.5 font-medium text-mn-text-muted">
                          <Star className="h-3 w-3 text-mn-text-muted" aria-hidden />
                          Not rated yet
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {metaPieces.length > 0 && (
                    <p className="text-[11px] text-mn-text-secondary">{metaPieces.join(" • ")}</p>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default SearchTitlesTab;
