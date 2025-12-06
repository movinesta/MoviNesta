import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Clock, Film, ListChecks, Play, Sparkles, Users } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import { TitleType } from "@/types/supabase-helpers";

type RecommendationSectionKind = "friends-trending" | "because-you-liked" | "anime" | "continue";

interface RecommendationItem {
  id: string;
  name: string;
  year: number;
  runtimeMinutes?: number;
  matchReason?: string;
  friendsWatchingCount?: number;
  moodTag?: string;
  posterUrl?: string | null;
  imdbRating?: number | null;
  rtTomatoMeter?: number | null;
}

interface RecommendationSection {
  id: string;
  kind: RecommendationSectionKind;
  title: string;
  subtitle?: string;
  pillLabel?: string;
  items: RecommendationItem[];
}

interface TonightPick extends RecommendationItem {
  logline?: string;
  moodLine?: string;
}

interface UseRecommendationsResult {
  isLoading: boolean;
  error: string | null;
  tonightPick: TonightPick | null;
  sections: RecommendationSection[];
  /**
   * True when we were able to load core recommendations, but some
   * secondary data (like follows or anime rows) failed in the background.
   */
  hasPartialData: boolean;
}

const getFriendlyRecommendationsErrorMessage = (error: Error): string => {
  const raw = error?.message ?? "";
  const lowered = raw.toLowerCase();

  if (
    lowered.includes("network") ||
    lowered.includes("failed to fetch") ||
    lowered.includes("fetch")
  ) {
    return "We couldn’t reach the server to load your recommendations. Check your connection and try again.";
  }

  if (lowered.includes("unauthorized") || lowered.includes("401") || lowered.includes("403")) {
    return "We couldn’t load your recommendations because your session may have expired. Try signing out and back in.";
  }

  return "Something went wrong while loading your recommendations. Please try again.";
};

/**
 * Hook powering the For You tab.
 * Uses Supabase + React Query to load basic personalized rows.
 */

interface RatingRow {
  title_id: string;
  rating: number | null;
  created_at: string;
}

interface LibraryEntryRow {
  title_id: string;
  status: string;
  updated_at: string;
}

interface TitleBasicRow {
  id: string;
  title: string | null;
  year: number | null;
  runtime_minutes: number | null;
  type?: TitleType | null;
  poster_url?: string | null;
  backdrop_url?: string | null;
  imdb_rating?: number | null;
  omdb_rt_rating_pct?: number | null;
}

interface FollowsRow {
  followed_id: string;
}

const getPosterWithFallback = (
  posterUrl?: string | null,
  backdropUrl?: string | null,
): string | null => posterUrl ?? backdropUrl ?? null;

const fetchHomeRecommendations = async (
  userId: string,
): Promise<{
  tonightPick: TonightPick | null;
  sections: RecommendationSection[];
  hasPartialData: boolean;
}> => {
  // Load some basic context in parallel.
  const [followsResult, ratingsResult, libraryResult] = await Promise.all([
    supabase.from("follows").select("followed_id").eq("follower_id", userId),
    supabase
      .from("ratings")
      .select("title_id, rating, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("library_entries")
      .select("title_id, status, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(40),
  ]);

  // Track when we had to fall back because a secondary query failed, so we can
  // surface a subtle warning in the UI while still showing core recommendations.
  let hasPartialData = false;

  if (ratingsResult.error) {
    throw new Error(ratingsResult.error.message);
  }

  if (libraryResult.error) {
    throw new Error(libraryResult.error.message);
  }

  const followsError = followsResult.error;
  if (followsError) {
    hasPartialData = true;
    console.warn("[HomeForYouTab] Failed to load follows", followsError.message);
  }

  const ratings = (ratingsResult.data ?? []) as RatingRow[];
  const libraryEntries = (libraryResult.data ?? []) as LibraryEntryRow[];

  const follows = (followsResult.data ?? []) as FollowsRow[];
  const friendIds =
    follows.map((row) => row.followed_id).filter((value): value is string => Boolean(value)) ?? [];

  const seedRating = ratings.find((row) => (row.rating ?? 0) >= 4.0) ?? ratings[0] ?? null;
  const seedTitleId = seedRating?.title_id ?? null;

  // -------------------------------------------------------------------
  // Collect candidate title ids for all sections.
  // -------------------------------------------------------------------
  let friendRatings: { title_id: string; user_id: string; created_at: string }[] = [];

  if (friendIds.length > 0) {
    const { data: friendRatingsData, error: friendRatingsError } = await supabase
      .from("ratings")
      .select("title_id, user_id, created_at")
      .in("user_id", friendIds)
      .order("created_at", { ascending: false })
      .limit(30);

    if (friendRatingsError) {
      hasPartialData = true;
      console.warn("[HomeForYouTab] Failed to load friend ratings", friendRatingsError.message);
    }

    friendRatings = friendRatingsData ?? [];
  }

  const trendingTitleIds: string[] = [];
  friendRatings.forEach((row) => {
    if (!row.title_id) return;
    if (!trendingTitleIds.includes(row.title_id)) {
      trendingTitleIds.push(row.title_id);
    }
  });

  const becauseTitleIds: string[] = [];
  if (seedTitleId) {
    libraryEntries.forEach((entry) => {
      if (
        entry.title_id &&
        entry.title_id !== seedTitleId &&
        (entry.status === "want_to_watch" || entry.status === "watching")
      ) {
        if (!becauseTitleIds.includes(entry.title_id)) {
          becauseTitleIds.push(entry.title_id);
        }
      }
    });
  }

  const continueTitleIds: string[] = [];
  libraryEntries.forEach((entry) => {
    if (entry.title_id && (entry.status === "watching" || entry.status === "want_to_watch")) {
      if (!continueTitleIds.includes(entry.title_id)) {
        continueTitleIds.push(entry.title_id);
      }
    }
  });

  // Popular anime for now: just pull some recent anime titles.
  const animeResult = await supabase
    .from("titles")
    .select(
      "id:title_id, title:primary_title, year:release_year, runtime_minutes, type:content_type, poster_url, backdrop_url, imdb_rating, rt_tomato_pct",
    )
    .eq("content_type", "anime")
    .order("release_year", { ascending: false })
    .limit(16);

  if (animeResult.error) {
    hasPartialData = true;
    console.warn("[HomeForYouTab] Failed to load anime titles", animeResult.error.message);
  }

  const animeTitles = (animeResult.data ?? []) as TitleBasicRow[];
  const animeTitleIds = animeTitles.map((row) => row.id);

  const allTitleIds = Array.from(
    new Set<string>([
      ...(seedTitleId ? [seedTitleId] : []),
      ...trendingTitleIds,
      ...becauseTitleIds,
      ...continueTitleIds,
      ...animeTitleIds,
    ]),
  );

  if (!allTitleIds.length) {
    return { tonightPick: null, sections: [], hasPartialData };
  }

  const titlesResult = await supabase
    .from("titles")
    .select(
      `id:title_id, title:primary_title, year:release_year, runtime_minutes, type:content_type, poster_url, backdrop_url, imdb_rating, rt_tomato_pct`,
    )
    .in("title_id", allTitleIds);

  if (titlesResult.error) {
    throw new Error(titlesResult.error.message);
  }

  const titles = (titlesResult.data ?? []) as TitleBasicRow[];
  const titlesById = new Map<string, TitleBasicRow>();
  titles.forEach((row) => {
    titlesById.set(row.id, row);
  });

  const usedTitleIds = new Set<string>();

  // -------------------------------------------------------------------
  // Tonight's pick: based on last highly-rated title if we have one.
  // -------------------------------------------------------------------
  let tonightPick: TonightPick | null = null;

  if (seedTitleId && titlesById.has(seedTitleId)) {
    const t = titlesById.get(seedTitleId)!;
    const seedRatingValue = seedRating?.rating ?? null;

    tonightPick = {
      id: t.id,
      name: t.title ?? "Untitled",
      year: t.year ?? new Date().getFullYear(),
      runtimeMinutes: t.runtime_minutes ?? undefined,
      matchReason:
        seedRatingValue && seedRatingValue >= 4
          ? "Because you gave this a high rating."
          : "Based on your recent diary activity.",
      moodTag: t.type === "anime" ? "Anime night" : "Cinematic night",
      logline: undefined,
      moodLine:
        t.type === "anime"
          ? "Animated, emotional, and perfect for a late-night binge."
          : "Feels like the right vibe for tonight based on your recent watches.",
      friendsWatchingCount: friendRatings.filter((row) => row.title_id === seedTitleId).length,
      posterUrl: getPosterWithFallback(t.poster_url, t.backdrop_url),
      imdbRating: t.imdb_rating ?? null,
      rtTomatoMeter: t.omdb_rt_rating_pct ?? null,
    };
    usedTitleIds.add(seedTitleId);
  }

  // -------------------------------------------------------------------
  // Build sections.
  // -------------------------------------------------------------------
  const sections: RecommendationSection[] = [];

  // Trending with friends
  const trendingItems: RecommendationItem[] = [];
  trendingTitleIds.slice(0, 12).forEach((titleId) => {
    const t = titlesById.get(titleId);
    if (!t || usedTitleIds.has(titleId)) return;

    const friendsWatchingCount = friendRatings.filter((row) => row.title_id === titleId).length;

    trendingItems.push({
      id: t.id,
      name: t.title ?? "Untitled",
      year: t.year ?? new Date().getFullYear(),
      friendsWatchingCount,
      moodTag: t.type === "anime" ? "Anime night" : "Friends love this",
      posterUrl: getPosterWithFallback(t.poster_url, t.backdrop_url),
      imdbRating: t.imdb_rating ?? null,
      rtTomatoMeter: t.omdb_rt_rating_pct ?? null,
    });
    usedTitleIds.add(titleId);
  });

  if (trendingItems.length > 0) {
    sections.push({
      id: "friends-trending",
      kind: "friends-trending",
      title: "Trending with friends",
      subtitle: "What your circle has been rating and logging recently.",
      pillLabel: "Social picks",
      items: trendingItems,
    });
  }

  // Because you liked X
  if (seedTitleId && titlesById.has(seedTitleId) && becauseTitleIds.length > 0) {
    const seedTitle = titlesById.get(seedTitleId)!;
    const becauseItems: RecommendationItem[] = [];

    becauseTitleIds.slice(0, 12).forEach((titleId) => {
      const t = titlesById.get(titleId);
      if (!t || usedTitleIds.has(titleId)) return;

      becauseItems.push({
        id: t.id,
        name: t.title ?? "Untitled",
        year: t.year ?? new Date().getFullYear(),
        matchReason: `On your watchlist after ${seedTitle.title ?? "that favorite"}.`,
        posterUrl: getPosterWithFallback(t.poster_url, t.backdrop_url),
        imdbRating: t.imdb_rating ?? null,
        rtTomatoMeter: t.omdb_rt_rating_pct ?? null,
      });
      usedTitleIds.add(titleId);
    });

    if (becauseItems.length > 0) {
      sections.push({
        id: "because-you-liked",
        kind: "because-you-liked",
        title: `Because you liked ${seedTitle.title ?? "this"}`,
        subtitle: "Watchlist picks tuned by your recent favorites.",
        pillLabel: "Taste match",
        items: becauseItems,
      });
    }
  }

  // Popular anime
  const animeItems: RecommendationItem[] = [];

  animeTitles.slice(0, 12).forEach((t) => {
    if (usedTitleIds.has(t.id)) return;
    animeItems.push({
      id: t.id,
      name: t.title ?? "Untitled",
      year: t.year ?? new Date().getFullYear(),
      matchReason: "Anime in your catalog and trending in MoviNesta.",
      posterUrl: getPosterWithFallback(t.poster_url, t.backdrop_url),
      imdbRating: t.imdb_rating ?? null,
      rtTomatoMeter: t.omdb_rt_rating_pct ?? null,
    });
    usedTitleIds.add(t.id);
  });

  if (animeItems.length > 0) {
    sections.push({
      id: "popular-anime",
      kind: "anime",
      title: "Popular anime right now",
      subtitle: "Heart-punching stories, cozy vibes, and a bit of chaos.",
      pillLabel: "Anime corner",
      items: animeItems,
    });
  }

  // Continue swiping / watching
  const continueItems: RecommendationItem[] = [];
  continueTitleIds.slice(0, 12).forEach((titleId) => {
    const t = titlesById.get(titleId);
    if (!t || usedTitleIds.has(titleId)) return;

    const libraryEntry = libraryEntries.find((entry) => entry.title_id === titleId);
    const imdbRating = t.imdb_rating ?? null;
    const rtTomatoMeter = t.omdb_rt_rating_pct ?? null;

    let matchReason: string | undefined;
    if (libraryEntry?.status === "watching") {
      matchReason = "In progress — pick up where you left off.";
    } else if (libraryEntry?.status === "want_to_watch") {
      matchReason = "On your Watchlist and waiting for a good night.";
    }

    continueItems.push({
      id: t.id,
      name: t.title ?? "Untitled",
      year: t.year ?? new Date().getFullYear(),
      runtimeMinutes: t.runtime_minutes ?? undefined,
      matchReason,
      posterUrl: getPosterWithFallback(t.poster_url, t.backdrop_url),
      imdbRating,
      rtTomatoMeter,
    });
    usedTitleIds.add(titleId);
  });

  if (continueItems.length > 0) {
    sections.push({
      id: "continue",
      kind: "continue",
      title: "Continue swiping / watching",
      subtitle: "Pick up right where your last movie night left off.",
      pillLabel: "On deck",
      items: continueItems,
    });
  }

  return { tonightPick, sections, hasPartialData };
};

const useRecommendations = (): UseRecommendationsResult => {
  const { user } = useAuth();

  const { data, isLoading, isFetching, error } = useQuery<
    { tonightPick: TonightPick | null; sections: RecommendationSection[]; hasPartialData: boolean },
    Error
  >({
    queryKey: ["home-for-you", user?.id],
    enabled: Boolean(user?.id),
    staleTime: 1000 * 20,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    queryFn: async () => {
      if (!user?.id) {
        return { tonightPick: null, sections: [], hasPartialData: false };
      }
      return fetchHomeRecommendations(user.id);
    },
  });

  const friendlyError = error ? getFriendlyRecommendationsErrorMessage(error) : null;

  if (error) {
    console.error("[HomeForYouTab] Failed to load recommendations", error);
  }

  const isInitialLoading = isLoading || (!data && isFetching);

  return {
    isLoading: isInitialLoading,
    error: friendlyError,
    tonightPick: data?.tonightPick ?? null,
    sections: data?.sections ?? [],
    hasPartialData: data?.hasPartialData ?? false,
  };
};

const HomeForYouTab: React.FC = () => {
  const { isLoading, error, tonightPick, sections, hasPartialData } = useRecommendations();

  const hasContent = !!tonightPick || sections.length > 0;

  return (
    <div className="space-y-4">
      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-mn-error/60 bg-mn-error/10 px-3 py-2 text-[11px] text-mn-error"
        >
          {error}
        </div>
      )}

      {isLoading ? (
        <TonightPickSkeleton />
      ) : tonightPick ? (
        <TonightPickCard pick={tonightPick} />
      ) : (
        <EmptyTonightPickState />
      )}

      {isLoading && <CarouselsSkeleton />}

      {!isLoading && sections.length > 0 && (
        <div className="space-y-3">
          {sections.map((section) => (
            <RecommendationSectionRow key={section.id} section={section} />
          ))}
        </div>
      )}

      {!isLoading && hasPartialData && !error && (
        <p className="rounded-2xl border border-mn-border-soft bg-mn-surface-soft px-3 py-2 text-[11px] text-mn-text-secondary">
          Some rows might be missing while we catch up on your follows and anime data, but your main
          recommendations are still here.
        </p>
      )}

      {!isLoading && !hasContent && <EmptyForYouState />}
    </div>
  );
};

interface TonightPickCardProps {
  pick: TonightPick;
}

const TonightPickCard: React.FC<TonightPickCardProps> = ({ pick }) => {
  const hasValidImdb =
    typeof pick.imdbRating === "number" && !Number.isNaN(pick.imdbRating) && pick.imdbRating > 0;

  const hasValidRt =
    typeof pick.rtTomatoMeter === "number" &&
    !Number.isNaN(pick.rtTomatoMeter) &&
    pick.rtTomatoMeter > 0;

  return (
    <section className="rounded-mn-card border border-mn-border-subtle bg-mn-bg-elevated/95 p-4 text-[11px] text-mn-text-secondary shadow-mn-card">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1 rounded-full bg-mn-primary/15 px-2.5 py-0.5 text-[10px] font-medium text-mn-primary">
          <Sparkles className="h-3.5 w-3.5" aria-hidden={true} />
          <span>Tonight&apos;s pick for you</span>
        </div>
        {pick.runtimeMinutes ? (
          <div className="inline-flex items-center gap-1 rounded-full bg-mn-bg/80 px-2 py-0.5 text-[10px] text-mn-text-muted">
            <Clock className="h-3 w-3" aria-hidden={true} />
            <span>{pick.runtimeMinutes} min</span>
          </div>
        ) : null}
      </div>

      <div className="flex gap-3">
        <Link
          to={`/title/${pick.id}`}
          className="relative flex h-28 w-20 shrink-0 overflow-hidden rounded-mn-card bg-mn-bg/80 shadow-mn-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
        >
          {pick.posterUrl ? (
            <>
              <img src={pick.posterUrl} alt={pick.name} className="h-full w-full object-cover" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent" />
            </>
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-gradient-to-br from-mn-surface-elevated/80 via-mn-bg to-mn-primary/70 text-[10px] text-mn-text-muted">
              <Film className="h-4 w-4 text-mn-primary" aria-hidden={true} />
              <span>No poster yet</span>
            </div>
          )}
          <div className="pointer-events-none absolute bottom-1 left-1 right-1 space-y-0.5 px-1.5">
            <span className="inline-flex items-center rounded-full bg-mn-bg/80 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-mn-primary-soft">
              {pick.year}
            </span>
            <span className="block text-[11px] font-heading font-semibold text-mn-bg line-clamp-3 drop-shadow">
              {pick.name}
            </span>
          </div>
        </Link>

        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="text-[13px] font-heading font-semibold text-mn-text-primary">
            Movie night mood: {pick.moodTag ?? "Surprise me"}
          </h2>
          {pick.logline && (
            <p className="text-[11px] text-mn-text-secondary line-clamp-3">{pick.logline}</p>
          )}
          {pick.moodLine && <p className="text-[10px] text-mn-text-muted">{pick.moodLine}</p>}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full bg-mn-primary px-3 py-1.5 text-[11px] font-medium text-mn-bg shadow-mn-soft hover:bg-mn-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
            >
              <Play className="h-3.5 w-3.5" aria-hidden={true} />
              <span>Add to Watchlist</span>
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full border border-mn-border-subtle bg-mn-bg/80 px-3 py-1.5 text-[11px] text-mn-text-secondary hover:border-mn-primary/70 hover:text-mn-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
            >
              <ListChecks className="h-3.5 w-3.5" aria-hidden={true} />
              <span>Why this pick?</span>
            </button>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-mn-text-muted">
            {pick.friendsWatchingCount ? (
              <span className="inline-flex items-center gap-1">
                <Users className="h-3 w-3" aria-hidden={true} />
                <span>Watched by {pick.friendsWatchingCount} friend(s)</span>
              </span>
            ) : null}
            {hasValidImdb && (
              <span className="inline-flex items-center gap-1">
                <span className="font-semibold text-mn-text-secondary">IMDb Rating</span>
                <span>{pick.imdbRating!.toFixed(1)}</span>
              </span>
            )}
            {hasValidRt && (
              <span className="inline-flex items-center gap-1">
                <span className="font-semibold text-mn-text-secondary">Tomatometer</span>
                <span>{pick.rtTomatoMeter}%</span>
              </span>
            )}
            {pick.matchReason && (
              <span className="line-clamp-1">
                <span className="font-medium text-mn-text-secondary">Because: </span>
                {pick.matchReason}
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

interface RecommendationSectionRowProps {
  section: RecommendationSection;
}

const RecommendationSectionRow: React.FC<RecommendationSectionRowProps> = ({ section }) => {
  if (!section.items.length) return null;

  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[12px] font-heading font-semibold text-mn-text-primary">
              {section.title}
            </h3>
            {section.pillLabel && (
              <span className="inline-flex items-center rounded-full bg-mn-bg-elevated/80 px-2 py-0.5 text-[9px] text-mn-text-muted">
                {section.pillLabel}
              </span>
            )}
          </div>
          {section.subtitle && (
            <p className="mt-0.5 text-[10px] text-mn-text-secondary line-clamp-2">
              {section.subtitle}
            </p>
          )}
        </div>

        <button
          type="button"
          aria-label={`See all for ${section.title}`}
          className="inline-flex items-center gap-1 rounded-full border border-mn-border-subtle/80 bg-mn-bg/80 px-2.5 py-1 text-[10px] text-mn-text-secondary hover:border-mn-primary/70 hover:text-mn-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
        >
          <span>See all</span>
          <ChevronRight className="h-3 w-3" aria-hidden="true" />
        </button>
      </div>

      <div className="-mx-1 overflow-x-auto pb-1">
        <div className="flex snap-x snap-mandatory gap-2 px-1">
          {section.items.map((item) => (
            <RecommendationCard key={item.id} item={item} sectionKind={section.kind} />
          ))}
        </div>
      </div>
    </section>
  );
};

const SECTION_KIND_META: Record<
  RecommendationSectionKind,
  { icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>; label: string }
> = {
  "friends-trending": { icon: Users as any, label: "Friends" },
  "because-you-liked": { icon: Film as any, label: "Match" },
  anime: { icon: Sparkles as any, label: "Anime" },
  continue: { icon: Clock as any, label: "Continue" },
};

interface RecommendationCardProps {
  item: RecommendationItem;
  sectionKind: RecommendationSectionKind;
}

const RecommendationCard: React.FC<RecommendationCardProps> = ({ item, sectionKind }) => {
  const metaPieces: string[] = [];

  if (item.friendsWatchingCount) {
    metaPieces.push(`Watched by ${item.friendsWatchingCount} friend(s)`);
  }

  if (item.runtimeMinutes) {
    metaPieces.push(`${item.runtimeMinutes} min`);
  }

  const hasValidImdb =
    typeof item.imdbRating === "number" && !Number.isNaN(item.imdbRating) && item.imdbRating > 0;

  const hasValidRt =
    typeof item.rtTomatoMeter === "number" &&
    !Number.isNaN(item.rtTomatoMeter) &&
    item.rtTomatoMeter > 0;

  if (hasValidImdb) {
    metaPieces.push(`IMDb Rating ${item.imdbRating!.toFixed(1)}`);
  }

  if (hasValidRt) {
    metaPieces.push(`Tomatometer ${item.rtTomatoMeter}%`);
  }

  const sectionMeta = SECTION_KIND_META[sectionKind];
  const SectionIcon = sectionMeta.icon;

  return (
    <Link
      to={`/title/${item.id}`}
      className="group flex w-[160px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-mn-border-subtle/80 bg-mn-bg-elevated/90 text-[11px] text-mn-text-secondary shadow-mn-soft no-underline outline-none ring-offset-2 ring-offset-mn-bg focus-visible:ring-2 focus-visible:ring-mn-primary"
    >
      <div className="relative h-32 overflow-hidden">
        {item.posterUrl ? (
          <>
            <img src={item.posterUrl} alt={item.name} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-br from-mn-accent-violet/45 via-mn-bg/40 to-mn-primary/75" />
          </>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-gradient-to-br from-mn-surface-elevated/80 via-mn-bg to-mn-primary/70 text-[10px] text-mn-text-muted">
            <Film className="h-4 w-4 text-mn-primary" aria-hidden={true} />
            <span>Poster missing</span>
          </div>
        )}
        <div className="relative flex h-full flex-col justify-between p-2.5">
          <div className="space-y-0.5">
            <p className="line-clamp-2 text-[11px] font-heading font-semibold text-mn-text-primary">
              {item.name}
            </p>
            {item.matchReason && (
              <p className="line-clamp-2 text-[9px] text-mn-text-secondary">{item.matchReason}</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between gap-1 px-2.5 py-2">
        {metaPieces.length > 0 && (
          <p className="line-clamp-1 text-[9px] text-mn-text-muted">{metaPieces.join(" • ")}</p>
        )}

        <div className="mt-1 flex items-center justify-between gap-2 text-[10px]">
          <span className="inline-flex items-center gap-1 text-mn-text-muted">
            <SectionIcon className="h-3 w-3" aria-hidden={true} />
            <span>{sectionMeta.label}</span>
          </span>

          <span className="inline-flex items-center gap-1 text-mn-primary group-hover:underline">
            <span className="text-[10px] font-medium">Open</span>
            <ChevronRight className="h-2.5 w-2.5" aria-hidden="true" />
          </span>
        </div>
      </div>
    </Link>
  );
};

export const TonightPickSkeleton: React.FC = () => {
  return (
    <section className="animate-pulse rounded-mn-card border border-mn-border-subtle/80 bg-mn-bg-elevated/90 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="h-4 w-32 rounded-full bg-mn-border-subtle/60" />
        <div className="h-4 w-16 rounded-full bg-mn-border-subtle/40" />
      </div>
      <div className="flex gap-3">
        <div className="h-28 w-20 rounded-2xl bg-mn-border-subtle/60" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-2/3 rounded-full bg-mn-border-subtle/60" />
          <div className="h-3 w-full rounded-full bg-mn-border-subtle/40" />
          <div className="h-3 w-5/6 rounded-full bg-mn-border-subtle/40" />
          <div className="mt-2 flex gap-2">
            <div className="h-7 w-28 rounded-full bg-mn-border-subtle/50" />
            <div className="h-7 w-28 rounded-full bg-mn-border-subtle/40" />
          </div>
        </div>
      </div>
    </section>
  );
};

export const CarouselsSkeleton: React.FC = () => {
  return (
    <div className="space-y-3">
      {[0, 1].map((rowIndex) => (
        <section key={rowIndex} className="space-y-2">
          <div className="h-4 w-40 rounded-full bg-mn-border-subtle/60" />
          <div className="-mx-1 overflow-x-hidden pb-1">
            <div className="flex gap-2 px-1">
              {[0, 1, 2].map((cardIdx) => (
                <div
                  key={cardIdx}
                  className="h-40 w-[160px] shrink-0 rounded-2xl border border-mn-border-subtle/60 bg-mn-bg-elevated/80"
                />
              ))}
            </div>
          </div>
        </section>
      ))}
    </div>
  );
};

const EmptyTonightPickState: React.FC = () => {
  return (
    <section className="rounded-mn-card border border-mn-border-subtle/80 bg-mn-bg-elevated/95 px-4 py-5 text-[11px] text-mn-text-secondary shadow-mn-card">
      <div className="mx-auto flex max-w-md flex-col items-center text-center">
        <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-mn-primary/15">
          <Sparkles className="h-4 w-4 text-mn-primary" aria-hidden={true} />
        </div>
        <h2 className="text-sm font-heading font-semibold text-mn-text-primary">
          Smart picks arrive as you watch
        </h2>
        <p className="mt-1 text-[11px] text-mn-text-secondary">
          Once you&apos;ve logged a few titles and swiped through recommendations, MoviNesta will
          start surfacing a single “tonight&apos;s pick” tuned to your taste.
        </p>
        <p className="mt-2 text-[10px] text-mn-text-muted">
          For now, head to <span className="font-medium text-mn-text-primary">Swipe</span> or{" "}
          <span className="font-medium text-mn-text-primary">Diary</span> to teach the nest what you
          love.
        </p>
      </div>
    </section>
  );
};

const EmptyForYouState: React.FC = () => {
  return (
    <section className="rounded-mn-card border border-mn-border-subtle/80 bg-mn-bg-elevated/95 px-4 py-4 text-[11px] text-mn-text-secondary shadow-mn-card">
      <div className="flex items-center gap-3">
        <div className="inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-mn-primary/15">
          <Film className="h-4 w-4 text-mn-primary" aria-hidden={true} />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-heading font-semibold text-mn-text-primary">
            No personalized rows yet
          </h3>
          <p className="text-[11px] text-mn-text-secondary">
            As you rate, review, and follow friends, this tab will fill with eerily good
            recommendations.
          </p>
        </div>
      </div>
    </section>
  );
};

export default HomeForYouTab;
