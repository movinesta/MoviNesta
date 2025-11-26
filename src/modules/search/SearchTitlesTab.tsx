import React from "react";
import { Link } from "react-router-dom";
import { Film, Star, Clock, SlidersHorizontal } from "lucide-react";
import { useSearchTitles, type TitleSearchFilters } from "./useSearchTitles";

interface SearchTitlesTabProps {
  query: string;
  filters: TitleSearchFilters;
}

const SearchTitlesTab: React.FC<SearchTitlesTabProps> = ({ query, filters }) => {
  const trimmedQuery = query.trim();

  const { data, isLoading, isError, error } = useSearchTitles({
    query: trimmedQuery,
    filters,
  });

  if (!trimmedQuery) {
    return (
      <div className="space-y-3">
        <p className="text-[12px] text-mn-text-secondary">
          Start typing a title, director, or genre to search the catalog. As you wire
          Supabase search, results will appear here.
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
            Once analytics are wired up, you can show what your friends and the community
            are watching the most here.
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
            // eslint-disable-next-line react/no-array-index-key
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
        <p className="text-[12px] text-mn-text-secondary">
          No titles found for{" "}
          <span className="rounded border border-mn-border-subtle/80 bg-mn-bg px-1.5 py-0.5 text-[11px] font-medium text-mn-text-primary">
            &ldquo;{trimmedQuery}&rdquo;
          </span>
          . Try another spelling, or a different title.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-mn-text-secondary">
          Showing {results.length} title{results.length === 1 ? "" : "s"} for{" "}
          <span className="rounded border border-mn-border-subtle/80 bg-mn-bg px-1.5 py-0.5 text-[11px] font-medium text-mn-text-primary">
            &ldquo;{trimmedQuery}&rdquo;
          </span>
          .
        </p>
        <div className="inline-flex items-center gap-1 rounded-full border border-mn-border-subtle/70 bg-mn-bg/80 px-2 py-0.5 text-[10px] text-mn-text-muted">
          <SlidersHorizontal className="h-3 w-3" aria-hidden="true" />
          <span>Filters coming soon</span>
        </div>
      </div>

      <ul className="divide-y divide-mn-border-subtle/60 rounded-mn-card border border-mn-border-subtle bg-mn-bg/60">
        {results.map((item) => {
          const metaPieces: string[] = [];
          if (item.type) {
            metaPieces.push(
              item.type === "movie"
                ? "Movie"
                : item.type === "series"
                ? "Series"
                : item.type === "anime"
                ? "Anime"
                : "Short",
            );
          }
          if (item.ageRating) {
            metaPieces.push(item.ageRating);
          }
          if (item.originalLanguage) {
            metaPieces.push(item.originalLanguage.toUpperCase());
          }

          return (
            <li key={item.id}>
              <Link
                to={`/title/${item.id}`}
                className="flex gap-3 px-3 py-2 transition hover:bg-mn-border-subtle/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
              >
                <div className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-mn-primary/20 text-mn-primary">
                  <Film className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-mn-text-primary">
                    {item.title}
                    {item.year ? (
                      <span className="ml-1 text-[11px] font-normal text-mn-text-muted">
                        ({item.year})
                      </span>
                    ) : null}
                  </p>
                  {metaPieces.length > 0 && (
                    <p className="mt-0.5 text-[11px] text-mn-text-secondary">
                      {metaPieces.join(" • ")}
                    </p>
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
