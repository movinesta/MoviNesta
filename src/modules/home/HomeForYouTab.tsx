import React from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import {
  ChevronRight,
  Clock,
  Film,
  ListChecks,
  Loader2,
  Play,
  Sparkles,
  Users,
} from "lucide-react";
import { Chip } from "@/components/ui/chip";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  TonightPickSkeleton,
  CarouselsSkeleton,
  EmptyTonightPickState,
  EmptyForYouState,
} from "./HomeForYouSkeletons";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import { qk } from "@/lib/queryKeys";
import { toast } from "@/components/toasts";
import { TitleType } from "@/types/supabase-helpers";
import { mapMediaItemToSummary, type MediaItemRow } from "@/lib/mediaItems";

type RecommendationSectionKind = "friends-trending" | "because-you-liked" | "anime" | "continue";

interface RecommendationItem {
  id: string;
  name: string;
  year: number;
  runtimeMinutes?: number;
  contentType?: "movie" | "series" | "anime";
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
  title: string;
  year: number | null;
  runtimeMinutes: number | null;
  type: TitleType | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  imdbRating: number | null;
  rtTomatoMeter: number | null;
}

type LibraryContentType = "movie" | "series" | "anime";

const normalizeLibraryContentType = (type: TitleType | null | undefined): LibraryContentType => {
  if (type === "movie" || type === "series" || type === "anime") return type;
  if (type === "episode") return "series";
  return "movie";
};

const MEDIA_ITEM_COLUMNS = `
  id,
  kind,
  tmdb_title,
  tmdb_name,
  tmdb_original_title,
  tmdb_original_name,
  tmdb_release_date,
  tmdb_first_air_date,
  tmdb_runtime,
  tmdb_poster_path,
  tmdb_backdrop_path,
  tmdb_original_language,
  omdb_title,
  omdb_year,
  omdb_language,
  omdb_imdb_id,
  omdb_imdb_rating,
  omdb_rating_rotten_tomatoes,
  omdb_poster,
  omdb_rated,
  tmdb_id
`;

const mapMediaItemToBasicRow = (row: MediaItemRow): TitleBasicRow => {
  const summary = mapMediaItemToSummary(row);
  return {
    id: summary.id,
    title: summary.title,
    year: summary.year,
    runtimeMinutes: (row.tmdb_runtime as any) ?? null,
    type: summary.type,
    posterUrl: summary.posterUrl,
    backdropUrl: summary.backdropUrl,
    imdbRating: summary.imdbRating,
    rtTomatoMeter: summary.rtTomatoMeter,
  };
};

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

  const seedRating = ratings.find((row) => (row.rating ?? 0) >= 8.0) ?? ratings[0] ?? null;
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
  const { data: animeData, error: animeError } = await supabase
    .from("media_items")
    .select(MEDIA_ITEM_COLUMNS)
    .eq("kind", "anime")
    .order("tmdb_release_date", { ascending: false })
    .limit(16);

  if (animeError) {
    hasPartialData = true;
    console.warn("[HomeForYouTab] Failed to load anime titles", animeError.message);
  }

  const animeTitles = (animeData as MediaItemRow[] | null)?.map(mapMediaItemToBasicRow) ?? [];
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
    .from("media_items")
    .select(MEDIA_ITEM_COLUMNS)
    .in("id", allTitleIds);

  if (titlesResult.error) {
    throw new Error(titlesResult.error.message);
  }

  const titles = ((titlesResult.data ?? []) as MediaItemRow[]).map(mapMediaItemToBasicRow);
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
      runtimeMinutes: t.runtimeMinutes ?? undefined,
      contentType: normalizeLibraryContentType(t.type),
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
      posterUrl: getPosterWithFallback(t.posterUrl, t.backdropUrl),
      imdbRating: t.imdbRating ?? null,
      rtTomatoMeter: t.rtTomatoMeter ?? null,
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
      contentType: normalizeLibraryContentType(t.type),
      friendsWatchingCount,
      moodTag: t.type === "anime" ? "Anime night" : "Friends love this",
      posterUrl: getPosterWithFallback(t.posterUrl, t.backdropUrl),
      imdbRating: t.imdbRating ?? null,
      rtTomatoMeter: t.rtTomatoMeter ?? null,
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
        contentType: normalizeLibraryContentType(t.type),
        matchReason: `On your watchlist after ${seedTitle.title ?? "that favorite"}.`,
        posterUrl: getPosterWithFallback(t.posterUrl, t.backdropUrl),
        imdbRating: t.imdbRating ?? null,
        rtTomatoMeter: t.rtTomatoMeter ?? null,
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
      contentType: normalizeLibraryContentType(t.type),
      matchReason: "Anime in your catalog and trending in MoviNesta.",
      posterUrl: getPosterWithFallback(t.posterUrl, t.backdropUrl),
      imdbRating: t.imdbRating ?? null,
      rtTomatoMeter: t.rtTomatoMeter ?? null,
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
    const imdbRating = t.imdbRating ?? null;
    const rtTomatoMeter = t.rtTomatoMeter ?? null;

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
      runtimeMinutes: t.runtimeMinutes ?? undefined,
      contentType: normalizeLibraryContentType(t.type),
      matchReason,
      posterUrl: getPosterWithFallback(t.posterUrl, t.backdropUrl),
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
    queryKey: qk.homeForYou(user?.id),
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
    <div className="flex flex-col stack-gap">
      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-destructive/60 bg-destructive/10 px-3 py-2 text-xs text-destructive"
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
        <div className="flex flex-col gap-3">
          {sections.map((section) => (
            <RecommendationSectionRow key={section.id} section={section} />
          ))}
        </div>
      )}

      {!isLoading && hasPartialData && !error && (
        <p className="rounded-2xl border border-border-soft bg-muted px-3 py-2 text-xs text-muted-foreground">
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
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isWhyOpen, setIsWhyOpen] = React.useState(false);

  const addToWatchlist = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Not authenticated");
      const contentType = pick.contentType ?? normalizeLibraryContentType(null);

      const { data: existing, error: existingError } = await supabase
        .from("library_entries")
        .select("status")
        .eq("user_id", user.id)
        .eq("title_id", pick.id)
        .maybeSingle();

      if (existingError) {
        throw new Error(existingError.message);
      }

      const existingStatus =
        existing && typeof (existing as { status?: unknown }).status === "string"
          ? ((existing as { status: string }).status as string)
          : undefined;

      if (existingStatus === "want_to_watch") {
        return { already: true as const };
      }

      const { error } = await supabase.from("library_entries").upsert(
        {
          user_id: user.id,
          title_id: pick.id,
          status: "want_to_watch",
          updated_at: new Date().toISOString(),
          content_type: contentType,
        },
        { onConflict: "user_id,title_id" },
      );

      if (error) {
        throw new Error(error.message);
      }

      return { already: false as const };
    },
    onSuccess: async (res) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.homeForYou(user?.id) }),
        user?.id
          ? queryClient.invalidateQueries({ queryKey: qk.diaryLibrary(user.id) })
          : Promise.resolve(),
      ]);

      if (res.already) {
        toast.show("It’s already on your Watchlist.", { title: "Saved" });
      } else {
        toast.success("Added to your Watchlist.");
      }
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : "Please try again.";
      toast.error(message);
    },
  });

  const hasValidImdb =
    typeof pick.imdbRating === "number" && !Number.isNaN(pick.imdbRating) && pick.imdbRating > 0;

  const hasValidRt =
    typeof pick.rtTomatoMeter === "number" &&
    !Number.isNaN(pick.rtTomatoMeter) &&
    pick.rtTomatoMeter > 0;

  return (
    <section className="rounded-2xl border border-border bg-card/95 card-pad text-xs text-muted-foreground shadow-lg">
      <div className="mb-2 flex items-center justify-between gap-2">
        <Chip variant="accent" className="gap-1 px-2.5 py-0.5 text-xs">
          <Sparkles className="h-3.5 w-3.5" aria-hidden={true} />
          <span>Tonight&apos;s pick for you</span>
        </Chip>
        {pick.runtimeMinutes ? (
          <Chip className="gap-1 px-2 py-0.5 text-xs">
            <Clock className="h-3 w-3" aria-hidden={true} />
            <span>{pick.runtimeMinutes} min</span>
          </Chip>
        ) : null}
      </div>

      <div className="flex gap-3">
        <Link
          to={`/title/${pick.id}`}
          className="relative flex h-28 w-20 shrink-0 overflow-hidden rounded-2xl bg-background/80 shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {pick.posterUrl ? (
            <>
              <img src={pick.posterUrl} alt={pick.name} className="h-full w-full object-cover" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/80 via-background/40 to-transparent" />
            </>
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-gradient-to-br from-card/80 via-background to-primary/70 text-xs text-muted-foreground">
              <Film className="h-4 w-4 text-primary" aria-hidden={true} />
              <span>No poster yet</span>
            </div>
          )}
          <div className="pointer-events-none absolute bottom-1 left-1 right-1 space-y-0.5 px-1.5">
            <span className="inline-flex items-center rounded-full bg-background/80 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-primary">
              {pick.year}
            </span>
            <span className="block text-xs font-heading font-semibold text-primary-foreground line-clamp-3 drop-shadow">
              {pick.name}
            </span>
          </div>
        </Link>

        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="text-sm font-heading font-semibold text-foreground">
            Movie night mood: {pick.moodTag ?? "Surprise me"}
          </h2>
          {pick.logline && (
            <p className="text-xs text-muted-foreground line-clamp-3">{pick.logline}</p>
          )}
          {pick.moodLine && <p className="text-xs text-muted-foreground">{pick.moodLine}</p>}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => addToWatchlist.mutate()}
              disabled={addToWatchlist.isPending || !user?.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-md hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {addToWatchlist.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden={true} />
              ) : (
                <Play className="h-3.5 w-3.5" aria-hidden={true} />
              )}
              <span>{user?.id ? "Add to Watchlist" : "Sign in to save"}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsWhyOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/80 px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <ListChecks className="h-3.5 w-3.5" aria-hidden={true} />
              <span>Why this pick?</span>
            </button>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {pick.friendsWatchingCount ? (
              <span className="inline-flex items-center gap-1">
                <Users className="h-3 w-3" aria-hidden={true} />
                <span>Watched by {pick.friendsWatchingCount} friend(s)</span>
              </span>
            ) : null}
            {hasValidImdb && (
              <span className="inline-flex items-center gap-1">
                <span className="font-semibold text-muted-foreground">IMDb Rating</span>
                <span>{pick.imdbRating!.toFixed(1)}</span>
              </span>
            )}
            {hasValidRt && (
              <span className="inline-flex items-center gap-1">
                <span className="font-semibold text-muted-foreground">Tomatometer</span>
                <span>{pick.rtTomatoMeter}%</span>
              </span>
            )}
            {pick.matchReason && (
              <span className="line-clamp-1">
                <span className="font-medium text-muted-foreground">Because: </span>
                {pick.matchReason}
              </span>
            )}
          </div>
        </div>
      </div>

      <Dialog open={isWhyOpen} onOpenChange={setIsWhyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Why this pick?</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p className="font-semibold text-foreground">{pick.name}</p>
            {pick.matchReason ? (
              <p className="text-sm text-muted-foreground">{pick.matchReason}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                We chose this based on your recent activity and what you’ve been saving or rating.
              </p>
            )}

            {pick.moodLine ? (
              <p className="text-sm text-muted-foreground">{pick.moodLine}</p>
            ) : null}

            <div className="rounded-2xl border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
              <ul className="list-disc pl-4 space-y-1">
                <li>Recent diary and Watchlist signals are weighted higher.</li>
                <li>Friends’ recent ratings can surface titles you’re likely to enjoy.</li>
                <li>
                  We also bias toward titles with posters and strong public ratings when available.
                </li>
              </ul>
            </div>

            <div className="flex justify-end">
              <Link
                to={`/title/${pick.id}`}
                className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                onClick={() => setIsWhyOpen(false)}
              >
                Open details
              </Link>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
};

interface RecommendationSectionRowProps {
  section: RecommendationSection;
}

const RecommendationSectionRow: React.FC<RecommendationSectionRowProps> = ({ section }) => {
  const [isOpen, setIsOpen] = React.useState(false);

  if (!section.items.length) return null;

  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[12px] font-heading font-semibold text-foreground">
              {section.title}
            </h3>
            {section.pillLabel && (
              <span className="inline-flex items-center rounded-full bg-card/80 px-2 py-0.5 text-[9px] text-muted-foreground">
                {section.pillLabel}
              </span>
            )}
          </div>
          {section.subtitle && (
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{section.subtitle}</p>
          )}
        </div>

        <button
          type="button"
          aria-label={`See all for ${section.title}`}
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-background/80 px-2.5 py-1 text-xs text-muted-foreground hover:border-primary/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{section.title}</DialogTitle>
          </DialogHeader>
          {section.subtitle ? (
            <p className="text-sm text-muted-foreground">{section.subtitle}</p>
          ) : null}
          <div className="mt-2 space-y-2">
            {section.items.map((item) => (
              <Link
                key={`see-all-${section.id}-${item.id}`}
                to={`/title/${item.id}`}
                className="flex items-center gap-3 rounded-2xl border border-border/50 bg-card/60 p-3 hover:bg-card/80"
                onClick={() => setIsOpen(false)}
              >
                <div className="h-14 w-10 shrink-0 overflow-hidden rounded-xl bg-muted">
                  {item.posterUrl ? (
                    <img
                      src={item.posterUrl}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-primary/40 via-background/20 to-primary/60" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{item.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {item.year}
                    {item.matchReason ? ` • ${item.matchReason}` : ""}
                  </p>
                </div>
                <ChevronRight
                  className="ml-auto h-4 w-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              </Link>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
};

const SECTION_KIND_META: Record<RecommendationSectionKind, { icon: LucideIcon; label: string }> = {
  "friends-trending": { icon: Users, label: "Friends" },
  "because-you-liked": { icon: Film, label: "Match" },
  anime: { icon: Sparkles, label: "Anime" },
  continue: { icon: Clock, label: "Continue" },
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
      className="group flex w-[160px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-border bg-card/90 text-xs text-muted-foreground shadow-md no-underline outline-none ring-offset-2 ring-offset-background focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="relative h-32 overflow-hidden">
        {item.posterUrl ? (
          <>
            <img src={item.posterUrl} alt={item.name} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-br from-primary/45 via-background/40 to-primary/75" />
          </>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-gradient-to-br from-card/80 via-background to-primary/70 text-xs text-muted-foreground">
            <Film className="h-4 w-4 text-primary" aria-hidden={true} />
            <span>Poster missing</span>
          </div>
        )}
        <div className="relative flex h-full flex-col justify-between p-2.5">
          <div className="space-y-0.5">
            <p className="line-clamp-2 text-xs font-heading font-semibold text-foreground">
              {item.name}
            </p>
            {item.matchReason && (
              <p className="line-clamp-2 text-[9px] text-muted-foreground">{item.matchReason}</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between gap-1 px-2.5 py-2">
        {metaPieces.length > 0 && (
          <p className="line-clamp-1 text-[9px] text-muted-foreground">{metaPieces.join(" • ")}</p>
        )}

        <div className="mt-1 flex items-center justify-between gap-2 text-xs">
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <SectionIcon className="h-3 w-3" aria-hidden={true} />
            <span>{sectionMeta.label}</span>
          </span>

          <span className="inline-flex items-center gap-1 text-primary group-hover:underline">
            <span className="text-xs font-medium">Open</span>
            <ChevronRight className="h-2.5 w-2.5" aria-hidden="true" />
          </span>
        </div>
      </div>
    </Link>
  );
};

export default HomeForYouTab;
export { TonightPickSkeleton, CarouselsSkeleton } from "./HomeForYouSkeletons";
