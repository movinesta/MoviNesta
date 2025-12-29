import React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { RatingStars } from "@/components/RatingStars";
import { MaterialIcon } from "@/components/ui/material-icon";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { qk } from "@/lib/queryKeys";
import { rating0_10ToStars, starsToRating0_10 } from "@/lib/ratings";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/modules/auth/AuthProvider";
import { getOrCreateMediaSwipeSessionId, sendMediaSwipeEvent } from "@/modules/swipe/mediaSwipeApi";

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

type ReviewRow = {
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

type ReactionRow = {
  review_id: string;
  emoji: string;
};

function compactNumber(n: number) {
  try {
    return Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(n);
  } catch {
    return String(n);
  }
}

function pickTitle(...candidates: Array<string | null | undefined>) {
  const value = candidates
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .find((item) => Boolean(item));
  return value || "Reviews";
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

function Divider() {
  return <div className="-mx-4 h-px bg-white/5" />;
}

function CircleIconButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-11 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white backdrop-blur-md transition hover:bg-white/20 active:scale-[0.98]"
    >
      {children}
    </button>
  );
}

function StarsHistogram({ summary }: { summary: RatingSummary }) {
  const items = [
    { star: 5, count: summary.stars_5 },
    { star: 4, count: summary.stars_4 },
    { star: 3, count: summary.stars_3 },
    { star: 2, count: summary.stars_2 },
    { star: 1, count: summary.stars_1 },
  ] as const;
  const total = items.reduce((a, b) => a + b.count, 0);

  return (
    <div className="grid grid-cols-[12px_1fr_38px] items-center gap-x-3 gap-y-2">
      {items.map((h) => {
        const pct = total ? Math.round((h.count / total) * 100) : 0;
        return (
          <React.Fragment key={h.star}>
            <p className="text-xs font-medium text-white">{h.star}</p>
            <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-[#3d3349]">
              <div
                className="rounded-full bg-primary"
                style={{ width: `${pct}%`, opacity: 0.2 + (h.star / 5) * 0.8 }}
              />
            </div>
            <p className="text-right text-xs text-white/50">{pct}%</p>
          </React.Fragment>
        );
      })}
    </div>
  );
}

function ReviewCard({
  review,
  profile,
  reactions,
}: {
  review: ReviewRow;
  profile: ProfilePublicRow | null;
  reactions: { up: number; down: number };
}) {
  const initials = (profile?.display_name ?? profile?.username ?? "?")
    .split(/\s+/g)
    .slice(0, 2)
    .map((p) => p.slice(0, 1).toUpperCase())
    .join("")
    .slice(0, 2);
  const stars = review.rating == null ? null : rating0_10ToStars(review.rating);
  const [showSpoiler, setShowSpoiler] = React.useState(false);
  const isSpoiler = Boolean(review.spoiler);
  const canShow = !isSpoiler || showSpoiler;

  return (
    <div className="rounded-2xl bg-[#302839] p-4">
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
            <p className="text-sm font-bold text-white">
              {profile?.display_name ?? profile?.username ?? "User"}
            </p>
            <p className="text-xs text-white/40">{timeAgo(review.created_at)}</p>
          </div>
        </div>

        {stars != null ? (
          <div className="flex items-center gap-1 rounded-lg bg-[#211a29] px-2 py-1">
            <MaterialIcon name="star" className="text-sm text-yellow-500" filled />
            <span className="text-xs font-bold text-white">{stars.toFixed(1)}</span>
          </div>
        ) : null}
      </div>

      {review.headline ? (
        <p className="mb-2 text-sm font-semibold text-white">{review.headline}</p>
      ) : null}

      {review.body ? (
        <div className="text-sm leading-relaxed text-white/75">
          {canShow ? (
            <p>{review.body}</p>
          ) : (
            <div className="rounded-xl border border-white/10 bg-[#211a29] p-3">
              <p className="text-white/80">Spoiler warning</p>
              <button
                type="button"
                className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-primary"
                onClick={() => setShowSpoiler(true)}
              >
                View spoiler
                <MaterialIcon name="chevron_right" className="text-base" />
              </button>
            </div>
          )}
        </div>
      ) : null}

      <div className="mt-4 flex items-center gap-4 text-xs text-white/55">
        <button
          type="button"
          className="inline-flex items-center gap-1 transition-colors hover:text-primary"
        >
          <MaterialIcon name="thumb_up" className="text-base" />
          <span>{reactions.up ? compactNumber(reactions.up) : "0"}</span>
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1 transition-colors hover:text-red-400"
        >
          <MaterialIcon name="thumb_down" className="text-base" />
          <span>{reactions.down ? compactNumber(reactions.down) : "0"}</span>
        </button>
        <button
          type="button"
          className="ml-auto rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/20"
        >
          Reply
        </button>
      </div>
    </div>
  );
}

function ReviewComposer({
  open,
  onOpenChange,
  titleName,
  titleId,
  contentType,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titleName: string;
  titleId: string;
  contentType: "movie" | "series" | "anime";
}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [ratingStars, setRatingStars] = React.useState<number>(4);
  const [headline, setHeadline] = React.useState<string>("");
  const [body, setBody] = React.useState<string>("");
  const [spoiler, setSpoiler] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setError(null);
      setHeadline("");
      setBody("");
      setSpoiler(false);
      setRatingStars(4);
    }
  }, [open]);

  const submit = useMutation({
    mutationFn: async () => {
      if (!user) {
        throw new Error("SIGN_IN_REQUIRED");
      }

      const rating0_10 = starsToRating0_10(ratingStars);
      const sessionId = getOrCreateMediaSwipeSessionId();

      const tasks: Promise<unknown>[] = [];

      tasks.push(
        supabase
          .from("reviews")
          .insert({
            user_id: user.id,
            title_id: titleId,
            content_type: contentType,
            rating: rating0_10,
            headline: headline.trim() || null,
            body: body.trim() || null,
            spoiler,
          })
          .then(({ error: e }) => {
            if (e) throw e;
          }),
      );

      // Keep ratings table (and recommendation feedback) in sync.
      tasks.push(
        supabase
          .from("ratings")
          .upsert(
            {
              user_id: user.id,
              title_id: titleId,
              content_type: contentType,
              rating: rating0_10,
            },
            { onConflict: "user_id,title_id" },
          )
          .then(({ error: e }) => {
            if (e) throw e;
          }),
      );

      tasks.push(
        sendMediaSwipeEvent({
          sessionId,
          deckId: null,
          position: null,
          mediaItemId: titleId,
          eventType: "rating",
          rating0_10,
          source: "title_reviews",
          payload: { action: "rate_and_review", origin: "title_reviews" },
        }),
      );

      await Promise.allSettled(tasks);
    },
    onSuccess: async () => {
      setError(null);
      onOpenChange(false);
      await queryClient.invalidateQueries({ queryKey: ["title", "reviews", titleId] });
      await queryClient.invalidateQueries({ queryKey: ["title", "rating-summary", titleId] });
      // Also refresh detail page caches.
      queryClient.invalidateQueries({ queryKey: qk.titleDetail(titleId) });
    },
    onError: (e: any) => {
      if (e?.message === "SIGN_IN_REQUIRED") {
        setError("Sign in to rate and review.");
        return;
      }
      setError(e?.message ?? "Failed to submit review.");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-white/10 bg-[#211a29] text-white">
        <DialogHeader>
          <DialogTitle>Rate &amp; Review</DialogTitle>
          <p className="mt-1 text-sm text-white/60">{titleName}</p>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Your rating</p>
              <p className="text-sm font-bold text-white">{ratingStars.toFixed(1)}/5</p>
            </div>
            <div className="mt-2">
              <RatingStars rating={ratingStars} size={20} />
            </div>
            <input
              className="mt-3 w-full"
              type="range"
              min={0}
              max={5}
              step={0.5}
              value={ratingStars}
              onChange={(e) => setRatingStars(Number(e.target.value))}
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold">Headline</p>
            <Input
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="Add a short headline"
              className="border-white/10 bg-white/5 text-white placeholder:text-white/40"
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold">Review</p>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Share your thoughts"
              className="min-h-[120px] border-white/10 bg-white/5 text-white placeholder:text-white/40"
            />
          </div>

          <label className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <span className="text-sm font-semibold">Contains spoilers</span>
            <input
              type="checkbox"
              checked={spoiler}
              onChange={(e) => setSpoiler(e.target.checked)}
              className="size-5 accent-primary"
            />
          </label>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex gap-3">
            <Button
              variant="secondary"
              className="flex-1 border-white/10 bg-white/10 text-white hover:bg-white/15"
              onClick={() => onOpenChange(false)}
              disabled={submit.isPending}
            >
              Cancel
            </Button>
            <Button className="flex-1" onClick={() => submit.mutate()} disabled={submit.isPending}>
              {submit.isPending ? "Saving…" : "Post"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function TitleReviewsPageV2() {
  const navigate = useNavigate();
  const params = useParams();

  const titleId = String(params.titleId ?? "");
  const canUseId = /^[0-9a-fA-F-]{36}$/.test(titleId);

  const [sort, setSort] = React.useState<"recent" | "top" | "critical">("recent");
  const [includeSpoilers, setIncludeSpoilers] = React.useState(false);
  const [composerOpen, setComposerOpen] = React.useState(false);

  const titleQuery = useQuery({
    queryKey: qk.titleDetail(canUseId ? titleId : null),
    enabled: canUseId,
    staleTime: 1000 * 60,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("media_items")
        .select("id,kind,tmdb_title,tmdb_name,omdb_title,tmdb_release_date,tmdb_first_air_date,tmdb_genres,omdb_genre")
        .eq("id", titleId)
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw error;
      return (
        (data as any as {
          id: string;
          kind: string | null;
          tmdb_title: string | null;
          tmdb_name: string | null;
          omdb_title: string | null;
          tmdb_release_date: string | null;
          tmdb_first_air_date: string | null;
          tmdb_genres: { name?: string }[] | null;
          omdb_genre: string | null;
        }) ?? null
      );
    },
  });

    const contentType: "movie" | "series" | "anime" = (() => {
    const kind = (titleQuery.data as any)?.kind as string | null | undefined;
    if (kind === "anime") return "anime";
    if (kind === "movie") return "movie";
    // Treat series/episode/other as "series" for content tables.
    return "series";
  })();

const titleName = pickTitle(
    titleQuery.data?.tmdb_title,
    titleQuery.data?.tmdb_name,
    titleQuery.data?.omdb_title,
  );
  const releaseYear = (() => {
    const raw = titleQuery.data?.tmdb_release_date ?? titleQuery.data?.tmdb_first_air_date ?? null;
    if (!raw) return null;
    const year = Number(String(raw).slice(0, 4));
    return Number.isNaN(year) ? null : year;
  })();
  const primaryGenre = (() => {
    const tmdbGenres = titleQuery.data?.tmdb_genres ?? [];
    if (Array.isArray(tmdbGenres)) {
      const item = tmdbGenres.find((g) => g?.name);
      if (item?.name) return item.name;
    }
    const omdb = titleQuery.data?.omdb_genre ?? null;
    if (omdb) return String(omdb).split(",")[0]?.trim() ?? null;
    return null;
  })();
  const subtitleParts = [releaseYear ? String(releaseYear) : null, primaryGenre].filter(Boolean);
  const titleSubtitle = subtitleParts.join(" • ");

  const summaryQuery = useQuery({
    queryKey: ["title", "rating-summary", canUseId ? titleId : null],
    enabled: canUseId,
    staleTime: 1000 * 60,
    queryFn: async (): Promise<RatingSummary | null> => {
      const { data, error } = await supabase.rpc("get_title_rating_summary_v1", { p_title_id: titleId });
      if (error) {
        console.warn("[TitleReviewsPageV2] rating summary RPC error", error.message);
        return null;
      }
      const row = Array.isArray(data) ? (data[0] as any) : (data as any);
      if (!row) return null;
      return {
        title_id: String(row.title_id ?? titleId),
        reviews_count: Number(row.reviews_count ?? 0),
        ratings_count: Number(row.ratings_count ?? 0),
        average_rating_0_10: row.average_rating_0_10 == null ? null : Number(row.average_rating_0_10),
        average_rating_0_5: row.average_rating_0_5 == null ? null : Number(row.average_rating_0_5),
        stars_5: Number(row.stars_5 ?? 0),
        stars_4: Number(row.stars_4 ?? 0),
        stars_3: Number(row.stars_3 ?? 0),
        stars_2: Number(row.stars_2 ?? 0),
        stars_1: Number(row.stars_1 ?? 0),
      };
    },
  });

  const PAGE_SIZE = 10;

  const reviewsQuery = useInfiniteQuery({
    queryKey: ["title", "reviews", titleId, sort],
    enabled: canUseId,
    initialPageParam: 0,
    getNextPageParam: (lastPage: any) => lastPage?.nextFrom ?? undefined,
    queryFn: async ({ pageParam }) => {
      const from = Number(pageParam ?? 0);
      const to = from + PAGE_SIZE - 1;

      let q = supabase
        .from("reviews")
        .select("id,user_id,title_id,rating,headline,body,spoiler,created_at", { count: "exact" })
        .eq("title_id", titleId);

      if (sort === "recent") {
        q = q.order("created_at", { ascending: false });
      } else if (sort === "top") {
        q = q.order("rating", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
      } else {
        q = q.order("rating", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false });
      }

      const { data, error, count } = await q.range(from, to);
      if (error) throw error;

      const rows = (data as any as ReviewRow[]) ?? [];
      const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
      const reviewIds = rows.map((r) => r.id);

      const profilesById = new Map<string, ProfilePublicRow>();
      if (userIds.length) {
        const { data: profiles, error: pe } = await supabase
          .from("profiles_public")
          .select("id,username,display_name,avatar_url")
          .in("id", userIds);
        if (!pe) {
          for (const p of (profiles as any as ProfilePublicRow[]) ?? []) profilesById.set(p.id, p);
        }
      }

      const reactionsByReview = new Map<string, { up: number; down: number }>();
      if (reviewIds.length) {
        const { data: reactions, error: re } = await supabase
          .from("review_reactions")
          .select("review_id,emoji")
          .in("review_id", reviewIds);

        if (!re) {
          for (const r of (reactions as any as ReactionRow[]) ?? []) {
            const prev = reactionsByReview.get(r.review_id) ?? { up: 0, down: 0 };
            if (r.emoji === "👍") prev.up += 1;
            if (r.emoji === "👎") prev.down += 1;
            reactionsByReview.set(r.review_id, prev);
          }
        }
      }

      return {
        rows,
        profilesById,
        reactionsByReview,
        totalCount: Number(count ?? 0),
        nextFrom: rows.length === PAGE_SIZE ? to + 1 : null,
      };
    },
  });

  const flat = React.useMemo(() => {
    const pages = reviewsQuery.data?.pages ?? [];
    const reviews: ReviewRow[] = [];
    const profiles = new Map<string, ProfilePublicRow>();
    const reactions = new Map<string, { up: number; down: number }>();
    let totalCount = 0;

    for (const p of pages as any[]) {
      for (const r of p.rows as ReviewRow[]) reviews.push(r);
      for (const [k, v] of (p.profilesById as Map<string, ProfilePublicRow>).entries()) profiles.set(k, v);
      for (const [k, v] of (p.reactionsByReview as Map<string, { up: number; down: number }>).entries())
        reactions.set(k, v);
      totalCount = Math.max(totalCount, Number(p.totalCount ?? 0));
    }

    return { reviews, profiles, reactions, totalCount };
  }, [reviewsQuery.data]);

  const visibleReviews = React.useMemo(
    () => (includeSpoilers ? flat.reviews : flat.reviews.filter((r) => !r.spoiler)),
    [flat.reviews, includeSpoilers],
  );

  const avgStars = summaryQuery.data?.average_rating_0_5 ?? null;
  const displayAvg = avgStars == null ? "–" : avgStars.toFixed(1);
  const displayCount = summaryQuery.data?.ratings_count ?? flat.totalCount;

  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) {
        await navigator.share({ title: titleName, url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        alert("Link copied");
      }
    } catch {
      // ignore
    }
  };

  if (!canUseId) {
    return (
      <div className="px-4 py-10 text-center text-white/70">
        This title link is invalid.
        <div className="mt-4">
          <Button onClick={() => navigate(-1)}>Go back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100dvh-(5.5rem+env(safe-area-inset-bottom)))] bg-[#1a1322] pb-24">
      {/* Top bar */}
      <div className="sticky top-0 z-30 -mx-4 flex items-center justify-between bg-[#1a1322]/80 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur relative">
        <CircleIconButton label="Back" onClick={() => navigate(-1)}>
          <MaterialIcon name="arrow_back" />
        </CircleIconButton>

        <div className="absolute left-1/2 w-[60%] -translate-x-1/2 text-center">
          <p className="truncate text-sm font-semibold text-white">
            {titleQuery.isLoading ? "" : titleName}
          </p>
          <p className="truncate text-xs text-white/50">{titleSubtitle || "Ratings & reviews"}</p>
        </div>

        <CircleIconButton label="More" onClick={handleShare}>
          <MaterialIcon name="more_vert" />
        </CircleIconButton>
      </div>

      <div className="px-4 pt-6">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex min-w-[100px] flex-col items-center justify-center gap-1">
            <p className="text-5xl font-black leading-none tracking-tight text-white">{displayAvg}</p>
            <div className="mt-1">
              {avgStars != null ? <RatingStars rating={avgStars} size={14} /> : <Skeleton className="h-4 w-24" />}
            </div>
            <p className="mt-2 text-xs text-white/50">
              {summaryQuery.isLoading ? "Loading…" : displayCount ? `${compactNumber(displayCount)} verified ratings` : "No ratings yet"}
            </p>
          </div>

          <div className="min-w-[200px] flex-1">
            {summaryQuery.data ? <StarsHistogram summary={summaryQuery.data} /> : <Skeleton className="h-24 w-full" />}
          </div>
        </div>

        <div className="mt-6 overflow-x-auto pb-2">
          <div className="flex gap-2 pr-2">
            {[{ k: "recent", label: "Most Recent" }, { k: "top", label: "Highest Rated" }, { k: "critical", label: "Critical" }].map(
              (t) => (
                <button
                  key={t.k}
                  type="button"
                  onClick={() => setSort(t.k as any)}
                  className={
                    "flex h-9 shrink-0 items-center justify-center rounded-full border px-4 text-xs font-semibold transition " +
                    (sort === t.k
                      ? "border-primary bg-primary text-white"
                      : "border-white/10 bg-white/10 text-white/70 hover:bg-white/20")
                  }
                >
                  {t.label}
                </button>
              ),
            )}
            <button
              type="button"
              onClick={() => setIncludeSpoilers((prev) => !prev)}
              className={cn(
                "flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-4 text-xs font-semibold transition",
                includeSpoilers
                  ? "border-primary bg-primary text-white"
                  : "border-white/10 bg-white/10 text-white/70 hover:bg-white/20",
              )}
              aria-pressed={includeSpoilers}
            >
              Spoilers
              <MaterialIcon
                name={includeSpoilers ? "visibility" : "visibility_off"}
                className="text-base"
              />
            </button>
          </div>
        </div>

        <div className="my-6">
          <Divider />
        </div>

        <div className="space-y-4">
          {reviewsQuery.isLoading ? (
            <>
              <Skeleton className="h-28 w-full rounded-2xl" />
              <Skeleton className="h-28 w-full rounded-2xl" />
            </>
          ) : null}

          {visibleReviews.map((r) => (
            <ReviewCard
              key={r.id}
              review={r}
              profile={flat.profiles.get(r.user_id) ?? null}
              reactions={flat.reactions.get(r.id) ?? { up: 0, down: 0 }}
            />
          ))}

          {!reviewsQuery.isLoading && visibleReviews.length === 0 ? (
            <div className="rounded-2xl bg-[#302839] p-4 text-sm text-white/60">
              {flat.reviews.length > 0 && !includeSpoilers
                ? "No spoiler-free reviews yet. Toggle spoilers to view all reviews."
                : "No reviews yet. Be the first to share your thoughts."}
            </div>
          ) : null}

          {reviewsQuery.hasNextPage ? (
            <Button
              variant="secondary"
              className="w-full rounded-full border-white/10 bg-white/10 text-white hover:bg-white/15"
              onClick={() => reviewsQuery.fetchNextPage()}
              disabled={reviewsQuery.isFetchingNextPage}
            >
              {reviewsQuery.isFetchingNextPage ? "Loading…" : "Load more"}
            </Button>
          ) : null}
        </div>
      </div>

      {/* Floating action */}
      <div className="fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 px-4">
        <Button className="h-14 w-full rounded-full" onClick={() => setComposerOpen(true)}>
          Rate &amp; Review
        </Button>
      </div>

      <ReviewComposer open={composerOpen} onOpenChange={setComposerOpen} titleName={titleName} titleId={titleId} contentType={contentType} />

      {/* Small link back to title page (keeps navigation feel) */}
      <div className="sr-only">
        <Link to={`/title/${titleId}`}>Back to title</Link>
      </div>
    </div>
  );
}
