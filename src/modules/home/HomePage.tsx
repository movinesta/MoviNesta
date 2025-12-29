import React from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import CreateActionSheet from "@/components/shared/CreateActionSheet";
import { MaterialIcon } from "@/components/ui/material-icon";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { tmdbImageUrl } from "@/lib/tmdb";
import type { Database } from "@/types/supabase";

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
  const imageUrl =
    (card?.posterUrl && card.posterUrl.trim() ? card.posterUrl : null) ??
    (card?.tmdbPosterPath ? tmdbImageUrl(card.tmdbPosterPath, "w500") : null);

  return {
    id,
    title,
    subtitle: formatSubtitleFromCard(card),
    rating: formatRatingLabelFromCard(card),
    imageUrl,
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
}> = ({ icon, label, onClick, showDot }) => (
  <button
    type="button"
    onClick={onClick}
    className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    aria-label={label}
  >
    <MaterialIcon name={icon} className="text-[22px]" ariaLabel={label} />
    {showDot ? (
      <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-primary" />
    ) : null}
  </button>
);

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
}> = ({ item, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="group flex flex-col gap-1 text-left"
    aria-label={item.title}
  >
    <div
      className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-muted shadow"
      style={
        item.imageUrl
          ? { backgroundImage: `url(${item.imageUrl})`, backgroundSize: "cover" }
          : undefined
      }
    >
      {!item.imageUrl ? (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/25 via-background/25 to-primary/40" />
      ) : null}
      {item.rating ? (
        <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/55 px-1.5 py-1 text-[10px] font-bold text-yellow-400">
          <MaterialIcon name="star" filled className="text-[14px]" ariaLabel="Rating" />
          <span>{item.rating}</span>
        </div>
      ) : null}
    </div>
    <div className="min-w-0">
      <h4 className="truncate text-sm font-bold text-foreground">{item.title}</h4>
      <p className="mt-0.5 text-xs text-muted-foreground">{item.subtitle}</p>
    </div>
  </button>
);

const FeaturedPoster: React.FC<{
  item: PosterItem;
  onClick?: () => void;
}> = ({ item, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="group w-full text-left"
    aria-label={item.title}
  >
    <div
      className="relative aspect-[2/3] w-full overflow-hidden rounded-3xl bg-muted shadow-lg"
      style={
        item.imageUrl
          ? { backgroundImage: `url(${item.imageUrl})`, backgroundSize: "cover" }
          : undefined
      }
    >
      {!item.imageUrl ? (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/25 via-background/25 to-primary/40" />
      ) : null}
      <div className="absolute inset-0 bg-black/30 transition-colors group-hover:bg-black/40" />
      <div className="absolute inset-x-0 bottom-0 p-5">
        <div className="flex flex-col gap-1 text-white">
          <h4 className="text-lg font-bold leading-tight">{item.title}</h4>
          <p className="text-sm opacity-90">{item.subtitle}</p>
          {item.rating ? (
            <div className="inline-flex items-center gap-1 text-sm font-bold text-yellow-400">
              <MaterialIcon name="star" filled className="text-[18px]" ariaLabel="Rating" />
              <span>{item.rating}</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  </button>
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
  const posterUrl = item.title.posterUrl ?? null;
  const showSnippet =
    item.kind === "friend-review" || item.kind === "friend-rating" || item.kind === "friend-watched"
      ? (item as any).reviewSnippet
      : null;
  const showNote = item.kind === "watchlist-add" ? item.note : null;
  const showReason = item.kind === "recommendation" ? item.reason : null;

  return (
    <div className="flex gap-4 rounded-3xl border border-border/40 bg-card/70 p-4 shadow-sm">
      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted ring-1 ring-border/40">
        {item.user.avatarUrl ? (
          <img src={item.user.avatarUrl} alt="" className="h-full w-full object-cover" />
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

        <div className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-border/30 bg-background/40 p-2">
          <div className="h-14 w-10 shrink-0 overflow-hidden rounded-lg bg-muted">
            {posterUrl ? (
              <img src={posterUrl} alt="" className="h-full w-full object-cover" />
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
        </div>

        <div className="mt-3 flex items-center gap-6">
          <button
            type="button"
            className="group inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            <MaterialIcon
              name="thumb_up"
              className="text-[18px] transition-transform group-hover:scale-110"
            />
            <span>Like</span>
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <MaterialIcon name="chat_bubble" className="text-[18px]" />
            <span>Comment</span>
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
  const { user } = useAuth();
  const { data: currentProfile } = useCurrentProfile();
  const { data: stories, isLoading: isStoriesLoading } = useHomeStories();
  const { items: feedItems, isLoading: isFeedLoading, error: feedError } = useHomeFeed();

  const userId = user?.id ?? null;

  const sessionId = React.useMemo(() => getOrCreateMediaSwipeSessionId(), []);

  const {
    data: combinedDeck,
    isLoading: isCombinedLoading,
    error: combinedError,
  } = useQuery({
    queryKey: ["home-v2", "deck", "combined", userId],
    enabled: Boolean(userId),
    queryFn: () => fetchHomeDeck({ sessionId, mode: "combined", limit: 18 }),
    staleTime: 60_000,
  });

  const {
    data: trendingDeck,
    isLoading: isTrendingLoading,
    error: trendingError,
  } = useQuery({
    queryKey: ["home-v2", "deck", "trending", userId],
    enabled: Boolean(userId),
    queryFn: () => fetchHomeDeck({ sessionId, mode: "trending", limit: 18 }),
    staleTime: 60_000,
  });

  const {
    data: forYouDeck,
    isLoading: isForYouLoading,
    error: forYouError,
  } = useQuery({
    queryKey: ["home-v2", "deck", "for_you", userId],
    enabled: Boolean(userId),
    queryFn: () => fetchHomeDeck({ sessionId, mode: "for_you", limit: 18 }),
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
            <IconButton
              icon="notifications"
              label="Notifications"
              onClick={() => navigate("/activity")}
              showDot
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
              const label = s.displayName || s.username || s.listName || "Story";
              const to = s.listId ? `/lists/${s.listId}` : s.username ? `/u/${s.username}` : "/me";

              return (
                <button
                  key={`${s.userId}:${s.listId ?? "none"}`}
                  type="button"
                  onClick={() => navigate(to)}
                  className="flex min-w-[72px] flex-col items-center gap-2"
                  aria-label={label}
                >
                  <span className="rounded-full bg-gradient-to-tr from-primary to-fuchsia-400 p-[2px]">
                    <span className="inline-flex h-[60px] w-[60px] items-center justify-center overflow-hidden rounded-full border-2 border-background bg-muted">
                      {s.avatarUrl ? (
                        <img src={s.avatarUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-xs font-semibold text-muted-foreground">
                          {getInitials(s.displayName, s.username)}
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="w-[72px] truncate text-center text-xs font-medium text-foreground">
                    {label}
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
            </div>
          </div>
        </div>
      </section>

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
            {feedItems.slice(0, 2).map((item) => (
              <FriendsActivityCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-card/60 p-4 text-sm text-muted-foreground">
            Your friends’ activity will show up here once they start rating, reviewing, or marking
            titles watched.
          </div>
        )}
      </section>

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
                />
              ))}
        </div>
      </section>

      <CreateActionSheet open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </div>
  );
};

export default HomePage;
