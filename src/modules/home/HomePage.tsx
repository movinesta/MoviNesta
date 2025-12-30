import React from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import CreateActionSheet from "@/components/shared/CreateActionSheet";
import { MaterialIcon } from "@/components/ui/material-icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { pushToast } from "@/components/toasts";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { qk } from "@/lib/queryKeys";
import { tmdbImageUrl } from "@/lib/tmdb";
import type { Database } from "@/types/supabase";
import type { TitleType } from "@/types/supabase-helpers";
import {
  type DiaryLibraryEntry,
  type DiaryStatus,
  useDiaryLibrary,
  useDiaryLibraryMutations,
} from "@/modules/diary/useDiaryLibrary";

import {
  fetchMediaSwipeDeck,
  getOrCreateMediaSwipeSessionId,
  getOrCreateSwipeDeckSeedForMode,
  type MediaSwipeCard,
  type MediaSwipeDeckMode,
} from "@/modules/swipe/mediaSwipeApi";

import { useCurrentProfile } from "@/modules/profile/useProfile";
import { useAuth } from "@/modules/auth/AuthProvider";
import { useHomeStories } from "./useHomeStories";
import { useHomeFeed } from "./useHomeFeed";
import type { HomeFeedItem } from "./homeFeedTypes";

type PosterItem = {
  id: string;
  title: string;
  subtitle: string;
  rating?: string;
  imageUrl: string | null;
  kind?: TitleType | null;
};

type MediaItemRow = Database["public"]["Tables"]["media_items"]["Row"];

type HomeDeck = {
  deckId: string;
  cards: MediaSwipeCard[];
};

function formatSubtitleFromCard(card?: MediaSwipeCard | null) {
  const year = card?.releaseYear ? String(card.releaseYear) : null;
  const genres = Array.isArray(card?.genres) ? card?.genres : [];
  const primaryGenre = genres[0] ?? null;

  if (primaryGenre && year) return `${primaryGenre} • ${year}`;
  if (primaryGenre) return primaryGenre;
  if (year) return year;
  return card?.kind ? card.kind : "Title";
}

function formatRatingLabelFromCard(card?: MediaSwipeCard | null) {
  const imdb = typeof card?.imdbRating === "number" ? card.imdbRating : null;
  const rt = typeof card?.rtTomatoMeter === "number" ? card.rtTomatoMeter : null;

  const starsFromImdb = imdb != null ? imdb / 2 : null;
  const starsFromRt = rt != null ? rt / 20 : null;
  const value = starsFromImdb ?? starsFromRt;

  if (value == null) return undefined;
  const clamped = Math.max(0, Math.min(5, value));
  return clamped.toFixed(1);
}

function cardToPosterItem(card: MediaSwipeCard | null | undefined): PosterItem | null {
  const id = (card?.mediaItemId ?? "").toString();
  const title = (card?.title ?? "").toString().trim();
  if (!id || !title) return null;

  // media-swipe-deck already normalizes posterUrl for us (OMDb first, then TMDB fallback).
  const kind: TitleType | null =
    card?.kind === "movie" || card?.kind === "series" || card?.kind === "anime"
      ? (card.kind as TitleType)
      : null;

  const imageUrl =
    (card?.posterUrl && card.posterUrl.trim() ? card.posterUrl : null) ??
    (card?.tmdbPosterPath ? tmdbImageUrl(card.tmdbPosterPath, "w500") : null);

  return {
    id,
    title,
    subtitle: formatSubtitleFromCard(card),
    rating: formatRatingLabelFromCard(card),
    imageUrl,
    kind,
  };
}

function diaryEntryToPosterItem(entry: DiaryLibraryEntry): PosterItem {
  const subtitleParts: string[] = [];
  if (entry.year) subtitleParts.push(String(entry.year));
  if (entry.type && entry.type !== "other" && entry.type !== "episode") {
    subtitleParts.push(entry.type === "series" ? "Series" : entry.type === "anime" ? "Anime" : "Movie");
  }
  const subtitle = subtitleParts.join(" • ") || "In your diary";

  return {
    id: entry.titleId,
    title: entry.title,
    subtitle,
    rating: entry.rating ?? undefined,
    imageUrl: entry.posterUrl ?? null,
    kind: entry.type ?? null,
  };
}

async function fetchHomeDeck(args: { sessionId: string; mode: MediaSwipeDeckMode; limit: number }) {
  const { sessionId, mode, limit } = args;
  const seed = getOrCreateSwipeDeckSeedForMode(sessionId, mode, null);
  return fetchMediaSwipeDeck({ sessionId, mode, limit, seed }) as Promise<HomeDeck>;
}
function getGreetingLabel(now = new Date()) {
  const hour = now.getHours();
  if (hour >= 5 && hour < 12) return "Good Morning";
  if (hour >= 12 && hour < 18) return "Good Afternoon";
  return "Good Evening";
}

function getInitials(displayName?: string | null, username?: string | null) {
  const source = (displayName || username || "").replace(/^@/, "").trim();
  if (!source) return "?";
  const parts = source.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

const IconButton: React.FC<{
  icon: string;
  label: string;
  onClick: () => void;
  showDot?: boolean;
  badgeCount?: number;
}> = ({ icon, label, onClick, showDot, badgeCount }) => {
  const safeCount = typeof badgeCount === "number" && badgeCount > 0 ? badgeCount : 0;
  const badgeLabel = safeCount > 9 ? "9+" : String(safeCount);

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      aria-label={label}
    >
      <MaterialIcon name={icon} className="text-[22px]" ariaLabel={label} />
      {safeCount ? (
        <span
          className="absolute -right-0.5 -top-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold leading-none text-primary-foreground shadow"
          aria-label={`${safeCount} new items`}
        >
          {badgeLabel}
        </span>
      ) : showDot ? (
        <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-primary" />
      ) : null}
    </button>
  );
};


const SectionHeader: React.FC<{
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ title, actionLabel = "See All", onAction }) => (
  <div className="flex items-center justify-between px-4 pb-3">
    <h2 className="text-xl font-bold tracking-tight text-foreground">{title}</h2>
    {onAction ? (
      <button
        type="button"
        onClick={onAction}
        className="text-sm font-semibold text-primary transition-colors hover:text-primary/80"
      >
        {actionLabel}
      </button>
    ) : null}
  </div>
);

const PosterTile: React.FC<{
  item: PosterItem;
  onClick?: () => void;
  menu?: React.ReactNode;
}> = ({ item, onClick, menu }) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!onClick) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div className="group flex flex-col gap-1 text-left">
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        aria-label={item.title}
        className="outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-muted shadow">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-muted to-muted/40" />
          )}
          <div className="absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
          {item.rating ? (
            <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-1.5 py-1 text-[10px] font-bold text-yellow-400">
              <MaterialIcon name="star" filled className="text-[14px]" ariaLabel="Rating" />
              <span>{item.rating}</span>
            </div>
          ) : null}
          {menu ? (
            <div className="absolute right-2 top-2 z-20" onClick={(e) => e.stopPropagation()}>
              {menu}
            </div>
          ) : null}
        </div>

        <div className="min-w-0 pt-1">
          <h4 className="truncate text-sm font-bold text-foreground">{item.title}</h4>
          <p className="mt-0.5 text-xs text-muted-foreground">{item.subtitle}</p>
        </div>
      </div>
    </div>
  );
};


const FeaturedPoster: React.FC<{
  item: PosterItem;
  onClick?: () => void;
  menu?: React.ReactNode;
}> = ({ item, onClick, menu }) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!onClick) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div className="group w-full text-left">
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        aria-label={item.title}
        className="outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <div className="relative aspect-[2/3] w-full overflow-hidden rounded-3xl bg-muted shadow-lg">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-muted to-muted/40" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-80" />

          {item.rating ? (
            <div className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-xs font-bold text-yellow-400">
              <MaterialIcon name="star" filled className="text-[16px]" ariaLabel="Rating" />
              <span>{item.rating}</span>
            </div>
          ) : null}

          {menu ? (
            <div className="absolute right-4 top-4 z-20" onClick={(e) => e.stopPropagation()}>
              {menu}
            </div>
          ) : null}

          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3 className="text-lg font-bold text-white drop-shadow">{item.title}</h3>
            <p className="mt-1 text-sm text-white/80">{item.subtitle}</p>
          </div>
        </div>
      </div>
    </div>
  );
};


const PosterQuickMenu: React.FC<{
  item: PosterItem;
  currentStatus: DiaryStatus | null;
  onSetStatus: (status: DiaryStatus) => void;
  onOpenDetails: () => void;
  onRateAndReview: () => void;
}> = ({ item, currentStatus, onSetStatus, onOpenDetails, onRateAndReview }) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <button
        type="button"
        className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        aria-label="More actions"
      >
        <MaterialIcon name="more_vert" className="text-[20px]" ariaLabel="More" />
      </button>
    </DropdownMenuTrigger>

    <DropdownMenuContent align="end" sideOffset={8} className="w-56">
      <DropdownMenuLabel className="truncate">{item.title}</DropdownMenuLabel>
      <DropdownMenuSeparator />

      <DropdownMenuRadioGroup
        value={currentStatus ?? "none"}
        onValueChange={(value) => {
          if (value === "none") return;
          onSetStatus(value as DiaryStatus);
        }}
      >
        <DropdownMenuRadioItem value="want_to_watch">Watchlist</DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="watching">Watching</DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="watched">Watched</DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="dropped">Dropped</DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>

      <DropdownMenuSeparator />
      <DropdownMenuItem
        onSelect={(e) => {
          e.preventDefault();
          onRateAndReview();
        }}
      >
        Rate &amp; review
      </DropdownMenuItem>
      <DropdownMenuItem
        onSelect={(e) => {
          e.preventDefault();
          onOpenDetails();
        }}
      >
        Open details
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

const FeedActionLabel = (item: HomeFeedItem) => {
  switch (item.kind) {
    case "friend-rating":
      return "rated";
    case "friend-review":
      return "reviewed";
    case "friend-watched":
      return "watched";
    case "watchlist-add":
      return "added to watchlist";
    case "watchlist-remove":
      return "removed from watchlist";
    case "recommendation":
      return "recommended";
    default:
      return "";
  }
};

const FriendsActivityCard: React.FC<{ item: HomeFeedItem }> = ({ item }) => {
  const navigate = useNavigate();
  const posterUrl = item.title.posterUrl ?? null;

  const showSnippet =
    item.kind === "friend-review" || item.kind === "friend-rating" || item.kind === "friend-watched"
      ? (item as any).reviewSnippet
      : null;
  const showNote = item.kind === "watchlist-add" ? item.note : null;
  const showReason = item.kind === "recommendation" ? item.reason : null;

  const openTitle = () => navigate(`/title/${item.title.id}`);
  const openReviews = () => navigate(`/title/${item.title.id}/reviews`);

  return (
    <div className="flex gap-4 rounded-3xl border border-border/40 bg-card/70 p-4 shadow-sm">
      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted ring-1 ring-border/40">
        {item.user.avatarUrl ? (
          <img src={item.user.avatarUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center text-[10px] font-semibold text-muted-foreground">
            {item.user.displayName.slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-foreground">{item.user.displayName}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {FeedActionLabel(item)}{" "}
              <span className="font-semibold text-foreground">{item.title.name}</span>
            </p>
          </div>
          <p className="shrink-0 text-xs text-muted-foreground">{item.relativeTime}</p>
        </div>

        {showSnippet ? (
          <p className="mt-3 text-sm leading-relaxed text-foreground/90">{showSnippet}</p>
        ) : null}

        {showNote ? (
          <p className="mt-3 text-sm leading-relaxed text-foreground/90">{showNote}</p>
        ) : null}

        {showReason ? (
          <p className="mt-3 text-sm leading-relaxed text-foreground/90">{showReason}</p>
        ) : null}

        <button
          type="button"
          onClick={openTitle}
          className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-border/30 bg-background/40 p-2 text-left transition hover:bg-background/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          aria-label={`Open ${item.title.name}`}
        >
          <div className="h-14 w-10 shrink-0 overflow-hidden rounded-lg bg-muted">
            {posterUrl ? (
              <img src={posterUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-primary/40 via-background/20 to-primary/60" />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-foreground">{item.title.name}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {item.title.mediaType ?? "title"}
            </p>
            {item.kind === "friend-rating" ||
            item.kind === "friend-review" ||
            item.kind === "friend-watched" ? (
              typeof (item as any).rating === "number" ? (
                <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-yellow-400">
                  <MaterialIcon name="star" filled className="text-[14px]" ariaLabel="Rating" />
                  <span>{(item as any).rating}/5</span>
                </div>
              ) : null
            ) : null}
          </div>
        </button>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={openTitle}
            className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition hover:bg-primary/90"
          >
            Open
          </button>
          <button
            type="button"
            onClick={openReviews}
            className="inline-flex items-center justify-center rounded-full bg-white/5 px-4 py-2 text-xs font-bold text-foreground ring-1 ring-border/50 transition hover:bg-white/10"
          >
            Reviews
          </button>
        </div>
      </div>
    </div>
  );
};


const FriendsActivitySkeleton: React.FC = () => (
  <div className="space-y-3">
    {[0, 1].map((idx) => (
      <div
        key={`friends-activity-skeleton-${idx}`}
        className="rounded-3xl border border-border/40 bg-card/60 p-4 shadow-sm"
      >
        <div className="flex gap-4">
          <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-40 animate-pulse rounded bg-muted" />
            <div className="h-3 w-56 animate-pulse rounded bg-muted" />
            <div className="h-14 w-full animate-pulse rounded-2xl bg-muted" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

const HomePage: React.FC = () => {
  useDocumentTitle("Home");

  const navigate = useNavigate();
const queryClient = useQueryClient();

const { user } = useAuth();
const userId = user?.id ?? null;

const { data: currentProfile } = useCurrentProfile();
const { data: stories, isLoading: isStoriesLoading } = useHomeStories();
const {
  items: feedItems,
  isLoading: isFeedLoading,
  error: feedError,
  hasMore: feedHasMore,
  isLoadingMore: isFeedLoadingMore,
  loadMore: loadMoreFeed,
} = useHomeFeed();

  const { updateStatus } = useDiaryLibraryMutations();
  const { entries: diaryEntries, isLoading: isDiaryLoading } = useDiaryLibrary({
    status: "all",
    type: "all",
  });

  const statusByTitleId = React.useMemo(
    () => new Map(diaryEntries.map((entry) => [entry.titleId, entry.status] as const)),
    [diaryEntries],
  );

  const typeByTitleId = React.useMemo(
    () => new Map(diaryEntries.map((entry) => [entry.titleId, entry.type ?? null] as const)),
    [diaryEntries],
  );

  const continueWatchingItems = React.useMemo(
    () =>
      diaryEntries
        .filter((entry) => entry.status === "watching")
        .slice(0, 12)
        .map(diaryEntryToPosterItem),
    [diaryEntries],
  );

  const upNextItems = React.useMemo(
    () =>
      diaryEntries
        .filter((entry) => entry.status === "want_to_watch")
        .slice(0, 12)
        .map(diaryEntryToPosterItem),
    [diaryEntries],
  );

  const ACTIVITY_SEEN_KEY = "home:lastSeenActivityAt";
  const [lastSeenActivityAt, setLastSeenActivityAt] = React.useState<string | null>(() => {
    try {
      return localStorage.getItem(ACTIVITY_SEEN_KEY);
    } catch {
      return null;
    }
  });

  const newActivityCount = React.useMemo(() => {
    if (!feedItems.length) return 0;
    if (!lastSeenActivityAt) return feedItems.length;
    const last = new Date(lastSeenActivityAt).getTime();
    if (Number.isNaN(last)) return feedItems.length;
    return feedItems.filter((item) => new Date(item.createdAt).getTime() > last).length;
  }, [feedItems, lastSeenActivityAt]);

  const statusLabel = React.useCallback((status: DiaryStatus) => {
    switch (status) {
      case "want_to_watch":
        return "Watchlist";
      case "watching":
        return "Watching";
      case "watched":
        return "Watched";
      case "dropped":
        return "Dropped";
      default:
        return "Saved";
    }
  }, []);

  const setDiaryStatusForPoster = React.useCallback(
    async (item: PosterItem, status: DiaryStatus) => {
      if (!userId) {
        pushToast({ title: "Sign in required", description: "Create an account to save titles.", variant: "info" });
        return;
      }

      const type = item.kind ?? typeByTitleId.get(item.id) ?? null;
      if (!type) {
        pushToast({
          title: "Couldn't save",
          description: "This title is missing a content type.",
          variant: "error",
        });
        return;
      }

      const prev = statusByTitleId.get(item.id) ?? null;

      try {
        await updateStatus.mutateAsync({ titleId: item.id, status, type, title: item.title, posterUrl: item.imageUrl ?? null });

        pushToast({
          title: "Saved",
          description: prev ? `Moved to ${statusLabel(status)}.` : `Added to ${statusLabel(status)}.`,
          variant: "success",
          action: prev
            ? {
                label: "Undo",
                onClick: () => updateStatus.mutate({ titleId: item.id, status: prev, type, title: item.title, posterUrl: item.imageUrl ?? null }),
              }
            : undefined,
        });
      } catch (err: any) {
        pushToast({
          title: "Update failed",
          description: err?.message ?? "Please try again.",
          variant: "error",
        });
      }
    },
    [statusByTitleId, statusLabel, typeByTitleId, updateStatus, userId],
  );

  const posterMenuFor = React.useCallback(
    (item: PosterItem | null) => {
      if (!item?.id) return null;
      return (
        <PosterQuickMenu
          item={item}
          currentStatus={statusByTitleId.get(item.id) ?? null}
          onSetStatus={(status) => setDiaryStatusForPoster(item, status)}
          onOpenDetails={() => navigate(`/title/${item.id}`)}
          onRateAndReview={() => navigate(`/title/${item.id}/reviews?compose=1`)}
        />
      );
    },
    [navigate, setDiaryStatusForPoster, statusByTitleId],
  );


  const sessionId = React.useMemo(() => getOrCreateMediaSwipeSessionId(), []);

  const {
    data: combinedDeck,
    isLoading: isCombinedLoading,
    error: combinedError,
  } = useQuery({
    queryKey: ["home-v2", "deck", "combined", userId],
    enabled: Boolean(userId),
    queryFn: () => fetchHomeDeck({ sessionId, mode: "combined", limit: 14 }),
    staleTime: 60_000,
  });

  const {
    data: trendingDeck,
    isLoading: isTrendingLoading,
    error: trendingError,
  } = useQuery({
    queryKey: ["home-v2", "deck", "trending", userId],
    enabled: Boolean(userId),
    queryFn: () => fetchHomeDeck({ sessionId, mode: "trending", limit: 14 }),
    staleTime: 60_000,
  });

  const {
    data: forYouDeck,
    isLoading: isForYouLoading,
    error: forYouError,
  } = useQuery({
    queryKey: ["home-v2", "deck", "for_you", userId],
    enabled: Boolean(userId),
    queryFn: () => fetchHomeDeck({ sessionId, mode: "for_you", limit: 14 }),
    staleTime: 60_000,
  });

  const heroCard = React.useMemo(() => {
    return combinedDeck?.cards?.[0] ?? forYouDeck?.cards?.[0] ?? trendingDeck?.cards?.[0] ?? null;
  }, [combinedDeck?.cards, forYouDeck?.cards, trendingDeck?.cards]);

  const heroPoster = React.useMemo(() => cardToPosterItem(heroCard), [heroCard]);
  const heroId = heroPoster?.id ?? null;

  const { data: heroDetails } = useQuery({
    queryKey: ["home-v2", "hero-details", heroId],
    enabled: Boolean(heroId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("media_items")
        .select(
          "id, tmdb_overview, omdb_plot, tmdb_backdrop_path, tmdb_poster_path, tmdb_title, tmdb_name, omdb_title",
        )
        .eq("id", heroId as string)
        .maybeSingle();

      if (error) throw error;
      return (data ?? null) as MediaItemRow | null;
    },
    staleTime: 5 * 60_000,
  });

  const heroDescription = React.useMemo(() => {
    const copy = (heroDetails?.tmdb_overview || heroDetails?.omdb_plot || "").trim();
    return copy || null;
  }, [heroDetails?.tmdb_overview, heroDetails?.omdb_plot]);

  const heroBackdropUrl = React.useMemo(() => {
    const fromDetails = tmdbImageUrl(heroDetails?.tmdb_backdrop_path ?? null, "w1280");
    const fromDeckBackdrop = heroCard?.tmdbBackdropPath
      ? tmdbImageUrl(heroCard.tmdbBackdropPath, "w1280")
      : null;
    const fromDeckPoster = heroCard?.tmdbPosterPath
      ? tmdbImageUrl(heroCard.tmdbPosterPath, "w780")
      : null;
    return fromDetails ?? fromDeckBackdrop ?? fromDeckPoster ?? heroPoster?.imageUrl ?? null;
  }, [heroDetails?.tmdb_backdrop_path, heroCard, heroPoster?.imageUrl]);

  const { data: recentWatchedId } = useQuery({
    queryKey: ["home-v2", "recent-watched", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("library_entries")
        .select("title_id, updated_at")
        .eq("user_id", userId as string)
        .eq("status", "watched")
        .order("updated_at", { ascending: false })
        .limit(1);

      if (error) throw error;
      return data?.[0]?.title_id ?? null;
    },
    staleTime: 60_000,
  });

  const seedMediaId = recentWatchedId ?? heroId;

  const { data: seedItem } = useQuery({
    queryKey: ["home-v2", "seed-item", seedMediaId],
    enabled: Boolean(seedMediaId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("media_items")
        .select("id, tmdb_title, tmdb_name, omdb_title")
        .eq("id", seedMediaId as string)
        .maybeSingle();

      if (error) throw error;
      return data ?? null;
    },
    staleTime: 5 * 60_000,
  });

  const seedTitle = React.useMemo(() => {
    const candidates = [
      (seedItem as any)?.tmdb_title,
      (seedItem as any)?.tmdb_name,
      (seedItem as any)?.omdb_title,
      heroPoster?.title,
    ];

    return (
      candidates.map((v) => (typeof v === "string" ? v.trim() : "")).find((v) => Boolean(v)) ?? null
    );
  }, [seedItem, heroPoster?.title]);

  const trendingItems = React.useMemo(() => {
    const skip = new Set<string>();
    if (heroId) skip.add(heroId);
    return (trendingDeck?.cards ?? [])
      .filter((c) => c?.mediaItemId && !skip.has(c.mediaItemId))
      .map(cardToPosterItem)
      .filter(Boolean) as PosterItem[];
  }, [trendingDeck?.cards, heroId]);

  const trendingFeatured = trendingItems[0] ?? null;
  const trendingGrid = trendingItems.slice(1, 7);

  const becauseItems = React.useMemo(() => {
    const skip = new Set<string>();
    if (heroId) skip.add(heroId);
    const list = (forYouDeck?.cards ?? [])
      .filter((c) => c?.mediaItemId && !skip.has(c.mediaItemId))
      .map(cardToPosterItem)
      .filter(Boolean) as PosterItem[];
    return list.length ? list : trendingItems;
  }, [forYouDeck?.cards, trendingItems, heroId]);

  const becauseFeatured = becauseItems[0] ?? null;
  const becauseGrid = becauseItems.slice(1, 7);

  const [isCreateOpen, setIsCreateOpen] = React.useState(false);

  const displayName =
    currentProfile?.displayName || currentProfile?.username || (currentProfile ? "You" : "");

  const greeting = React.useMemo(() => getGreetingLabel(), []);

  const storyItems = React.useMemo(() => {
    const all = stories ?? [];
    const meId = user?.id ?? null;
    return meId ? all.filter((s) => s.userId !== meId) : all;
  }, [user?.id, stories]);
const handleRefresh = React.useCallback(() => {
  if (!userId) return;

  pushToast({ title: "Refreshing…", description: "Updating your Home feed.", variant: "info", durationMs: 1200 });

  queryClient.invalidateQueries({ queryKey: ["home-v2"] });
  queryClient.invalidateQueries({ queryKey: ["home", "stories", userId] });
  queryClient.invalidateQueries({ queryKey: qk.homeFeed(userId) });
  queryClient.invalidateQueries({ queryKey: qk.diaryLibrary(userId) });
}, [queryClient, userId]);

const [feedVisibleCount, setFeedVisibleCount] = React.useState(3);

React.useEffect(() => {
  setFeedVisibleCount(3);
}, [userId]);



  return (
    <div className="flex flex-col gap-6">
      {/* Sticky header (keeps AppShell bottom nav untouched) */}
      <header className="sticky top-0 z-30 -mx-4 -mt-4 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3 sm:px-5">
          <button
            type="button"
            onClick={() => navigate("/me")}
            className="flex items-center gap-3 rounded-2xl p-1 pr-2 transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label="Open profile"
          >
            <span className="relative inline-flex h-10 w-10 overflow-hidden rounded-full ring-2 ring-primary/20">
              {currentProfile?.avatarUrl ? (
                <img
                  src={currentProfile.avatarUrl}
                  alt={displayName || "Profile"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="grid h-full w-full place-items-center bg-muted text-[10px] font-semibold text-foreground">
                  {getInitials(currentProfile?.displayName, currentProfile?.username)}
                </span>
              )}
            </span>
            <span className="flex flex-col items-start">
              <span className="text-xs font-medium text-muted-foreground">{greeting}</span>
              <span className="text-lg font-bold leading-none tracking-tight text-foreground">
                {displayName || ""}
              </span>
            </span>
          </button>

          <div className="flex items-center gap-2">
            <IconButton icon="search" label="Search" onClick={() => navigate("/search")} />
            <IconButton icon="refresh" label="Refresh" onClick={handleRefresh} />
            <IconButton
              icon="notifications"
              label="Notifications"
              onClick={() => {
                const now = new Date().toISOString();
                try {
                  localStorage.setItem(ACTIVITY_SEEN_KEY, now);
                } catch {
                  // ignore
                }
                setLastSeenActivityAt(now);
                navigate("/activity");
              }}
              badgeCount={newActivityCount}
            />
          </div>
        </div>
      </header>

      {/* Happening Now */}
      <section>
        <div className="px-4 pb-2">
          <h3 className="text-xs font-bold tracking-wider text-muted-foreground/80">
            HAPPENING NOW
          </h3>
        </div>

        <div className="no-scrollbar flex w-full gap-4 overflow-x-auto px-4 py-1">
          <button
            type="button"
            onClick={() => navigate("/me?createHighlight=1")}
            className="flex min-w-[72px] flex-col items-center gap-2"
            aria-label="Add new highlight"
          >
            <span className="grid h-16 w-16 place-items-center rounded-full border-2 border-dashed border-muted-foreground/50">
              <MaterialIcon name="add" className="text-[22px] text-muted-foreground" />
            </span>
            <span className="w-[72px] truncate text-center text-xs font-medium text-muted-foreground">
              Add New
            </span>
          </button>

          {isStoriesLoading ? (
            Array.from({ length: 5 }).map((_, idx) => (
              <div
                key={`story-skel-${idx}`}
                className="flex min-w-[72px] flex-col items-center gap-2"
              >
                <div className="h-16 w-16 animate-pulse rounded-full bg-muted" />
                <div className="h-3 w-16 animate-pulse rounded bg-muted" />
              </div>
            ))
          ) : storyItems.length ? (
            storyItems.map((s) => {
              const primaryLabel = s.displayName || s.username || "Someone";
              const secondaryLabel = s.listName || "";
              const to = s.listId ? `/lists/${s.listId}` : s.username ? `/u/${s.username}` : "/me";
              const aria = secondaryLabel ? `${primaryLabel} • ${secondaryLabel}` : primaryLabel;

              return (
                <button
                  key={`${s.userId}:${s.listId ?? "none"}`}
                  type="button"
                  onClick={() => navigate(to)}
                  className="flex w-[92px] shrink-0 flex-col items-center gap-2"
                  aria-label={aria}
                >
                  <span className="rounded-full bg-gradient-to-tr from-primary to-fuchsia-400 p-[2px]">
                    <span className="relative inline-flex h-[68px] w-[68px] items-center justify-center overflow-hidden rounded-full border-2 border-background bg-muted">
                      {s.coverPosterUrl ? (
                        <img
                          src={s.coverPosterUrl}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover"
                        />
                      ) : s.avatarUrl ? (
                        <img
                          src={s.avatarUrl}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-xs font-semibold text-muted-foreground">
                          {getInitials(s.displayName, s.username)}
                        </span>
                      )}

                      <span className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />

                      <span className="absolute bottom-0 right-0 inline-flex h-8 w-8 overflow-hidden rounded-full border-2 border-background bg-muted">
                        {s.avatarUrl ? (
                          <img src={s.avatarUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                        ) : (
                          <span className="grid h-full w-full place-items-center text-[10px] font-semibold text-muted-foreground">
                            {getInitials(s.displayName, s.username)}
                          </span>
                        )}
                      </span>
                    </span>
                  </span>

                  <span className="w-[92px]">
                    <span className="block truncate text-center text-xs font-semibold text-foreground">
                      {primaryLabel}
                    </span>
                    {secondaryLabel ? (
                      <span className="block truncate text-center text-[10px] text-muted-foreground">
                        {secondaryLabel}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })
          ) : (
            <div className="flex items-center text-xs text-muted-foreground">
              Follow people to see highlights.
            </div>
          )}
        </div>
      </section>

      {/* Top pick hero */}
      <section className="px-4">
        <div className="group relative overflow-hidden rounded-3xl bg-card shadow-lg">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={heroBackdropUrl ? { backgroundImage: `url(${heroBackdropUrl})` } : undefined}
            aria-hidden
          />
          {!heroBackdropUrl ? (
            <div className="absolute inset-0 bg-gradient-to-br from-primary/35 via-background/30 to-primary/55" />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/35 to-transparent" />

          <div className="relative z-10 flex min-h-[420px] flex-col justify-end p-5">
            <div className="mb-2 inline-flex items-center gap-2">
              <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur">
                Top Pick
              </span>
              <span className="text-xs font-medium text-muted-foreground">
                {combinedError || forYouError || trendingError
                  ? "Couldn't load recommendations"
                  : (heroCard?.why ?? "Recommended for you")}
              </span>
            </div>

            <h2 className="mb-2 text-3xl font-bold leading-tight tracking-tight text-white">
              {userId &&
              !heroPoster?.title &&
              (isCombinedLoading || isForYouLoading || isTrendingLoading) ? (
                <span className="block h-10 w-2/3 animate-pulse rounded bg-white/15" />
              ) : heroPoster?.title ? (
                heroPoster.title
              ) : userId ? (
                ""
              ) : (
                "Sign in to get recommendations"
              )}
            </h2>

            {heroDescription ? (
              <p className="mb-4 line-clamp-2 text-sm text-white/80">{heroDescription}</p>
            ) : null}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  if (heroPoster?.id) navigate(`/title/${heroPoster.id}`);
                  else navigate("/search");
                }}
                className={cn(
                  "flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-primary text-base font-bold text-primary-foreground shadow-lg",
                  "transition-all hover:bg-primary/90 active:scale-[0.98]",
                )}
                disabled={!heroPoster?.id}
              >
                <MaterialIcon name="play_arrow" filled className="text-[20px]" ariaLabel="Play" />
                View
              </button>

              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className={cn(
                  "flex h-12 w-32 items-center justify-center gap-1 rounded-full bg-white/10 text-white shadow-lg backdrop-blur",
                  "transition-colors hover:bg-white/20",
                )}
              >
                <MaterialIcon name="add" className="text-[22px]" ariaLabel="Add" />
                <span className="text-sm font-bold">Add</span>
              </button>

              {heroPoster?.id ? <div className="shrink-0">{posterMenuFor(heroPoster)}</div> : null}
            </div>
          </div>
        </div>
      </section>

      {/* Continue Watching */}
      {userId ? (
        <section className="mt-6">
          <SectionHeader title="Continue Watching" actionLabel="Diary" onAction={() => navigate("/diary")} />
          <div className="no-scrollbar flex gap-4 overflow-x-auto px-4 pb-1">
            {isDiaryLoading ? (
              Array.from({ length: 8 }).map((_, idx) => (
                <div key={`cw-skel-${idx}`} className="w-32 shrink-0">
                  <div className="aspect-[2/3] w-full animate-pulse rounded-xl bg-muted" />
                  <div className="mt-2 h-3 w-3/4 animate-pulse rounded bg-muted" />
                  <div className="mt-1 h-3 w-1/2 animate-pulse rounded bg-muted" />
                </div>
              ))
            ) : continueWatchingItems.length ? (
              continueWatchingItems.map((item) => (
                <div key={`cw-${item.id}`} className="w-32 shrink-0">
                  <PosterTile
                    item={item}
                    onClick={() => navigate(`/title/${item.id}`)}
                    menu={posterMenuFor(item)}
                  />
                </div>
              ))
            ) : (
              <div className="w-full rounded-2xl border border-dashed border-border bg-card/60 p-4 text-sm text-muted-foreground">
                Mark a show or movie as <span className="font-semibold">Watching</span> to see it here.
              </div>
            )}
          </div>
        </section>
      ) : null}

      {/* Up Next */}
      {userId ? (
        <section className="mt-6">
          <SectionHeader title="Up Next" actionLabel="Watchlist" onAction={() => navigate("/diary")} />
          <div className="no-scrollbar flex gap-4 overflow-x-auto px-4 pb-1">
            {isDiaryLoading ? (
              Array.from({ length: 8 }).map((_, idx) => (
                <div key={`upnext-skel-${idx}`} className="w-32 shrink-0">
                  <div className="aspect-[2/3] w-full animate-pulse rounded-xl bg-muted" />
                  <div className="mt-2 h-3 w-3/4 animate-pulse rounded bg-muted" />
                  <div className="mt-1 h-3 w-1/2 animate-pulse rounded bg-muted" />
                </div>
              ))
            ) : upNextItems.length ? (
              upNextItems.map((item) => (
                <div key={`upnext-${item.id}`} className="w-32 shrink-0">
                  <PosterTile
                    item={item}
                    onClick={() => navigate(`/title/${item.id}`)}
                    menu={posterMenuFor(item)}
                  />
                </div>
              ))
            ) : (
              <div className="w-full rounded-2xl border border-dashed border-border bg-card/60 p-4 text-sm text-muted-foreground">
                Add titles to your <span className="font-semibold">Watchlist</span> to build your queue.
              </div>
            )}
          </div>
        </section>
      ) : null}

      {/* Trending Now */}
      <section>
        <SectionHeader title="Trending Now" onAction={() => navigate("/search")} />

        <div className="px-4">
          {trendingError ? (
            <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              {(trendingError as any)?.message
                ? String((trendingError as any).message)
                : "Couldn't load trending titles."}
            </div>
          ) : isTrendingLoading ? (
            <div className="aspect-[2/3] w-full animate-pulse rounded-3xl bg-muted" />
          ) : trendingFeatured ? (
            <FeaturedPoster
              item={trendingFeatured}
              onClick={() => navigate(`/title/${trendingFeatured.id}`)}
              menu={posterMenuFor(trendingFeatured)}
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-card/60 p-4 text-sm text-muted-foreground">
              No trending titles yet.
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-6 px-4 pt-6 sm:grid-cols-3">
          {isTrendingLoading
            ? Array.from({ length: 6 }).map((_, idx) => (
                <div
                  key={`trending-skel-${idx}`}
                  className="aspect-[2/3] w-full animate-pulse rounded-xl bg-muted"
                />
              ))
            : trendingGrid.map((item) => (
                <PosterTile
                  key={item.id}
                  item={item}
                  onClick={() => navigate(`/title/${item.id}`)}
                  menu={posterMenuFor(item)}
                />
              ))}
        </div>
      </section>

      {/* Friends' Activity */}

      <section className="px-4">
        <h2 className="pb-2 text-xl font-bold tracking-tight text-foreground">
          Friends&apos; Activity
        </h2>

        {feedError ? (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
            {feedError}
          </div>
        ) : null}

        {isFeedLoading ? (
          <FriendsActivitySkeleton />
        ) : feedItems.length ? (
          <div className="space-y-3">
            {feedItems.slice(0, feedVisibleCount).map((item) => (
              <FriendsActivityCard key={item.id} item={item} />
            ))}

            <div className="flex items-center gap-2 pt-2">
              {feedItems.length > feedVisibleCount || feedHasMore ? (
                <button
                  type="button"
                  onClick={() => {
                    const next = feedVisibleCount + 3;
                    if (next <= feedItems.length) {
                      setFeedVisibleCount(next);
                      return;
                    }
                    if (feedHasMore && !isFeedLoadingMore) {
                      loadMoreFeed();
                      setFeedVisibleCount(next);
                    }
                  }}
                  className="inline-flex items-center justify-center rounded-full bg-white/5 px-4 py-2 text-xs font-bold text-foreground ring-1 ring-border/50 transition hover:bg-white/10 disabled:opacity-60"
                  disabled={isFeedLoadingMore}
                >
                  {isFeedLoadingMore ? "Loading…" : "Load more"}
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => navigate("/activity")}
                className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition hover:bg-primary/90"
              >
                See all
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-card/60 p-4 text-sm text-muted-foreground">
            Your friends’ activity will show up here once they start rating, reviewing, or marking
            titles watched.
          </div>
        )}      </section>

      {/* Because you watched... */}
      <section>
        <SectionHeader
          title={seedTitle ? `Because you watched ${seedTitle}` : "More for you"}
          onAction={() => {
            if (seedMediaId) navigate(`/title/${seedMediaId}`);
            else navigate("/search");
          }}
        />

        <div className="px-4">
          {forYouError ? (
            <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              {(forYouError as any)?.message
                ? String((forYouError as any).message)
                : "Couldn't load recommendations."}
            </div>
          ) : isForYouLoading ? (
            <div className="aspect-[2/3] w-full animate-pulse rounded-3xl bg-muted" />
          ) : becauseFeatured ? (
            <FeaturedPoster
              item={becauseFeatured}
              onClick={() => navigate(`/title/${becauseFeatured.id}`)}
              menu={posterMenuFor(becauseFeatured)}
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-card/60 p-4 text-sm text-muted-foreground">
              No recommendations yet.
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-6 px-4 pt-6 pb-2 sm:grid-cols-3">
          {isForYouLoading
            ? Array.from({ length: 6 }).map((_, idx) => (
                <div
                  key={`because-skel-${idx}`}
                  className="aspect-[2/3] w-full animate-pulse rounded-xl bg-muted"
                />
              ))
            : becauseGrid.map((item) => (
                <PosterTile
                  key={item.id}
                  item={item}
                  onClick={() => navigate(`/title/${item.id}`)}
                  menu={posterMenuFor(item)}
                />
              ))}
        </div>
      </section>

      <CreateActionSheet open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </div>
  );
};

export default HomePage;
