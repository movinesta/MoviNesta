import React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { RatingStars } from "@/components/RatingStars";
import { MaterialIcon } from "@/components/ui/material-icon";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { callSupabaseFunction } from "@/lib/callSupabaseFunction";
import type { MediaItemRow } from "@/lib/mediaItems";
import { qk } from "@/lib/queryKeys";
import { rating0_10ToStars } from "@/lib/ratings";
import { supabase } from "@/lib/supabase";
import { tmdbImageUrl } from "@/lib/tmdb";
import { useAuth } from "@/modules/auth/AuthProvider";
import { useDiaryLibraryMutations, useTitleDiaryEntry } from "@/modules/diary/useDiaryLibrary";
import { getOrCreateMediaSwipeSessionId, sendMediaSwipeEvent } from "@/modules/swipe/mediaSwipeApi";
import { isCatalogSyncResponse, type CatalogSyncResponse } from "@/lib/catalogSync";
import { isUuid, resolveVirtualTitleId } from "./virtualTitleId";
import type { TitleType } from "@/types/supabase-helpers";

type TitleV2Row = Pick<
  MediaItemRow,
  | "id"
  | "kind"
  | "tmdb_title"
  | "tmdb_name"
  | "tmdb_release_date"
  | "tmdb_first_air_date"
  | "tmdb_runtime"
  | "tmdb_poster_path"
  | "tmdb_backdrop_path"
  | "tmdb_genres"
  | "tmdb_tagline"
  | "tmdb_overview"
  | "tmdb_raw"
  | "omdb_title"
  | "omdb_year"
  | "omdb_rated"
  | "omdb_runtime"
  | "omdb_plot"
  | "omdb_genre"
>;

type RatingSummary = {
  title_id: string;
  reviews_count: number;
  ratings_count: number;
  average_rating_0_10: number | null;
  average_rating_0_5: number | null;
  stars_5: number;
  stars_4: number;
  stars_3: number;
  stars_2: number;
  stars_1: number;
};

type ReviewPreviewRow = {
  id: string;
  user_id: string;
  title_id: string;
  rating: number | null;
  headline: string | null;
  body: string | null;
  spoiler: boolean | null;
  created_at: string;
};

type ProfilePublicRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

function compactNumber(n: number) {
  try {
    return Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(
      n,
    );
  } catch {
    return String(n);
  }
}

function formatRuntime(minutes: number | null | undefined) {
  if (!minutes || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h <= 0) return `${m}m`;
  if (m <= 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function getYearFromRow(row: TitleV2Row) {
  const date = (row.tmdb_release_date ?? row.tmdb_first_air_date) as any;
  if (date) {
    const s = String(date);
    const year = Number(s.slice(0, 4));
    if (!Number.isNaN(year)) return year;
  }
  if (row.omdb_year) {
    const year = Number(String(row.omdb_year).slice(0, 4));
    if (!Number.isNaN(year)) return year;
  }
  return null;
}

function getTitleFromRow(row: TitleV2Row) {
  const candidates = [row.tmdb_title, row.tmdb_name, row.omdb_title];
  const title = candidates
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .find((value) => Boolean(value));
  return title || "Untitled";
}

function getOverviewFromRow(row: TitleV2Row) {
  return row.tmdb_overview ?? row.omdb_plot ?? null;
}

function getContentTypeFromRow(row: TitleV2Row): TitleType {
  // Align with TitleType union used across the app
  if (row.kind === "movie") return "movie";
  if (row.kind === "series") return "series";
  if (row.kind === "anime") return "anime";
  if (row.kind === "episode") return "episode";
  return "other";
}

function extractGenres(tmdbGenres: unknown, omdbGenre: string | null | undefined): string[] {
  const out: string[] = [];
  if (Array.isArray(tmdbGenres)) {
    for (const g of tmdbGenres) {
      const name = (g as any)?.name;
      if (typeof name === "string" && name.trim()) out.push(name.trim());
    }
  }
  if (!out.length && omdbGenre) {
    for (const p of String(omdbGenre)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)) {
      out.push(p);
    }
  }
  // Deduplicate while preserving order
  return Array.from(new Set(out));
}

type TmdbRawVideo = { site?: string; type?: string; key?: string; name?: string };

function extractYouTubeTrailerUrl(tmdbRaw: unknown): string | null {
  const videos = (tmdbRaw as any)?.videos?.results;
  if (!Array.isArray(videos)) return null;
  const candidates = videos as TmdbRawVideo[];

  const pick = (fn: (v: TmdbRawVideo) => boolean) =>
    candidates.find((v) => fn(v) && v.site === "YouTube" && typeof v.key === "string");

  const trailer =
    pick((v) => v.type === "Trailer") || pick((v) => v.type === "Teaser") || pick(() => true);

  if (!trailer?.key) return null;
  return `https://www.youtube.com/watch?v=${encodeURIComponent(trailer.key)}`;
}

type TmdbRawCast = {
  id?: number;
  name?: string;
  character?: string;
  profile_path?: string | null;
};

function extractCast(tmdbRaw: unknown): TmdbRawCast[] {
  const cast = (tmdbRaw as any)?.credits?.cast;
  if (!Array.isArray(cast)) return [];
  return cast
    .filter((c) => c && typeof c === "object")
    .slice(0, 24)
    .map((c) => ({
      id: (c as any).id,
      name: (c as any).name,
      character: (c as any).character,
      profile_path: (c as any).profile_path,
    }));
}

function shortName(name: string) {
  const parts = name.trim().split(/\s+/g);
  if (parts.length <= 1) return name;
  return `${parts[0]} ${parts[1].slice(0, 1)}.`;
}

function timeAgo(iso: string) {
  const dt = new Date(iso);
  const now = Date.now();
  const diff = Math.max(0, now - dt.getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

function ReviewPreviewCard({
  review,
  profile,
}: {
  review: ReviewPreviewRow;
  profile: ProfilePublicRow | null;
}) {
  const [showSpoiler, setShowSpoiler] = React.useState(false);
  const initials = (profile?.display_name ?? profile?.username ?? "?")
    .split(/\s+/g)
    .slice(0, 2)
    .map((p) => p.slice(0, 1).toUpperCase())
    .join("")
    .slice(0, 2);
  const stars = review.rating == null ? null : rating0_10ToStars(review.rating);
  const isSpoiler = Boolean(review.spoiler);
  const canShow = !isSpoiler || showSpoiler;

  return (
    <div className="rounded-2xl border border-border bg-card/70 card-pad transition-colors hover:bg-card/90">
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-3">
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.display_name ?? profile.username ?? "User"}
              className="size-10 rounded-full object-cover"
            />
          ) : (
            <div className="flex size-10 items-center justify-center rounded-full bg-primary/20 font-bold text-primary">
              {initials}
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-foreground">
              {profile?.display_name ?? profile?.username ?? "User"}
            </p>
            <p className="text-xs text-muted-foreground">{timeAgo(review.created_at)}</p>
          </div>
        </div>
        {stars != null ? (
          <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-background/60 px-2 py-1">
            <MaterialIcon name="star" className="text-sm text-yellow-500" filled />
            <span className="text-xs font-semibold text-foreground">{stars.toFixed(1)}</span>
          </div>
        ) : null}
      </div>

      {review.headline ? (
        <p className="mb-2 text-sm font-semibold text-foreground">{review.headline}</p>
      ) : null}
      {review.body ? (
        canShow ? (
          <p className="text-sm leading-relaxed text-muted-foreground">{review.body}</p>
        ) : (
          <div className="rounded-xl border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            <p>Spoiler warning</p>
            <button
              type="button"
              className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-primary"
              onClick={() => setShowSpoiler(true)}
              aria-expanded={showSpoiler}
            >
              View spoiler
              <MaterialIcon name="chevron_right" className="text-base" />
            </button>
          </div>
        )
      ) : null}
    </div>
  );
}

function Divider() {
  return <div className="full-bleed h-px bg-border/60" />;
}

function CircleIconButton({
  children,
  label,
  onClick,
  isActive,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick?: () => void;
  isActive?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={
        "flex size-11 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white backdrop-blur-md transition " +
        (disabled ? "opacity-60" : "hover:bg-white/20 active:scale-[0.98]") +
        (isActive ? " ring-2 ring-primary/70" : "")
      }
    >
      {children}
    </button>
  );
}

export default function TitleDetailPageV2() {
  const navigate = useNavigate();
  const params = useParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const rawId = String(params.titleId ?? "");
  const [canonicalId, setCanonicalId] = React.useState<string | null>(null);

  // --- Support legacy virtual IDs (tmdb- / tv- prefixes) by syncing into media_items.
  React.useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!rawId) {
        setCanonicalId(null);
        return;
      }
      if (isUuid(rawId)) {
        setCanonicalId(rawId);
        return;
      }

      let nextId: string | null = null;
      try {
        nextId = await resolveVirtualTitleId(rawId, async (payload) => {
          const res = await callSupabaseFunction<CatalogSyncResponse>("catalog-sync", payload);
          if (!isCatalogSyncResponse(res)) return null;
          return res;
        });
      } catch (err) {
        console.warn("[TitleDetailPageV2] catalog-sync failed", err);
      }

      if (!cancelled) {
        setCanonicalId(nextId);
        if (nextId) {
          // Replace the route (keeps navigation stack clean)
          navigate(`/title/${nextId}`, { replace: true });
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [navigate, rawId]);

  const titleId = canonicalId ?? (isUuid(rawId) ? rawId : null);

  const titleQuery = useQuery({
    queryKey: qk.titleDetail(titleId),
    enabled: Boolean(titleId),
    staleTime: 1000 * 60,
    queryFn: async (): Promise<TitleV2Row | null> => {
      if (!titleId) return null;
      const { data, error } = await supabase
        .from("media_items")
        .select(
          [
            "id",
            "kind",
            "tmdb_title",
            "tmdb_name",
            "tmdb_release_date",
            "tmdb_first_air_date",
            "tmdb_runtime",
            "tmdb_poster_path",
            "tmdb_backdrop_path",
            "tmdb_genres",
            "tmdb_tagline",
            "tmdb_overview",
            "tmdb_raw",
            "omdb_title",
            "omdb_year",
            "omdb_rated",
            "omdb_runtime",
            "omdb_plot",
            "omdb_genre",
          ].join(","),
        )
        .eq("id", titleId)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        throw error;
      }
      return (data as any as TitleV2Row) ?? null;
    },
  });

  const summaryQuery = useQuery({
    queryKey: ["title", "rating-summary", titleId],
    enabled: Boolean(titleId),
    staleTime: 1000 * 60,
    queryFn: async (): Promise<RatingSummary | null> => {
      if (!titleId) return null;

      const { data, error } = await supabase.rpc("get_title_rating_summary_v1", {
        p_title_id: titleId,
      });

      if (error) {
        // If the RPC isn't deployed yet, fail soft.
        console.warn("[TitleDetailPageV2] rating summary RPC error", error.message);
        return null;
      }
      const row = Array.isArray(data) ? (data[0] as any) : (data as any);
      if (!row) return null;
      return {
        title_id: String(row.title_id ?? titleId),
        reviews_count: Number(row.reviews_count ?? 0),
        ratings_count: Number(row.ratings_count ?? 0),
        average_rating_0_10:
          row.average_rating_0_10 == null ? null : Number(row.average_rating_0_10),
        average_rating_0_5: row.average_rating_0_5 == null ? null : Number(row.average_rating_0_5),
        stars_5: Number(row.stars_5 ?? 0),
        stars_4: Number(row.stars_4 ?? 0),
        stars_3: Number(row.stars_3 ?? 0),
        stars_2: Number(row.stars_2 ?? 0),
        stars_1: Number(row.stars_1 ?? 0),
      } satisfies RatingSummary;
    },
  });

  const reviewsPreviewQuery = useQuery({
    queryKey: ["title", "reviews-preview", titleId],
    enabled: Boolean(titleId),
    staleTime: 1000 * 30,
    queryFn: async (): Promise<{
      reviews: ReviewPreviewRow[];
      profilesById: Map<string, ProfilePublicRow>;
    }> => {
      if (!titleId) return { reviews: [], profilesById: new Map() };

      const { data, error } = await supabase
        .from("reviews")
        .select("id,user_id,title_id,rating,headline,body,spoiler,created_at")
        .eq("title_id", titleId)
        .order("created_at", { ascending: false })
        .limit(2);

      if (error) throw error;

      const reviews = (data as any as ReviewPreviewRow[]) ?? [];
      const userIds = Array.from(new Set(reviews.map((r) => r.user_id).filter(Boolean)));
      const profilesById = new Map<string, ProfilePublicRow>();

      if (userIds.length) {
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles_public")
          .select("id,username,display_name,avatar_url")
          .in("id", userIds);
        if (profilesError) {
          console.warn("[TitleDetailPageV2] profile lookup failed", profilesError.message);
        } else {
          for (const p of (profiles as any as ProfilePublicRow[]) ?? []) {
            profilesById.set(p.id, p);
          }
        }
      }

      return { reviews, profilesById };
    },
  });

  const diary = useTitleDiaryEntry(titleId);
  const diaryMutations = useDiaryLibraryMutations();
  const status = diary.data?.status ?? null;
  const myStars = diary.data?.rating ?? null;

  const feedbackQuery = useQuery({
    queryKey: ["media_feedback", user?.id, titleId],
    enabled: Boolean(user?.id && titleId),
    staleTime: 1000 * 15,
    queryFn: async () => {
      if (!user?.id || !titleId) return null;
      const { data, error } = await supabase
        .from("media_feedback")
        .select("last_action")
        .eq("user_id", user.id)
        .eq("media_item_id", titleId)
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;
      return (data as any as { last_action: string | null }) ?? null;
    },
  });

  const isLiked = feedbackQuery.data?.last_action === "like";

  const toggleLike = useMutation({
    mutationFn: async () => {
      if (!titleId) return;
      if (!user?.id) {
        alert("Sign in to like this title.");
        return;
      }

      // Optimistic
      await queryClient.cancelQueries({ queryKey: ["media_feedback", user?.id, titleId] });
      queryClient.setQueryData(["media_feedback", user?.id, titleId], (prev: any) => {
        const next = isLiked ? "skip" : "like";
        return { ...(prev ?? {}), last_action: next };
      });

      const sessionId = getOrCreateMediaSwipeSessionId();
      await sendMediaSwipeEvent({
        sessionId,
        deckId: null,
        position: null,
        mediaItemId: titleId,
        eventType: isLiked ? "skip" : "like",
        source: "title",
        payload: { action: isLiked ? "unlike" : "like", origin: "title_detail" },
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["media_feedback", user?.id, titleId] });
    },
  });

  const toggleWatchlist = useMutation({
    mutationFn: async () => {
      if (!user?.id || !titleId) {
        if (!user?.id) {
          alert("Sign in to add this title to your watchlist.");
        }
        return;
      }
      const row = titleQuery.data;
      if (!row) return;
      const type = getContentTypeFromRow(row);

      const shouldEnable = status !== "want_to_watch";

      // Optimistic: update diary cache.
      queryClient.setQueryData(qk.titleDiary(user.id, titleId), (prev: any) => {
        return { ...(prev ?? {}), status: shouldEnable ? "want_to_watch" : null };
      });

      const sessionId = getOrCreateMediaSwipeSessionId();

      const tasks: Promise<unknown>[] = [];

      tasks.push(
        sendMediaSwipeEvent({
          sessionId,
          deckId: null,
          position: null,
          mediaItemId: titleId,
          eventType: "watchlist",
          inWatchlist: shouldEnable,
          source: "title",
          payload: {
            action: shouldEnable ? "watchlist_add" : "watchlist_remove",
            origin: "title_detail",
          },
        }),
      );

      if (shouldEnable) {
        tasks.push(
          diaryMutations.updateStatus.mutateAsync({ titleId, status: "want_to_watch", type }),
        );
      } else {
        // Remove the entry (keeps library clean and triggers watchlist_removed activity)
        tasks.push(
          Promise.resolve(
            supabase
              .from("library_entries")
              .delete()
              .eq("user_id", user.id)
              .eq("title_id", titleId),
          ).then(({ error }) => {
            if (error) throw error;
          }),
        );
      }

      await Promise.allSettled(tasks);
    },
    onSettled: () => {
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: qk.titleDiary(user.id, titleId ?? undefined) });
        queryClient.invalidateQueries({ queryKey: qk.diaryLibrary(user.id) });
        queryClient.invalidateQueries({ queryKey: qk.diaryStats(user.id) });
        queryClient.invalidateQueries({ queryKey: qk.homeFeed(user.id) });
      }
    },
  });

  const handleShare = async () => {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    const titleLabel = title || "MoviNesta";

    try {
      if (navigator.share) {
        await navigator.share({ title: titleLabel, url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      // ignore
    }
  };

  // Track detail open / close (soft-fail)
  React.useEffect(() => {
    if (!titleId) return;
    const sessionId = getOrCreateMediaSwipeSessionId();
    sendMediaSwipeEvent({
      sessionId,
      deckId: null,
      position: null,
      mediaItemId: titleId,
      eventType: "detail_open",
      source: "title",
      payload: { origin: "title_detail" },
    }).catch(() => null);

    return () => {
      sendMediaSwipeEvent({
        sessionId,
        deckId: null,
        position: null,
        mediaItemId: titleId,
        eventType: "detail_close",
        source: "title",
        payload: { origin: "title_detail" },
      }).catch(() => null);
    };
  }, [titleId]);

  const row = titleQuery.data;
  const backdropUrl = tmdbImageUrl(row?.tmdb_backdrop_path ?? null, "w1280") ?? null;
  const posterUrl = tmdbImageUrl(row?.tmdb_poster_path ?? null, "w500") ?? null;
  const year = row ? getYearFromRow(row) : null;
  const runtime = row ? formatRuntime(row.tmdb_runtime ?? null) : null;
  const rated = row?.omdb_rated ?? null;
  const title = row ? getTitleFromRow(row) : "";
  const tagline = row?.tmdb_tagline ?? null;
  const overview = row ? getOverviewFromRow(row) : null;
  const genres = row ? extractGenres(row.tmdb_genres as any, row.omdb_genre) : [];
  const trailerUrl = extractYouTubeTrailerUrl(row?.tmdb_raw) ?? null;
  const cast = extractCast(row?.tmdb_raw);

  const avg0_5 = summaryQuery.data?.average_rating_0_5 ?? null;
  const avgStars = avg0_5 == null ? null : Math.max(0, Math.min(5, avg0_5));
  const ratingsCount = summaryQuery.data?.ratings_count ?? 0;

  const heroRating = avgStars == null ? null : avgStars.toFixed(1);
  const heroRatingLabel = heroRating ?? "–";

  const histogram = summaryQuery.data
    ? ([
        { star: 5, count: summaryQuery.data.stars_5 },
        { star: 4, count: summaryQuery.data.stars_4 },
        { star: 3, count: summaryQuery.data.stars_3 },
        { star: 2, count: summaryQuery.data.stars_2 },
        { star: 1, count: summaryQuery.data.stars_1 },
      ] as const)
    : null;

  const histogramTotal = histogram ? histogram.reduce((a, b) => a + b.count, 0) : 0;

  return (
    <div className="relative flex min-h-[calc(100dvh-(5.5rem+env(safe-area-inset-bottom)))] flex-col overflow-hidden">
      {/* Hero backdrop */}
      <div className="pointer-events-none absolute inset-x-0 top-[-1rem] h-[65vh]">
        <div
          className="h-full w-full bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: backdropUrl
              ? `url(${backdropUrl})`
              : posterUrl
                ? `url(${posterUrl})`
                : undefined,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/10 to-background" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
      </div>

      {/* Top bar */}
      <div className="fixed top-0 z-30 full-bleed flex w-full items-center justify-between bg-gradient-to-b from-black/60 to-transparent px-[var(--page-pad-x)] pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <CircleIconButton label="Back" onClick={() => navigate(-1)}>
          <MaterialIcon name="arrow_back" />
        </CircleIconButton>

        <div className="flex items-center gap-2">
          <CircleIconButton
            label={isLiked ? "Liked" : "Like"}
            isActive={isLiked}
            disabled={!titleId || toggleLike.isPending}
            onClick={() => toggleLike.mutate()}
          >
            <MaterialIcon name="favorite" filled={isLiked} />
          </CircleIconButton>

          <CircleIconButton label="More" onClick={() => {}} disabled>
            <MaterialIcon name="more_vert" />
          </CircleIconButton>
        </div>
      </div>

      {/* Main content */}
      <main className="relative z-10 mt-[45vh] px-0 pb-20">
        <div className="flex flex-col items-center px-[var(--page-pad-x)] text-center">
          {/* Rating ring */}
          <div className="mb-4 relative group">
            <div className="absolute -inset-1 rounded-full bg-primary blur opacity-40 transition duration-200 group-hover:opacity-60" />
            <div className="relative flex size-16 items-center justify-center rounded-full border-2 border-primary bg-black/35">
              {summaryQuery.isLoading ? (
                <Skeleton className="h-6 w-10 rounded" />
              ) : (
                <span className="text-lg font-semibold text-foreground">{heroRatingLabel}</span>
              )}
            </div>
          </div>

          <h1 className="mb-2 text-balance text-4xl font-bold leading-tight tracking-tight text-white">
            {titleQuery.isLoading ? <Skeleton className="h-10 w-64" /> : title}
          </h1>

          {tagline ? <p className="mb-3 text-sm text-white/75">{tagline}</p> : null}

          <div className="mb-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm font-medium text-white/70">
            {year != null && <span>{year}</span>}
            {year != null && (runtime || rated) && (
              <span className="size-1 rounded-full bg-white/30" />
            )}
            {runtime && <span>{runtime}</span>}
            {runtime && rated && <span className="size-1 rounded-full bg-white/30" />}
            {rated && <span>{rated}</span>}
          </div>

          {genres.length ? (
            <div className="mb-8 flex flex-wrap justify-center gap-2">
              {genres.slice(0, 3).map((g) => (
                <div
                  key={g}
                  className="flex h-8 items-center justify-center rounded-full border border-white/5 bg-white/10 px-3 backdrop-blur-sm"
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-white">{g}</p>
                </div>
              ))}
            </div>
          ) : null}

          {/* Actions */}
          <div className="w-full max-w-sm">
            <div className="flex gap-3">
              {trailerUrl ? (
                <a
                  href={trailerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-14 flex-1 items-center justify-center gap-2 rounded-full bg-primary text-base font-bold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 active:scale-[0.98]"
                >
                  <MaterialIcon name="play_circle" />
                  Play Trailer
                </a>
              ) : (
                <Button
                  variant="secondary"
                  className="h-14 flex-1 rounded-full bg-white/10 text-white hover:bg-white/15"
                  disabled
                >
                  Trailer unavailable
                </Button>
              )}

              <button
                type="button"
                aria-label={
                  status === "want_to_watch" ? "Remove from watchlist" : "Add to watchlist"
                }
                onClick={() => toggleWatchlist.mutate()}
                disabled={!titleId || !row || toggleWatchlist.isPending}
                className={
                  "flex size-14 items-center justify-center rounded-full border border-white/10 bg-black/30 text-white backdrop-blur-sm transition-all hover:bg-black/40 active:scale-[0.98] " +
                  (status === "want_to_watch" ? " ring-2 ring-primary/70" : "")
                }
              >
                <MaterialIcon name="bookmark_add" filled={status === "want_to_watch"} />
              </button>

              <button
                type="button"
                aria-label="Share"
                onClick={handleShare}
                className="flex size-14 items-center justify-center rounded-full border border-white/10 bg-black/30 text-white backdrop-blur-sm transition-all hover:bg-black/40 active:scale-[0.98]"
              >
                <MaterialIcon name="ios_share" />
              </button>
            </div>

            {/* Personal rating hint */}
            {myStars != null ? (
              <div className="mt-3 flex items-center justify-center gap-2 text-xs text-white/70">
                <span>Your rating</span>
                <RatingStars rating={myStars} size={12} />
                <span className="font-semibold text-white">{myStars.toFixed(1)}/5</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Storyline */}
        {overview ? (
          <section className="px-[var(--page-pad-x)] pt-8">
            <h3 className="mb-3 px-1 text-lg font-bold text-white">Storyline</h3>
            <p className="px-1 text-base leading-relaxed text-white/75">{overview}</p>
          </section>
        ) : null}

        <div className="my-8">
          <Divider />
        </div>

        {/* Cast */}
        {cast.length ? (
          <section className="px-[var(--page-pad-x)]">
            <div className="mb-4 flex items-end justify-between px-1">
              <h3 className="text-lg font-semibold text-foreground">Cast &amp; Crew</h3>
              <button
                type="button"
                className="text-sm font-semibold text-primary"
                onClick={() => {
                  // Simple: jump to the horizontal list and let users scroll.
                  const el = document.getElementById("mn-cast-scroll");
                  el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                }}
              >
                See all
              </button>
            </div>
            <div
              id="mn-cast-scroll"
              className="full-bleed flex snap-x gap-3 overflow-x-auto px-[var(--page-pad-x)] pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {cast.slice(0, 12).map((c, idx) => {
                const name = typeof c.name === "string" ? c.name : "";
                const role = typeof c.character === "string" ? c.character : "";
                const img = tmdbImageUrl(c.profile_path ?? null, "w185");
                return (
                  <div
                    key={`${c.id ?? idx}`}
                    className="flex shrink-0 snap-start flex-col items-center gap-2"
                  >
                    <div className="size-20 overflow-hidden rounded-full bg-muted/60">
                      {img ? (
                        <img src={img} alt={name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                          <MaterialIcon name="person" />
                        </div>
                      )}
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-semibold text-foreground">
                        {name ? shortName(name) : ""}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{role}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        <div className="my-8">
          <Divider />
        </div>

        {/* Ratings & Reviews */}
        <section className="full-bleed mt-2 rounded-t-3xl border-t border-border/60 bg-background px-[var(--page-pad-x)] py-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">Ratings &amp; Reviews</h3>
            {titleId ? (
              <Link to={`/title/${titleId}/reviews`} className="text-sm font-semibold text-primary">
                See all
              </Link>
            ) : null}
          </div>

          <div className="mt-6 flex flex-wrap gap-6">
            <div className="flex flex-col justify-center gap-1">
              <p className="text-5xl font-black leading-none tracking-tight text-foreground">
                {heroRatingLabel}
              </p>
              <div className="mt-1">
                {avgStars != null ? (
                  <RatingStars rating={avgStars} size={14} />
                ) : (
                  <div className="h-4 w-24" />
                )}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {summaryQuery.isLoading
                  ? "Loading…"
                  : ratingsCount
                    ? `${compactNumber(ratingsCount)} verified ratings`
                    : "No ratings yet"}
              </p>
            </div>

            <div className="min-w-[220px] flex-1">
              {histogram ? (
                <div className="grid grid-cols-[12px_1fr_38px] items-center gap-x-3 gap-y-2">
                  {histogram.map((h) => {
                    const pct = histogramTotal ? Math.round((h.count / histogramTotal) * 100) : 0;
                    return (
                      <React.Fragment key={h.star}>
                        <p className="text-xs font-medium text-foreground">{h.star}</p>
                        <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="rounded-full bg-primary"
                            style={{ width: `${pct}%`, opacity: 0.2 + (h.star / 5) * 0.8 }}
                          />
                        </div>
                        <p className="text-right text-xs text-muted-foreground">{pct}%</p>
                      </React.Fragment>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-3">
                  <Skeleton className="h-2 w-full" />
                  <Skeleton className="h-2 w-5/6" />
                  <Skeleton className="h-2 w-4/6" />
                </div>
              )}
            </div>
          </div>

          {/* Reviews preview */}
          <div className="mt-8 flex flex-col gap-4">
            {reviewsPreviewQuery.isLoading ? (
              <>
                <Skeleton className="h-24 w-full rounded-2xl" />
                <Skeleton className="h-24 w-full rounded-2xl" />
              </>
            ) : (
              reviewsPreviewQuery.data?.reviews?.map((r) => (
                <ReviewPreviewCard
                  key={r.id}
                  review={r}
                  profile={reviewsPreviewQuery.data?.profilesById.get(r.user_id) ?? null}
                />
              ))
            )}

            {!reviewsPreviewQuery.isLoading &&
            (reviewsPreviewQuery.data?.reviews?.length ?? 0) === 0 ? (
              <div className="rounded-2xl border border-border bg-card/70 card-pad text-sm text-muted-foreground">
                No reviews yet. Be the first to rate and review this title.
              </div>
            ) : null}
          </div>

          {titleId ? (
            <div className="mt-6">
              <Link
                to={`/title/${titleId}/reviews`}
                className="inline-flex items-center gap-2 text-sm font-semibold text-primary"
              >
                View all reviews
                <MaterialIcon name="chevron_right" className="text-base" />
              </Link>
            </div>
          ) : null}
        </section>
      </main>

      <div className="pointer-events-none fixed bottom-0 left-0 h-12 w-full bg-gradient-to-t from-background to-transparent" />
    </div>
  );
}
