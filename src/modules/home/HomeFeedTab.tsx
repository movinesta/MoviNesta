import React, { useMemo } from "react";
import { Chip } from "@/components/ui/Chip";
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

const filterMatchesItem = (
  item: HomeFeedItem,
  filter: FeedFilterKey,
  quickFilter: QuickFilter,
): boolean => {
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
    return (
      item.kind === "friend-rating" ||
      item.kind === "friend-review" ||
      item.kind === "watchlist-add"
    );
  }

  return true;
};

export const FeedSkeleton = () => (
  <div className="space-y-2">
    {[0, 1, 2].map((idx) => (
      <div
        key={`feed-skeleton-${idx}`}
        className="space-y-2 rounded-2xl border border-border bg-card/70 p-3 text-xs shadow-lg"
      >
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 animate-pulse rounded-full bg-border/60" />
          <div className="flex-1 space-y-1">
            <div className="h-3 w-24 animate-pulse rounded bg-border/60" />
            <div className="h-2.5 w-16 animate-pulse rounded bg-border/50" />
          </div>
        </div>
        <div className="h-12 w-20 animate-pulse rounded bg-border/60" />
        <div className="h-3 w-full animate-pulse rounded bg-border/40" />
      </div>
    ))}
  </div>
);

const EmptyFeedState = () => (
  <div className="rounded-2xl border border-dashed border-border bg-card/60 p-4 text-center text-xs text-muted-foreground">
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
        {FEED_FILTERS.map((filter) => {
          const isActive = activeFilter === filter.key;
          const Icon = filter.icon;
          return (
            <button
              key={filter.key}
              type="button"
              onClick={() => setActiveFilter(filter.key)}
              aria-pressed={isActive}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Chip
                variant={isActive ? "accent" : "outline"}
                className="flex items-center gap-1"
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{filter.label}</span>
              </Chip>
            </button>
          );
        })}
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive"
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
            List: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
              function List(props, ref) {
                return <div ref={ref} className="space-y-3" {...props} />;
              },
            ),
            Footer: () => (
              <div className="pt-1">
                {hasMore ? (
                  <button
                    type="button"
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                    className="mx-auto flex items-center justify-center rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-md disabled:opacity-60"
                  >
                    {isLoadingMore ? "Loading more..." : "Load more"}
                  </button>
                ) : (
                  <p className="py-2 text-center text-xs text-muted-foreground">
                    You&apos;re all caught up.
                  </p>
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
