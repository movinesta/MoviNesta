import React, { useMemo } from "react";
import { BookmarkPlus, MessageSquare, Sparkles, Star } from "lucide-react";
import { Virtuoso } from "react-virtuoso";
import HomeFeedItemCard from "./HomeFeedItemCard";
import type { HomeFeedItem } from "./homeFeedTypes";
import { useHomeFeed } from "./useHomeFeed";

const FEED_FILTERS = [
  { key: "all", label: "All", icon: MessageSquare },
  { key: "ratings", label: "Ratings", icon: Star },
  { key: "reviews", label: "Reviews", icon: MessageSquare },
  { key: "watchlist", label: "Watchlist", icon: BookmarkPlus },
  { key: "recommendations", label: "Recs", icon: Sparkles },
] as const;

type FeedFilterKey = (typeof FEED_FILTERS)[number]["key"];

const filterMatchesItem = (item: HomeFeedItem, filter: FeedFilterKey, quickFilter: QuickFilter): boolean => {
  const matchesFeedFilter = (() => {
    switch (filter) {
      case "ratings":
        return item.kind === "friend-rating";
      case "reviews":
        return item.kind === "friend-review";
      case "watchlist":
        return item.kind === "watchlist-add";
      case "recommendations":
        return item.kind === "recommendation";
      case "all":
      default:
        return true;
    }
  })();

  if (!matchesFeedFilter) return false;

  if (quickFilter === "reviews") {
    return item.kind === "friend-review";
  }

  if (quickFilter === "follows") {
    return item.kind === "friend-rating" || item.kind === "friend-review" || item.kind === "watchlist-add";
  }

  return true;
};

export const FeedSkeleton = () => (
  <div className="space-y-2">
    {[0, 1, 2].map((idx) => (
      <div
        key={`feed-skeleton-${idx}`}
        className="space-y-2 rounded-mn-card border border-mn-border-subtle/80 bg-mn-bg-elevated/70 p-3 text-[11px] shadow-mn-card"
      >
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 animate-pulse rounded-full bg-mn-border-subtle/60" />
          <div className="flex-1 space-y-1">
            <div className="h-3 w-24 animate-pulse rounded bg-mn-border-subtle/60" />
            <div className="h-2.5 w-16 animate-pulse rounded bg-mn-border-subtle/50" />
          </div>
        </div>
        <div className="h-12 w-20 animate-pulse rounded bg-mn-border-subtle/60" />
        <div className="h-3 w-full animate-pulse rounded bg-mn-border-subtle/40" />
      </div>
    ))}
  </div>
);

const EmptyFeedState = () => (
  <div className="rounded-mn-card border border-dashed border-mn-border-subtle/70 bg-mn-bg-elevated/60 p-4 text-center text-[11px] text-mn-text-secondary">
    Your friends’ activity will show up here once they start rating and reviewing titles.
  </div>
);

export type QuickFilter = "all" | "follows" | "reviews";

interface HomeFeedTabProps {
  isFiltersSheetOpen: boolean;
  onFiltersSheetOpenChange: (open: boolean) => void;
  quickFilter: QuickFilter;
}

const HomeFeedTab: React.FC<HomeFeedTabProps> = ({ quickFilter }) => {
  const { items, isLoading, hasMore, isLoadingMore, loadMore, error } = useHomeFeed();
  const [activeFilter, setActiveFilter] = React.useState<FeedFilterKey>("all");

  const filteredItems = useMemo(
    () => items.filter((item) => filterMatchesItem(item, activeFilter, quickFilter)),
    [items, activeFilter, quickFilter],
  );

  const handleLoadMore = () => {
    if (hasMore && !isLoadingMore) {
      loadMore();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {FEED_FILTERS.map((filter) => (
          <button
            type="button"
            key={filter.key}
            onClick={() => setActiveFilter(filter.key)}
            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] transition-colors ${
              activeFilter === filter.key
                ? "border-mn-primary/60 bg-mn-primary/10 text-mn-text-primary"
                : "border-mn-border-subtle/80 bg-mn-bg-elevated/70 text-mn-text-secondary hover:border-mn-primary/50"
            }`}
            aria-pressed={activeFilter === filter.key}
          >
            <filter.icon className="h-3.5 w-3.5" aria-hidden />
            {filter.label}
          </button>
        ))}
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-mn-error/50 bg-mn-error/10 px-3 py-2 text-[11px] text-mn-error"
        >
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          <FeedSkeleton />
          <FeedSkeleton />
          <FeedSkeleton />
        </div>
      ) : filteredItems.length === 0 ? (
        <EmptyFeedState />
      ) : (
        <Virtuoso
          style={{ height: "70vh" }}
          data={filteredItems}
          computeItemKey={(_, item) => item.id}
          endReached={handleLoadMore}
          components={{
            List: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>((props, ref) => (
              <div ref={ref} className="space-y-3" {...props} />
            )),
            Footer: () => (
              <div className="pt-1">
                {hasMore ? (
                  <button
                    type="button"
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                    className="mx-auto flex items-center justify-center rounded-full border border-mn-border-subtle bg-mn-bg-elevated px-3 py-1.5 text-[11px] text-mn-text-secondary shadow-mn-soft disabled:opacity-60"
                  >
                    {isLoadingMore ? "Loading more..." : "Load more"}
                  </button>
                ) : (
                  <p className="py-2 text-center text-[11px] text-mn-text-muted">You&apos;re all caught up.</p>
                )}
              </div>
            ),
          }}
          itemContent={(index, item) => (
            <div className="pb-1">
              <HomeFeedItemCard item={item} />
            </div>
          )}
        />
      )}
    </div>
  );
};

export default HomeFeedTab;
