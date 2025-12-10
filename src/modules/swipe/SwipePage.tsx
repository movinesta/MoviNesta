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
  Star,
} from "lucide-react";
import TopBar from "../../components/shared/TopBar";
import { useQuery } from "@tanstack/react-query";
import { qk } from "../../lib/queryKeys";
import { useAuth } from "../auth/AuthProvider";
import {
  useDiaryLibraryMutations,
  useTitleDiaryEntry,
  type DiaryStatus,
} from "../diary/useDiaryLibrary";
import { useConversations } from "../messages/useConversations";
import { useSendMessage } from "../messages/ConversationPage";
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

/** Treat "N/A", empty and null as non-existent to save space */
const cleanText = (value?: string | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.toUpperCase() === "N/A") return null;
  return trimmed;
};

const formatRuntime = (minutes?: number | null): string | null => {
  if (!minutes || minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
};

const abbreviateCountry = (value?: string | null): string | null => {
  const cleaned = cleanText(value);
  if (!cleaned) return null;
  const lower = cleaned.toLowerCase();

  if (lower === "united states" || lower === "united states of america") return "US";
  if (lower === "united kingdom" || lower === "great britain") return "UK";
  if (lower === "canada") return "CA";
  if (lower === "australia") return "AU";
  if (lower === "germany") return "DE";
  if (lower === "france") return "FR";
  if (lower === "spain") return "ES";
  if (lower === "italy") return "IT";
  if (lower === "japan") return "JP";
  if (lower === "south korea" || lower === "republic of korea") return "KR";
  if (cleaned.length <= 3) return cleaned.toUpperCase();
  return cleaned;
};

const safeNumber = (
  value?: number | string | null,
): number | null => {
  if (value == null) return null;
  if (typeof value === "number") {
    if (Number.isNaN(value)) return null;
    return value;
  }
  const parsed = parseFloat(value);
  if (Number.isNaN(parsed)) return null;
  return parsed;
};

const formatInt = (value?: number | string | null): string | null => {
  const num = safeNumber(value);
  if (num == null) return null;
  return Math.round(num).toLocaleString();
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
    <div className="space-y-2 text-left leading-relaxed" aria-label="Swipe card summary">
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

const LoadingSwipeCard: React.FC = () => (
  <article className="relative z-10 mx-auto flex h-[72%] max-h-[480px] w-full max-w-md select-none flex-col overflow-hidden rounded-2xl bg-gradient-to-br from-mn-bg-elevated/95 via-mn-bg/95 to-mn-bg-elevated/90 shadow-[0_24px_70px_rgba(0,0,0,0.8)] backdrop-blur">
    <div className="relative h-[58%] overflow-hidden bg-gradient-to-br from-mn-bg/90 via-mn-bg/85 to-mn-bg/95">
      <div className="h-full w-full bg-gradient-to-br from-mn-border-subtle/40 via-mn-border-subtle/20 to-mn-border-subtle/50" />
      <div className="absolute inset-0 animate-pulse bg-gradient-to-b from-black/25 via-black/10 to-mn-bg/85" />
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

interface TitleDetailRow {
  title_id: string;
  content_type: string | null;

  plot: string | null;
  tmdb_overview: string | null;
  tagline: string | null;

  omdb_director: string | null;
  omdb_writer: string | null;
  omdb_actors: string | null;

  genres: string[] | null;
  tmdb_genre_names: string[] | null;
  language: string | null;
  omdb_language: string | null;
  tmdb_original_language: string | null;
  country: string | null;
  omdb_country: string | null;

  imdb_rating: number | string | null;
  imdb_votes: number | string | null;
  metascore: number | string | null;
  rt_tomato_pct: number | string | null;

  poster_url: string | null;
  tmdb_poster_path: string | null;
  backdrop_url: string | null;

  omdb_awards: string | null;
  omdb_box_office_str: string | null;
  omdb_box_office: number | string | null;
  omdb_released: string | null;

  tmdb_vote_average: number | string | null;
  tmdb_vote_count: number | string | null;
  tmdb_popularity: number | string | null;

  tmdb_episode_run_time: number | number[] | null;
}

const WATCHLIST_STATUS = "want_to_watch" as DiaryStatus;
const WATCHED_STATUS = "watched" as DiaryStatus;

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
  const [isFullDetailOpen, setIsFullDetailOpen] = useState(false);
  const [showFullFriendReview, setShowFullFriendReview] = useState(false);

  const [lastAction, setLastAction] = useState<{
    card: SwipeCardData;
    direction: SwipeDirection;
  } | null>(null);
  const [showUndo, setShowUndo] = useState(false);
  const undoTimeoutRef = useRef<number | null>(null);

  const [smartHint, setSmartHint] = useState<string | null>(null);
  const smartHintTimeoutRef = useRef<number | null>(null);
  const [sessionSwipeCount, setSessionSwipeCount] = useState(0);
  const [longSkipStreak, setLongSkipStreak] = useState(0);

  const detailContentRef = useRef<HTMLDivElement | null>(null);
  const dragStartedInDetailAreaRef = useRef(false);

  const [showSharePresetSheet, setShowSharePresetSheet] = useState(false); // kept for future use
  const [isShareSheetOpen, setIsShareSheetOpen] = useState(false);

  const activeCard = cards[currentIndex];
  const nextCard = cards[currentIndex + 1];

  const activeTitleId = activeCard?.id ?? null;

  const { user } = useAuth();
  const { updateStatus, updateRating } = useDiaryLibraryMutations();
  const { data: diaryEntryData } = useTitleDiaryEntry(activeTitleId);
  const diaryEntry = diaryEntryData ?? { status: null, rating: null };

  const [localRating, setLocalRating] = useState<number | null>(null);

  const longPressTimeoutRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);

  const audioContextRef = useRef<AudioContext | null>(null);
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

  // title detail query
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
          omdb_writer,
          omdb_actors,
          genres,
          tmdb_genre_names,
          language,
          omdb_language,
          tmdb_original_language,
          country,
          omdb_country,
          imdb_rating,
          imdb_votes,
          metascore,
          rt_tomato_pct,
          poster_url,
          tmdb_poster_path,
          backdrop_url,
          omdb_awards,
          omdb_box_office_str,
          omdb_box_office,
          omdb_released,
          tmdb_vote_average,
          tmdb_vote_count,
          tmdb_popularity,
          tmdb_episode_run_time
        `,
        )
        .eq("title_id", activeTitleId)
        .maybeSingle();

      if (error) throw error;
      return data as TitleDetailRow | null;
    },
  });

  // clean + merged fields (hide "N/A")
  const detailOverview =
    cleanText(titleDetail?.plot) ??
    cleanText(titleDetail?.tmdb_overview) ??
    cleanText(activeCard?.overview) ??
    null;

  const detailGenres =
    titleDetail?.tmdb_genre_names ??
    titleDetail?.genres ??
    activeCard?.genres ??
    null;

  const primaryLanguageRaw =
    titleDetail?.language ??
    titleDetail?.omdb_language ??
    titleDetail?.tmdb_original_language ??
    activeCard?.language ??
    null;
  const detailPrimaryLanguage = cleanText(primaryLanguageRaw);

  const primaryCountryRaw =
    titleDetail?.country ??
    titleDetail?.omdb_country ??
    activeCard?.country ??
    null;
  const detailPrimaryCountry = cleanText(primaryCountryRaw);
  const detailPrimaryCountryAbbr = abbreviateCountry(detailPrimaryCountry);

  const detailDirector = cleanText(titleDetail?.omdb_director);
  const detailWriter = cleanText(titleDetail?.omdb_writer);
  const detailActors = cleanText(titleDetail?.omdb_actors);

  const externalImdbRating = titleDetail?.imdb_rating ?? activeCard?.imdbRating ?? null;
  const externalTomato = titleDetail?.rt_tomato_pct ?? activeCard?.rtTomatoMeter ?? null;
  const externalMetascore = titleDetail?.metascore ?? null;

  const imdbVotes = titleDetail?.imdb_votes ?? null;
  const tmdbVoteAverage = titleDetail?.tmdb_vote_average ?? null;
  const tmdbVoteCount = titleDetail?.tmdb_vote_count ?? null;
  const tmdbPopularity = titleDetail?.tmdb_popularity ?? null;

  const detailAwards = cleanText(titleDetail?.omdb_awards);
  const detailBoxOffice = cleanText(titleDetail?.omdb_box_office_str);
  const detailReleased = cleanText(titleDetail?.omdb_released);

  const normalizedContentType: TitleType | null =
    titleDetail?.content_type === "movie" || titleDetail?.content_type === "series"
      ? titleDetail.content_type
      : activeCard?.type ?? null;

  const activeCardAny = activeCard as any;
  const rawCertification: string | null =
    (activeCardAny?.certification as string | undefined) ??
    (activeCardAny?.rated as string | undefined) ??
    (titleDetail?.omdb_rated as string | undefined) ??
    null;
  const detailCertification = cleanText(rawCertification);

  // extra derived for full details
  const allGenresArray: string[] =
    (Array.isArray(detailGenres)
      ? (detailGenres as string[])
      : detailGenres
      ? String(detailGenres).split(",").map((g) => g.trim())
      : []) ?? [];
  const moreGenres =
    allGenresArray.length > 3 ? allGenresArray.slice(3).filter(Boolean) : [];

  const allLanguagesRaw: (string | null)[] = [
    titleDetail?.language ?? null,
    titleDetail?.omdb_language ?? null,
    titleDetail?.tmdb_original_language ?? null,
    activeCard?.language ?? null,
  ];
  const languages = Array.from(
    new Set(
      allLanguagesRaw
        .map((l) => cleanText(l))
        .filter((l): l is string => !!l),
    ),
  );

  let episodeRuntimeMinutes: number | null = null;
  if (Array.isArray(titleDetail?.tmdb_episode_run_time)) {
    if (titleDetail.tmdb_episode_run_time.length > 0) {
      episodeRuntimeMinutes = safeNumber(titleDetail.tmdb_episode_run_time[0]) ?? null;
    }
  } else if (titleDetail?.tmdb_episode_run_time != null) {
    episodeRuntimeMinutes = safeNumber(titleDetail.tmdb_episode_run_time);
  }

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

  const serverRating = diaryEntry?.rating ?? null;
  const currentUserRating = localRating ?? serverRating;

  useEffect(() => {
    // Reset local rating when the active title or server rating changes
    setLocalRating(null);
  }, [activeTitleId, serverRating]);

  const handleStarClick = (value: number) => {
    const next = currentUserRating === value ? null : value;
    setLocalRating(next);
    setDiaryRating(next);
  };

  const getShareUrl = () =>
    typeof window !== "undefined"
      ? `${window.location.origin}/title/${activeCard?.id ?? ""}`
      : `/title/${activeCard?.id ?? ""}`;

  const shareUrl = getShareUrl();

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
      // user cancelled / blocked
    }
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

  // onboarding
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hasSeen = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    setShowOnboarding(!hasSeen);
  }, []);

  // reset on card change
  useEffect(() => {
    setActivePosterFailed(false);
    setShowFullFriendReview(false);
    setIsDetailMode(false);
    setIsFullDetailOpen(false);
    setShowSharePresetSheet(false);
  }, [activeCard?.id]);

  useEffect(() => {
    setNextPosterFailed(false);
  }, [nextCard?.id]);

  // preload next posters
  useEffect(() => {
    if (typeof window === "undefined") return;

    const idle =
      (window as any).requestIdleCallback ??
      ((cb: () => void) => window.setTimeout(cb, 180));

    idle(() => {
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

  // cleanup
  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (longPressTimeoutRef.current != null) window.clearTimeout(longPressTimeoutRef.current);
      if (undoTimeoutRef.current != null) window.clearTimeout(undoTimeoutRef.current);
      if (smartHintTimeoutRef.current != null) window.clearTimeout(smartHintTimeoutRef.current);
      if (audioContextRef.current) audioContextRef.current.close().catch(() => {});
    },
    [],
  );

  // next card preview timing
  useEffect(() => {
    if (!nextCard) return;
    setIsNextPreviewActive(false);
    const timeout = window.setTimeout(() => setIsNextPreviewActive(true), 16);
    return () => window.clearTimeout(timeout);
  }, [nextCard?.id]);

  // fetch more when low
  useEffect(() => {
    const remaining = cards.length - currentIndex;
    if (remaining < 3) fetchMore(Math.max(24, remaining + 12));
  }, [cards.length, currentIndex, fetchMore]);

  // trim consumed
  useEffect(() => {
    if (currentIndex <= 10) return;
    const drop = Math.min(Math.max(currentIndex - 6, 0), cards.length);
    if (drop > 0) {
      trimConsumed(drop);
      setCurrentIndex((idx) => Math.max(4, idx - drop));
    }
  }, [cards.length, currentIndex, trimConsumed]);

  const setCardTransform = (x: number, withTransition = false) => {
    const node = cardRef.current;
    if (!node) return;

    const finalX = clamp(x, -MAX_DRAG, MAX_DRAG);

    const rotateZ = clamp(finalX / ROTATION_FACTOR, -12, 12);
    const dragRotateY = clamp(finalX / 26, -10, 10);
    const baseScale = 1.02;
    const extraScale = Math.min(Math.abs(finalX) / 900, 0.04);
    const scale = baseScale + extraScale;

    const hover = hoverTiltRef.current;
    const hoverRotateX = hover.y * -4;
    const hoverRotateYExtra = hover.x * 5;
    const hoverTranslateY = hover.y * -4;

    node.style.transition = withTransition
      ? "transform 260ms cubic-bezier(0.22,0.61,0.36,1)"
      : "none";

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
    setCardTransform(0, true);
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

    if (undoTimeoutRef.current != null) window.clearTimeout(undoTimeoutRef.current);
    undoTimeoutRef.current = window.setTimeout(() => setShowUndo(false), 2800);
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
      if (previousCard && previousCard.id === lastAction.card.id) return candidate;
      return prev;
    });

    clearUndo();
  };

  const setSmartHintWithTimeout = (hint: string | null) => {
    setSmartHint(hint);
    if (smartHintTimeoutRef.current != null) window.clearTimeout(smartHintTimeoutRef.current);
    if (hint) {
      smartHintTimeoutRef.current = window.setTimeout(() => setSmartHint(null), 3200);
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
      if (externalImdbRating != null && safeNumber(externalImdbRating) != null && safeNumber(externalImdbRating)! >= 7.5) {
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

    if (direction === "dislike" && (activeCard.runtimeMinutes ?? 0) > 130) {
      setLongSkipStreak((s) => s + 1);
    } else {
      setLongSkipStreak(0);
    }

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
          node.style.transform =
            "perspective(1400px) translateX(0px) translateY(24px) scale(0.95)";
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

  const handlePointerDown = (x: number, pointerId: number, target: EventTarget | null) => {
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

    if (longPressTimeoutRef.current != null) window.clearTimeout(longPressTimeoutRef.current);
    longPressTriggeredRef.current = false;

    longPressTimeoutRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      setIsDragging(false);
      resetCardPosition();
      safeVibrate(20);
      setIsDetailMode((prev) => !prev);
      setIsFullDetailOpen(false);
    }, 550);

    const startedInDetail =
      isDetailMode &&
      detailContentRef.current &&
      detailContentRef.current.contains(target as Node);
    dragStartedInDetailAreaRef.current = startedInDetail;

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

    setCardTransform(dx);
    setNextParallaxX(-dx * 0.06);

    let nextIntent: "like" | "dislike" | null = null;
    if (dx > DRAG_INTENT_THRESHOLD) nextIntent = "like";
    else if (dx < -DRAG_INTENT_THRESHOLD) nextIntent = "dislike";
    setDragIntent(nextIntent);

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

  // keyboard
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
  }, [activeCard, actionsDisabled, isDragging]);

  const renderDeckIndicator = () => {
    if (!cards.length) return null;

    const maxDots = 8;
    const total = Math.min(cards.length, maxDots);

    const half = Math.floor(total / 2);
    let start = Math.max(0, currentIndex - half);
    if (start + total > cards.length) start = Math.max(0, cards.length - total);

    return (
      <div className="mb-3 flex justify-center" aria-hidden="true">
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
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 sm:px-0">
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
      <div className="pointer-events-none absolute inset-x-0 top-2 z-30 flex justify-center px-4 sm:px-0">
        <div className="pointer-events-auto inline-flex max-w-md items-start gap-2 rounded-md border border-mn-border-subtle/80 bg-mn-bg/95 px-3 py-2 text-[11px] text-mn-text-secondary shadow-mn-card backdrop-blur">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 text-mn-primary" />
          <span>{smartHint}</span>
        </div>
      </div>
    );
  };

  const primaryImdbForMeta =
    typeof activeCard?.imdbRating === "number" && !Number.isNaN(activeCard.imdbRating)
      ? activeCard.imdbRating
      : typeof titleDetail?.imdb_rating === "number" && !Number.isNaN(titleDetail.imdb_rating as number)
      ? (titleDetail.imdb_rating as number)
      : safeNumber(titleDetail?.imdb_rating);

  const primaryRtForMeta =
    typeof activeCard?.rtTomatoMeter === "number" && !Number.isNaN(activeCard.rtTomatoMeter)
      ? activeCard.rtTomatoMeter
      : typeof titleDetail?.rt_tomato_pct === "number" && !Number.isNaN(titleDetail.rt_tomato_pct as number)
      ? (titleDetail.rt_tomato_pct as number)
      : safeNumber(titleDetail?.rt_tomato_pct);

  const metaLine = activeCard
    ? (() => {
        const parts: string[] = [];
        if (activeCard.year) parts.push(String(activeCard.year));

        const typeLabel =
          (normalizedContentType ?? activeCard.type) === "series" ? "Series" : "Movie";
        if (typeLabel) parts.push(typeLabel);

        if (primaryImdbForMeta != null) {
          parts.push(`IMDb ${primaryImdbForMeta.toFixed(1)}`);
        }
        if (primaryRtForMeta != null) {
          parts.push(`RT ${primaryRtForMeta}%`);
        }
        if (typeof activeCard.runtimeMinutes === "number" && activeCard.runtimeMinutes > 0) {
          parts.push(`${activeCard.runtimeMinutes} min`);
        }
        return parts.join(" · ");
      })()
    : "";

  const highlightLabel = (() => {
    if (!activeCard) return null;
    if (activeCard.friendLikesCount && activeCard.friendLikesCount >= 3) {
      return "Friends love this";
    }
    return null;
  })();

  const handleMouseMoveOnCard = (e: React.MouseEvent<HTMLDivElement>) => {
    if (typeof window !== "undefined" && window.matchMedia) {
      if (window.matchMedia("(pointer: coarse)").matches) return;
    }
    if (isDragging) return;
    const node = cardRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const relY = (e.clientY - rect.top) / rect.height;
    hoverTiltRef.current = {
      x: (relX - 0.5) * 2,
      y: (relY - 0.5) * 2,
    };
    setCardTransform(dragDelta.current);
  };

  const handleMouseLeaveCard = () => {
    if (isDragging) return;
    hoverTiltRef.current = { x: 0, y: 0 };
    setCardTransform(dragDelta.current, true);
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
        {/* blurred background */}
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
              {/* intent glow */}
              {dragIntent && (
                <div className="pointer-events-none absolute inset-0 -z-0">
                  {dragIntent === "like" && (
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(16,185,129,0.22),transparent_60%)]" />
                  )}
                  {dragIntent === "dislike" && (
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(248,113,113,0.22),transparent_60%)]" />
                  )}
                </div>
              )}

              {/* next preview */}
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

              {/* active card */}
              <article
                ref={cardRef}
                role="group"
                aria-roledescription="Movie card"
                aria-label={buildSwipeCardLabel(activeCard)}
                className={`relative z-10 mx-auto flex h-[72%] max-h-[480px] w-full max-w-md select-none flex-col overflow-hidden rounded-2xl bg-gradient-to-br from-mn-bg-elevated/95 via-mn-bg/95 to-mn-bg-elevated/90 shadow-[0_28px_80px_rgba(0,0,0,0.85)] backdrop-blur transform-gpu will-change-transform ${
                  isDetailMode ? "ring-1 ring-mn-primary/40" : "border border-white/5"
                }`}
                onPointerDown={(e) => {
                  if (e.pointerType === "mouse" && e.button !== 0) return;
                  handlePointerDown(e.clientX, e.pointerId, e.target);
                }}
                onPointerMove={(e) => handlePointerMove(e.clientX)}
                onPointerUp={finishDrag}
                onPointerCancel={finishDrag}
                onMouseMove={handleMouseMoveOnCard}
                onMouseLeave={handleMouseLeaveCard}
                style={{ touchAction: "pan-y" }}
              >
                {/* light leak */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 mix-blend-screen opacity-[0.14]"
                >
                  <div className="absolute -top-20 left-0 right-0 h-40 bg-[radial-gradient(circle_at_10%_0%,rgba(255,255,255,0.18),transparent_60%),radial-gradient(circle_at_90%_0%,rgba(255,255,255,0.1),transparent_60%)]" />
                </div>

                {/* header / poster */}
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
                            "filter 260ms cubic-bezier(0.22,0.61,0.36,1), transform 260ms cubic-bezier(0.22,0.61,1)",
                        }}
                      />
                      {/* adaptive mini-poster in detail mode (more responsive) */}
                      {isDetailMode && (
                        <div
                          className="pointer-events-none absolute left-3 flex items-start"
                          style={{ top: "3.4rem" }}
                        >
                          <div
                            className="overflow-hidden rounded-2xl border border-mn-border-subtle/80 bg-mn-bg shadow-[0_14px_40px_rgba(0,0,0,0.85)]"
                            style={{
                              height: "clamp(120px, 22vh, 220px)",
                              aspectRatio: "2 / 3",
                            }}
                          >
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

                  {/* swipe overlays */}
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

                  {/* badges top */}
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

                {/* bottom content: swipe vs detail vs full details (same footprint, no scroll) */}
                <div className="relative flex flex-1 flex-col bg-gradient-to-b from-mn-bg/92 via-mn-bg/96 to-mn-bg px-4 pb-4 pt-3 backdrop-blur-md">
                  {/* SWIPE MODE: compact */}
                  {!isDetailMode && (
                    <>
                      <CardMetadata
                        card={activeCard}
                        metaLine={metaLine}
                        highlightLabel={highlightLabel}
                      />

                      {/* friends info under swipe card */}
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
                                showFullFriendReview ? "max-h-32" : "max-h-10"
                              }`}
                            >
                              <span
                                className={`block text-[11px] ${
                                  showFullFriendReview ? "" : "line-clamp-2"
                                }`}
                              >
                                {activeCard.topFriendName}: “
                                {activeCard.topFriendReviewSnippet}”
                              </span>
                            </div>
                          </button>
                        )}
                      </div>
                    </>
                  )}

                  {/* DETAIL / FULL DETAIL MODES (same container, no scroll) */}
                  {isDetailMode && activeCard && (
                    <div
                      ref={detailContentRef}
                      id="swipe-detail-panel"
                      aria-label={isFullDetailOpen ? "Full details" : "Details summary"}
                      aria-live="polite"
                      className="mt-2 flex flex-1 flex-col text-left text-[11px] text-mn-text-secondary"
                    >
                      <div className="flex-1 overflow-hidden pr-1">
                        {!isFullDetailOpen ? (
                          // SUMMARY DETAIL: old + new info, clipped to card
                          <div className="space-y-3">
                            {/* Title & compact badges */}
                            <div className="space-y-1.5">
                              <h3 className="line-clamp-2 text-base font-semibold text-mn-text-primary sm:text-lg">
                                {activeCard.title}
                              </h3>
                              {/* old info (same meta line as swipe) */}
                              {metaLine && (
                                <p className="text-[11px] text-mn-text-secondary/90">
                                  {metaLine}
                                </p>
                              )}
                              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-mn-text-secondary/90">
                                {detailGenres && (
                                  <span className="inline-flex items-center gap-1">
                                    <span className="font-medium text-mn-text-primary/90">
                                      Genres
                                    </span>
                                    <span className="truncate max-w-[180px]">
                                      {Array.isArray(detailGenres)
                                        ? (detailGenres as string[]).slice(0, 3).join(", ")
                                        : String(detailGenres)
                                            .split(",")
                                            .map((g) => g.trim())
                                            .slice(0, 3)
                                            .join(", ")}
                                    </span>
                                  </span>
                                )}
                                {detailCertification && (
                                  <span className="rounded-full bg-mn-bg-elevated/80 px-2 py-0.5 text-[10px] font-medium text-mn-text-primary/90">
                                    {detailCertification}
                                  </span>
                                )}
                                {detailPrimaryCountryAbbr && (
                                  <span className="rounded-full bg-mn-bg-elevated/80 px-2 py-0.5 text-[10px] text-mn-text-secondary/90">
                                    {detailPrimaryCountryAbbr}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Overview (3 lines, with small heading) */}
                            {detailOverview && (
                              <div className="space-y-0.5">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-mn-text-secondary/70">
                                  Overview
                                </p>
                                <p className="line-clamp-3 text-[11px] leading-relaxed text-mn-text-secondary/90">
                                  {detailOverview}
                                </p>
                              </div>
                            )}

                            {/* Director / cast (first 3 actors) */}
                            {(detailDirector || detailActors) && (
                              <div className="space-y-1.5 text-[10.5px]">
                                {detailDirector && (
                                  <p>
                                    <span className="font-medium text-mn-text-primary/90">
                                      Director:
                                    </span>{" "}
                                    <span>{detailDirector}</span>
                                  </p>
                                )}
                                {detailActors && (
                                  <p>
                                    <span className="font-medium text-mn-text-primary/90">
                                      Cast:
                                    </span>{" "}
                                    <span>
                                      {detailActors
                                        .split(",")
                                        .map((a) => a.trim())
                                        .filter(Boolean)
                                        .slice(0, 3)
                                        .join(", ")}
                                    </span>
                                  </p>
                                )}
                              </div>
                            )}

                            {/* Your rating + quick actions */}
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              <div className="inline-flex items-center gap-1 rounded-full bg-mn-bg-elevated/80 px-2.5 py-1">
                                <span className="text-[10px] text-mn-text-secondary/80">
                                  Your rating
                                </span>
                                <div className="flex items-center gap-0.5" aria-label="Your rating">
                                  {Array.from({ length: 5 }).map((_, idx) => {
                                    const value = idx + 1;
                                    const filled =
                                      currentUserRating != null && currentUserRating >= value;
                                    return (
                                      <button
                                        key={value}
                                        type="button"
                                        onClick={() => handleStarClick(value)}
                                        className="flex h-5 w-5 items-center justify-center rounded-full hover:scale-105 focus-visible:outline-none"
                                      >
                                        <Star
                                          className={`h-3.5 w-3.5 ${
                                            filled
                                              ? "fill-yellow-400 text-yellow-400"
                                              : "text-mn-border-subtle"
                                          }`}
                                        />
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              <div className="ml-auto flex flex-wrap items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setDiaryStatus(WATCHLIST_STATUS)}
                                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors ${
                                    statusIs(WATCHLIST_STATUS)
                                      ? "bg-mn-primary/90 text-mn-bg"
                                      : "border border-mn-border-subtle/70 bg-mn-bg-elevated/80 text-mn-text-secondary hover:border-mn-primary/70 hover:text-mn-primary"
                                  }`}
                                >
                                  Watchlist
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDiaryStatus(WATCHED_STATUS)}
                                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors ${
                                    statusIs(WATCHED_STATUS)
                                      ? "bg-emerald-500/90 text-mn-bg"
                                      : "border border-mn-border-subtle/70 bg-mn-bg-elevated/80 text-mn-text-secondary hover:border-emerald-400/80 hover:text-emerald-300"
                                  }`}
                                >
                                  Watched
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setIsShareSheetOpen(true)}
                                  className="inline-flex items-center gap-1 rounded-full border border-mn-border-subtle/70 bg-mn-bg-elevated/80 px-2.5 py-1 text-[10px] font-medium text-mn-text-secondary hover:border-mn-primary/70 hover:text-mn-primary"
                                >
                                  <Share2 className="h-3.5 w-3.5" />
                                  <span className="hidden sm:inline">Share</span>
                                </button>
                              </div>
                            </div>

                            {/* Friends info block (same data as swipe, but in summary layout) */}
                            {(typeof activeCard.friendLikesCount === "number" &&
                              activeCard.friendLikesCount > 0) ||
                            (activeCard.topFriendName &&
                              activeCard.topFriendReviewSnippet) ? (
                              <div className="space-y-1.5 rounded-2xl bg-mn-bg-elevated/80 px-3 py-2 text-[11px] text-mn-text-primary shadow-mn-soft">
                                {typeof activeCard.friendLikesCount === "number" &&
                                  activeCard.friendLikesCount > 0 && (
                                    <div className="inline-flex items-center gap-1 text-[11px] text-mn-text-secondary">
                                      <Flame className="h-4 w-4 text-mn-primary/80" />
                                      {activeCard.friendLikesCount === 1
                                        ? "1 friend likes this"
                                        : `${activeCard.friendLikesCount} friends like this`}
                                    </div>
                                  )}
                                {activeCard.topFriendName &&
                                  activeCard.topFriendReviewSnippet && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setShowFullFriendReview((v) => !v)
                                      }
                                      className="mt-1 inline-flex w-full items-start gap-2 text-left"
                                    >
                                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-mn-primary" />
                                      <div
                                        className={`overflow-hidden transition-all duration-200 ${
                                          showFullFriendReview ? "max-h-32" : "max-h-10"
                                        }`}
                                      >
                                        <span
                                          className={`block text-[11px] ${
                                            showFullFriendReview ? "" : "line-clamp-2"
                                          }`}
                                        >
                                          {activeCard.topFriendName}: “
                                          {activeCard.topFriendReviewSnippet}”
                                        </span>
                                      </div>
                                    </button>
                                  )}
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          // FULL DETAILS: only new info (beyond summary), small sections first
                          <div className="h-full space-y-3 text-[11px] leading-relaxed text-mn-text-secondary/90">
                            {/* INFO: more genres, languages, episode runtime */}
                            {(moreGenres.length > 0 ||
                              languages.length > 0 ||
                              episodeRuntimeMinutes) && (
                              <section aria-label="Detailed info">
                                <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-mn-text-secondary/80">
                                  Info
                                </h3>
                                <div className="mt-1 grid gap-1.5 rounded-2xl bg-mn-bg/60 px-3 py-2 text-[10.5px]">
                                  {moreGenres.length > 0 && (
                                    <p>
                                      <span className="font-medium text-mn-text-primary/90">
                                        More genres:
                                      </span>{" "}
                                      <span>{moreGenres.join(", ")}</span>
                                    </p>
                                  )}
                                  {languages.length > 0 && (
                                    <p>
                                      <span className="font-medium text-mn-text-primary/90">
                                        Languages:
                                      </span>{" "}
                                      <span>{languages.join(", ")}</span>
                                    </p>
                                  )}
                                  {episodeRuntimeMinutes &&
                                    normalizedContentType === "series" && (
                                      <p>
                                        <span className="font-medium text-mn-text-primary/90">
                                          Episode runtime:
                                        </span>{" "}
                                        <span>
                                          {formatRuntime(episodeRuntimeMinutes)}
                                        </span>
                                      </p>
                                    )}
                                </div>
                              </section>
                            )}

                            {/* RATINGS: only extra stats (no raw IMDb/RT scores) */}
                            {(imdbVotes ||
                              externalMetascore ||
                              tmdbVoteAverage ||
                              tmdbVoteCount ||
                              tmdbPopularity) && (
                              <section aria-label="Ratings breakdown" className="mt-1">
                                <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-mn-text-secondary/80">
                                  Ratings
                                </h3>
                                <div className="mt-1 grid gap-1.5">
                                  {imdbVotes && formatInt(imdbVotes) && (
                                    <div className="flex items-center justify-between">
                                      <span className="text-mn-text-secondary/90">
                                        IMDb votes
                                      </span>
                                      <span className="font-medium text-mn-text-primary/90">
                                        {formatInt(imdbVotes)}
                                      </span>
                                    </div>
                                  )}
                                  {externalMetascore &&
                                    safeNumber(externalMetascore) != null && (
                                      <div className="flex items-center justify-between">
                                        <span className="text-mn-text-secondary/90">
                                          Metascore
                                        </span>
                                        <span className="font-medium text-mn-text-primary/90">
                                          {safeNumber(externalMetascore)}
                                        </span>
                                      </div>
                                    )}
                                  {tmdbVoteAverage &&
                                    safeNumber(tmdbVoteAverage) != null && (
                                      <div className="flex items-center justify-between">
                                        <span className="text-mn-text-secondary/90">
                                          TMDB score
                                        </span>
                                        <span className="font-medium text-mn-text-primary/90">
                                          {safeNumber(tmdbVoteAverage)?.toFixed(1)}
                                        </span>
                                      </div>
                                    )}
                                  {tmdbVoteCount && formatInt(tmdbVoteCount) && (
                                    <div className="flex items-center justify-between">
                                      <span className="text-mn-text-secondary/90">
                                        TMDB votes
                                      </span>
                                      <span className="font-medium text-mn-text-primary/90">
                                        {formatInt(tmdbVoteCount)}
                                      </span>
                                    </div>
                                  )}
                                  {tmdbPopularity &&
                                    safeNumber(tmdbPopularity) != null && (
                                      <div className="flex items-center justify-between">
                                        <span className="text-mn-text-secondary/90">
                                          TMDB popularity
                                        </span>
                                        <span className="font-medium text-mn-text-primary/90">
                                          {safeNumber(tmdbPopularity)?.toFixed(1)}
                                        </span>
                                      </div>
                                    )}
                                </div>
                              </section>
                            )}

                            {/* CREDITS: writers + more cast (beyond first 3) */}
                            {detailActors || detailWriter ? (
                              <section aria-label="Credits" className="mt-1">
                                <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-mn-text-secondary/80">
                                  Credits
                                </h3>
                                <div className="mt-1 space-y-1.5 text-[11px]">
                                  {detailWriter && (
                                    <p>
                                      <span className="font-medium text-mn-text-primary/90">
                                        Writers:
                                      </span>{" "}
                                      <span>{detailWriter}</span>
                                    </p>
                                  )}
                                  {detailActors && (() => {
                                    const allNames = detailActors
                                      .split(",")
                                      .map((a) => a.trim())
                                      .filter(Boolean);
                                    const extra = allNames.slice(3);
                                    if (!extra.length) return null;
                                    return (
                                      <p>
                                        <span className="font-medium text-mn-text-primary/90">
                                          More cast:
                                        </span>{" "}
                                        <span>{extra.join(", ")}</span>
                                      </p>
                                    );
                                  })()}
                                </div>
                              </section>
                            ) : null}

                            {/* RELEASE & PRODUCTION: release date, awards, box office */}
                            {(detailReleased || detailAwards || detailBoxOffice) && (
                              <section aria-label="Release and production" className="mt-1">
                                <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-mn-text-secondary/80">
                                  Release &amp; production
                                </h3>
                                <div className="mt-1 space-y-1.5 text-[11px]">
                                  {detailReleased && (
                                    <p>
                                      <span className="font-medium text-mn-text-primary/90">
                                        Released:
                                      </span>{" "}
                                      <span>{detailReleased}</span>
                                    </p>
                                  )}
                                  {detailAwards && (
                                    <p>
                                      <span className="font-medium text-mn-text-primary/90">
                                        Awards:
                                      </span>{" "}
                                      <span>{detailAwards}</span>
                                    </p>
                                  )}
                                  {detailBoxOffice && (
                                    <p>
                                      <span className="font-medium text-mn-text-primary/90">
                                        Box office:
                                      </span>{" "}
                                      <span>{detailBoxOffice}</span>
                                    </p>
                                  )}
                                </div>
                              </section>
                            )}

                            {/* NOTE: no story/overview here, to keep full-details only "new" compact data */}
                          </div>
                        )}
                      </div>

                      {/* toggle button row – same location & shape for both states */}
                      <div className="mt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => setIsFullDetailOpen((val) => !val)}
                          aria-expanded={isFullDetailOpen}
                          aria-controls="swipe-detail-panel"
                          className="inline-flex items-center gap-1 rounded-full border border-mn-border-subtle/70 px-2.5 py-1 text-[10px] font-medium text-mn-text-primary hover:border-mn-primary/70 hover:text-mn-primary"
                        >
                          <span>{isFullDetailOpen ? "Collapse" : "Full details"}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </article>

              {showOnboarding && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-gradient-to-b from-mn-bg/70 via-mn-bg/50 to-mn-bg/80">
                  <div className="pointer-events-auto max-w-xs rounded-2xl border border-mn-border-subtle/70 bg-mn-bg/95 p-4 text-center shadow-mn-card">
                    <p className="text-sm font-semibold text-mn-text-primary">
                      Swipe to decide
                    </p>
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

        {/* bottom actions */}
        <div className="mt-3 grid grid-cols-3 gap-3" aria-label="Swipe actions">
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

        <SwipeShareSheet
          isOpen={isShareSheetOpen}
          onClose={() => setIsShareSheetOpen(false)}
          activeCard={activeCard}
          shareUrl={shareUrl}
          onShareExternal={handleShareExternal}
        />

        {renderUndoToast()}
      </div>
    </div>
  );
};


interface SwipeShareSheetProps {
  isOpen: boolean;
  onClose: () => void;
  activeCard: SwipeCardData | undefined;
  shareUrl: string;
  onShareExternal: () => Promise<void>;
}

const SwipeShareSheet: React.FC<SwipeShareSheetProps> = ({
  isOpen,
  onClose,
  activeCard,
  shareUrl,
  onShareExternal,
}) => {
  const { user } = useAuth();
  const { data: conversations = [], isLoading } = useConversations();

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen || !activeCard) return null;

  const text = `Check this out: ${activeCard.title}\n\n${shareUrl}`;

  const handleBackdropClick: React.MouseEventHandler<HTMLDivElement> = (event) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        alert("Link copied to clipboard");
      } else {
        alert(shareUrl);
      }
    } catch {
      alert(shareUrl);
    }
  };

  const handleExternalShareClick = async () => {
    await onShareExternal();
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex flex-col justify-end bg-black/55"
      onClick={handleBackdropClick}
    >
      <div className="pointer-events-auto w-full max-w-md self-center rounded-t-2xl bg-mn-bg-elevated pb-3 pt-2 shadow-[0_-18px_45px_rgba(0,0,0,0.65)]">
        <div className="flex items-center justify-between px-4 pb-2">
          <span className="text-[13px] font-semibold text-mn-text-primary">
            Share
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-mn-text-secondary hover:bg-mn-bg/80"
          >
            <span className="text-[18px] leading-none">&times;</span>
          </button>
        </div>

        <section className="border-t border-mn-border-subtle/80 px-4 pt-3 pb-2">
          <h2 className="mb-2 text-[12px] font-medium uppercase tracking-[0.08em] text-mn-text-secondary/90">
            Send to
          </h2>
          {isLoading ? (
            <div className="flex gap-3 overflow-hidden">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="flex flex-col items-center gap-1">
                  <div className="h-11 w-11 animate-pulse rounded-full bg-mn-border-subtle/50" />
                  <div className="h-2.5 w-12 animate-pulse rounded bg-mn-border-subtle/40" />
                </div>
              ))}
            </div>
          ) : !user ? (
            <p className="text-[12px] text-mn-text-secondary/80">
              Sign in to share via messages.
            </p>
          ) : conversations.length === 0 ? (
            <p className="text-[12px] text-mn-text-secondary/80">
              No conversations yet. Start a chat from a profile or the Messages tab.
            </p>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-1 pt-0.5">
              {conversations.map((conversation) => (
                <ShareRecipientChip
                  key={conversation.id}
                  conversation={conversation}
                  text={text}
                />
              ))}
            </div>
          )}
        </section>

        <section className="border-t border-mn-border-subtle/80 px-4 pt-3 pb-1.5">
          <h2 className="mb-2 text-[12px] font-medium uppercase tracking-[0.08em] text-mn-text-secondary/90">
            Share via
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1 rounded-full border border-mn-border-subtle/80 bg-mn-bg px-2.5 py-1 text-[11px] font-medium text-mn-text-secondary hover:border-mn-primary/70 hover:text-mn-primary"
            >
              Copy link
            </button>
            <button
              type="button"
              onClick={handleExternalShareClick}
              className="inline-flex items-center gap-1 rounded-full border border-mn-border-subtle/80 bg-mn-bg px-2.5 py-1 text-[11px] font-medium text-mn-text-secondary hover:border-mn-primary/70 hover:text-mn-primary"
            >
              Share outside MoviNesta
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

interface ShareRecipientChipProps {
  conversation: any;
  text: string;
}

const ShareRecipientChip: React.FC<ShareRecipientChipProps> = ({ conversation, text }) => {
  const primaryOther = conversation.isGroup
    ? null
    : conversation.participants?.find((p: any) => !p.isSelf) ??
      conversation.participants?.[0];

  const displayName = primaryOther?.displayName ?? conversation.title ?? "Conversation";
  const avatarUrl = primaryOther?.avatarUrl;

  const sendMessage = useSendMessage(conversation.id);

  const handleClick = () => {
    if (sendMessage.isPending) return;
    sendMessage.mutate({ text });
  };

  const initials = displayName
    .split(" ")
    .map((part: string) => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex w-[72px] flex-col items-center gap-1 text-center"
    >
      <div className="relative">
        <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-mn-bg-subtle text-[10px] text-mn-text-secondary">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="h-full w-full object-cover"
            />
          ) : (
            <span>{initials}</span>
          )}
        </div>
        {sendMessage.isSuccess && (
          <div className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500">
            <CheckCircle2 className="h-3 w-3 text-mn-bg" />
          </div>
        )}
      </div>
      <span className="line-clamp-2 max-w-[72px] text-[10px] text-mn-text-primary">
        {displayName}
      </span>
    </button>
  );
};


export default SwipePage;
