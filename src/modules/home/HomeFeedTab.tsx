import { qk } from "../../lib/queryKeys";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import {
  BookmarkPlus,
  Film,
  MessageCircle,
  MoreHorizontal,
  Sparkles,
  Star,
  ThumbsUp,
  UserPlus,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import type { Database } from "@/types/supabase";

type FeedEventType = "review" | "rating" | "watchlist" | "follow" | "recommendation";
type AvatarColorKey = "teal" | "violet" | "orange";

type ActivityEventRow = Database["public"]["Tables"]["activity_events"]["Row"];
type TitleRow = Database["public"]["Tables"]["titles"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type FollowRow = Database["public"]["Tables"]["follows"]["Row"];

interface FeedTitle {
  id: string;
  name: string;
  year: number;
  posterUrl?: string;
}

interface FeedUser {
  id: string;
  displayName: string;
  username: string;
  avatarInitials: string;
  avatarColor: AvatarColorKey;
}

type MaybeString = string | null | undefined;

function buildAvatarInitials(displayName?: MaybeString, username?: MaybeString): string {
  const source = (displayName ?? username ?? "").trim();

  if (!source) {
    return "?";
  }

  const parts = source.split(/\s+/);

  if (parts.length >= 2) {
    const first = parts[0]?.[0] ?? "";
    const second = parts[1]?.[0] ?? "";
    const initials = (first + second).trim();
    return initials ? initials.toUpperCase() : "?";
  }

  const cleaned = parts[0].replace(/[^A-Za-z0-9]/g, "");
  if (!cleaned) {
    return "?";
  }

  if (cleaned.length === 1) {
    return cleaned.toUpperCase();
  }

  return (cleaned[0] + cleaned[cleaned.length - 1]).toUpperCase();
}

interface FeedEvent {
  id: string;
  type: FeedEventType;
  createdAt: string;
  createdAtLabel: string;
  user: FeedUser;
  title?: FeedTitle;
  rating?: number;
  reviewSnippet?: string;
  extra?: string;
  emoji?: string;
}

interface FeedGroup {
  title: FeedTitle;
  events: FeedEvent[];
  latestCreatedAt: string;
}

type FeedItem =
  | { kind: "titleGroup"; id: string; group: FeedGroup }
  | { kind: "standalone"; id: string; event: FeedEvent };

const FEED_FILTERS = [
  { key: "all", label: "All", icon: null },
  { key: "reviews", label: "Reviews", icon: Film },
  { key: "ratings", label: "Ratings", icon: Star },
  { key: "watchlist", label: "Watchlist", icon: BookmarkPlus },
  { key: "follows", label: "Follows", icon: UserPlus },
  { key: "recommendations", label: "Recs", icon: Sparkles },
] as const;

type FeedFilter = (typeof FEED_FILTERS)[number]["key"];

type QuickFilter = "all" | "follows" | "reviews";

interface UseFeedResult {
  items: FeedItem[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  loadMore: () => void;
}

const avatarColorClassName: Record<AvatarColorKey, string> = {
  teal: "bg-mn-accent-teal/25 text-mn-accent-teal",
  violet: "bg-mn-accent-violet/25 text-mn-accent-violet",
  orange: "bg-mn-primary/20 text-mn-primary",
};

const getFriendlyFeedErrorMessage = (error: Error): string => {
  const raw = error?.message ?? "";
  const lowered = raw.toLowerCase();

  if (
    lowered.includes("network") ||
    lowered.includes("failed to fetch") ||
    lowered.includes("fetch")
  ) {
    return "We couldn’t reach the server to load your feed. Check your connection and try again in a moment.";
  }

  if (lowered.includes("unauthorized") || lowered.includes("401") || lowered.includes("403")) {
    return "We couldn’t load your feed because your session may have expired. Try signing out and back in.";
  }

  return "Something went wrong while loading your feed. Please try again.";
};

const buildGroupedItems = (events: FeedEvent[]): FeedItem[] => {
  const groupsByTitle = new Map<string, FeedGroup>();
  const standalone: FeedEvent[] = [];

  events.forEach((event) => {
    if (event.title) {
      const key = event.title.id;
      const existing = groupsByTitle.get(key);
      if (existing) {
        existing.events.push(event);
        if (event.createdAt > existing.latestCreatedAt) {
          existing.latestCreatedAt = event.createdAt;
        }
      } else {
        groupsByTitle.set(key, {
          title: event.title,
          events: [event],
          latestCreatedAt: event.createdAt,
        });
      }
    } else {
      standalone.push(event);
    }
  });

  const items: FeedItem[] = [];

  groupsByTitle.forEach((group) => {
    items.push({
      kind: "titleGroup",
      id: `group-${group.title.id}`,
      group,
    });
  });

  standalone.forEach((event) => {
    items.push({
      kind: "standalone",
      id: event.id,
      event,
    });
  });

  items.sort((a, b) => {
    const aTime = a.kind === "titleGroup" ? a.group.latestCreatedAt : a.event.createdAt;
    const bTime = b.kind === "titleGroup" ? b.group.latestCreatedAt : b.event.createdAt;

    if (aTime < bTime) return 1;
    if (aTime > bTime) return -1;
    return 0;
  });

  return items;
};

const FEED_PAGE_SIZE = 80;

type ActivityPayload = ActivityEventRow["payload"];

interface NormalizedActivityPayload {
  rating?: number;
  review_snippet?: string;
  headline?: string;
  extra?: string;
  emoji?: string;
}

const normalizeActivityPayload = (payload: ActivityPayload): NormalizedActivityPayload => {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const record = payload as Record<string, unknown>;

    return {
      rating: typeof record.rating === "number" ? record.rating : undefined,
      review_snippet: typeof record.review_snippet === "string" ? record.review_snippet : undefined,
      headline: typeof record.headline === "string" ? record.headline : undefined,
      extra: typeof record.extra === "string" ? record.extra : undefined,
      emoji: typeof record.emoji === "string" ? record.emoji : undefined,
    };
  }

  return {};
};

const mapActivityTypeToFeedType = (eventType: string): FeedEventType | null => {
  switch (eventType) {
    case "rating_created":
      return "rating";
    case "review_created":
      return "review";
    case "watchlist_added":
      return "watchlist";
    case "follow_created":
      return "follow";
    default:
      return null;
  }
};

const formatTimeAgo = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Recently";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 45) return "Just now";

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) {
    return `${diffWeeks} wk${diffWeeks === 1 ? "" : "s"} ago`;
  }

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) {
    return `${diffMonths} mo${diffMonths === 1 ? "" : "s"} ago`;
  }

  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears} yr${diffYears === 1 ? "" : "s"} ago`;
};

const pickAvatarColor = (id: string): AvatarColorKey => {
  let sum = 0;
  for (let i = 0; i < id.length; i += 1) {
    sum += id.charCodeAt(i);
  }
  const idx = sum % 3;
  if (idx === 0) return "teal";
  if (idx === 1) return "violet";
  return "orange";
};

const fetchHomeFeed = async (
  userId: string,
  cursor: string | null = null,
): Promise<{ items: FeedItem[]; nextCursor: string | null; hasMore: boolean }> => {
  // 1) Which users are in scope? Self + people you follow.
  const { data: followsData, error: followsError } = await supabase
    .from("follows")
    .select("followed_id")
    .eq("follower_id", userId);

  if (followsError) {
    console.warn("[HomeFeedTab] Failed to load follows", followsError.message);
  }

  const friendIds = (followsData ?? [])
    .map((row: FollowRow) => row.followed_id)
    .filter((id): id is string => Boolean(id));

  const scopedUserIds = Array.from(new Set<string>([userId, ...friendIds]));

  if (scopedUserIds.length === 0) {
    return { items: [], nextCursor: null, hasMore: false };
  }

  // 2) Load recent activity events for those users with cursor-based pagination.
  let eventsQuery = supabase
    .from("activity_events")
    .select("id, created_at, user_id, event_type, title_id, related_user_id, payload")
    .in("user_id", scopedUserIds)
    .order("created_at", { ascending: false });

  if (cursor) {
    eventsQuery = eventsQuery.lt("created_at", cursor);
  }

  const { data: eventsData, error: eventsError } = await eventsQuery.limit(FEED_PAGE_SIZE + 1);

  if (eventsError) {
    throw new Error(eventsError.message);
  }

  const rows = eventsData ?? [];

  if (!rows.length) {
    return { items: [], nextCursor: null, hasMore: false };
  }

  const hasMore = rows.length > FEED_PAGE_SIZE;
  const pageRows = hasMore ? rows.slice(0, FEED_PAGE_SIZE) : rows;

  const titleIds = Array.from(
    new Set(pageRows.map((row) => row.title_id).filter((id): id is string => Boolean(id))),
  );

  const actorUserIds = Array.from(
    new Set(
      pageRows
        .flatMap((row) => [row.user_id, row.related_user_id])
        .filter((value): value is string => Boolean(value)),
    ),
  );

  const [titlesResult, profilesResult] = await Promise.all([
    titleIds.length
      ? supabase
          .from("titles")
          .select("title_id, primary_title, release_year, poster_url, backdrop_url")
          .in("title_id", titleIds)
      : Promise.resolve({ data: [] as TitleRow[], error: null }),
    actorUserIds.length
      ? supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url")
          .in("id", actorUserIds)
      : Promise.resolve({ data: [] as ProfileRow[], error: null }),
  ]);

  if (titlesResult.error) {
    console.warn("[HomeFeedTab] Failed to load titles for feed", titlesResult.error.message);
  }

  if (profilesResult.error) {
    console.warn("[HomeFeedTab] Failed to load profiles for feed", profilesResult.error.message);
  }

  const titlesById = new Map<string, TitleRow>();
  const titleRows = titlesResult.data ?? [];
  titleRows.forEach((row) => {
    titlesById.set(row.title_id, row);
  });

  const profilesById = new Map<string, ProfileRow>();
  const profileRows = profilesResult.data ?? [];
  profileRows.forEach((row) => {
    profilesById.set(row.id, row);
  });

  const events: FeedEvent[] = [];

  pageRows.forEach((row) => {
    const feedType = mapActivityTypeToFeedType(row.event_type);
    if (!feedType) return;

    const actorProfile = profilesById.get(row.user_id) ?? null;
    const targetProfile = row.related_user_id
      ? (profilesById.get(row.related_user_id) ?? null)
      : null;

    const displayName = actorProfile?.display_name ?? actorProfile?.username ?? "Someone";
    const username = actorProfile?.username ?? actorProfile?.display_name ?? "";

    const user: FeedUser = {
      id: row.user_id,
      displayName,
      username,
      avatarInitials: buildAvatarInitials(displayName || username || "S"),
      avatarColor: pickAvatarColor(row.user_id),
    };

    const titleRow = row.title_id ? (titlesById.get(row.title_id) ?? null) : null;
    const title: FeedTitle | undefined = titleRow
      ? {
          id: row.title_id,
          name: titleRow.primary_title ?? "Untitled",
          year: titleRow.release_year ?? new Date().getFullYear(),
          posterUrl: titleRow.poster_url ?? titleRow.backdrop_url ?? undefined,
        }
      : undefined;

    const payload = normalizeActivityPayload(row.payload);

    let rating: number | undefined;
    let reviewSnippet: string | undefined;
    let extra: string | undefined = payload.extra;
    const emoji: string | undefined = payload.emoji;

    if (feedType === "rating" || feedType === "review") {
      rating = typeof payload.rating === "number" ? payload.rating : undefined;
      reviewSnippet = payload.review_snippet;
    }

    if (feedType === "follow") {
      if (row.related_user_id === userId) {
        extra = "started following you";
      } else if (targetProfile) {
        const targetName = targetProfile.display_name ?? targetProfile.username ?? "someone";
        extra = `started following ${targetName}`;
      } else if (!extra) {
        extra = "started following someone";
      }
    }

    events.push({
      id: row.id,
      type: feedType,
      createdAt: row.created_at,
      createdAtLabel: formatTimeAgo(row.created_at),
      user,
      title,
      rating,
      reviewSnippet,
      extra,
      emoji,
    });
  });

  const items = buildGroupedItems(events);
  const nextCursor = hasMore ? (pageRows[pageRows.length - 1]?.created_at ?? null) : null;

  return { items, nextCursor, hasMore };
};

const useFeed = (): UseFeedResult => {
  const { user } = useAuth();

  const { data, isLoading, isFetching, error, fetchNextPage, isFetchingNextPage, hasNextPage } =
    useInfiniteQuery<{ items: FeedItem[]; nextCursor: string | null; hasMore: boolean }, Error>({
      queryKey: qk.homeFeed(user?.id ?? null),
      enabled: Boolean(user?.id),
      initialPageParam: null as string | null,
      staleTime: 1000 * 15,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      keepPreviousData: true,
      queryFn: async ({ pageParam }) => {
        if (!user?.id) {
          return { items: [], nextCursor: null, hasMore: false };
        }
        return fetchHomeFeed(user.id, pageParam);
      },
      getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : null),
    });

  const items = useMemo(() => (data?.pages ?? []).flatMap((page) => page.items), [data]);

  const friendlyError = error ? getFriendlyFeedErrorMessage(error) : null;

  if (error) {
    console.error("[HomeFeedTab] Failed to load feed", error);
  }

  const isInitialLoading = isLoading || (!data && isFetching);

  return {
    items,
    isLoading: isInitialLoading,
    isLoadingMore: isFetchingNextPage,
    hasMore: Boolean(hasNextPage),
    error: friendlyError,
    loadMore: () => {
      if (hasNextPage) {
        fetchNextPage();
      }
    },
  };
};

const filterMatchesItem = (item: FeedItem, filter: FeedFilter): boolean => {
  if (filter === "all") return true;

  const matchesEvent = (event: FeedEvent): boolean => {
    switch (filter) {
      case "reviews":
        return event.type === "review";
      case "ratings":
        return event.type === "rating";
      case "watchlist":
        return event.type === "watchlist";
      case "follows":
        return event.type === "follow";
      case "recommendations":
        return event.type === "recommendation";
      default:
        return true;
    }
  };

  if (item.kind === "standalone") {
    return matchesEvent(item.event);
  }

  return item.group.events.some(matchesEvent);
};

interface HomeFeedTabProps {
  isFiltersSheetOpen?: boolean;
  onFiltersSheetOpenChange?: (open: boolean) => void;
  quickFilter?: QuickFilter;
}

const HomeFeedTab: React.FC<HomeFeedTabProps> = ({
  isFiltersSheetOpen = false,
  onFiltersSheetOpenChange,
  quickFilter = "all",
}) => {
  const { items, isLoading, isLoadingMore, hasMore, error, loadMore } = useFeed();
  const [filter, setFilter] = useState<FeedFilter>("all");
  const filtersDialogRef = useRef<HTMLDivElement | null>(null);
  const filtersCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const lastFiltersTriggerRef = useRef<HTMLElement | null>(null);
  const wasFiltersOpenRef = useRef(false);

  useEffect(() => {
    setFilter(quickFilter as FeedFilter);
  }, [quickFilter]);

  useEffect(() => {
    if (!isFiltersSheetOpen) {
      if (wasFiltersOpenRef.current && lastFiltersTriggerRef.current) {
        lastFiltersTriggerRef.current.focus();
      }
      wasFiltersOpenRef.current = false;
      return;
    }

    wasFiltersOpenRef.current = true;

    const previousActive = document.activeElement;
    if (previousActive instanceof HTMLElement) {
      lastFiltersTriggerRef.current = previousActive;
    }

    const dialogEl = filtersDialogRef.current;
    const focusable = dialogEl?.querySelectorAll<HTMLElement>(
      "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
    );

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!dialogEl) return;

      if (event.key === "Escape") {
        event.preventDefault();
        onFiltersSheetOpenChange?.(false);
        return;
      }

      if (event.key !== "Tab" || !focusable || focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey) {
        if (document.activeElement === first) {
          event.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    dialogEl?.addEventListener("keydown", handleKeyDown);

    queueMicrotask(() => {
      (filtersCloseButtonRef.current ?? focusable?.[0] ?? dialogEl)?.focus();
    });

    return () => dialogEl?.removeEventListener("keydown", handleKeyDown);
  }, [isFiltersSheetOpen, onFiltersSheetOpenChange]);

  const filteredItems = useMemo(
    () => items.filter((item) => filterMatchesItem(item, filter)),
    [items, filter],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 text-[12px] text-mn-text-secondary">
        <span>{isLoading ? "Loading your feed…" : `${filteredItems.length} updates`}</span>
      </div>

      {isFiltersSheetOpen && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Close filters"
          className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              onFiltersSheetOpenChange?.(false);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === "Escape" || event.key === " ") {
              onFiltersSheetOpenChange?.(false);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Filter home feed"
            className="w-full max-w-sm rounded-t-3xl bg-mn-bg-elevated p-3 pb-4 shadow-mn-soft sm:rounded-3xl"
            tabIndex={-1}
            ref={filtersDialogRef}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-[12px] font-semibold text-mn-text-primary">Feed filters</h2>
              <button
                type="button"
                ref={filtersCloseButtonRef}
                onClick={() => onFiltersSheetOpenChange?.(false)}
                className="text-[11px] text-mn-text-muted hover:text-mn-text-secondary"
              >
                Close
              </button>
            </div>
            <div className="flex flex-wrap gap-1 text-[11px]">
              {FEED_FILTERS.map(({ key, label, icon: Icon }) => {
                const isActive = filter === key;

                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => {
                      setFilter(key);
                      onFiltersSheetOpenChange?.(false);
                    }}
                    className={[
                      "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 transition",
                      isActive
                        ? "border-mn-primary bg-mn-primary/15 text-mn-primary"
                        : "border-mn-border-subtle/70 bg-mn-bg/80 text-mn-text-muted hover:text-mn-text-secondary",
                    ].join(" ")}
                  >
                    {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-mn-error/50 bg-mn-error/10 px-3 py-2 text-[11px] text-mn-error"
        >
          {error}
        </div>
      )}

      {isLoading ? (
        <FeedSkeleton />
      ) : filteredItems.length === 0 ? (
        <EmptyFeedState />
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) =>
            item.kind === "titleGroup" ? (
              <TitleFeedCard key={item.id} group={item.group} />
            ) : (
              <StandaloneFeedCard key={item.id} event={item.event} />
            ),
          )}
          {hasMore && (
            <div className="pt-1">
              <button
                type="button"
                onClick={loadMore}
                disabled={isLoadingMore}
                className="mx-auto flex items-center justify-center rounded-full border border-mn-border-subtle bg-mn-bg-elevated px-3 py-1.5 text-[11px] text-mn-text-secondary shadow-mn-soft disabled:opacity-60"
              >
                {isLoadingMore ? "Loading more..." : "Load more"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface TitleFeedCardProps {
  group: FeedGroup;
}

const TitleFeedCard: React.FC<TitleFeedCardProps> = ({ group }) => {
  const sortedEvents = useMemo(
    () =>
      [...group.events].sort((a, b) => {
        if (a.createdAt < b.createdAt) return 1;
        if (a.createdAt > b.createdAt) return -1;
        return 0;
      }),
    [group.events],
  );

  const primaryEvent = sortedEvents[0];
  const secondaryEvents = sortedEvents.slice(1);
  const hasReview = sortedEvents.some((event) => event.type === "review");
  const hasRatingOnly = sortedEvents.some((event) => event.type === "rating");
  const hasWatchlist = sortedEvents.some((event) => event.type === "watchlist");
  const hasRecommendation = sortedEvents.some((event) => event.type === "recommendation");

  return (
    <article className="flex gap-3 rounded-mn-card border border-mn-border-subtle/85 bg-mn-bg-elevated/85 p-3 text-[11px] shadow-mn-card">
      {/* Poster */}
      <Link
        to={`/title/${group.title.id}`}
        className="relative flex h-24 w-16 shrink-0 overflow-hidden rounded-mn-card bg-mn-bg/80 shadow-mn-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
      >
        {group.title.posterUrl ? (
          <img
            src={group.title.posterUrl}
            alt={group.title.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-mn-accent-violet/45 via-mn-bg/40 to-mn-primary/75" />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent" />
        <div className="pointer-events-none absolute bottom-1 left-1 right-1 space-y-0.5 px-1.5">
          <span className="block text-[9px] font-semibold uppercase tracking-[0.18em] text-mn-primary-soft">
            {group.title.year}
          </span>
          <span className="block text-[10px] font-medium text-mn-bg line-clamp-3 drop-shadow">
            {group.title.name}
          </span>
        </div>
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <header className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-0.5">
            <h2 className="truncate text-[13px] font-heading font-semibold text-mn-text-primary">
              {group.title.name}
            </h2>
            <p className="flex flex-wrap items-center gap-1 text-[10px] text-mn-text-muted">
              <span>{group.title.year}</span>
              {hasReview && <ChipLabel>Review</ChipLabel>}
              {hasRatingOnly && <ChipLabel>Rating</ChipLabel>}
              {hasWatchlist && <ChipLabel>Watchlist</ChipLabel>}
              {hasRecommendation && <ChipLabel>Trending</ChipLabel>}
            </p>
          </div>

          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-mn-border-subtle/70 bg-mn-bg/80 text-mn-text-muted hover:border-mn-primary/70 hover:text-mn-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
            aria-label="More options"
          >
            <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </header>

        <div className="space-y-1.5">
          {primaryEvent && <EventSummaryRow event={primaryEvent} />}

          {secondaryEvents.length > 0 && (
            <p className="text-[10px] text-mn-text-muted">
              +{secondaryEvents.length} more activity item{secondaryEvents.length === 1 ? "" : "s"}{" "}
              on this title
            </p>
          )}
        </div>

        <ReactionBar titleId={group.title.id} />
      </div>
    </article>
  );
};

interface StandaloneFeedCardProps {
  event: FeedEvent;
}

const StandaloneFeedCard: React.FC<StandaloneFeedCardProps> = ({ event }) => {
  if (event.type === "follow") {
    return (
      <article className="flex items-center gap-3 rounded-mn-card border border-mn-border-subtle/80 bg-mn-bg-elevated/85 p-3 text-[11px] shadow-mn-card">
        <Avatar user={event.user} />
        <div className="flex-1 space-y-0.5">
          <p className="text-[11px] text-mn-text-secondary">
            <span className="font-medium text-mn-text-primary">{event.user.displayName}</span>{" "}
            <span>{event.extra ?? "started following you"}</span>
          </p>
          <p className="text-[10px] text-mn-text-muted">{event.createdAtLabel}</p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-full border border-mn-primary/70 bg-mn-primary/15 px-3 py-1 text-[11px] font-medium text-mn-primary hover:bg-mn-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
        >
          <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Follow back</span>
        </button>
      </article>
    );
  }

  // Fallback card for any other single event without a title
  return (
    <article className="rounded-mn-card border border-mn-border-subtle/80 bg-mn-bg-elevated/85 p-3 text-[11px] shadow-mn-card">
      <EventSummaryRow event={event} />
      <ReactionBar />
    </article>
  );
};

interface AvatarProps {
  user: FeedUser;
}

const Avatar: React.FC<AvatarProps> = ({ user }) => {
  const bgClass = avatarColorClassName[user.avatarColor];
  const profileHref = user.username ? `/u/${user.username}` : null;

  const avatarCircle = (
    <div
      className={[
        "inline-flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold",
        bgClass,
      ].join(" ")}
      aria-hidden={Boolean(profileHref)}
    >
      {user.avatarInitials}
    </div>
  );

  if (!profileHref) {
    return avatarCircle;
  }

  return (
    <Link
      to={profileHref}
      className="inline-flex items-center rounded-full transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
      aria-label={`View @${user.username}'s profile`}
    >
      {avatarCircle}
    </Link>
  );
};

interface ChipLabelProps {
  children: React.ReactNode;
}

const ChipLabel: React.FC<ChipLabelProps> = ({ children }) => {
  return (
    <span className="inline-flex items-center rounded-full bg-mn-bg/80 px-2 py-0.5 text-[9px] font-medium text-mn-text-muted">
      {children}
    </span>
  );
};

interface EventSummaryRowProps {
  event: FeedEvent;
}

const EventSummaryRow: React.FC<EventSummaryRowProps> = ({ event }) => {
  const { user } = event;

  const profileHref = user.username ? `/u/${user.username}` : null;
  const UserLink = profileHref ? (
    <Link
      to={profileHref}
      className="inline-flex items-center gap-1 rounded-full px-1 py-0.5 font-medium text-mn-text-primary transition hover:text-mn-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
    >
      <span>{user.displayName}</span>
    </Link>
  ) : (
    <span className="font-medium text-mn-text-primary">{user.displayName}</span>
  );

  let prefix: React.ReactNode = null;
  let highlight: React.ReactNode = null;
  let meta: React.ReactNode = null;

  if (event.type === "review") {
    prefix = <>{UserLink} logged a review</>;
    highlight = (
      <span className="inline-flex items-center gap-1 rounded-full bg-mn-bg/80 px-2 py-0.5 text-[10px] text-mn-text-secondary">
        <Star className="h-3 w-3 text-mn-primary" aria-hidden="true" />
        <span>{event.rating?.toFixed(1) ?? "–"}</span>
      </span>
    );
    meta = event.reviewSnippet ? (
      <p className="mt-0.5 line-clamp-2 text-[10px] text-mn-text-secondary">
        “{event.reviewSnippet}”
      </p>
    ) : null;
  } else if (event.type === "rating") {
    prefix = <>{UserLink} rated it</>;
    highlight = (
      <span className="inline-flex items-center gap-1 rounded-full bg-mn-bg/80 px-2 py-0.5 text-[10px] text-mn-text-secondary">
        <Star className="h-3 w-3 text-mn-primary" aria-hidden="true" />
        <span>{event.rating?.toFixed(1) ?? "–"}</span>
      </span>
    );
  } else if (event.type === "watchlist") {
    prefix = <>{UserLink} added this to their Watchlist</>;
    highlight = <BookmarkPlus className="h-3.5 w-3.5 text-mn-primary" aria-hidden="true" />;
  } else if (event.type === "recommendation") {
    prefix = (
      <>
        <span className="font-medium text-mn-text-primary">MoviNesta</span> recommends this title
      </>
    );
    highlight = <Sparkles className="h-3.5 w-3.5 text-mn-primary" aria-hidden="true" />;
    meta = event.extra ? (
      <p className="mt-0.5 text-[10px] text-mn-text-secondary">{event.extra}</p>
    ) : null;
  } else if (event.type === "follow") {
    prefix = (
      <>
        {UserLink} {event.extra ?? "started following you"}
      </>
    );
  }

  return (
    <div className="flex gap-2">
      <Avatar user={user} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-1 text-[11px] text-mn-text-secondary">
          {prefix}
          {highlight}
        </p>
        {meta}
        <p className="mt-0.5 text-[10px] text-mn-text-muted">
          {event.createdAtLabel}
          {event.emoji ? <span className="ml-1">{event.emoji}</span> : null}
        </p>
      </div>
    </div>
  );
};

interface ReactionBarProps {
  titleId?: string;
}

const ReactionBar: React.FC<ReactionBarProps> = ({ titleId }) => {
  return (
    <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-mn-text-muted">
      <div className="inline-flex items-center gap-1">
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-full border border-mn-border-subtle/70 bg-mn-bg/80 px-2 py-1 hover:border-mn-primary/70 hover:text-mn-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
          aria-label="React with thumbs up"
        >
          <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-full border border-mn-border-subtle/70 bg-mn-bg/80 px-2 py-1 hover:border-mn-primary/70 hover:text-mn-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
          aria-label="React with sparkles"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-full border border-mn-border-subtle/70 bg-mn-bg/80 px-2.5 py-1 text-[11px] hover:border-mn-primary/70 hover:text-mn-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
        >
          <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Comments</span>
        </button>
        {titleId && (
          <Link
            to={`/title/${titleId}`}
            className="text-[11px] font-medium text-mn-text-secondary hover:text-mn-primary hover:underline"
          >
            Open
          </Link>
        )}
      </div>
    </div>
  );
};

export const FeedSkeleton: React.FC = () => {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((idx) => (
        <div
          key={idx}
          className="flex animate-pulse gap-3 rounded-mn-card border border-mn-border-subtle/80 bg-mn-bg-elevated/80 p-3"
        >
          <div className="h-24 w-16 rounded-xl bg-mn-border-subtle/60" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-2/3 rounded-full bg-mn-border-subtle/60" />
            <div className="h-3 w-1/3 rounded-full bg-mn-border-subtle/40" />
            <div className="h-3 w-full rounded-full bg-mn-border-subtle/40" />
            <div className="h-3 w-5/6 rounded-full bg-mn-border-subtle/30" />
          </div>
        </div>
      ))}
    </div>
  );
};

const EmptyFeedState: React.FC = () => {
  return (
    <div className="flex min-h-[40vh] items-center justify-center px-2">
      <div className="max-w-sm rounded-mn-card border border-mn-border-subtle/80 bg-mn-bg-elevated/90 px-5 py-6 text-center text-[11px] text-mn-text-secondary shadow-mn-card">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-mn-primary/15">
          <Sparkles className="h-5 w-5 text-mn-primary" aria-hidden="true" />
        </div>
        <h2 className="text-sm font-heading font-semibold text-mn-text-primary">
          Your feed is warming up
        </h2>
        <p className="mt-1 text-[11px] text-mn-text-secondary">
          As you follow friends, rate titles, and add to your Watchlist, this feed will turn into a
          cozy stream of movie moments.
        </p>
        <p className="mt-2 text-[10px] text-mn-text-muted">
          Tip: head to <span className="font-medium text-mn-text-primary">Swipe</span> or{" "}
          <span className="font-medium text-mn-text-primary">Search</span> to start filling your
          nest.
        </p>
      </div>
    </div>
  );
};

export default HomeFeedTab;
