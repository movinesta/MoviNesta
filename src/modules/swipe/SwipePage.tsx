import React, { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Flame,
  Info,
  ImageOff,
  SkipForward,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Share2,
} from "lucide-react";
import TopBar from "../../components/shared/TopBar";
import { RatingStars } from "../../components/RatingStars";
import { useQuery } from "@tanstack/react-query";
import { qk } from "../../lib/queryKeys";
import { useAuth } from "../auth/AuthProvider";
import {
  useDiaryLibraryMutations,
  useTitleDiaryEntry,
  type DiaryStatus,
} from "../diary/useDiaryLibrary";
import { supabase } from "../../lib/supabase";
import type { SwipeCardData, SwipeDirection, SwipeDeckKind } from "./useSwipeDeck";
import { useSwipeDeck } from "./useSwipeDeck";
import SwipeSyncBanner from "./SwipeSyncBanner";
import { TitleType } from "@/types/supabase-helpers";

const ONBOARDING_STORAGE_KEY = "mn_swipe_onboarding_seen";
const SWIPE_DISTANCE_THRESHOLD = 88;
const SWIPE_VELOCITY_THRESHOLD = 0.32; // px per ms
const MAX_DRAG = 220;
const EXIT_MULTIPLIER = 16;
const EXIT_MIN = 360;
const ROTATION_FACTOR = 14;
const DRAG_INTENT_THRESHOLD = 32;
const FEEDBACK_ENABLED = true;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const formatRuntime = (minutes?: number | null): string | null => {
  if (!minutes || minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
};

const getSourceLabel = (source?: SwipeDeckKind) => {
  switch (source) {
    case "from-friends":
      return "Friends’ picks";
    case "trending":
      return "Trending now";
    default:
      return "Matched for you";
  }
};

const buildSwipeCardLabel = (card?: SwipeCardData) => {
  if (!card) return undefined;

  const pieces: string[] = [];
  if (card.year) pieces.push(String(card.year));

  const ratingBits: string[] = [];
  if (typeof card.imdbRating === "number" && !Number.isNaN(card.imdbRating)) {
    ratingBits.push(`IMDb ${card.imdbRating.toFixed(1)}`);
  }
  if (typeof card.rtTomatoMeter === "number" && !Number.isNaN(card.rtTomatoMeter)) {
    ratingBits.push(`${card.rtTomatoMeter}% Rotten Tomatoes`);
  }

  const descriptor = [...pieces, ...ratingBits].filter(Boolean).join(" · ");
  return descriptor ? `${card.title} (${descriptor})` : card.title;
};

interface CardMetadataProps {
  card: SwipeCardData;
  metaLine: string;
  highlightLabel: string | null;
}

const CardMetadata: React.FC<CardMetadataProps> = ({ card, metaLine, highlightLabel }) => {
  return (
    <div className="space-y-2 text-left leading-relaxed">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 className="line-clamp-2 text-2xl font-heading font-semibold text-mn-text-primary">
            {card.title}
          </h2>
          {metaLine && (
            <p className="truncate text-[11px] text-mn-text-secondary/90">{metaLine}</p>
          )}
          {highlightLabel && (
            <p className="text-[10px] font-medium text-mn-primary/90">
              {highlightLabel}
            </p>
          )}
        </div>
      </div>
      {card.tagline && !card.tagline.trim().startsWith("Plot") && (
        <p className="line-clamp-2 text-[11px] text-mn-text-secondary/90">{card.tagline}</p>
      )}
    </div>
  );
};

const PosterFallback: React.FC<{ title?: string }> = ({ title }) => (
  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-mn-bg via-mn-bg-elevated to-mn-bg text-center">
    <div className="flex flex-col items-center gap-2 text-mn-text-secondary">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-mn-surface-elevated/70 shadow-mn-soft">
        <ImageOff className="h-6 w-6 text-mn-text-secondary" />
      </div>
      <span className="text-[12px] font-semibold">Artwork unavailable</span>
      {title && (
        <span className="max-w-[240px] truncate text-[11px] text-mn-text-secondary/80">
          for {title}
        </span>
      )}
    </div>
  </div>
);

/**
 * Animated loading skeleton with subtle 3D “wiggle”
 */
const LoadingSwipeCard: React.FC = () => {
  const [offset, setOffset] = useState(0);
  const directionRef = useRef<1 | -1>(1);

  useEffect(() => {
    const interval = window.setInterval(() => {
      directionRef.current = (directionRef.current === 1 ? -1 : 1) as 1 | -1;
      setOffset(directionRef.current * 14);
    }, 850);

    return () => window.clearInterval(interval);
  }, []);

  const rotation = offset / 5;

  return (
    <article
      className="relative z-10 mx-auto flex h-[72%] max-h-[480px] w-full max-w-md select-none flex-col overflow-hidden rounded-2xl bg-gradient-to-br from-mn-bg-elevated/95 via-mn-bg/95 to-mn-bg-elevated/90 shadow-[0_24px_70px_rgba(0,0,0,0.8)] backdrop-blur transform-gpu will-change-transform"
      style={{
        transform: `perspective(1400px) translateX(${offset}px) rotateZ(${rotation}deg) rotateY(${
          offset / 6
        }deg) scale(1.02)`,
        transition: "transform 480ms cubic-bezier(0.22,0.61,0.36,1)",
      }}
    >
      <div className="relative h-[58%] overflow-hidden bg-gradient-to-br from-mn-bg/90 via-mn-bg/85 to-mn-bg/95">
        <div className="h-full w-full animate-pulse bg-gradient-to-br from-mn-border-subtle/40 via-mn-border-subtle/20 to-mn-border-subtle/50" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/10 to-mn-bg/85" />
        <div className="absolute left-3 right-3 top-3 flex flex-wrap items-center justify-between gap-2 text-[10px]">
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-mn-text-muted/90">
            <span className="h-1.5 w-1.5 rounded-full bg-mn-border-subtle/80" />
            Getting picks…
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] text-mn-text-muted/80">
            <Sparkles className="h-3 w-3" />
            Warming up
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between bg-gradient-to-b from-mn-bg/92 via-mn-bg/96 to-mn-bg px-4 pb-4 pt-3 backdrop-blur-md">
        <div className="space-y-3 text-left text-[12px] leading-relaxed">
          <div className="space-y-2">
            <div className="h-5 w-3/4 animate-pulse rounded-md bg-mn-border-subtle/60" />
            <div className="h-3 w-1/2 animate-pulse rounded-md bg-mn-border-subtle/40" />
          </div>
          <div className="space-y-1.5">
            <div className="h-3 w-full animate-pulse rounded-md bg-mn-border-subtle/40" />
            <div className="h-3 w-5/6 animate-pulse rounded-md bg-mn-border-subtle/30" />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <div className="h-6 w-20 animate-pulse rounded-md bg-mn-border-subtle/40" />
            <div className="h-6 w-16 animate-pulse rounded-md bg-mn-border-subtle/20" />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-mn-text-secondary">
          <span className="inline-flex items-center gap-1 text-[11px] text-mn-text-secondary/80">
            <Flame className="h-4 w-4 text-mn-border-subtle/80" />
            Finding what friends like…
          </span>
        </div>
      </div>
    </article>
  );
};

interface TitleDetailRow {
  title_id: string;
  content_type: string | null;

  plot: string | null;
  tmdb_overview: string | null;
  tagline: string | null;

  omdb_director: string | null;
  omdb_actors: string | null;

  genres: string[] | null;
  tmdb_genre_names: string[] | null;
  language: string | null;
  omdb_language: string | null;
  tmdb_original_language: string | null;
  country: string | null;
  omdb_country: string | null;

  imdb_rating: number | null;
  metascore: number | null;
  rt_tomato_pct: number | null;

  poster_url: string | null;
  tmdb_poster_path: string | null;
  backdrop_url: string | null;
}

const SwipePage: React.FC = () => {
  const {
    cards,
    isLoading,
    isError,
    swipe,
    fetchMore,
    trimConsumed,
    swipeSyncError,
    retryFailedSwipe,
    isRetryingSwipe,
  } = useSwipeDeck("combined", {
    limit: 72,
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isNextPreviewActive, setIsNextPreviewActive] = useState(false);
  const [activePosterFailed, setActivePosterFailed] = useState(false);
  const [nextPosterFailed, setNextPosterFailed] = useState(false);

  const [dragIntent, setDragIntent] = useState<"like" | "dislike" | null>(null);
  const [nextParallaxX, setNextParallaxX] = useState(0);

  const [isDetailMode, setIsDetailMode] = useState(false);
  const [showFullFriendReview, setShowFullFriendReview] = useState(false);
  const [showFullOverview, setShowFullOverview] = useState(false);

  const [lastAction, setLastAction] = useState<{
    card: SwipeCardData;
    direction: SwipeDirection;
  } | null>(null);
  const [showUndo, setShowUndo] = useState(false);
  const undoTimeoutRef = useRef<number | null>(null);

  // Smarts
  const [smartHint, setSmartHint] = useState<string | null>(null);
  const smartHintTimeoutRef = useRef<number | null>(null);
  const [longSkipStreak, setLongSkipStreak] = useState(0);
  const [sessionSwipeCount, setSessionSwipeCount] = useState(0);
  const detailContentRef = useRef<HTMLDivElement | null>(null);
  const dragStartedInDetailAreaRef = useRef(false);

  // Share presets
  const [showSharePresetSheet, setShowSharePresetSheet] = useState(false);

  const activeCard = cards[currentIndex];
  const nextCard = cards[currentIndex + 1];

  const activeTitleId = activeCard?.id ?? null;

  // diary / auth
  const { user } = useAuth();
  const { updateStatus, updateRating } = useDiaryLibraryMutations();
  const { data: diaryEntryData } = useTitleDiaryEntry(activeTitleId);
  const diaryEntry = diaryEntryData ?? { status: null, rating: null };

  // long press
  const longPressTimeoutRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);

  // haptics + audio
  const audioContextRef = useRef<AudioContext | null>(null);

  // hover parallax
  const hoverTiltRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const ensureAudioContext = () => {
    if (!FEEDBACK_ENABLED) return null;
    if (typeof window === "undefined") return null;
    if (audioContextRef.current) return audioContextRef.current;
    const AC =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    audioContextRef.current = ctx;
    return ctx;
  };

  const safeVibrate = (pattern: number | number[]) => {
    if (!FEEDBACK_ENABLED) return;
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
    navigator.vibrate(pattern);
  };

  const playSwipeSound = (direction: SwipeDirection, intensity: number) => {
    if (!FEEDBACK_ENABLED) return;
    const ctx = ensureAudioContext();
    if (!ctx) return;

    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    let startFreq = 440;
    let endFreq = 440;

    if (direction === "like") {
      startFreq = 420;
      endFreq = 660;
    } else if (direction === "dislike") {
      startFreq = 280;
      endFreq = 190;
    } else {
      startFreq = 360;
      endFreq = 320;
    }

    const now = ctx.currentTime;
    const duration = 0.08 + intensity * 0.07;

    osc.type = "triangle";
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.linearRampToValueAtTime(endFreq, now + duration);

    const startGain = 0.18 + intensity * 0.18;
    gain.gain.setValueAtTime(startGain, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  };

  // title details (from titles table)
  const { data: titleDetail } = useQuery<TitleDetailRow | null>({
    queryKey: qk.titleDetail(activeTitleId),
    enabled: Boolean(activeTitleId && isDetailMode),
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!activeTitleId) return null;

      const { data, error } = await supabase
        .from("titles")
        .select(
          `
          title_id,
          content_type,
          plot,
          tmdb_overview,
          tagline,
          omdb_director,
          omdb_actors,
          genres,
          tmdb_genre_names,
          language,
          omdb_language,
          tmdb_original_language,
          country,
          omdb_country,
          imdb_rating,
          metascore,
          rt_tomato_pct,
          poster_url,
          tmdb_poster_path,
          backdrop_url
        `,
        )
        .eq("title_id", activeTitleId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data as TitleDetailRow | null;
    },
  });

  const detailOverview =
    (titleDetail?.plot ?? titleDetail?.tmdb_overview) ??
    activeCard?.overview ??
    null;

  const detailGenres =
    titleDetail?.tmdb_genre_names ??
    titleDetail?.genres ??
    activeCard?.genres ??
    null;

  const detailYear =
    typeof activeCard?.year === "number" ? activeCard.year : null;

  const detailRuntimeMinutes =
    typeof titleDetail?.runtime_minutes === "number"
      ? titleDetail.runtime_minutes
      : typeof activeCard?.runtimeMinutes === "number"
      ? activeCard.runtimeMinutes
      : null;

  const detailPrimaryLanguage =
    titleDetail?.language ??
    titleDetail?.omdb_language ??
    titleDetail?.tmdb_original_language ??
    activeCard?.language ??
    null;

  const detailPrimaryCountry =
    titleDetail?.country ??
    titleDetail?.omdb_country ??
    activeCard?.country ??
    null;

  const detailDirector = titleDetail?.omdb_director ?? null;
  const detailActors = titleDetail?.omdb_actors ?? null;

  const externalImdbRating = titleDetail?.imdb_rating ?? activeCard?.imdbRating ?? null;
  const externalTomato = titleDetail?.rt_tomato_pct ?? activeCard?.rtTomatoMeter ?? null;
  const externalMetascore = titleDetail?.metascore ?? null;

  // diary helpers
  const normalizedContentType: TitleType | null =
    titleDetail?.content_type === "movie" || titleDetail?.content_type === "series"
      ? titleDetail.content_type
      : activeCard?.type ?? null;


  const normalizedContentTypeLabel =
    normalizedContentType === "movie"
      ? "Movie"
      : normalizedContentType === "series"
      ? "Series"
      : null;

  const ensureSignedIn = () => {
    if (!user) {
      alert("Sign in to save this title, rate it, or add it to your watchlist.");
      return false;
    }
    return true;
  };

  const setDiaryStatus = (status: DiaryStatus) => {
    if (!activeTitleId || !ensureSignedIn() || updateStatus.isPending) return;
    const type = normalizedContentType ?? "movie";
    updateStatus.mutate({ titleId: activeTitleId, status, type });
  };

  const setDiaryRating = (nextRating: number | null) => {
    if (!activeTitleId || !ensureSignedIn() || updateRating.isPending) return;
    const type = normalizedContentType ?? "movie";
    updateRating.mutate({ titleId: activeTitleId, rating: nextRating, type });
  };

  const statusIs = (status: DiaryStatus) => diaryEntry?.status === status;

  const getShareUrl = () =>
    typeof window !== "undefined"
      ? `${window.location.origin}/title/${activeCard?.id ?? ""}`
      : `/title/${activeCard?.id ?? ""}`;

  const handleShareExternal = async (messageOverride?: string) => {
    if (!activeCard) return;
    const url = getShareUrl();
    const defaultText = `Check this out: ${activeCard.title}`;
    const text = messageOverride ?? defaultText;

    try {
      if (navigator.share) {
        await navigator.share({
          title: activeCard.title,
          text,
          url,
        });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${text}\n\n${url}`);
        alert("Link copied to clipboard");
      } else {
        alert(`${text}\n\n${url}`);
      }
    } catch {
      // user cancelled
    }
  };

  const handleShareOpenDetail = () => {
    if (!activeCard) return;
    const url = `/title/${activeCard.id}`;
    if (typeof window !== "undefined") {
      window.open(url, "_blank");
    }
  };

  const handleSharePreset = async (preset: "watch_together" | "recommend" | "dm") => {
    if (!activeCard) return;
    const url = getShareUrl();

    let text: string;
    if (preset === "watch_together") {
      text = `Should we watch this together?\n\n${activeCard.title} (${activeCard.year ?? ""})\n`;
      await handleShareExternal(text);
    } else if (preset === "recommend") {
      text = `This looks like your type of title.\n\n${activeCard.title} (${activeCard.year ?? ""})\n`;
      await handleShareExternal(text);
    } else {
      // DM preset: always copy formatted DM text
      text = `Hey, I found this on MoviNesta:\n${activeCard.title} (${activeCard.year ?? ""})\n\nWhat do you think?\n${url}`;
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
          alert("Message copied for DM");
        } else {
          alert(text);
        }
      } catch {
        alert(text);
      }
    }

    setShowSharePresetSheet(false);
  };

  const showActivePoster = Boolean(activeCard?.posterUrl && !activePosterFailed);
  const showNextPoster = Boolean(nextCard?.posterUrl && !nextPosterFailed);

  const cardRef = useRef<HTMLDivElement | null>(null);
  const dragStartX = useRef<number | null>(null);
  const dragDelta = useRef(0);
  const rafRef = useRef<number>();
  const lastMoveX = useRef<number | null>(null);
  const lastMoveTime = useRef<number | null>(null);
  const velocityRef = useRef(0);

  useEffect(() => {
    const hasSeen =
      typeof window !== "undefined" ? localStorage.getItem(ONBOARDING_STORAGE_KEY) : null;
    setShowOnboarding(!hasSeen);
  }, []);

  useEffect(() => {
    setActivePosterFailed(false);
    setShowFullFriendReview(false);
    setIsDetailMode(false);
    setShowFullOverview(false);
    setShowSharePresetSheet(false);
  }, [activeCard?.id]);

  useEffect(() => {
    setNextPosterFailed(false);
  }, [nextCard?.id]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const idle = (window as typeof window & { requestIdleCallback?: typeof requestIdleCallback })
      .requestIdleCallback;
    const runner = idle ?? ((cb: () => void) => window.setTimeout(cb, 180));

    runner(() => {
      const upcoming = cards.slice(currentIndex + 1, currentIndex + 4);
      for (const card of upcoming) {
        if (!card?.posterUrl) continue;
        const img = new Image();
        img.loading = "lazy";
        img.decoding = "async";
        img.src = card.posterUrl;
      }
    });
  }, [cards, currentIndex]);

  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (longPressTimeoutRef.current != null) {
        window.clearTimeout(longPressTimeoutRef.current);
      }
      if (undoTimeoutRef.current != null) {
        window.clearTimeout(undoTimeoutRef.current);
      }
      if (smartHintTimeoutRef.current != null) {
        window.clearTimeout(smartHintTimeoutRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
    },
    [],
  );

  useEffect(() => {
    if (!nextCard) return;
    setIsNextPreviewActive(false);
    const timeout = window.setTimeout(() => {
      setIsNextPreviewActive(true);
    }, 16);
    return () => window.clearTimeout(timeout);
  }, [nextCard?.id]);

  useEffect(() => {
    const remaining = cards.length - currentIndex;
    if (remaining < 3) {
      fetchMore(Math.max(24, remaining + 12));
    }
  }, [cards.length, currentIndex, fetchMore]);

  useEffect(() => {
    if (currentIndex <= 10) return;
    const drop = Math.min(currentIndex - 6, cards.length);
    if (drop > 0) {
      trimConsumed(drop);
      setCurrentIndex((idx) => Math.max(4, idx - drop));
    }
  }, [cards.length, currentIndex, trimConsumed]);

  const setCardTransform = (
    x: number,
    {
      withTransition = false,
      clampDrag = true,
      elastic = false,
    }: { withTransition?: boolean; clampDrag?: boolean; elastic?: boolean } = {},
  ) => {
    const node = cardRef.current;
    if (!node) return;

    const finalX = clampDrag ? clamp(x, -MAX_DRAG, MAX_DRAG) : x;

    const rotateZ = clamp(finalX / ROTATION_FACTOR, -12, 12);
    const dragRotateY = clamp(finalX / 26, -10, 10);
    const baseScale = 1.02;
    const extraScale = Math.min(Math.abs(finalX) / 900, 0.04);
    const scale = baseScale + extraScale;

    const hover = hoverTiltRef.current;
    const hoverRotateX = hover.y * -4; // tilt up/down with mouse
    const hoverRotateYExtra = hover.x * 5; // add a bit of horizontal tilt
    const hoverTranslateY = hover.y * -4;

    if (withTransition) {
      node.style.transition = elastic
        ? "transform 360ms cubic-bezier(0.18,0.89,0.32,1.28)"
        : "transform 260ms cubic-bezier(0.22,0.61,0.36,1)";
    } else {
      node.style.transition = "none";
    }

    node.style.transform = `
      perspective(1400px)
      translateX(${finalX}px)
      translateY(${hoverTranslateY}px)
      rotateX(${hoverRotateX}deg)
      rotateY(${dragRotateY + hoverRotateYExtra}deg)
      rotateZ(${rotateZ}deg)
      scale(${scale})
    `;

    dragDelta.current = finalX;
  };

  const resetCardPosition = () => {
    hoverTiltRef.current = { x: 0, y: 0 };
    setCardTransform(0, { withTransition: true, elastic: true });
    dragDelta.current = 0;
    dragStartX.current = null;
    lastMoveX.current = null;
    lastMoveTime.current = null;
    velocityRef.current = 0;
    setDragIntent(null);
    setNextParallaxX(0);
  };

  const setUndo = (card: SwipeCardData, direction: SwipeDirection) => {
    setLastAction({ card, direction });
    setShowUndo(true);

    if (undoTimeoutRef.current != null) {
      window.clearTimeout(undoTimeoutRef.current);
    }
    undoTimeoutRef.current = window.setTimeout(() => {
      setShowUndo(false);
    }, 2800);
  };

  const clearUndo = () => {
    setShowUndo(false);
    setLastAction(null);
    if (undoTimeoutRef.current != null) {
      window.clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }
  };

  const handleUndo = () => {
    if (!lastAction) return;

    setCurrentIndex((prev) => {
      const candidate = prev - 1;
      if (candidate < 0) return prev;
      const previousCard = cards[candidate];
      if (previousCard && previousCard.id === lastAction.card.id) {
        return candidate;
      }
      return prev;
    });

    clearUndo();
  };

  // Simple rule-based hint system (smarter)
  const setSmartHintWithTimeout = (hint: string | null) => {
    setSmartHint(hint);
    if (smartHintTimeoutRef.current != null) {
      window.clearTimeout(smartHintTimeoutRef.current);
    }
    if (hint) {
      smartHintTimeoutRef.current = window.setTimeout(() => {
        setSmartHint(null);
      }, 3200);
    }
  };

  const computeSmartHint = (card: SwipeCardData, direction: SwipeDirection) => {
    const runtime = card.runtimeMinutes ?? 0;
    const genres = (detailGenres ?? card.genres ?? []) as string[];
    const isSeries = normalizedContentType === "series" || card.type === "series";
    const genreLower = genres.map((g) => g.toLowerCase());

    if (direction === "like") {
      if (genreLower.some((g) => g.includes("horror") || g.includes("thriller"))) {
        return "We’ll show more intense picks like this.";
      }
      if (genreLower.some((g) => g.includes("comedy"))) {
        return "We’ll show more light and funny picks like this.";
      }
      if (isSeries) {
        return "Nice — we’ll bring in more series that match this vibe.";
      }
      if (externalImdbRating != null && externalImdbRating >= 7.5) {
        return "Nice pick — we’ll show more highly rated titles like this.";
      }
      if (card.friendLikesCount && card.friendLikesCount >= 3) {
        return "Your friends are into this — we’ll pull in more friend-favorites.";
      }
      return "Got it — we’ll keep tuning around this kind of title.";
    }

    if (direction === "dislike") {
      if (isSeries) {
        return "Looks like this series isn’t your thing — we’ll dial down similar shows.";
      }
      if (runtime > 130 && longSkipStreak + 1 >= 3) {
        return "You’ve skipped a few long movies — we’ll lean toward shorter runtimes.";
      }
      if (runtime > 130) {
        return "Noted — we’ll be more careful with super long movies.";
      }
      return "Okay, we’ll dial down similar titles in your feed.";
    }

    if (direction === "skip") {
      return "We’ll move this out of your way and keep the feed feeling fresh.";
    }

    return null;
  };

  const performSwipe = (direction: SwipeDirection, velocity = 0) => {
    if (!activeCard) return;

    setShowOnboarding(false);
    if (typeof window !== "undefined") {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, "1");
    }

    setUndo(activeCard, direction);

    swipe({
      cardId: activeCard.id,
      direction,
      rating: activeCard.initialRating ?? null,
      inWatchlist: activeCard.initiallyInWatchlist ?? undefined,
      sourceOverride: activeCard.source,
    });

    setDragIntent(null);
    setNextParallaxX(0);

    // Long skip streak tracking
    if (direction === "dislike" && (activeCard.runtimeMinutes ?? 0) > 130) {
      setLongSkipStreak((s) => s + 1);
    } else {
      setLongSkipStreak(0);
    }

    // smart hint – only after a few swipes, and not on every swipe
    setSessionSwipeCount((prev) => {
      const next = prev + 1;
      const hint = computeSmartHint(activeCard, direction);
      if (hint && next >= 4 && next % 4 === 0) {
        setSmartHintWithTimeout(hint);
      } else {
        setSmartHintWithTimeout(null);
      }
      return next;
    });

    if (direction === "skip") {
      const node = cardRef.current;
      if (node) {
        node.style.transition =
          "transform 220ms cubic-bezier(0.22,0.61,0.36,1), opacity 220ms ease-out";
        node.style.transform =
          "perspective(1400px) translateX(0px) translateY(4px) scale(1.03) rotateZ(-1deg)";
        window.setTimeout(() => {
          node.style.transform = "perspective(1400px) translateX(0px) translateY(24px) scale(0.95)";
        }, 16);
        node.style.opacity = "0";
      }

      const intensity = 0.4;
      safeVibrate(16 + intensity * 40);
      playSwipeSound(direction, intensity);

      window.setTimeout(() => {
        setCurrentIndex((prev) => Math.min(prev + 1, cards.length));
        if (node) {
          node.style.transition = "none";
          node.style.transform = "translateX(0px) translateY(0px) scale(1)";
          node.style.opacity = "1";
        }
      }, 220);
      return;
    }

    const directionSign = direction === "like" ? 1 : -1;
    const baseExit = Math.max(
      EXIT_MIN,
      Math.abs(dragDelta.current) + Math.abs(velocity) * EXIT_MULTIPLIER,
    );
    const exitX = baseExit * directionSign;

    const node = cardRef.current;
    if (node) {
      const exitRotateZ = clamp(exitX / ROTATION_FACTOR, -18, 18);
      const exitRotateY = directionSign * 12;

      node.style.transition = "transform 260ms cubic-bezier(0.22,0.61,0.36,1)";
      node.style.transform = `
        perspective(1400px)
        translateX(${exitX}px)
        translateY(-4px)
        rotateZ(${exitRotateZ}deg)
        rotateY(${exitRotateY}deg)
        scale(1.04)
      `;
    }

    const travelMagnitude = Math.abs(baseExit);
    const intensity = Math.min(1, travelMagnitude / 520);

    safeVibrate(22 + intensity * 60);
    playSwipeSound(direction, intensity);

    window.setTimeout(() => {
      setCurrentIndex((prev) => Math.min(prev + 1, cards.length));
      resetCardPosition();
    }, 260);
  };

  const handlePointerDown = (x: number, pointerId: number) => {
    if (!activeCard) return;

    setIsDragging(true);
    dragStartX.current = x;
    dragDelta.current = 0;
    lastMoveX.current = x;
    lastMoveTime.current = performance.now();
    velocityRef.current = 0;
    setDragIntent(null);
    setNextParallaxX(0);

    ensureAudioContext();

    if (longPressTimeoutRef.current != null) {
      window.clearTimeout(longPressTimeoutRef.current);
    }
    longPressTriggeredRef.current = false;

    longPressTimeoutRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      setIsDragging(false);
      resetCardPosition();
      safeVibrate(20);
      setIsDetailMode((prev) => !prev);
    }, 550);

    const node = cardRef.current;
    if (!node) return;

    try {
      node.setPointerCapture(pointerId);
    } catch {
      // ignore
    }
  };

  const handlePointerMove = (x: number) => {
    if (!isDragging || dragStartX.current === null) return;

    const now = performance.now();
    const dx = x - dragStartX.current;

    if (longPressTimeoutRef.current != null && Math.abs(dx) > 10 && !longPressTriggeredRef.current) {
      window.clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }

    setCardTransform(dx, { withTransition: false });

    let nextIntent: "like" | "dislike" | null = null;
    if (dx > DRAG_INTENT_THRESHOLD) nextIntent = "like";
    else if (dx < -DRAG_INTENT_THRESHOLD) nextIntent = "dislike";
    setDragIntent(nextIntent);

    setNextParallaxX(-dx * 0.06);

    if (lastMoveX.current !== null && lastMoveTime.current !== null) {
      const dt = now - lastMoveTime.current;
      if (dt > 0) {
        const vx = (x - lastMoveX.current) / dt;
        velocityRef.current = vx;
      }
    }

    lastMoveX.current = x;
    lastMoveTime.current = now;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = window.requestAnimationFrame(() => setCardTransform(dragDelta.current));
  };

  const finishDrag = () => {
    if (longPressTimeoutRef.current != null) {
      window.clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }

    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      dragStartX.current = null;
      lastMoveX.current = null;
      lastMoveTime.current = null;
      velocityRef.current = 0;
      return;
    }

    if (!isDragging) return;
    setIsDragging(false);

        const distance = dragDelta.current;
    const projected = distance + velocityRef.current * 180;

    const isDetailDrag = isDetailMode && dragStartedInDetailAreaRef.current;
    const distanceThreshold = isDetailDrag ? SWIPE_DISTANCE_THRESHOLD * 1.6 : SWIPE_DISTANCE_THRESHOLD;
    const velocityThreshold = isDetailDrag ? SWIPE_VELOCITY_THRESHOLD * 1.4 : SWIPE_VELOCITY_THRESHOLD;

    const shouldSwipe =
      Math.abs(projected) >= distanceThreshold ||
      Math.abs(velocityRef.current) >= velocityThreshold;

    if (shouldSwipe) {
      performSwipe(projected >= 0 ? "like" : "dislike", velocityRef.current);
      dragStartX.current = null;
      lastMoveX.current = null;
      lastMoveTime.current = null;
      velocityRef.current = 0;
      return;
    }

    resetCardPosition();
  };

  const overlaySourceLabel = getSourceLabel(activeCard?.source);
  const actionsDisabled = !activeCard || isLoading || isError;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!activeCard || actionsDisabled || isDragging) return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        performSwipe("dislike");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        performSwipe("like");
      } else if (e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        performSwipe("skip");
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCard, actionsDisabled, isDragging]);

  const renderDeckIndicator = () => {
    if (!cards.length) return null;

    const maxDots = 8;
    const total = Math.min(cards.length, maxDots);

    const half = Math.floor(total / 2);
    let start = Math.max(0, currentIndex - half);
    if (start + total > cards.length) {
      start = Math.max(0, cards.length - total);
    }

    return (
      <div className="mb-3 flex justify-center">
        <div className="flex items-center gap-1.5">
          {Array.from({ length: total }).map((_, i) => {
            const cardIndex = start + i;
            const isActive = cardIndex === currentIndex;
            return (
              <span
                key={cardIndex}
                className={`h-1.5 rounded-md transition-all ${
                  isActive ? "w-4 bg-mn-primary" : "w-2 bg-mn-border-subtle/70"
                }`}
              />
            );
          })}
        </div>
      </div>
    );
  };

  const renderUndoToast = () => {
    if (!showUndo || !lastAction) return null;

    const label =
      lastAction.direction === "like"
        ? "Loved it"
        : lastAction.direction === "dislike"
        ? "Marked as ‘No thanks’"
        : "Saved for ‘Not now’";

    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 sm:static sm:mt-3 sm:px-0 sm:pointer-events-auto">
        <div className="pointer-events-auto inline-flex items-center gap-3 rounded-md border border-mn-border-subtle/80 bg-mn-bg/95 px-3 py-2 text-[12px] text-mn-text-primary shadow-mn-card backdrop-blur">
          <span>{label}</span>
          <button
            type="button"
            onClick={handleUndo}
            className="text-[11px] font-semibold uppercase tracking-[0.14em] text-mn-primary hover:text-mn-primary/80"
          >
            Undo
          </button>
        </div>
      </div>
    );
  };

  const renderSmartHintToast = () => {
    if (!smartHint) return null;
    return (
      <div className="pointer-events-none absolute inset-x-0 top-2 z-30 flex justify-center px-4 sm:px-0 transition-all duration-300 ease-out">
        <div className="pointer-events-auto inline-flex max-w-md items-start gap-2 rounded-md border border-mn-border-subtle/80 bg-mn-bg/95 px-3 py-2 text-[11px] text-mn-text-secondary shadow-mn-card backdrop-blur">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 text-mn-primary" />
          <span>{smartHint}</span>
        </div>
      </div>
    );
  };

  const shouldShowLongPressHint =
    !isDetailMode && !showOnboarding && currentIndex < 3 && !isLoading && !!activeCard;

  const posterRuntime = formatRuntime(activeCard?.runtimeMinutes);
  const metaLine = activeCard
    ? [
        activeCard.year ? String(activeCard.year) : null,
        activeCard.genres?.[0] ?? null,
        posterRuntime,
        typeof activeCard.imdbRating === "number" &&
        !Number.isNaN(activeCard.imdbRating) &&
        activeCard.imdbRating > 0
          ? `IMDb ${activeCard.imdbRating.toFixed(1)}`
          : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  const highlightLabel = (() => {
    if (!activeCard) return null;
    if (activeCard.friendLikesCount && activeCard.friendLikesCount >= 3) {
      return "Friends love this";
    }
    return null;
  })();

  // Hover parallax (desktop only)
  const handleMouseMoveOnCard = (e: React.MouseEvent<HTMLDivElement>) => {
    if (typeof window !== "undefined" && window.matchMedia) {
      if (window.matchMedia("(pointer: coarse)").matches) {
        return;
      }
    }

    if (isDragging) return;
    const node = cardRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width; // 0..1
    const relY = (e.clientY - rect.top) / rect.height; // 0..1
    hoverTiltRef.current = {
      x: (relX - 0.5) * 2, // -1..1
      y: (relY - 0.5) * 2, // -1..1
    };
    setCardTransform(dragDelta.current);
  };

  const handleMouseLeaveCard = () => {
    if (isDragging) return;
    hoverTiltRef.current = { x: 0, y: 0 };
    setCardTransform(dragDelta.current, { withTransition: true });
  };

  return (
    <div className="flex min-h-[calc(100vh-6rem)] flex-col">
      <TopBar title="Swipe" subtitle="Combined For You, friends, and trending picks" />

      <SwipeSyncBanner
        message={swipeSyncError}
        onRetry={retryFailedSwipe}
        isRetrying={isRetryingSwipe}
      />

      <div className="relative mt-2 flex flex-1 flex-col overflow-visible rounded-2xl border border-mn-border-subtle/60 bg-transparent p-3">
        {/* Blurred poster background */}
        {activeCard?.posterUrl && (
          <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-2xl">
            <img
              src={activeCard.posterUrl}
              alt={activeCard.title}
              className="h-full w-full scale-110 object-cover blur-xl brightness-[0.35]"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-mn-bg/40 via-mn-bg/70 to-mn-bg/90" />
          </div>
        )}

        {renderDeckIndicator()}

        <div
          className="relative flex flex-1 items-center justify-center overflow-visible [perspective:1400px]"
          aria-live="polite"
        >
          {isLoading && !activeCard && !isError && <LoadingSwipeCard />}

          {isError && !isLoading && (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-center text-sm text-mn-text-secondary">
              <Info className="h-8 w-8 text-amber-400" />
              <p>We couldn&apos;t load your swipe deck.</p>
              <button
                type="button"
                onClick={() => fetchMore(32)}
                className="mt-1 rounded-md border border-mn-border-subtle/70 px-3 py-1.5 text-[12px] font-semibold text-mn-text-primary hover:bg-mn-bg-elevated/70"
              >
                Retry
              </button>
            </div>
          )}

          {!isLoading && !isError && !activeCard && (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-center text-sm text-mn-text-secondary">
              <Sparkles className="h-8 w-8 text-mn-primary" />
              <p>All caught up. New cards will appear soon.</p>
              <button
                type="button"
                onClick={() => fetchMore(36)}
                className="mt-1 rounded-md border border-mn-border-subtle/70 px-3 py-1.5 text-[12px] font-semibold text-mn-text-primary hover:bg-mn-bg-elevated/70"
              >
                Refresh deck
              </button>
            </div>
          )}

          {!isLoading && activeCard && (
            <>
              {/* Intent glow behind card */}
              {dragIntent && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 -z-0"
                >
                  {dragIntent === "like" && (
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(16,185,129,0.22),transparent_60%)]" />
                  )}
                  {dragIntent === "dislike" && (
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(248,113,113,0.22),transparent_60%)]" />
                  )}
                </div>
              )}

              {/* Next-card preview with mild parallax */}
              {nextCard && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 mx-auto flex h-[72%] max-h-[480px] w-full max-w-md items-center justify-center rounded-2xl transition-all duration-300 ease-out"
                  style={{
                    transform: `${
                      isNextPreviewActive
                        ? "translateY(-40px) scale(0.9)"
                        : "translateY(-10px) scale(0.84)"
                    } translateX(${nextParallaxX}px)`,
                    opacity: isNextPreviewActive ? 1 : 0,
                  }}
                >
                  <div className="relative h-full w-full overflow-hidden rounded-2xl border border-mn-border-subtle/40 shadow-mn-card">
                    {showNextPoster && nextCard.posterUrl ? (
                      <>
                        <img
                          src={nextCard.posterUrl}
                          alt={buildSwipeCardLabel(nextCard) ?? nextCard.title}
                          className="h-full w-full object-cover blur-[7px] brightness-[0.8]"
                          loading="lazy"
                          draggable={false}
                          onError={() => setNextPosterFailed(true)}
                        />
                        <div className="absolute inset-0 bg-gradient-to-b from-mn-bg/0 via-mn-bg/30 to-mn-bg/90" />
                      </>
                    ) : (
                      <PosterFallback title={nextCard?.title} />
                    )}
                  </div>
                </div>
              )}

              {/* Active swipe card */}
              <article
                ref={cardRef}
                className={`relative z-10 mx-auto flex h-[72%] max-h-[480px] w-full max-w-md select-none flex-col overflow-hidden rounded-2xl bg-gradient-to-br from-mn-bg-elevated/95 via-mn-bg/95 to-mn-bg-elevated/90 shadow-[0_28px_80px_rgba(0,0,0,0.85)] backdrop-blur transform-gpu will-change-transform ${
                  isDetailMode ? "ring-1 ring-mn-primary/40" : "border border-white/5"
                }`}
                onPointerDown={(e) => {
                if (e.pointerType === "mouse" && e.button !== 0) return;

                const startedInDetail =
                  isDetailMode &&
                  detailContentRef.current &&
                  detailContentRef.current.contains(e.target as Node);

                dragStartedInDetailAreaRef.current = startedInDetail;
                handlePointerDown(e.clientX, e.pointerId);
              }}
                onPointerMove={(e) => handlePointerMove(e.clientX)}
                onPointerUp={finishDrag}
                onPointerCancel={finishDrag}
                onMouseMove={handleMouseMoveOnCard}
                onMouseLeave={handleMouseLeaveCard}
                aria-label={buildSwipeCardLabel(activeCard)}
                style={{ touchAction: "pan-y" }}
              >
                {/* Light leak + subtle grain overlay */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 mix-blend-screen opacity-[0.14]"
                >
                  <div className="absolute -top-20 left-0 right-0 h-40 bg-[radial-gradient(circle_at_10%_0%,rgba(255,255,255,0.18),transparent_60%),radial-gradient(circle_at_90%_0%,rgba(255,255,255,0.1),transparent_60%)]" />
                </div>

                {/* Poster / visual header */}
                <div
                  className={`relative overflow-hidden bg-gradient-to-br from-mn-bg/90 via-mn-bg/85 to-mn-bg/95 transition-all duration-300 ease-out ${
                    isDetailMode ? "h-[40%]" : "h-[58%]"
                  }`}
                >
                  {showActivePoster && activeCard.posterUrl ? (
                    <>
                      <img
                        src={activeCard.posterUrl}
                        alt={buildSwipeCardLabel(activeCard) ?? `${activeCard.title} poster`}
                        className="h-full w-full object-cover"
                        draggable={false}
                        loading="lazy"
                        onError={() => setActivePosterFailed(true)}
                        style={{
                          filter: isDetailMode ? "blur(4px) brightness(0.65)" : "none",
                          transform: isDetailMode ? "scale(1.12)" : "scale(1)",
                          transition:
                            "filter 260ms cubic-bezier(0.22,0.61,0.36,1), transform 260ms cubic-bezier(0.22,0.61,0.36,1)",
                        }}
                      />
                      {/* small foreground poster in detail mode - top-left */}
                      {isDetailMode && (
                        <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-3">
                          <div className="h-20 w-14 overflow-hidden rounded-xl border border-mn-border-subtle/80 bg-mn-bg shadow-[0_10px_30px_rgba(0,0,0,0.8)]">
                            <img
                              src={activeCard.posterUrl}
                              alt={activeCard.title}
                              className="h-full w-full object-cover"
                              draggable={false}
                            />
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <PosterFallback title={activeCard.title} />
                  )}

                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 via-black/40 to-mn-bg/95" />

                  {/* Swipe intent overlays */}
                  {dragIntent === "like" && (
                    <>
                      <div className="pointer-events-none absolute inset-x-8 bottom-3 flex justify-start">
                        <div className="flex items-center gap-2 rounded-md bg-emerald-500/14 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-200 shadow-mn-soft backdrop-blur-sm">
                          <ThumbsUp className="h-4 w-4 text-emerald-300" />
                          <span>Love it</span>
                        </div>
                      </div>
                      <div className="pointer-events-none absolute inset-y-8 right-2 w-1 rounded-full bg-gradient-to-b from-emerald-400/0 via-emerald-400/40 to-emerald-400/0" />
                    </>
                  )}
                  {dragIntent === "dislike" && (
                    <>
                      <div className="pointer-events-none absolute inset-x-8 bottom-3 flex justify-end">
                        <div className="flex items-center gap-2 rounded-md bg-rose-500/14 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-rose-200 shadow-mn-soft backdrop-blur-sm">
                          <ThumbsDown className="h-4 w-4 text-rose-300" />
                          <span>No thanks</span>
                        </div>
                      </div>
                      <div className="pointer-events-none absolute inset-y-8 left-2 w-1 rounded-full bg-gradient-to-b from-rose-400/0 via-rose-400/40 to-rose-400/0" />
                    </>
                  )}

                  {/* top status strip + index */}
                  <div className="absolute left-3 right-3 top-3 flex flex-wrap items-center justify-between gap-2 text-[10px]">
                    <span className="inline-flex items-center gap-1 rounded-md bg-mn-bg/80 px-2 py-1 text-[10px] font-semibold text-mn-text-primary shadow-mn-soft">
                      <span className="h-1.5 w-1.5 rounded-sm bg-mn-primary" />
                      {overlaySourceLabel}
                    </span>

                    <span className="inline-flex items-center gap-1 rounded-md bg-mn-bg/70 px-2 py-1 text-[10px] font-medium text-mn-text-secondary/85 shadow-mn-soft">
                      <Sparkles className="h-3 w-3 text-mn-primary/80" />
                      {currentIndex + 1} / {cards.length || 1}
                    </span>
                  </div>
                </div>

                {/* Content & detail mode */}
                <div className="flex flex-1 flex-col justify-between bg-gradient-to-b from-mn-bg/92 via-mn-bg/96 to-mn-bg px-4 pb-4 pt-3 backdrop-blur-md">
                  <div>
                    <div
                      className={`transition-opacity transition-transform duration-250 ${
                        isDetailMode ? "opacity-100 translate-y-0" : "opacity-100 translate-y-0"
                      }`}
                    >
                      <CardMetadata
                        card={activeCard}
                        metaLine={metaLine}
                        highlightLabel={!isDetailMode ? highlightLabel : null}
                      />
                    </div>

                    {/* Detail mode sections */}
                    {isDetailMode && (
                      <div className="mt-3 space-y-3 text-[11px] text-mn-text-secondary">
                        {/* Rating + diary actions */}
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-medium text-mn-text-primary/90">
                              Your rating
                            </span>
                            <div className="flex items-center gap-0.5">
                              {[1, 2, 3, 4, 5].map((star) => {
                                const currentRating = diaryEntry?.rating ?? null;
                                const isActive = typeof currentRating === "number" && currentRating >= star;
                                return (
                                  <button
                                    key={star}
                                    type="button"
                                    onClick={() => setDiaryRating(isActive ? star - 1 || null : star)}
                                    className={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-[11px] transition ${
                                      isActive
                                        ? "border-mn-primary/80 bg-mn-primary/90 text-black"
                                        : "border-mn-border-subtle/70 bg-mn-bg-elevated/60 text-mn-text-muted hover:border-mn-primary/70 hover:text-mn-primary/90"
                                    }`}
                                    aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
                                  >
                                    ★
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setDiaryStatus(statusIs("watchlist") ? null : "watchlist")
                              }
                              className={`inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-medium transition ${
                                statusIs("watchlist")
                                  ? "border-mn-primary/70 bg-mn-primary/90 text-black"
                                  : "border-mn-border-subtle bg-mn-bg text-mn-text-primary hover:border-mn-primary/60 hover:text-mn-primary"
                              }`}
                            >
                              Watchlist
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDiaryStatus(statusIs("watched") ? null : "watched")
                              }
                              className={`inline-flex items-center rounded-md border px-2.5 py-1 text-[11px] font-medium transition ${
                                statusIs("watched")
                                  ? "border-emerald-400/80 bg-emerald-500/90 text-black"
                                  : "border-mn-border-subtle bg-mn-bg text-mn-text-primary hover:border-emerald-400/80 hover:text-emerald-200"
                              }`}
                            >
                              Marked watched
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowSharePresetSheet(true)}
                              className="inline-flex items-center gap-1 rounded-md border border-mn-border-subtle/80 bg-mn-bg px-2.5 py-1.5 text-[11px] font-medium text-mn-text-primary hover:border-mn-primary/70 hover:text-mn-primary"
                            >
                              <Share2 className="h-3.5 w-3.5" />
                              Share
                            </button>
                          </div>
                        </div>

                        {/* Scores & basics */}
                        {(externalImdbRating || externalTomato || externalMetascore || detailGenres) && (
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-3 text-[10.5px] font-medium text-mn-text-primary/95">
                              {externalImdbRating && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-mn-bg-elevated/80 px-2 py-1 shadow-mn-soft">
                                  <span className="text-[10px] font-semibold text-mn-text-secondary/80">
                                    IMDb
                                  </span>
                                  <span>{externalImdbRating.toFixed(1)}</span>
                                </span>
                              )}
                              {externalTomato && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-mn-bg-elevated/80 px-2 py-1 shadow-mn-soft">
                                  <span className="text-[10px] font-semibold text-mn-text-secondary/80">
                                    RT
                                  </span>
                                  <span>{externalTomato}%</span>
                                </span>
                              )}
                              {externalMetascore && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-mn-bg-elevated/80 px-2 py-1 shadow-mn-soft">
                                  <span className="text-[10px] font-semibold text-mn-text-secondary/80">
                                    Metascore
                                  </span>
                                  <span>{externalMetascore}</span>
                                </span>
                              )}
                            </div>

                            {(detailGenres || detailRuntimeMinutes || detailPrimaryCountry) && (
                              <div className="text-[10.5px] text-mn-text-secondary/85">
                                <p>
                                  {[detailYear, normalizedContentTypeLabel, detailGenres]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </p>
                                {detailRuntimeMinutes && (
                                  <p className="mt-0.5">
                                    {Math.round(detailRuntimeMinutes)} min
                                    {detailPrimaryCountry ? ` · ${detailPrimaryCountry}` : ""}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Overview */}
                        {detailOverview && (
                          <div className="space-y-1">
                            <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-mn-text-secondary/70">
                              Overview
                            </p>
                            <p
                              className={`text-[11px] text-mn-text-secondary ${
                                showFullOverview ? "" : "line-clamp-3"
                              }`}
                            >
                              {detailOverview}
                            </p>
                            {detailOverview.length > 180 && (
                              <button
                                type="button"
                                onClick={() => setShowFullOverview((v) => !v)}
                                className="text-[10.5px] font-medium text-mn-primary hover:underline"
                              >
                                {showFullOverview ? "Show less" : "Read more"}
                              </button>
                            )}
                          </div>
                        )}

                        {/* People */}
                        {(detailDirector || detailActors) && (
                          <div className="space-y-1 text-[10.5px] text-mn-text-secondary/90">
                            <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-mn-text-secondary/70">
                              People
                            </p>
                            {detailDirector && (
                              <p>
                                <span className="font-semibold text-mn-text-primary">Director: </span>
                                {detailDirector}
                              </p>
                            )}
                            {detailActors && (
                              <p>
                                <span className="font-semibold text-mn-text-primary">Cast: </span>
                                {detailActors
                                  .split(",")
                                  .map((s) => s.trim())
                                  .filter(Boolean)
                                  .slice(0, 5)
                                  .join(", ")}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Social / friends row */}
                    <div className="mt-4 flex flex-wrap items-start gap-2 text-[11px] text-mn-text-secondary">
                      {typeof activeCard.friendLikesCount === "number" &&
                        activeCard.friendLikesCount > 0 && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-mn-text-secondary">
                            <Flame className="h-4 w-4 text-mn-primary/80" />
                            {activeCard.friendLikesCount === 1
                              ? "1 friend likes this"
                              : `${activeCard.friendLikesCount} friends like this`}
                          </span>
                        )}

                      {activeCard.topFriendName && activeCard.topFriendReviewSnippet && (
                        <button
                          type="button"
                          onClick={() => setShowFullFriendReview((v) => !v)}
                          className="inline-flex flex-1 items-start gap-2 rounded-2xl bg-mn-bg-elevated/80 px-3 py-2 text-left text-mn-text-primary shadow-mn-soft hover:bg-mn-bg-elevated"
                        >
                          <CheckCircle2 className="mt-0.5 h-4 w-4 text-mn-primary" />
                          <div
                            className={`overflow-hidden transition-all duration-200 ${
                              showFullFriendReview || isDetailMode ? "max-h-32" : "max-h-10"
                            }`}
                          >
                            <span
                              className={`block text-[11px] ${
                                showFullFriendReview || isDetailMode ? "" : "line-clamp-2"
                              }`}
                            >
                              {activeCard.topFriendName}: “{activeCard.topFriendReviewSnippet}”
                            </span>
                          </div>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </article>

              {showOnboarding && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-gradient-to-b from-mn-bg/70 via-mn-bg/50 to-mn-bg/80">
                  <div className="pointer-events-auto max-w-xs rounded-2xl border border-mn-border-subtle/70 bg-mn-bg/95 p-4 text-center shadow-mn-card">
                    <p className="text-sm font-semibold text-mn-text-primary">Swipe to decide</p>
                    <p className="mt-1 text-[12px] text-mn-text-secondary">
                      Swipe left to pass, right to save what you love.
                    </p>
                    <button
                      type="button"
                      className="mt-3 w-full rounded-xl bg-mn-primary px-3 py-2 text-sm font-semibold text-white shadow-mn-soft"
                      onClick={() => {
                        setShowOnboarding(false);
                        if (typeof window !== "undefined") {
                          localStorage.setItem(ONBOARDING_STORAGE_KEY, "1");
                        }
                      }}
                    >
                      Got it
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {renderSmartHintToast()}
        </div>

        {/* Bottom actions */}
        <div className="mt-3 grid grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => performSwipe("dislike")}
            disabled={actionsDisabled}
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-mn-border-subtle/70 bg-mn-bg px-3 py-3 text-sm font-semibold text-rose-400 shadow-mn-soft disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg active:translate-y-[1px] active:scale-[0.99] active:shadow-none transition-all duration-150"
            aria-label="No thanks"
          >
            <ThumbsDown className="h-5 w-5" />
            <span className="hidden sm:inline">No thanks</span>
          </button>
          <button
            type="button"
            onClick={() => performSwipe("skip")}
            disabled={actionsDisabled}
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-mn-border-subtle/70 bg-mn-bg px-3 py-3 text-sm font-semibold text-mn-text-secondary shadow-mn-soft disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-border-subtle focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg active:translate-y-[1px] active:scale-[0.99] active:shadow-none transition-all duration-150"
            aria-label="Not now"
          >
            <SkipForward className="h-5 w-5" />
            <span className="hidden sm:inline">Not now</span>
          </button>
          <button
            type="button"
            onClick={() => performSwipe("like")}
            disabled={actionsDisabled}
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-transparent bg-mn-primary/95 px-3 py-3 text-sm font-semibold text-mn-bg shadow-mn-soft disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg active:translate-y-[1px] active:scale-[0.99] active:shadow-none transition-all duration-150"
            aria-label="Love it"
          >
            <ThumbsUp className="h-5 w-5" />
            <span className="hidden sm:inline">Love it</span>
          </button>
        </div>

        {renderUndoToast()}
      </div>
    </div>
  );
};

export default SwipePage;
