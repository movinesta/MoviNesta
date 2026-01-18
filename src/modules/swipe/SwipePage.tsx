import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MaterialIcon } from "@/components/ui/material-icon";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "../../lib/queryKeys";
import { useAuth } from "../auth/AuthProvider";
import { useTitleDiaryEntry } from "../diary/useDiaryLibrary";
import { useConversations } from "../messages/useConversations";
import { useSendMessage } from "../messages/ConversationPage";
import { supabase } from "../../lib/supabase";
import type { SwipeCardData, SwipeDirection } from "./useSwipeDeck";
import { buildAppUrl } from "@/lib/appUrl";
import { safeLocalStorageGetItem, safeLocalStorageSetItem } from "@/lib/storage";
import {
  clamp,
  cleanText,
  formatRuntime,
  abbreviateCountry,
  safeNumber,
  formatInt,
  buildSwipeCardLabel,
} from "./swipeCardMeta";
import { useMediaSwipeDeck } from "./useMediaSwipeDeck";
import SwipeSyncBanner from "./SwipeSyncBanner";
import { SwipeDebugPanel } from "./SwipeDebugPanel";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { TitleType } from "@/types/supabase-helpers";
import { PosterFallback } from "./SwipeCardComponents";
import FriendAvatarStack from "./FriendAvatarStack";
import FriendsListModal from "./FriendsListModal";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const ONBOARDING_STORAGE_KEY = "mn_swipe_onboarding_seen";
const SWIPE_SFX_STORAGE_KEY = "mn_swipe_sfx_enabled";
const SWIPE_HAPTICS_STORAGE_KEY = "mn_swipe_haptics_enabled";

// Swipe feel presets
// "floaty_gamey" = cinematic drag (slight mass) + satisfying, gamey commits.
type SwipeFeelPreset = {
  id: "classic" | "floaty_gamey";
  distanceWidthFactor: number;
  distanceMin: number;
  distanceMax: number;
  intentFactor: number;
  intentMin: number;
  intentMax: number;
  velocityThreshold: number; // px/ms
  velocityProjectionMs: number; // ms of follow-through for commit projection
  dragFollowAlpha: number; // 0..1 lerp amount per frame (higher = snappier)
  rotationFactor: number; // bigger = less rotation
  rotateZCap: number;
  rotateYCap: number;
  rotateXCap: number;
  undercardTranslateY: number;
  undercardBlurMax: number;
  punchScale: number;
  punchDurationMs: number;
  burstBaseCount: number;
  burstDurationMs: number;
};

const SWIPE_FEEL_PRESETS: Record<SwipeFeelPreset["id"], SwipeFeelPreset> = {
  classic: {
    id: "classic",
    distanceWidthFactor: 0.18,
    distanceMin: 72,
    distanceMax: 120,
    intentFactor: 0.36,
    intentMin: 28,
    intentMax: 44,
    velocityThreshold: 0.32,
    velocityProjectionMs: 180,
    dragFollowAlpha: 1.0, // no smoothing
    rotationFactor: 10,
    rotateZCap: 22,
    rotateYCap: 18,
    rotateXCap: 8,
    undercardTranslateY: 6,
    undercardBlurMax: 0,
    punchScale: 1.01,
    punchDurationMs: 120,
    burstBaseCount: 10,
    burstDurationMs: 480,
  },
  floaty_gamey: {
    id: "floaty_gamey",
    distanceWidthFactor: 0.22,
    distanceMin: 86,
    distanceMax: 140,
    intentFactor: 0.35,
    intentMin: 30,
    intentMax: 52,
    velocityThreshold: 0.55,
    velocityProjectionMs: 220,
    dragFollowAlpha: 0.22,
    rotationFactor: 15,
    rotateZCap: 18,
    rotateYCap: 14,
    rotateXCap: 7,
    undercardTranslateY: 8,
    undercardBlurMax: 1.4,
    punchScale: 1.015,
    punchDurationMs: 140,
    burstBaseCount: 12,
    burstDurationMs: 520,
  },
};

// Change this to "classic" if you want the old feel.
const SWIPE_FEEL: SwipeFeelPreset = SWIPE_FEEL_PRESETS.floaty_gamey;

const SWIPE_DISTANCE_THRESHOLD_FALLBACK = 88;

// Prefer measuring the actual card width for consistent feel across layouts.
// deviceScale lets us nudge thresholds for coarse pointers (touch) without hardcoding screen sizes.
const getSwipeDistanceThreshold = (cardWidth?: number, deviceScale = 1) => {
  const w =
    typeof cardWidth === "number" && Number.isFinite(cardWidth) && cardWidth > 0
      ? cardWidth
      : typeof window !== "undefined"
        ? window.innerWidth
        : SWIPE_DISTANCE_THRESHOLD_FALLBACK;
  return clamp(
    w * SWIPE_FEEL.distanceWidthFactor * deviceScale,
    SWIPE_FEEL.distanceMin,
    SWIPE_FEEL.distanceMax,
  );
};

const getDragIntentThreshold = (cardWidth?: number, deviceScale = 1) =>
  clamp(
    Math.round(getSwipeDistanceThreshold(cardWidth, deviceScale) * SWIPE_FEEL.intentFactor),
    SWIPE_FEEL.intentMin,
    SWIPE_FEEL.intentMax,
  );

const applyRubberBand = (x: number, max: number) => {
  const ax = Math.abs(x);
  if (ax <= max) return x;
  const extra = ax - max;
  // A gentle iOS-like rubber-band
  return Math.sign(x) * (max + extra * 0.18);
};

// Gesture tuning
const DRAG_START_SLOP = 8; // px before we commit to a swipe gesture
const DIRECTION_LOCK_RATIO = 1.25; // prefer vertical if |dy| > |dx| * ratio (tap/scroll protection)

// Premium feel
const LANE_DOMINANCE_RATIO = 1.6; // once horizontal dominates, damp the minor axis for a clean lane
const LANE_MINOR_DAMP_MIN = 0.25; // 0..1 multiplier for minor axis when fully lane-locked
const SOFT_SETTLE_DELAY_MS = 120; // ms of stillness before a gentle lane settle
const SOFT_SETTLE_MAX_PUSH = 14; // px of extra magnetic pull into the lane
const HAPTIC_COOLDOWN_MS = 70;

const SWIPE_VELOCITY_THRESHOLD = SWIPE_FEEL.velocityThreshold; // px per ms
const MAX_DRAG = 220;
const EXIT_MIN = 360;
// Slightly more "Tinder-like" rotation (stronger tilt at the same drag distance)
const ROTATION_FACTOR = SWIPE_FEEL.rotationFactor;
const FEEDBACK_ENABLED = true;

const MN_SWIPE_BURST_CSS = `
@keyframes mn-swipe-burst {
  0% { transform: translate3d(0px,0px,0px) rotate(0deg) scale(1); opacity: 0.95; }
  100% { transform: translate3d(var(--dx, 0px), var(--dy, 0px), 0px) rotate(var(--rot, 0deg)) scale(var(--s, 1)); opacity: 0; }
}
.mn-swipe-burst-dot {
  position: absolute;
  left: var(--x, 0px);
  top: var(--y, 0px);
  width: var(--sz, 8px);
  height: var(--sz, 8px);
  border-radius: 9999px;
  filter: blur(0px);
  will-change: transform, opacity;
  animation: mn-swipe-burst var(--dur, 520ms) cubic-bezier(0.18, 0.78, 0.22, 1) forwards;
}
.mn-swipe-burst-dot[data-shape="square"] { border-radius: 6px; }
@media (prefers-reduced-motion: reduce) {
  .mn-swipe-burst-dot { animation: none !important; opacity: 0 !important; }
}
`;

const SWIPE_LAYOUT_VARS = {
  // Visual scale tokens (used via Tailwind arbitrary values in className)
  // We scale from BOTH viewport width and height, because Swipe is constrained by vertical real-estate.
  // min(vw, vh) keeps the layout balanced on short screens and tablets.
  "--mn-swipe-radius": "clamp(26px, min(6vw, 4.2vh), 44px)",
  "--mn-swipe-pad": "clamp(12px, min(4.6vw, 3.2vh), 24px)",

  "--mn-swipe-kicker": "clamp(10px, min(2.5vw, 1.45vh), 12px)",
  "--mn-swipe-header": "clamp(1.05rem, min(4.2vw, 2.6vh), 1.35rem)",
  "--mn-swipe-top-hit": "clamp(2.25rem, min(9vw, 5.2vh), 2.9rem)",
  "--mn-swipe-top-icon": "clamp(22px, min(5.6vw, 3.2vh), 30px)",

  "--mn-swipe-title": "clamp(1.6rem, min(6.6vw, 4.4vh), 2.6rem)",
  "--mn-swipe-subtitle": "clamp(0.92rem, min(3.6vw, 2.2vh), 1.15rem)",
  "--mn-swipe-meta": "clamp(0.88rem, min(3.2vw, 2.0vh), 1.08rem)",
  "--mn-swipe-chip": "clamp(0.72rem, min(2.9vw, 1.75vh), 0.9rem)",

  "--mn-swipe-hit": "clamp(2.25rem, min(9vw, 5.5vh), 2.85rem)", // ~36px → 46px
  "--mn-swipe-gap": "clamp(1.35rem, min(6.2vw, 3.7vh), 2.5rem)",
  "--mn-swipe-action": "clamp(3.1rem, min(12.5vw, 7.0vh), 4.1rem)",
  "--mn-swipe-action-primary": "clamp(4.4rem, min(17.5vw, 9.2vh), 6.1rem)",
  "--mn-swipe-icon": "clamp(22px, min(5.5vw, 3.4vh), 30px)",
  "--mn-swipe-icon-primary": "clamp(32px, min(8.5vw, 4.8vh), 46px)",

  "--mn-swipe-star-hit": "clamp(18px, min(5vw, 2.8vh), 24px)",
  "--mn-swipe-star-icon": "clamp(14px, min(3.8vw, 2.1vh), 19px)",
} as React.CSSProperties;

// Swipe Brain v2 uses media_items + media_feedback (no titles/diary tables)
type DiaryStatus = "want_to_watch" | "watched";

const percentToNumber = (value: unknown): number | null => {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const cleaned = raw.replace(/%/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

const starsToRating0_10 = (stars: number | null): number | null => {
  if (stars == null) return null;
  const s = Math.round(stars);
  if (s <= 0) return null;
  return Math.min(10, Math.max(2, s * 2));
};

const adaptMediaSwipeCard = (card: any): SwipeCardData => {
  const source = (() => {
    const raw = String(card?.source ?? "").trim();
    if (!raw) return null;

    const normalized = raw.replace("-", "_");

    if (normalized === "for_you" || normalized === "for-you") return "for-you";
    if (normalized === "friends" || normalized === "from_friends" || normalized === "from-friends")
      return "from-friends";
    if (normalized === "trending") return "trending";
    if (normalized === "popular") return "popular";
    if (normalized === "combined") return "combined";
    if (normalized === "explore") return "explore";
    return null;
  })();

  const kind = card?.kind === "series" ? "series" : card?.kind === "anime" ? "anime" : "movie";

  const releaseYear =
    typeof card?.releaseYear === "number"
      ? card.releaseYear
      : card?.releaseYear != null
        ? Number(card.releaseYear)
        : null;

  const runtimeMinutes =
    typeof card?.runtimeMinutes === "number"
      ? card.runtimeMinutes
      : card?.runtimeMinutes != null
        ? Number(card.runtimeMinutes)
        : null;

  return {
    id: String(card?.id ?? ""),
    title: String(card?.title ?? "Untitled"),
    deckId: card?.deckId ?? null,
    position:
      typeof card?.position === "number"
        ? card.position
        : card?.position != null
          ? Number(card.position)
          : null,
    year: Number.isFinite(releaseYear as any) ? releaseYear : null,
    type: kind,
    runtimeMinutes: Number.isFinite(runtimeMinutes as any) ? runtimeMinutes : null,
    tagline: card?.tagline ?? null,
    mood: card?.mood ?? null,
    vibeTag: card?.vibeTag ?? null,
    posterUrl: card?.posterUrl ?? null,
    tmdbPosterPath: card?.tmdbPosterPath ?? null,
    tmdbBackdropPath: card?.tmdbBackdropPath ?? null,
    source,
    why: card?.why ?? null,
    friendIds: Array.isArray(card?.friendIds) ? card.friendIds : null,
    friendProfiles: Array.isArray(card?.friendProfiles) ? card.friendProfiles : null,
    friendLikesCount:
      typeof card?.friendLikesCount === "number"
        ? card.friendLikesCount
        : Array.isArray(card?.friendProfiles)
          ? card.friendProfiles.length
          : Array.isArray(card?.friendIds)
            ? card.friendIds.length
            : null,
    topFriendName:
      Array.isArray(card?.friendProfiles) && card.friendProfiles[0]
        ? String(card.friendProfiles[0].display_name ?? card.friendProfiles[0].username ?? "")
        : (card?.topFriendName ?? null),
    topFriendInitials: card?.topFriendInitials ?? null,
    topFriendReviewSnippet: card?.topFriendReviewSnippet ?? null,
    overview: card?.overview ?? null,
    genres: Array.isArray(card?.genres) ? card.genres : null,
    language: card?.language ?? null,
    country: card?.country ?? null,
    initialRating:
      typeof card?.initialRating === "number"
        ? card.initialRating
        : card?.initialRating != null
          ? Number(card.initialRating)
          : null,
    initiallyInWatchlist: Boolean(card?.initiallyInWatchlist),
    imdbRating:
      typeof card?.imdbRating === "number"
        ? card.imdbRating
        : card?.imdbRating != null
          ? Number(card.imdbRating)
          : null,
    rtTomatoMeter:
      typeof card?.rtTomatoMeter === "number"
        ? card.rtTomatoMeter
        : card?.rtTomatoMeter != null
          ? Number(card.rtTomatoMeter)
          : null,
  };
};

function computeMatchPercent(input: {
  card: SwipeCardData | null;
  friendCount: number;
  imdb: number | null;
  rt: number | null;
}): number {
  const { card, friendCount, imdb, rt } = input;

  // Heuristic (not a true personalization score): blends source, social proof and ratings.
  let score = 74;
  const source = card?.source ?? null;

  if (source === "for-you") score += 10;
  if (source === "from-friends") score += 7;
  if (source === "trending") score += 4;
  if (source === "popular") score += 2;

  const likes = typeof card?.friendLikesCount === "number" ? card.friendLikesCount : 0;
  if (likes > 0) {
    const socialBoost =
      friendCount > 0 ? (likes / Math.max(1, friendCount)) * 18 : Math.min(12, likes * 3);
    score += socialBoost;
  }

  if (imdb != null) score += (imdb - 7) * 4;
  if (rt != null) score += (rt - 70) * 0.15;

  // Minor bump if we have an explicit "why".
  if (card?.why) score += 3;

  const rounded = Math.round(score);
  return Math.round(clamp(rounded, 55, 99));
}

interface TitleDetailRow {
  title_id: string;
  content_type: string | null;

  plot: string | null;

  omdb_director: string | null;
  omdb_writer: string | null;
  omdb_actors: string | null;

  genres: string[] | null;
  omdb_language: string | null;
  omdb_country: string | null;

  imdb_rating: number | string | null;
  imdb_votes: number | string | null;
  metascore: number | string | null;
  rt_tomato_pct: number | string | null;

  poster_url: string | null;

  omdb_awards: string | null;
  omdb_box_office_str: string | null;
  omdb_box_office: number | string | null;
  omdb_released: string | null;
  omdb_rated: string | null;
  omdb_runtime: string | null;
  omdb_fetched_at: string | null;
  omdb_status: string | null;
  omdb_error: string | null;
}

const fetchTitleDetailRow = async (titleId: string): Promise<TitleDetailRow | null> => {
  const { data, error } = await supabase
    .from("media_items")
    .select(
      "id, kind, omdb_plot, omdb_director, omdb_writer, omdb_actors, omdb_genre, omdb_language, omdb_country, omdb_imdb_rating, omdb_imdb_votes, omdb_metascore, omdb_rating_rotten_tomatoes, omdb_poster, omdb_awards, omdb_box_office, omdb_released, omdb_rated, omdb_runtime, omdb_fetched_at, omdb_status, omdb_error",
    )
    .eq("id", titleId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) return null;

  const genres =
    (data as any).omdb_genre != null
      ? String((data as any).omdb_genre)
          .split(",")
          .map((g: string) => g.trim())
          .filter(Boolean)
      : null;

  const rt = percentToNumber((data as any).omdb_rating_rotten_tomatoes);

  return {
    title_id: (data as any).id,
    content_type: (data as any).kind ?? null,
    plot: (data as any).omdb_plot ?? null,
    omdb_director: (data as any).omdb_director ?? null,
    omdb_writer: (data as any).omdb_writer ?? null,
    omdb_actors: (data as any).omdb_actors ?? null,
    genres,
    omdb_language: (data as any).omdb_language ?? null,
    omdb_country: (data as any).omdb_country ?? null,
    imdb_rating: (data as any).omdb_imdb_rating ?? null,
    imdb_votes: (data as any).omdb_imdb_votes ?? null,
    metascore: (data as any).omdb_metascore ?? null,
    rt_tomato_pct: rt,
    poster_url: (data as any).omdb_poster ?? null,
    omdb_awards: (data as any).omdb_awards ?? null,
    omdb_box_office_str: (data as any).omdb_box_office ?? null,
    omdb_box_office: null,
    omdb_released: (data as any).omdb_released ?? null,
    omdb_rated: (data as any).omdb_rated ?? null,
    omdb_runtime: (data as any).omdb_runtime ?? null,
    omdb_fetched_at: (data as any).omdb_fetched_at ?? null,
    omdb_status: (data as any).omdb_status ?? null,
    omdb_error: (data as any).omdb_error ?? null,
  };
};

const WATCHLIST_STATUS = "want_to_watch" as DiaryStatus;
const WATCHED_STATUS = "watched" as DiaryStatus;

const SwipePage: React.FC = () => {
  const navigate = useNavigate();

  // Filters (opened via the tune icon in the header)
  const [kindFilter, setKindFilter] = useState<"movie" | "series" | "anime" | null>(null);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [genreFilter, setGenreFilter] = useState<string[]>([]);
  const [minImdbRatingFilter, setMinImdbRatingFilter] = useState<number>(0);

  // Responsive tuning (no scroll): adapt clamp counts to available height so content always fits.
  const [viewport, setViewport] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  useEffect(() => {
    if (typeof window === "undefined") return;
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setViewport({ w: window.innerWidth, h: window.innerHeight });
      });
    };
    update();
    window.addEventListener("resize", update, { passive: true });
    window.addEventListener("orientationchange", update, { passive: true } as any);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", update as any);
      window.removeEventListener("orientationchange", update as any);
    };
  }, []);

  const detailOverviewClampLines = useMemo(() => {
    const h = viewport.h || 844;
    if (h < 640) return 4;
    if (h < 720) return 5;
    if (h < 820) return 6;
    if (h < 920) return 7;
    return 8;
  }, [viewport.h]);

  const fullOverviewClampLines = useMemo(() => {
    // Full details gets a bit more room than summary, but still must never overflow.
    return clamp(detailOverviewClampLines + 2, 6, 10);
  }, [detailOverviewClampLines]);

  const {
    cards: rawCards,
    sessionId,
    isLoading,
    isError,
    swipe,
    fetchMore,
    trimConsumed,
    swipeSyncError,
    retryFailedSwipe,
    isRetryingSwipe,
    trackImpression,
    trackDwell,
    sendEventAsync,
  } = useMediaSwipeDeck("combined", {
    limit: 72,
    kindFilter,
    minImdbRating: minImdbRatingFilter > 0 ? minImdbRatingFilter : null,
    genresAny: genreFilter.length ? genreFilter : null,
  });

  const cards = useMemo(() => rawCards.map(adaptMediaSwipeCard), [rawCards]);

  const availableGenres = useMemo(() => {
    const set = new Set<string>();
    for (const card of cards) {
      const gs = (card?.genres ?? []) as any[];
      for (const g of gs) {
        const s = String(g ?? "").trim();
        if (s) set.add(s);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [cards]);

  const matchesLocalFilters = React.useCallback(
    (card: SwipeCardData | null | undefined) => {
      if (!card) return false;

      if (genreFilter.length) {
        const cardGenres = Array.isArray(card.genres) ? card.genres : [];
        const lower = new Set(cardGenres.map((g) => String(g).toLowerCase()));
        const ok = genreFilter.some((g) => lower.has(String(g).toLowerCase()));
        if (!ok) return false;
      }

      if (minImdbRatingFilter > 0) {
        const imdb =
          typeof card.imdbRating === "number" && !Number.isNaN(card.imdbRating)
            ? card.imdbRating
            : null;
        // If rating is unknown, let it pass (avoid filtering out too aggressively).
        if (imdb != null && imdb < minImdbRatingFilter) return false;
      }

      return true;
    },
    [genreFilter, minImdbRatingFilter],
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const activeCardRaw = rawCards[currentIndex];

  const activeCard = cards[currentIndex];

  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  const [showOnboarding, setShowOnboarding] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    const hasSeen = safeLocalStorageGetItem(ONBOARDING_STORAGE_KEY);
    return !hasSeen;
  });
  const [failedPosterIds, setFailedPosterIds] = useState<string[]>([]);
  const updatePosterFailure = (id: string | undefined, failed: boolean) => {
    if (!id) return;

    setFailedPosterIds((ids) => {
      const alreadyFailed = ids.includes(id);

      if (failed) {
        return alreadyFailed ? ids : [...ids, id];
      }

      return alreadyFailed ? ids.filter((existingId) => existingId !== id) : ids;
    });
  };

  const setActivePosterFailed = (failed: boolean) => updatePosterFailure(activeCard?.id, failed);

  const activePosterFailed = !!activeCard?.id && failedPosterIds.includes(activeCard.id);

  const nextCard = cards[currentIndex + 1] ?? null;
  const nextPosterFailed = !!nextCard?.id && failedPosterIds.includes(nextCard.id);
  const showNextPoster = Boolean(nextCard?.posterUrl && !nextPosterFailed);

  // Preload the next poster so the deck never flashes on fast swipes.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = nextCard?.posterUrl;
    if (!url) return;
    const img = new Image();
    (img as any).decoding = "async";
    img.src = url;
  }, [nextCard?.posterUrl]);

  const [isFriendsModalOpen, setIsFriendsModalOpen] = useState(false);

  const [isDetailMode, setIsDetailMode] = useState(false);
  const [isFullDetailOpen, setIsFullDetailOpen] = useState(false);

  const [lastAction, setLastAction] = useState<{
    card: SwipeCardData;
    direction: SwipeDirection;
  } | null>(null);
  const [showUndo, setShowUndo] = useState(false);
  const undoTimeoutRef = useRef<number | null>(null);

  // Prevent accidental duplicate swipe events (especially when using Back).
  const swipeActionKeysRef = useRef<Set<string>>(new Set());

  const [smartHint, setSmartHint] = useState<string | null>(null);
  const smartHintTimeoutRef = useRef<number | null>(null);
  const [, setSessionSwipeCount] = useState(0);
  const [longSkipStreak, setLongSkipStreak] = useState(0);

  const detailContentRef = useRef<HTMLDivElement | null>(null);
  const dragStartedInDetailAreaRef = useRef(false);

  const [isShareSheetOpen, setIsShareSheetOpen] = useState(false);

  const activeTitleId = activeCard?.id ?? null;
  const nextTitleId = nextCard?.id ?? null;

  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (typeof window === "undefined" || cards.length === 0) return;

    const idle = (window as typeof window & { requestIdleCallback?: typeof requestIdleCallback })
      .requestIdleCallback;

    const runPrefetch = () => {
      const PREFETCH_AHEAD = 8;
      const start = Math.min(Math.max(currentIndex + 1, 0), cards.length);
      const end = Math.min(cards.length, start + PREFETCH_AHEAD);
      const slice = cards.slice(start, end);

      const tasks = slice.map((card) => {
        if (!card.id) return null;
        const key = qk.titleDetail(card.id);
        if (queryClient.getQueryData(key)) return null;
        return queryClient.prefetchQuery({
          queryKey: key,
          queryFn: () => fetchTitleDetailRow(card.id),
          staleTime: 1000 * 60 * 30,
          gcTime: 1000 * 60 * 60,
        });
      });

      void Promise.allSettled(tasks.filter(Boolean) as any);
    };

    if (idle) {
      const handle = idle(runPrefetch);
      return () => {
        if (typeof window !== "undefined" && "cancelIdleCallback" in window) {
          (
            window as typeof window & { cancelIdleCallback?: (id: number) => void }
          ).cancelIdleCallback?.(handle);
        }
      };
    }

    const timeout = window.setTimeout(runPrefetch, 280);
    return () => window.clearTimeout(timeout);
  }, [cards, currentIndex, queryClient]);

  // Lightweight director lookup for the *next* card preview so it can render the same
  // "Directed by" line as the active card. (The full title-detail query is scoped to
  // the active card and is used heavily in detail mode.)
  const { data: nextPreviewDetail } = useQuery<{
    omdb_director: string | null;
    omdb_genre: string | null;
    omdb_rating_rotten_tomatoes: string | null;
    omdb_imdb_rating: string | number | null;
  } | null>({
    queryKey: ["title-preview", nextTitleId] as const,
    enabled: Boolean(nextTitleId),
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!nextTitleId) return null;
      const { data, error } = await supabase
        .from("media_items")
        .select("id, omdb_director, omdb_genre, omdb_rating_rotten_tomatoes, omdb_imdb_rating")
        .eq("id", nextTitleId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        omdb_director: (data as any).omdb_director ?? null,
        omdb_genre: (data as any).omdb_genre ?? null,
        omdb_rating_rotten_tomatoes: (data as any).omdb_rating_rotten_tomatoes ?? null,
        omdb_imdb_rating: (data as any).omdb_imdb_rating ?? null,
      };
    },
  });

  const nextDetailDirector = cleanText(nextPreviewDetail?.omdb_director);
  const nextDetailRt = percentToNumber(nextPreviewDetail?.omdb_rating_rotten_tomatoes);
  const nextDetailImdb = safeNumber(nextPreviewDetail?.omdb_imdb_rating);

  const { data: friendCount = 0 } = useQuery<number>({
    queryKey: ["friendCount", { userId: user?.id ?? null }],
    enabled: Boolean(user?.id),
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count, error } = await supabase
        .from("follows")
        .select("followed_id", { count: "exact", head: true })
        .eq("follower_id", user.id);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const diaryQuery = useTitleDiaryEntry(activeTitleId);

  const serverStatus: DiaryStatus | null = (diaryQuery.data?.status as DiaryStatus | null) ?? null;
  const serverRating = diaryQuery.data?.rating ?? null;

  const [localStatus, setLocalStatus] = useState<DiaryStatus | null>(null);

  const [localRating, setLocalRating] = useState<number | null>(null);

  const diaryEntry = { status: localStatus ?? serverStatus, rating: localRating ?? serverRating };

  const feedbackMutation = useMutation({
    mutationFn: async (vars: {
      status?: DiaryStatus | null;
      statusKind?: "watchlist" | "watched";
      ratingStars?: number | null;
    }) => {
      if (!user?.id || !activeCardRaw) return;

      const batch: any = {
        sessionId,
        deckId: activeCardRaw.deckId ?? null,
        recRequestId: activeCardRaw.recRequestId ?? null,
        dedupeKey: (activeCardRaw.dedupeKey ?? (activeCardRaw as any).dedupe_key) ?? null,
        position: activeCardRaw.position ?? null,
        mediaItemId: activeCardRaw.id,
        source: activeCardRaw.source ?? null,
        events: [],
      };

      const events: any[] = [];

      // Status updates
      if (vars.status !== undefined) {
        if (vars.statusKind === "watched") {
          const enabled = vars.status === WATCHED_STATUS;
          events.push({
            // We send eventType="like" but the edge function treats payload.action="status" specially
            // and *does not* record it as a real "like" (so likes remain separate from watched).
            eventType: "like" as const,
            payload: { ui: "SwipePage", action: "status", status: "watched", enabled },
          });
        } else {
          const enabled = vars.status === WATCHLIST_STATUS;
          events.push({
            eventType: "watchlist" as const,
            inWatchlist: enabled,
            payload: { ui: "SwipePage", action: "status", status: "watchlist", enabled },
          });
        }
      }

      // Rating updates
      if (vars.ratingStars !== undefined) {
        events.push({
          eventType: "rating" as const,
          rating0_10: starsToRating0_10(vars.ratingStars),
          payload: { ui: "SwipePage", action: "rating" },
        });
      }

      if (!events.length) return;
      batch.events = events;

      // One network call for status+rating changes.
      await sendEventAsync(batch);
    },
    onSuccess: () => {
      if (user?.id && activeTitleId) {
        queryClient.invalidateQueries({ queryKey: qk.titleDiary(user.id, activeTitleId) });
        queryClient.invalidateQueries({ queryKey: qk.diaryLibrary(user.id) });
      }
    },
  });
  // Note: long-press-to-open-details was removed. Details are opened via a short tap.

  const audioContextRef = useRef<AudioContext | null>(null);
  const burstLayerRef = useRef<HTMLDivElement | null>(null);
  const prefersReducedMotionRef = useRef(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const [sfxEnabled, setSfxEnabled] = useState(true);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const sfxEnabledRef = useRef(true);
  const hapticsEnabledRef = useRef(true);
  const lastHapticAtRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      prefersReducedMotionRef.current = mq.matches;
      setPrefersReducedMotion(mq.matches);
    };
    update();
    if (typeof mq.addEventListener === "function") mq.addEventListener("change", update);
    else (mq as any).addListener?.(update);
    return () => {
      if (typeof mq.removeEventListener === "function") mq.removeEventListener("change", update);
      else (mq as any).removeListener?.(update);
    };
  }, []);

  // Load/save feedback prefs (best-effort)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const sfx = safeLocalStorageGetItem(SWIPE_SFX_STORAGE_KEY);
      const hap = safeLocalStorageGetItem(SWIPE_HAPTICS_STORAGE_KEY);
      const nextSfx = sfx == null ? true : sfx === "1";
      const nextHap = hap == null ? true : hap === "1";
      setSfxEnabled(nextSfx);
      setHapticsEnabled(nextHap);
      sfxEnabledRef.current = nextSfx;
      hapticsEnabledRef.current = nextHap;
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    sfxEnabledRef.current = sfxEnabled;
    if (typeof window === "undefined") return;
    try {
      safeLocalStorageSetItem(SWIPE_SFX_STORAGE_KEY, sfxEnabled ? "1" : "0");
    } catch {
      // ignore
    }
  }, [sfxEnabled]);

  useEffect(() => {
    hapticsEnabledRef.current = hapticsEnabled;
    if (typeof window === "undefined") return;
    try {
      safeLocalStorageSetItem(SWIPE_HAPTICS_STORAGE_KEY, hapticsEnabled ? "1" : "0");
    } catch {
      // ignore
    }
  }, [hapticsEnabled]);

  const hoverTiltRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Coarse pointer detection (touch devices) for subtle threshold tuning.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(pointer: coarse)");
    const update = () => {
      isCoarsePointerRef.current = mq.matches;
    };
    update();
    if (typeof mq.addEventListener === "function") mq.addEventListener("change", update);
    else (mq as any).addListener?.(update);
    return () => {
      if (typeof mq.removeEventListener === "function") mq.removeEventListener("change", update);
      else (mq as any).removeListener?.(update);
    };
  }, []);

  const ensureAudioContext = () => {
    if (!FEEDBACK_ENABLED) return null;
    if (typeof window === "undefined") return null;
    if (audioContextRef.current) return audioContextRef.current;
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    audioContextRef.current = ctx;
    return ctx;
  };

  const safeVibrateRaw = (pattern: number | number[]) => {
    if (!FEEDBACK_ENABLED) return;
    if (!hapticsEnabledRef.current) return;
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
    navigator.vibrate(pattern);
  };

  const haptic = (kind: "threshold" | "commit" | "snap" | "skip", intensity = 1) => {
    if (!FEEDBACK_ENABLED) return;
    if (!hapticsEnabledRef.current) return;
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const last = lastHapticAtRef.current || 0;
    const cooldown = kind === "commit" ? 0 : HAPTIC_COOLDOWN_MS;
    if (now - last < cooldown) return;
    lastHapticAtRef.current = now;

    const t = clamp(intensity, 0.2, 1);
    if (kind === "threshold") {
      safeVibrateRaw(8);
      return;
    }
    if (kind === "snap") {
      safeVibrateRaw(6);
      return;
    }
    if (kind === "skip") {
      safeVibrateRaw(12);
      return;
    }

    // commit
    const base = Math.round(16 + t * 22);
    safeVibrateRaw(t > 0.7 ? [base, 12, base + 8] : base);
  };

  const playSwipeSound = (direction: SwipeDirection, intensity: number) => {
    if (!FEEDBACK_ENABLED) return;
    if (!sfxEnabledRef.current) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;

    const ctx = ensureAudioContext();
    if (!ctx) return;

    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const jitter = 1 + (Math.random() * 0.06 - 0.03);
    const t = clamp(intensity, 0.2, 1);

    // Procedural "whoosh" (noise through a sweeping filter) + tiny tone confirm.
    const now = ctx.currentTime;
    const dur = 0.11 + t * 0.08;

    // Noise buffer (short)
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) {
      const fade = 1 - i / len;
      data[i] = (Math.random() * 2 - 1) * fade;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";

    const startF = direction === "like" ? 760 : direction === "dislike" ? 520 : 640;
    const endF = direction === "like" ? 1180 : direction === "dislike" ? 320 : 560;
    filter.frequency.setValueAtTime(Math.max(80, startF * jitter), now);
    // exponential sweeps feel more natural than linear for audio
    filter.frequency.exponentialRampToValueAtTime(Math.max(60, endF * jitter), now + dur);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.09 + t * 0.14, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + dur + 0.02);

    // Tiny confirm tone (kept subtle)
    const osc = ctx.createOscillator();
    const og = ctx.createGain();
    osc.type = direction === "like" ? "sine" : "triangle";
    const baseTone = direction === "like" ? 520 : direction === "dislike" ? 210 : 360;
    osc.frequency.setValueAtTime(baseTone * jitter, now);
    osc.frequency.linearRampToValueAtTime(
      (baseTone + (direction === "like" ? 180 : -40)) * jitter,
      now + dur,
    );
    og.gain.setValueAtTime(0.0001, now);
    og.gain.exponentialRampToValueAtTime(0.04 + t * 0.05, now + 0.01);
    og.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(og);
    og.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  };

  const spawnBurst = (direction: SwipeDirection, intensity = 1) => {
    if (prefersReducedMotionRef.current) return;
    const layer = burstLayerRef.current;
    if (!layer) return;

    const rect = layer.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    if (w <= 0 || h <= 0) return;

    const dur = SWIPE_FEEL.burstDurationMs;
    const count = Math.max(6, Math.round(SWIPE_FEEL.burstBaseCount * clamp(intensity, 0.25, 1)));

    const originX = direction === "like" ? Math.min(92, w * 0.28) : Math.max(w - 92, w * 0.72);
    const originY = Math.min(92, h * 0.14);

    const color = direction === "like" ? "rgba(52,211,153,0.82)" : "rgba(251,113,133,0.82)";
    const alt = direction === "like" ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.7)";

    for (let i = 0; i < count; i++) {
      const el = document.createElement("span");
      const isSquare = i % 5 === 0;
      el.className = "mn-swipe-burst-dot";
      el.setAttribute("data-shape", isSquare ? "square" : "dot");

      const angle =
        (Math.random() * Math.PI * 0.9 + Math.PI * 0.05) * (direction === "like" ? 1 : -1);
      const speed = 62 + Math.random() * 98;
      const dx = Math.cos(angle) * speed;
      const dy = -Math.abs(Math.sin(angle)) * speed * (0.85 + Math.random() * 0.5);

      const sz = 5 + Math.random() * 6;
      const rot = (Math.random() * 160 - 80).toFixed(1) + "deg";
      const s = (0.8 + Math.random() * 0.9).toFixed(2);

      el.style.setProperty("--x", originX.toFixed(1) + "px");
      el.style.setProperty("--y", originY.toFixed(1) + "px");
      el.style.setProperty("--dx", dx.toFixed(1) + "px");
      el.style.setProperty("--dy", dy.toFixed(1) + "px");
      el.style.setProperty("--rot", rot);
      el.style.setProperty("--s", s);
      el.style.setProperty("--sz", sz.toFixed(1) + "px");
      el.style.setProperty("--dur", dur + "ms");
      el.style.background = i % 3 === 0 ? alt : color;

      layer.appendChild(el);
      window.setTimeout(() => el.remove(), dur + 60);
    }
  };

  // title detail query
  const { data: titleDetail } = useQuery<TitleDetailRow | null>({
    queryKey: qk.titleDetail(activeTitleId),
    // Always enabled so swipe mode can show director/ratings/backdrop consistently.
    enabled: Boolean(activeTitleId),
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!activeTitleId) return null;
      return fetchTitleDetailRow(activeTitleId);
    },
  });

  // clean + merged fields (hide "N/A")
  const detailOverview = cleanText(titleDetail?.plot) ?? cleanText(activeCard?.overview) ?? null;

  const detailGenres = titleDetail?.genres ?? activeCard?.genres ?? null;

  const primaryCountryRaw = titleDetail?.omdb_country ?? activeCard?.country ?? null;
  const detailPrimaryCountry = cleanText(primaryCountryRaw);
  const detailPrimaryCountryAbbr = abbreviateCountry(detailPrimaryCountry);

  const detailDirector = cleanText(titleDetail?.omdb_director);
  const detailWriter = cleanText(titleDetail?.omdb_writer);
  const detailActors = cleanText(titleDetail?.omdb_actors);

  const externalImdbRating = titleDetail?.imdb_rating ?? activeCard?.imdbRating ?? null;
  const externalTomato = titleDetail?.rt_tomato_pct ?? activeCard?.rtTomatoMeter ?? null;
  const externalMetascore = titleDetail?.metascore ?? null;

  const imdbVotes = titleDetail?.imdb_votes ?? null;

  const detailAwards = cleanText(titleDetail?.omdb_awards);
  const detailBoxOffice = cleanText(titleDetail?.omdb_box_office_str);
  const detailReleased = cleanText(titleDetail?.omdb_released);

  const normalizedContentType: TitleType | null =
    titleDetail?.content_type === "movie" ||
    titleDetail?.content_type === "series" ||
    titleDetail?.content_type === "anime"
      ? titleDetail.content_type
      : (activeCard?.type ?? null);

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
        ? String(detailGenres)
            .split(",")
            .map((g) => g.trim())
        : []) ?? [];
  const moreGenres = allGenresArray.length > 3 ? allGenresArray.slice(3).filter(Boolean) : [];

  const allLanguagesRaw: (string | null)[] = [
    titleDetail?.omdb_language ?? null,
    activeCard?.language ?? null,
  ];
  const languages = Array.from(
    new Set(allLanguagesRaw.map((l) => cleanText(l)).filter((l): l is string => !!l)),
  );

  const ensureSignedIn = () => {
    if (!user) {
      alert("Sign in to save this title, rate it, or add it to your watchlist.");
      return false;
    }
    return true;
  };

  const setDiaryStatus = (status: DiaryStatus) => {
    if (!activeTitleId || !activeCardRaw || !ensureSignedIn()) return;

    if (status === WATCHLIST_STATUS) {
      const next = diaryEntry.status === WATCHLIST_STATUS ? null : WATCHLIST_STATUS;
      setLocalStatus(next);
      feedbackMutation.mutate({ status: next, statusKind: "watchlist" });
      return;
    }

    if (status === WATCHED_STATUS) {
      const next = diaryEntry.status === WATCHED_STATUS ? null : WATCHED_STATUS;
      setLocalStatus(next);
      feedbackMutation.mutate({ status: next, statusKind: "watched" });
    }
  };

  // Bookmark button behavior (option 3B): add to watchlist, then move to the next card (without sending a skip swipe).
  const addToWatchlistAndContinue = () => {
    if (!activeTitleId || !activeCardRaw || !ensureSignedIn()) return;
    setLocalStatus(WATCHLIST_STATUS);
    feedbackMutation.mutate({ status: WATCHLIST_STATUS, statusKind: "watchlist" });
    advanceWithoutSwipe();
  };

  const setDiaryRating = (nextRating: number | null) => {
    if (!activeTitleId || !activeCardRaw || !ensureSignedIn()) return;
    setLocalRating(nextRating);
    feedbackMutation.mutate({ ratingStars: nextRating });
  };

  const statusIs = (status: DiaryStatus) => diaryEntry?.status === status;

  const diaryServerRating = serverRating ?? null;
  const currentUserRating = localRating ?? diaryServerRating;

  useEffect(() => {
    // Reset local overrides when the active card or server feedback changes
    setLocalRating(null);
    setLocalStatus(null);
  }, [activeTitleId, serverRating, serverStatus]);

  const handleStarClick = (value: number) => {
    const next = currentUserRating === value ? null : value;
    setDiaryRating(next);
  };

  const getShareUrl = () =>
    typeof window !== "undefined"
      ? buildAppUrl(`/title/${activeCard?.id ?? ""}`)
      : `/title/${activeCard?.id ?? ""}`;

  const shareUrl = getShareUrl();

  const handleShareExternal = async (messageOverride?: string) => {
    if (!activeCard || !activeCardRaw) return;
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

  const cardRef = useRef<HTMLDivElement | null>(null);
  const nextPreviewRef = useRef<HTMLDivElement | null>(null);
  const cardSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const isCoarsePointerRef = useRef(false);
  const dragStartX = useRef<number | null>(null);
  const dragStartY = useRef<number | null>(null);
  const dragDelta = useRef(0);
  const latestDxRef = useRef(0);
  const latestDyRef = useRef(0);
  const isPointerDownRef = useRef(false);
  const dragAxisLockRef = useRef<"x" | "y" | null>(null);
  const tapStartedOnInteractiveRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const smoothDxRef = useRef(0);
  const punchStartRef = useRef<number | null>(null);

  const lastMoveX = useRef<number | null>(null);
  const lastMoveTime = useRef<number | null>(null);
  const velocityRef = useRef(0);
  const activePointerIdRef = useRef<number | null>(null);
  const grabYRatioRef = useRef(0.5);
  const grabXRatioRef = useRef(0.5);
  const lastIntentRef = useRef<"like" | "dislike" | null>(null);
  const tapStartTimeRef = useRef<number | null>(null);
  const dwellStartRef = useRef<number | null>(null);
  const dwellCardIdRef = useRef<string | null>(null);
  const dwellCardRef = useRef<any | null>(null);

  // Keep card measurements up to date for adaptive thresholds.
  useEffect(() => {
    const measure = () => {
      const node = cardRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      cardSizeRef.current = { w: rect.width, h: rect.height };
    };
    measure();
    if (typeof window === "undefined") return;
    window.addEventListener("resize", measure, { passive: true } as any);
    return () => window.removeEventListener("resize", measure as any);
  }, [activeCard?.id]);

  // Advance to the next card WITHOUT sending a swipe/skip event.
  // Used for actions like Bookmark -> Watchlist (option 3B).
  const advanceWithoutSwipe = () => {
    if (!activeCard) return;

    setShowOnboarding(false);
    if (typeof window !== "undefined") {
      safeLocalStorageSetItem(ONBOARDING_STORAGE_KEY, "1");
    }

    const node = cardRef.current;
    if (node) {
      node.style.transition =
        "transform 220ms cubic-bezier(0.22,0.61,0.36,1), opacity 220ms ease-out";
      node.style.transform =
        "perspective(1400px) translateX(0px) translateY(6px) scale(1.02) rotateZ(-1deg)";
      window.setTimeout(() => {
        node.style.transform = "perspective(1400px) translateX(0px) translateY(26px) scale(0.95)";
      }, 16);
      node.style.opacity = "0";
    }

    window.setTimeout(() => {
      setNextPreviewTransform(0, true);
      setCurrentIndex((prev) => Math.min(prev + 1, cards.length));
      if (node) {
        node.style.transition = "none";
        node.style.transform = "translateX(0px) translateY(0px) scale(1)";
        node.style.opacity = "1";
      }
    }, 220);
  };

  // onboarding
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hasSeen = safeLocalStorageGetItem(ONBOARDING_STORAGE_KEY);
    setShowOnboarding(!hasSeen);
  }, []);

  // reset on card change
  useEffect(() => {
    setActivePosterFailed(false);
    setIsDetailMode(false);
    setIsFullDetailOpen(false);
  }, [activeCard?.id]);

  // Auto-skip cards that do not match local filters (genres / minimum IMDb rating).
  // We advance without sending skip events, so the deck movement stays clean.
  useEffect(() => {
    if (!activeCardRaw || !activeCard) return;
    if (isLoading || isError) return;

    if (matchesLocalFilters(activeCard)) return;

    // Close details if a filter change makes the current card invalid.
    setIsDetailMode(false);
    setIsFullDetailOpen(false);

    // Hard advance (no swipe event)
    setCurrentIndex((prev) => Math.min(prev + 1, cards.length));
  }, [activeCardRaw?.id, activeCard?.id, isLoading, isError, matchesLocalFilters]);

  // Track impressions + dwell time for the "Swipe Brain v2" learning loop
  useEffect(() => {
    if (!activeCardRaw) return;

    const now = performance.now();

    // Flush dwell for the previously tracked card (if any).
    if (
      dwellCardRef.current &&
      dwellCardIdRef.current &&
      dwellCardIdRef.current !== activeCardRaw.id
    ) {
      const started = dwellStartRef.current;
      if (started != null) {
        const dwellMs = Math.max(0, Math.round(now - started));
        trackDwell(dwellCardRef.current, dwellMs);
      }
    }

    // If the current card doesn't match local filters (genres/rating), don't track impressions/dwell for it.
    if (!matchesLocalFilters(activeCard)) {
      dwellCardRef.current = null;
      dwellCardIdRef.current = null;
      dwellStartRef.current = null;
      return;
    }

    trackImpression(activeCardRaw);

    dwellCardRef.current = activeCardRaw;
    dwellCardIdRef.current = activeCardRaw.id;
    dwellStartRef.current = now;
  }, [activeCardRaw?.id, activeCard?.id, matchesLocalFilters, trackDwell, trackImpression]);

  useEffect(() => {
    return () => {
      if (!dwellCardRef.current) return;
      const started = dwellStartRef.current;
      if (started == null) return;
      const dwellMs = Math.max(0, Math.round(performance.now() - started));
      trackDwell(dwellCardRef.current, dwellMs);
    };
  }, []);

  // preload next posters
  useEffect(() => {
    if (typeof window === "undefined") return;

    const idle =
      (window as any).requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 180));

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
      if (undoTimeoutRef.current != null) window.clearTimeout(undoTimeoutRef.current);
      if (smartHintTimeoutRef.current != null) window.clearTimeout(smartHintTimeoutRef.current);
      if (audioContextRef.current) audioContextRef.current.close().catch(() => {});
    },
    [],
  );

  // fetch more when low
  useEffect(() => {
    const remaining = cards.length - currentIndex;
    if (remaining < 12) fetchMore(Math.max(60, remaining + 24));
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
  const setNextPreviewTransform = useCallback(
    (x: number, withTransition = false, transitionMs?: number) => {
      const node = nextPreviewRef.current;
      if (!node) return;

      // Option A: next card is centered behind the active card.
      // It subtly "pops" into place as the active card is dragged away.
      const deviceScale = isCoarsePointerRef.current ? 0.96 : 1;
      const distanceThreshold = getSwipeDistanceThreshold(cardSizeRef.current.w, deviceScale);
      const progress = clamp(Math.abs(x) / Math.max(1, distanceThreshold), 0, 1);
      const bias = clamp(x / Math.max(1, distanceThreshold), -1, 1);

      // Intent shading: subtle left/right bias so the under-card "peels" toward the chosen lane.
      const brightness = 0.68 + progress * 0.32 + bias * progress * 0.03; // 0.68 -> 1.0 (+ intent)
      const saturate = 0.9 + progress * 0.1 + bias * progress * 0.02; // 0.9 -> 1.0 (+ intent)

      const scale = 0.985 + progress * 0.015; // 0.985 -> 1.0
      const translateY = (1 - progress) * SWIPE_FEEL.undercardTranslateY; // px -> 0px
      const blur = (1 - progress) * SWIPE_FEEL.undercardBlurMax;
      // Premium: a hint of depth in the under-card (subtle counter-rotation + parallax).
      const underParallax = 1 - progress;
      const translateX = (clamp(-x * 0.02, -10, 10) + bias * progress * 8) * underParallax;
      const rotateZ = clamp(-x / 220, -2.2, 2.2) * underParallax;

      const ms = transitionMs ?? 200;

      node.style.transition = withTransition
        ? `filter ${ms}ms cubic-bezier(0.22,0.61,0.36,1), transform ${ms}ms cubic-bezier(0.22,0.61,0.36,1)`
        : "none";

      node.style.transform = `translate3d(${translateX.toFixed(2)}px, ${translateY.toFixed(2)}px, 0px) rotateZ(${rotateZ.toFixed(3)}deg) scale(${scale.toFixed(4)})`;
      node.style.filter = `brightness(${brightness.toFixed(3)}) saturate(${saturate.toFixed(3)}) blur(${blur.toFixed(2)}px)`;
    },
    [],
  );

  const triggerPunch = () => {
    if (typeof performance === "undefined") return;
    punchStartRef.current = performance.now();
  };

  const getPunchScale = () => {
    if (typeof performance === "undefined") return 1;
    const start = punchStartRef.current;
    if (start == null) return 1;
    const t = (performance.now() - start) / Math.max(1, SWIPE_FEEL.punchDurationMs);
    if (t >= 1) {
      punchStartRef.current = null;
      return 1;
    }
    // 1 -> peak -> 1 (smooth bump)
    const p = Math.sin(Math.PI * t);
    return 1 + (SWIPE_FEEL.punchScale - 1) * p;
  };

  const setCardTransform = (
    x: number,
    withTransition = false,
    transitionMs?: number,
    easing?: string,
  ) => {
    const node = cardRef.current;
    if (!node) return;

    const reduceMotion = prefersReducedMotionRef.current;
    const deviceScale = isCoarsePointerRef.current ? 0.96 : 1;
    const distanceThreshold = getSwipeDistanceThreshold(cardSizeRef.current.w, deviceScale);
    const intentThreshold = getDragIntentThreshold(cardSizeRef.current.w, deviceScale);

    // Two-stage friction curve: 1:1 until ~70% of threshold, then extra movement gets "heavier".
    const applyTwoStageFriction = (val: number) => {
      const a = Math.abs(val);
      const knee = Math.max(1, distanceThreshold) * 0.7;
      if (a <= knee) return val;
      const extra = a - knee;
      return Math.sign(val) * (knee + extra * 0.38);
    };

    const frictionedX = applyTwoStageFriction(x);
    const clampedX = clamp(frictionedX, -MAX_DRAG, MAX_DRAG);
    const finalX = applyRubberBand(frictionedX, MAX_DRAG);

    // Most-premium: rotate around the grab point while dragging.
    const useGrabOrigin = Math.abs(frictionedX) > 0.5 && dragAxisLockRef.current === "x";
    node.style.transformOrigin = useGrabOrigin
      ? `${(grabXRatioRef.current * 100).toFixed(1)}% ${(grabYRatioRef.current * 100).toFixed(1)}%`
      : "50% 50%";

    // Drive UI feedback (labels / overlays) via CSS variables so we don't re-render during drags.
    const absX = Math.abs(clampedX);
    const labelStart = intentThreshold * 0.6;
    const labelProgress = clamp(
      (absX - labelStart) / Math.max(1, distanceThreshold - labelStart),
      0,
      1,
    );
    const likeOpacity = clampedX > 0 ? labelProgress : 0;
    const nopeOpacity = clampedX < 0 ? labelProgress : 0;
    node.style.setProperty("--mn-swipe-like-opacity", String(likeOpacity));
    node.style.setProperty("--mn-swipe-nope-opacity", String(nopeOpacity));
    node.style.setProperty("--mn-swipe-like-scale", String(0.96 + likeOpacity * 0.04));
    node.style.setProperty("--mn-swipe-nope-scale", String(0.96 + nopeOpacity * 0.04));

    const progress = clamp(Math.abs(clampedX) / Math.max(1, distanceThreshold), 0, 1);

    // Most-premium: rotation depends on where you grabbed the card (top vs bottom),
    // plus a little velocity-based tilt so flicks feel snappy.
    const anchor = clamp((0.5 - grabYRatioRef.current) * 2, -1, 1); // [-1..1] (top=+1, bottom=-1)
    const anchorSign = anchor < 0 ? -1 : 1;
    const anchorStrength = 0.55 + 0.45 * Math.abs(anchor); // [0.55..1]

    const pivotX = clamp((grabXRatioRef.current - 0.5) * 2, -1, 1); // [-1..1] (left=-1, right=+1)
    const vNorm = clamp(Math.abs(velocityRef.current) / 1.35, 0, 1);

    const baseRotateZ = (clampedX / ROTATION_FACTOR) * anchorStrength * anchorSign;
    const rotateZ = clamp(
      baseRotateZ * (1 + vNorm * 0.28),
      -SWIPE_FEEL.rotateZCap,
      SWIPE_FEEL.rotateZCap,
    );

    // Yaw: horizontal drag + grab-side pivot + velocity snap.
    const dragRotateY = clamp(
      clampedX / 24 + Math.sign(clampedX) * vNorm * 2.8 + -pivotX * progress * 4.5,
      -SWIPE_FEEL.rotateYCap,
      SWIPE_FEEL.rotateYCap,
    );
    // Pitch: subtle lift/tilt based on grab height & flick speed.
    const extraRotateX = clamp(
      anchor * (1.8 + vNorm * 2.2) * progress,
      -SWIPE_FEEL.rotateXCap,
      SWIPE_FEEL.rotateXCap,
    );

    // Micro-details: parallax + specular + dynamic shadow
    if (!reduceMotion) {
      const specO = clamp(0.08 + progress * 0.22 + vNorm * 0.12, 0, 0.42);
      const specX = clamp(
        50 + (clampedX / Math.max(1, distanceThreshold)) * 18 + hoverTiltRef.current.x * 12,
        24,
        76,
      );
      const specY = clamp(
        28 +
          (-latestDyRef.current / Math.max(1, distanceThreshold)) * 12 +
          hoverTiltRef.current.y * 10,
        16,
        66,
      );
      node.style.setProperty("--mn-swipe-spec-o", specO.toFixed(3));
      node.style.setProperty("--mn-swipe-spec-x", `${specX.toFixed(1)}%`);
      node.style.setProperty("--mn-swipe-spec-y", `${specY.toFixed(1)}%`);
      node.style.setProperty("--mn-swipe-poster-parallax", `${(-clampedX * 0.035).toFixed(2)}px`);
      node.style.setProperty(
        "--mn-swipe-poster-parallax-y",
        `${(latestDyRef.current * 0.02).toFixed(2)}px`,
      );
      node.style.setProperty("--mn-swipe-bg-parallax", `${(clampedX * 0.02).toFixed(2)}px`);

      const shadowA = clamp(0.46 + progress * 0.22 + vNorm * 0.14, 0.35, 0.78);
      node.style.boxShadow = `0 30px 92px rgba(0,0,0,${shadowA.toFixed(3)})`;
      node.style.backdropFilter = `blur(${(8 + progress * 8).toFixed(1)}px)`;
    } else {
      node.style.setProperty("--mn-swipe-spec-o", "0");
      node.style.setProperty("--mn-swipe-poster-parallax", "0px");
      node.style.setProperty("--mn-swipe-poster-parallax-y", "0px");
      node.style.setProperty("--mn-swipe-bg-parallax", "0px");
      node.style.boxShadow = "0 30px 90px rgba(0,0,0,0.62)";
      node.style.backdropFilter = "blur(8px)";
    }

    // Finger-follow Y (small) makes diagonal drags feel natural without breaking the horizontal lock.
    const fingerFollowY = reduceMotion ? 0 : clamp(latestDyRef.current * 0.18, -14, 14);

    // Premium: a tiny "lift" and scale makes the deck feel less flat without changing layout.
    const dragLift = -progress * (3.2 + vNorm * 1.6); // px

    const punchScale = getPunchScale();
    const scale = (1 + progress * 0.006 + vNorm * 0.004) * punchScale;

    const hover = reduceMotion ? { x: 0, y: 0 } : hoverTiltRef.current;
    const hoverRotateX = hover.y * -4;
    const hoverRotateYExtra = hover.x * 5;
    const hoverTranslateY = hover.y * -4;

    const ms = transitionMs ?? 320;
    const ease = easing ?? "cubic-bezier(0.16, 1, 0.3, 1)";
    node.style.transition = withTransition ? `transform ${ms}ms ${ease}` : "none";

    node.style.transform = `
      perspective(1400px)
      translate3d(${finalX}px, ${hoverTranslateY + dragLift + fingerFollowY}px, 0px)
      rotateX(${reduceMotion ? 0 : hoverRotateX + extraRotateX}deg)
      rotateY(${reduceMotion ? 0 : dragRotateY + hoverRotateYExtra}deg)
      rotateZ(${reduceMotion ? 0 : rotateZ}deg)
      scale(${scale})
    `;

    dragDelta.current = clampedX;
    setNextPreviewTransform(clampedX, withTransition, ms);
  };

  const resetCardPosition = (withTransition = true, releaseVelocity = 0) => {
    hoverTiltRef.current = { x: 0, y: 0 };
    const v = Math.abs(releaseVelocity);
    const vNorm = clamp(v / 1.35, 0, 1);
    const duration = withTransition ? clamp(Math.round(320 - vNorm * 140), 170, 320) : undefined;
    const ease =
      withTransition && v < 0.45
        ? "cubic-bezier(0.22, 1.2, 0.36, 1)"
        : "cubic-bezier(0.16, 1, 0.3, 1)";
    setCardTransform(0, withTransition, duration, ease);
    dragDelta.current = 0;
    dragStartX.current = null;
    dragStartY.current = null;
    lastMoveX.current = null;
    lastMoveTime.current = null;
    velocityRef.current = 0;
    latestDxRef.current = 0;
    latestDyRef.current = 0;
    isPointerDownRef.current = false;
    dragAxisLockRef.current = null;
    grabXRatioRef.current = 0.5;
    grabYRatioRef.current = 0.5;
    lastIntentRef.current = null;
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

  const handleBack = () => {
    if (!lastAction) return;

    setCurrentIndex((prev) => {
      const candidate = prev - 1;
      if (candidate < 0) return prev;
      const previousCard = cards[candidate];
      if (previousCard && previousCard.id === lastAction.card.id) return candidate;
      return prev;
    });

    setSmartHintWithTimeout("Reviewing previous card. Swipe actions are already saved.");
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => resetCardPosition(false));
    }

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
      if (
        externalImdbRating != null &&
        safeNumber(externalImdbRating) != null &&
        safeNumber(externalImdbRating)! >= 7.5
      ) {
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

  const performSwipe = (direction: SwipeDirection, velocity = 0, action: string | null = null) => {
    if (!activeCard || !activeCardRaw) return;

    const swipeKey = `${activeCardRaw.deckId ?? "unknown"}:${activeCardRaw.id}`;
    if (swipeActionKeysRef.current.has(swipeKey)) {
      setSmartHintWithTimeout("That swipe was already saved. Back is for review only.");
      resetCardPosition(true);
      return;
    }
    swipeActionKeysRef.current.add(swipeKey);

    setShowOnboarding(false);
    if (typeof window !== "undefined") {
      safeLocalStorageSetItem(ONBOARDING_STORAGE_KEY, "1");
    }

    setUndo(activeCard, direction);

    swipe({
      card: activeCardRaw,
      direction,
      action,
    });

    // Immediate UX feedback for explicit intent actions.
    if (action === "more_like_this") {
      setSmartHintWithTimeout("Locked in — we’ll prioritize more picks like this.");
    } else if (action === "not_interested") {
      setSmartHintWithTimeout("Noted — we’ll keep this out of your deck for a while.");
    }

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
          node.style.transform = "perspective(1400px) translateX(0px) translateY(24px) scale(0.95)";
        }, 16);
        node.style.opacity = "0";
      }

      const intensity = 0.4;
      haptic("skip", intensity);
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

    const viewportExit = typeof window !== "undefined" ? window.innerWidth + 240 : EXIT_MIN;

    // Make exit distance/duration feel tied to flick speed.
    const speed = Math.abs(velocity);
    const speedNorm = clamp(speed / 1.35, 0, 1);

    const extraDistance = clamp(speed * 260, 0, 280); // px/ms * ~ms => px
    const exitX = (viewportExit + extraDistance) * directionSign;

    const exitDuration = clamp(Math.round(260 - speedNorm * 110), 140, 260);

    const node = cardRef.current;
    if (node) {
      // Most-premium: keep the exit feeling continuous with the drag (same grab anchor + speed tilt).
      const anchor = clamp((0.5 - grabYRatioRef.current) * 2, -1, 1);
      const anchorSign = anchor < 0 ? -1 : 1;
      const anchorStrength = 0.55 + 0.45 * Math.abs(anchor);
      const pivotX = clamp((grabXRatioRef.current - 0.5) * 2, -1, 1);

      node.style.transformOrigin = `${(grabXRatioRef.current * 100).toFixed(1)}% ${(grabYRatioRef.current * 100).toFixed(1)}%`;

      const reduceMotion = prefersReducedMotionRef.current;

      const baseExitRotateZ = (exitX / ROTATION_FACTOR) * anchorStrength * anchorSign;
      const exitRotateZ = reduceMotion
        ? 0
        : clamp(baseExitRotateZ * (1 + speedNorm * 0.12), -24, 24);

      const exitRotateY = reduceMotion
        ? 0
        : clamp(directionSign * (10 + speedNorm * 12) + -pivotX * (4 + speedNorm * 3), -22, 22);
      const exitRotateX = reduceMotion ? 0 : clamp(anchor * (4 + speedNorm * 2), -8, 8);

      const exitTranslateY = -4 - speedNorm * 14;
      const exitScale = 1.04 + speedNorm * 0.04;

      // Gamey: tiny squash/stretch on commit (velocity-weighted)
      const squashX = reduceMotion ? 1 : 1 + speedNorm * 0.025;
      const squashY = reduceMotion ? 1 : 1 - speedNorm * 0.018;

      node.style.transition = `transform ${exitDuration}ms cubic-bezier(0.22,0.61,0.36,1)`;
      node.style.transform = `
        perspective(1400px)
        translate3d(${exitX}px, ${exitTranslateY}px, 0px)
        rotateX(${exitRotateX}deg)
        rotateY(${exitRotateY}deg)
        rotateZ(${exitRotateZ}deg)
        scale3d(${(exitScale * squashX).toFixed(4)}, ${(exitScale * squashY).toFixed(4)}, 1)
      `;
    }

    const gestureMagnitude = Math.abs(dragDelta.current) + Math.abs(velocity) * 220;
    const intensity = clamp(gestureMagnitude / 520, 0.25, 1);

    spawnBurst(direction, intensity);

    haptic("commit", intensity);
    playSwipeSound(direction, intensity);

    window.setTimeout(() => {
      setCurrentIndex((prev) => Math.min(prev + 1, cards.length));
      // Reset on the next frame so the newly-mounted card starts perfectly centered.
      window.requestAnimationFrame(() => resetCardPosition(false));
    }, exitDuration);
  };

  const handlePointerDown = (
    x: number,
    y: number,
    pointerId: number,
    target: EventTarget | null,
    pointerType: string,
    isPrimary: boolean,
    width?: number,
    height?: number,
  ) => {
    if (!activeCard || !activeCardRaw) return;
    if (activePointerIdRef.current != null) return;

    // Palm rejection + ignore non-primary touches.
    if (pointerType === "touch" && !isPrimary) return;
    if (pointerType === "touch" && typeof width === "number" && typeof height === "number") {
      if (width > 55 && height > 55) return;
    }

    const interactiveSelector =
      'button, a, input, textarea, select, [data-swipe-interactive="true"][role="button"], [data-swipe-interactive="true"][tabindex]:not([tabindex="-1"])';

    const startedOnInteractive =
      target instanceof HTMLElement && !!target.closest(interactiveSelector);

    tapStartedOnInteractiveRef.current = startedOnInteractive;

    // Let native interactions (click, focus, etc.) happen without starting a gesture.
    if (startedOnInteractive) return;

    // Pointer is down, but we only commit to a swipe after moving past slop and locking to X.
    isPointerDownRef.current = true;
    activePointerIdRef.current = pointerId;
    dragAxisLockRef.current = null;

    // Keep receiving move events even if the pointer drifts outside the card.
    try {
      cardRef.current?.setPointerCapture(pointerId);
    } catch {
      // no-op
    }

    dragStartX.current = x;
    dragStartY.current = y;
    // Premium: rotation anchor depends on where you "grab" the card.
    const node = cardRef.current;
    if (node) {
      const rect = node.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        cardSizeRef.current = { w: rect.width, h: rect.height };
        grabXRatioRef.current = clamp((x - rect.left) / rect.width, 0, 1);
        grabYRatioRef.current = clamp((y - rect.top) / rect.height, 0, 1);
      } else {
        grabXRatioRef.current = 0.5;
        grabYRatioRef.current = 0.5;
      }
    } else {
      grabXRatioRef.current = 0.5;
      grabYRatioRef.current = 0.5;
    }

    latestDxRef.current = 0;
    latestDyRef.current = 0;
    dragDelta.current = 0;

    smoothDxRef.current = 0;
    punchStartRef.current = null;

    lastMoveX.current = x;
    lastMoveTime.current = performance.now();
    tapStartTimeRef.current = lastMoveTime.current;
    velocityRef.current = 0;

    const startedInDetail =
      isDetailMode && detailContentRef.current && detailContentRef.current.contains(target as Node);
    dragStartedInDetailAreaRef.current = !!startedInDetail;
  };

  const handlePointerMove = (
    x: number,
    y: number,
    pointerId: number,
    pointerType: string,
    isPrimary: boolean,
    width?: number,
    height?: number,
  ) => {
    if (activePointerIdRef.current != null && pointerId !== activePointerIdRef.current) return;
    if (!isPointerDownRef.current || dragStartX.current === null || dragStartY.current === null)
      return;

    // Palm rejection + ignore non-primary touches.
    if (pointerType === "touch" && !isPrimary) return;
    if (pointerType === "touch" && typeof width === "number" && typeof height === "number") {
      if (width > 55 && height > 55) return;
    }

    const now = performance.now();
    const dxFromStart = x - dragStartX.current;
    const dyFromStart = y - dragStartY.current;

    // Direction-lock before we start dragging so taps and vertical scrolls don't feel "sticky".
    if (!isDraggingRef.current && dragAxisLockRef.current == null) {
      const adx = Math.abs(dxFromStart);
      const ady = Math.abs(dyFromStart);
      if (adx < DRAG_START_SLOP && ady < DRAG_START_SLOP) return;

      if (ady > adx * DIRECTION_LOCK_RATIO) {
        // Prefer vertical interaction (scroll, etc.). We stop tracking this pointer as a swipe.
        isPointerDownRef.current = false;
        activePointerIdRef.current = null;
        dragAxisLockRef.current = "y";
        dragStartX.current = null;
        dragStartY.current = null;
        lastMoveX.current = null;
        lastMoveTime.current = null;
        velocityRef.current = 0;
        return;
      }

      // Commit to horizontal swipe.
      dragAxisLockRef.current = "x";
      setIsDragging(true);
      isDraggingRef.current = true;

      // Consume the slop so the card doesn't "jump" when the gesture starts.
      dragStartX.current = x - Math.sign(dxFromStart) * DRAG_START_SLOP;
      dragStartY.current = y;

      lastMoveX.current = x;
      lastMoveTime.current = now;
      velocityRef.current = 0;
      if (sfxEnabledRef.current) ensureAudioContext();

      const node = cardRef.current;
      if (node) {
        try {
          node.setPointerCapture(pointerId);
        } catch {
          // ignore
        }
      }
    }

    if (!isDraggingRef.current || dragStartX.current === null) return;

    const dx = x - dragStartX.current;

    const deviceScale = isCoarsePointerRef.current ? 0.96 : 1;
    const distanceThreshold = getSwipeDistanceThreshold(cardSizeRef.current.w, deviceScale);
    const intentThreshold = getDragIntentThreshold(cardSizeRef.current.w, deviceScale);

    // Magnetic lanes: damp minor axis once horizontal movement clearly dominates.
    const dyRaw = dragStartY.current != null ? y - dragStartY.current : 0;
    const adx = Math.abs(dx);
    const ady = Math.abs(dyRaw);
    const laneStrength = clamp(
      (adx - ady * LANE_DOMINANCE_RATIO) / Math.max(1, intentThreshold),
      0,
      1,
    );
    const damp = clamp(
      1 - laneStrength * 0.75 - (adx / Math.max(1, distanceThreshold)) * 0.22,
      LANE_MINOR_DAMP_MIN,
      1,
    );
    const dy = dyRaw * damp;

    // Gentle magnetic pull into the chosen lane as intent becomes clear.
    const lanePull = clamp(
      (adx - intentThreshold * 0.55) / Math.max(1, intentThreshold * 0.75),
      0,
      1,
    );
    const dxMag = dx + Math.sign(dx) * SOFT_SETTLE_MAX_PUSH * 0.18 * lanePull;

    latestDxRef.current = dxMag;
    latestDyRef.current = clamp(dy, -70, 70);

    let nextIntent: "like" | "dislike" | null = null;
    if (dxMag > intentThreshold) nextIntent = "like";
    else if (dxMag < -intentThreshold) nextIntent = "dislike";
    // Premium: subtle haptic tick when crossing the decision threshold.
    if (nextIntent && nextIntent !== lastIntentRef.current) {
      haptic("threshold", 0.6);
      triggerPunch();
    }
    lastIntentRef.current = nextIntent;

    // Update velocity estimate.
    if (lastMoveX.current !== null && lastMoveTime.current !== null) {
      const dt = now - lastMoveTime.current;
      if (dt > 0) {
        const vxRaw = (x - lastMoveX.current) / dt;
        const vx = clamp(vxRaw, -2.5, 2.5);
        velocityRef.current = velocityRef.current * 0.75 + vx * 0.25;
      }
    }
    lastMoveX.current = x;
    lastMoveTime.current = now;

    if (rafRef.current != null) return;

    const tick = () => {
      rafRef.current = null;

      const alpha = clamp(SWIPE_FEEL.dragFollowAlpha, 0.08, 1);

      // Soft settle: if the user pauses mid-drag, gently "seat" the card into the nearest lane.
      let targetX = latestDxRef.current;
      if (isPointerDownRef.current && isDraggingRef.current && lastMoveTime.current != null) {
        const idleMs =
          (typeof performance !== "undefined" ? performance.now() : Date.now()) -
          lastMoveTime.current;
        if (idleMs > SOFT_SETTLE_DELAY_MS) {
          const settleT = clamp((idleMs - SOFT_SETTLE_DELAY_MS) / 260, 0, 1);
          const ax = Math.abs(targetX);
          if (ax > intentThreshold * 0.45 && ax < distanceThreshold * 0.86) {
            const desired =
              Math.sign(targetX) * Math.min(intentThreshold * 0.92, distanceThreshold * 0.84);
            const delta = clamp(desired - targetX, -SOFT_SETTLE_MAX_PUSH, SOFT_SETTLE_MAX_PUSH);
            targetX = targetX + delta * settleT;
          }
        }
      }

      smoothDxRef.current = smoothDxRef.current + (targetX - smoothDxRef.current) * alpha;

      setCardTransform(smoothDxRef.current);

      // Keep animating while dragging so punch + smoothing feel continuous.
      if (isPointerDownRef.current && isDraggingRef.current && dragAxisLockRef.current === "x") {
        rafRef.current = window.requestAnimationFrame(tick);
      }
    };

    rafRef.current = window.requestAnimationFrame(tick);
  };

  const finishDrag = (pointerId: number, x?: number, y?: number) => {
    // Ignore stray ups/cancels.
    if (activePointerIdRef.current != null && pointerId !== activePointerIdRef.current) return;

    const wasDragging = isDraggingRef.current;

    // Clear pointer tracking early.
    setIsDragging(false);
    isDraggingRef.current = false;
    isPointerDownRef.current = false;

    const capturedId = activePointerIdRef.current;
    activePointerIdRef.current = null;

    // Flush any pending RAF so the release feels exact.
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      setCardTransform(smoothDxRef.current);
    }

    const idToRelease = pointerId ?? capturedId;
    if (idToRelease != null) {
      try {
        cardRef.current?.releasePointerCapture(idToRelease);
      } catch {
        // ignore
      }
    }

    // Tap behavior (only if we never committed to a drag).
    if (!wasDragging) {
      const cancelledByVertical = dragAxisLockRef.current === "y";

      const startX = dragStartX.current;
      const startY = dragStartY.current;
      const dx = startX != null && x != null ? x - startX : 0;
      const dy = startY != null && y != null ? y - startY : 0;

      const tapDurationMs =
        tapStartTimeRef.current != null ? performance.now() - tapStartTimeRef.current : null;

      const isTap =
        !cancelledByVertical &&
        Math.abs(dx) < 10 &&
        Math.abs(dy) < 10 &&
        (tapDurationMs == null || tapDurationMs < 280) &&
        !tapStartedOnInteractiveRef.current;

      dragStartX.current = null;
      dragStartY.current = null;
      lastMoveX.current = null;
      lastMoveTime.current = null;
      velocityRef.current = 0;
      tapStartTimeRef.current = null;
      latestDxRef.current = 0;
      latestDyRef.current = 0;
      dragAxisLockRef.current = null;
      grabXRatioRef.current = 0.5;
      grabYRatioRef.current = 0.5;
      lastIntentRef.current = null;

      if (isTap && !(isDetailMode && dragStartedInDetailAreaRef.current)) {
        setIsDetailMode((v) => !v);
        setIsFullDetailOpen(false);
      }

      return;
    }

    tapStartTimeRef.current = null;

    const distance = clamp(dragDelta.current, -MAX_DRAG, MAX_DRAG);
    const projected = distance + velocityRef.current * SWIPE_FEEL.velocityProjectionMs;

    const isDetailDrag = isDetailMode && dragStartedInDetailAreaRef.current;
    const deviceScale = isCoarsePointerRef.current ? 0.96 : 1;
    const baseDistanceThreshold = getSwipeDistanceThreshold(cardSizeRef.current.w, deviceScale);
    const distanceThreshold = isDetailDrag ? baseDistanceThreshold * 1.6 : baseDistanceThreshold;
    const baseVelocityThreshold = isCoarsePointerRef.current
      ? SWIPE_VELOCITY_THRESHOLD * 0.92
      : SWIPE_VELOCITY_THRESHOLD;
    const velocityThreshold = isDetailDrag ? baseVelocityThreshold * 1.4 : baseVelocityThreshold;

    const shouldSwipe =
      Math.abs(projected) >= distanceThreshold ||
      Math.abs(velocityRef.current) >= velocityThreshold;

    // Reset pointer state.
    dragStartX.current = null;
    dragStartY.current = null;
    lastMoveX.current = null;
    lastMoveTime.current = null;
    latestDxRef.current = 0;
    latestDyRef.current = 0;
    smoothDxRef.current = 0;
    punchStartRef.current = null;
    dragAxisLockRef.current = null;

    if (shouldSwipe) {
      performSwipe(projected >= 0 ? "like" : "dislike", velocityRef.current);
      lastIntentRef.current = null;
      velocityRef.current = 0;
      return;
    }

    haptic("snap", clamp(Math.abs(velocityRef.current) / 1.35, 0.25, 0.9));
    resetCardPosition(true, velocityRef.current);
  };

  const actionsDisabled = !activeCard || isLoading || isError || isDragging;

  const friendLikesCount =
    typeof activeCard?.friendLikesCount === "number" ? activeCard.friendLikesCount : 0;
  const friendsLikedPercent =
    friendCount > 0 ? Math.round((friendLikesCount / Math.max(1, friendCount)) * 100) : 0;

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

  const renderUndoToast = () => {
    if (!showUndo || !lastAction) return null;

    const label =
      lastAction.direction === "like"
        ? "Loved it"
        : lastAction.direction === "dislike"
          ? "Marked as ‘No thanks’"
          : "Saved for ‘Not now’";

    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center page-pad">
        <div className="pointer-events-auto inline-flex items-center gap-3 rounded-md border border-border bg-background/95 px-3 py-2 text-[12px] text-foreground shadow-lg backdrop-blur">
          <span>{label}</span>
          <button
            type="button"
            aria-label="Back to previous card"
            onClick={handleBack}
            className="text-xs font-semibold uppercase tracking-[0.14em] text-primary hover:text-primary/80"
          >
            Back
          </button>
        </div>
      </div>
    );
  };

  const renderSmartHintToast = () => {
    if (!smartHint) return null;
    return (
      <div className="pointer-events-none absolute inset-x-0 top-2 z-30 flex justify-center page-pad">
        <div className="pointer-events-auto inline-flex max-w-md items-start gap-2 rounded-md border border-border bg-background/95 px-3 py-2 text-xs text-muted-foreground shadow-lg backdrop-blur">
          <MaterialIcon name="auto_awesome" className="mt-0.5 text-[18px] text-primary" />
          <span>{smartHint}</span>
        </div>
      </div>
    );
  };

  const primaryImdbForMeta =
    typeof activeCard?.imdbRating === "number" && !Number.isNaN(activeCard.imdbRating)
      ? activeCard.imdbRating
      : typeof titleDetail?.imdb_rating === "number" &&
          !Number.isNaN(titleDetail.imdb_rating as number)
        ? (titleDetail.imdb_rating as number)
        : safeNumber(titleDetail?.imdb_rating);

  const primaryRtForMeta =
    typeof activeCard?.rtTomatoMeter === "number" && !Number.isNaN(activeCard.rtTomatoMeter)
      ? activeCard.rtTomatoMeter
      : typeof titleDetail?.rt_tomato_pct === "number" &&
          !Number.isNaN(titleDetail.rt_tomato_pct as number)
        ? (titleDetail.rt_tomato_pct as number)
        : safeNumber(titleDetail?.rt_tomato_pct);

  const matchPercent = useMemo(
    () =>
      computeMatchPercent({
        card: activeCard ?? null,
        friendCount,
        imdb: primaryImdbForMeta ?? null,
        rt: primaryRtForMeta ?? null,
      }),
    [activeCard, friendCount, primaryImdbForMeta, primaryRtForMeta],
  );

  const metaLine = activeCard
    ? (() => {
        // One-line stats row (no match, no type):
        // 2016 • IMDb 7.1 • RT 87% • 1h 35m
        const parts: string[] = [];
        if (activeCard.year) parts.push(String(activeCard.year));

        if (primaryImdbForMeta != null && safeNumber(primaryImdbForMeta) != null) {
          parts.push(`IMDb ${String(safeNumber(primaryImdbForMeta)?.toFixed(1))}`);
        }

        if (primaryRtForMeta != null && safeNumber(primaryRtForMeta) != null) {
          parts.push(`RT ${Math.round(Number(primaryRtForMeta))}%`);
        }

        if (typeof activeCard.runtimeMinutes === "number" && activeCard.runtimeMinutes > 0) {
          const rt = formatRuntime(activeCard.runtimeMinutes);
          if (rt) parts.push(rt);
        }

        return parts.join(" • ");
      })()
    : "";

  const typeBadgeLabel = useMemo(() => {
    const t = (normalizedContentType ?? activeCard?.type ?? null) as any;
    if (t === "series") return "SERIES";
    if (t === "anime") return "ANIME";
    return "MOVIE";
  }, [normalizedContentType, activeCard?.type]);

  const swipeGenreTags = useMemo(() => {
    const raw = detailGenres ?? activeCard?.genres ?? null;
    const list = Array.isArray(raw)
      ? raw
      : raw
        ? String(raw)
            .split(",")
            .map((g) => g.trim())
            .filter(Boolean)
        : [];

    return list
      .map((g) => String(g ?? "").trim())
      .filter(Boolean)
      .slice(0, 3);
  }, [detailGenres, activeCard?.genres]);

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
    setCardTransform(latestDxRef.current);
  };

  const handleMouseLeaveCard = () => {
    if (isDragging) return;
    hoverTiltRef.current = { x: 0, y: 0 };
    setCardTransform(dragDelta.current, true);
  };

  return (
    <div
      data-reduce-motion={prefersReducedMotion ? "1" : "0"}
      className="relative flex flex-1 min-h-0 flex-col overflow-hidden overscroll-none h-[calc(100dvh-(5.5rem+env(safe-area-inset-bottom)))]"
      style={SWIPE_LAYOUT_VARS}
    >
      <style>{MN_SWIPE_BURST_CSS}</style>
      {/* Soft poster backdrop */}
      {activeCard?.posterUrl && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            backgroundImage: `url(${activeCard.posterUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" />
          <div className="absolute inset-0 backdrop-blur-2xl" />
        </div>
      )}

      {renderSmartHintToast()}

      <div className="relative z-10 flex shrink-0 flex-col gap-[calc(var(--mn-swipe-pad)*0.75)] px-[var(--mn-swipe-pad)] pt-[calc(env(safe-area-inset-top)+var(--mn-swipe-pad)*0.75)]">
        <header className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setIsFiltersOpen(true)}
            className="inline-flex h-[var(--mn-swipe-top-hit)] w-[var(--mn-swipe-top-hit)] items-center justify-center text-muted-foreground/90 transition-colors hover:text-foreground"
            aria-label="Filters"
          >
            <MaterialIcon name="tune" className="text-[length:var(--mn-swipe-top-icon)]" />
          </button>

          <div className="text-center">
            <div className="text-[length:var(--mn-swipe-kicker)] font-semibold tracking-[0.25em] text-primary/90">
              DISCOVERY
            </div>
            <div className="text-[length:var(--mn-swipe-header)] font-semibold text-foreground">
              For You
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate("/activity")}
            className="relative inline-flex h-[var(--mn-swipe-top-hit)] w-[var(--mn-swipe-top-hit)] items-center justify-center text-muted-foreground/90 transition-colors hover:text-foreground"
            aria-label="Activity"
          >
            <MaterialIcon name="notifications" className="text-[length:var(--mn-swipe-top-icon)]" />
            <span
              aria-hidden="true"
              className="absolute right-[8px] top-[8px] h-2 w-2 rounded-full bg-primary"
            />
          </button>
        </header>

        <SwipeSyncBanner
          message={swipeSyncError}
          onRetry={retryFailedSwipe}
          isRetrying={isRetryingSwipe}
        />

        <SwipeDebugPanel
          active={activeCardRaw ? {
            deckId: activeCardRaw.deckId ?? null,
            recRequestId: activeCardRaw.recRequestId ?? null,
            position: activeCardRaw.position ?? null,
            dedupeKey: (activeCardRaw.dedupeKey ?? (activeCardRaw as any).dedupe_key) ?? null,
            mediaItemId: activeCardRaw.id ?? null,
            source: activeCardRaw.source ?? null,
          } : null}
        />
      </div>

      <div className="relative z-10 flex flex-1 min-h-0 flex-col overflow-visible px-[var(--mn-swipe-pad)]">
        {/* (Mock parity) hide deck indicator */}

        <div
          className="relative flex flex-1 min-h-0 items-center justify-center overflow-visible [perspective:1400px]"
          aria-live="polite"
        >
          {isLoading && !activeCard && !isError && <LoadingScreen />}

          {isError && !isLoading && (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
              <MaterialIcon name="info" className="text-[32px] text-amber-400" />
              <p>We couldn&apos;t load your swipe deck.</p>
              <button
                type="button"
                onClick={() => fetchMore(32)}
                className="mt-1 rounded-md border border-border px-3 py-1.5 text-[12px] font-semibold text-foreground hover:bg-card/70"
              >
                Retry
              </button>
            </div>
          )}

          {!isLoading && !isError && !activeCard && (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
              <MaterialIcon name="auto_awesome" className="text-[32px] text-primary" />
              <p>All caught up. New cards will appear soon.</p>
              <button
                type="button"
                onClick={() => fetchMore(36)}
                className="mt-1 rounded-md border border-border px-3 py-1.5 text-[12px] font-semibold text-foreground hover:bg-card/70"
              >
                Refresh deck
              </button>
            </div>
          )}

          {!isLoading && activeCard && (
            <>
              {/* active card */}
              {/*
               * Use viewport-based height instead of percentage height.
               * Percentage heights can resolve unexpectedly when an ancestor's height is
               * min-height/flex-driven (common on mobile), leading to cards collapsing or
               * expanding with content (especially in details mode).
               */}
              {/*
               * Keep the card tall but not full-screen.
               * Use dvh where supported (mobile-safe), with vh as a fallback.
               */}
              <div className="relative z-10 mx-auto h-full max-h-[720px] w-full max-w-md">
                {/* next card preview (shows the upcoming card) */}
                {nextCard && (
                  <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                    {(() => {
                      const card = nextCard;
                      if (!card) return null;

                      const nextFriendLikesCount =
                        typeof card.friendLikesCount === "number"
                          ? card.friendLikesCount
                          : Array.isArray(card.friendProfiles)
                            ? card.friendProfiles.length
                            : 0;

                      const nextFriendsLikedPercent =
                        friendCount > 0
                          ? Math.round((nextFriendLikesCount / Math.max(1, friendCount)) * 100)
                          : 0;

                      const nextImdb =
                        typeof card.imdbRating === "number" && !Number.isNaN(card.imdbRating)
                          ? card.imdbRating
                          : (nextDetailImdb ?? null);

                      const nextRt =
                        typeof card.rtTomatoMeter === "number" && !Number.isNaN(card.rtTomatoMeter)
                          ? card.rtTomatoMeter
                          : (nextDetailRt ?? null);

                      const nextMatch = computeMatchPercent({
                        card: card,
                        friendCount,
                        imdb: nextImdb,
                        rt: nextRt,
                      });

                      const nextGenreTags = (() => {
                        const fromCard = Array.isArray(card.genres) ? card.genres : [];
                        const fromOmdb =
                          nextPreviewDetail?.omdb_genre != null
                            ? String(nextPreviewDetail.omdb_genre)
                                .split(",")
                                .map((g) => g.trim())
                                .filter(Boolean)
                            : [];

                        const src = fromCard.length > 0 ? fromCard : fromOmdb;
                        return src
                          .map((g) => String(g ?? "").trim())
                          .filter(Boolean)
                          .slice(0, 3);
                      })();

                      return (
                        <div
                          ref={nextPreviewRef}
                          className="absolute inset-0"
                          style={{ filter: "brightness(0.68) saturate(0.9)", willChange: "filter" }}
                        >
                          <div className="relative h-full w-full rounded-[var(--mn-swipe-radius)] bg-gradient-to-b from-white/10 via-primary/25 to-white/10 p-[1.25px] shadow-[0_30px_90px_rgba(0,0,0,0.75)]">
                            <div className="relative h-full w-full overflow-hidden rounded-[var(--mn-swipe-radius)] bg-background/20 backdrop-blur-sm">
                              {showNextPoster && card.posterUrl ? (
                                <img
                                  src={card.posterUrl}
                                  alt={buildSwipeCardLabel(card) ?? `${card.title} poster`}
                                  className="h-full w-full object-cover"
                                  draggable={false}
                                  loading="lazy"
                                  onError={() => updatePosterFailure(card.id, true)}
                                />
                              ) : (
                                <div className="h-full w-full">
                                  <PosterFallback title={card.title} />
                                </div>
                              )}

                              {/* overall dark overlay */}
                              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 via-black/20 to-black/70" />

                              {/* friends pill (top-left) - ONLY for friends mode */}
                              {card.source === "from-friends" && (
                                <div className="absolute left-[var(--mn-swipe-pad)] top-[var(--mn-swipe-pad)]">
                                  {(() => {
                                    const topFriend =
                                      card.topFriendName ??
                                      card.friendProfiles?.[0]?.display_name ??
                                      card.friendProfiles?.[0]?.username ??
                                      "";

                                    const extra = Math.max(0, nextFriendLikesCount - 1);
                                    const showFriendIdentity = Boolean(topFriend);
                                    const initial = (
                                      topFriend.trim().charAt(0) || "F"
                                    ).toUpperCase();

                                    return (
                                      <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-2.5 py-2 shadow-sm backdrop-blur-md">
                                        <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-full border border-white/20 bg-white/10 text-sm font-semibold text-white/90">
                                          {showFriendIdentity &&
                                          card.friendProfiles?.[0]?.avatar_url ? (
                                            <img
                                              src={card.friendProfiles[0].avatar_url}
                                              alt={topFriend || "Friend"}
                                              className="h-full w-full object-cover"
                                              loading="lazy"
                                              referrerPolicy="no-referrer"
                                            />
                                          ) : (
                                            <span>{initial}</span>
                                          )}
                                        </div>

                                        {extra > 0 && (
                                          <div className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/10 text-sm font-semibold text-white/90">
                                            +{extra}
                                          </div>
                                        )}

                                        <div className="pr-1 text-sm font-semibold text-white/90">
                                          {showFriendIdentity ? (
                                            <>
                                              <span className="text-primary">{topFriend}</span>
                                              <span className="text-white/80">
                                                {" "}
                                                &amp; others watched
                                              </span>
                                            </>
                                          ) : (
                                            <span className="text-white/80">From friends</span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              )}

                              {/* bottom gradient + content */}
                              <div className="absolute inset-x-0 bottom-0 px-[var(--mn-swipe-pad)] pb-[var(--mn-swipe-pad)]">
                                <div
                                  aria-hidden="true"
                                  className="pointer-events-none absolute inset-x-0 bottom-0 h-[72%] bg-gradient-to-t from-black/85 via-black/40 to-transparent"
                                />

                                <div className="relative">
                                  {(() => {
                                    const src = card.source ?? "for-you";
                                    const cfg =
                                      src === "trending"
                                        ? { label: "Trending", icon: "local_fire_department" }
                                        : src === "popular"
                                          ? { label: "Popular", icon: "stars" }
                                          : src === "from-friends"
                                            ? { label: "From Friends", icon: "group" }
                                            : { label: "For You", icon: "auto_awesome" };

                                    return (
                                      <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/25 px-3 py-1.5 text-[length:var(--mn-swipe-chip)] font-semibold text-primary-foreground backdrop-blur">
                                        <MaterialIcon
                                          name={cfg.icon}
                                          filled
                                          className="text-[18px]"
                                        />
                                        <span className="tracking-[0.12em]">{cfg.label}</span>
                                        <span className="text-white/35">•</span>
                                        <span className="font-semibold text-emerald-300">
                                          {nextMatch}% Match
                                        </span>
                                      </div>
                                    );
                                  })()}

                                  <h2 className="line-clamp-2 text-[length:var(--mn-swipe-title)] font-extrabold leading-[1.02] text-white">
                                    {card.title}
                                  </h2>

                                  {nextDetailDirector && (
                                    <p className="mt-1 text-[length:var(--mn-swipe-subtitle)] font-semibold text-white/60">
                                      Directed by {nextDetailDirector.split(",")[0]}
                                    </p>
                                  )}

                                  <div className="mt-4 text-[length:var(--mn-swipe-meta)] text-white/70 whitespace-nowrap overflow-hidden text-ellipsis">
                                    {[
                                      card.year ? <span key="y">{card.year}</span> : null,
                                      nextImdb != null ? (
                                        <span key="i" className="text-white/70">
                                          IMDb {String(nextImdb.toFixed(1))}
                                        </span>
                                      ) : null,
                                      nextRt != null ? (
                                        <span key="r" className="text-white/70">
                                          RT {Math.round(nextRt)}%
                                        </span>
                                      ) : null,
                                      typeof card.runtimeMinutes === "number" &&
                                      card.runtimeMinutes > 0 ? (
                                        <span key="t">{formatRuntime(card.runtimeMinutes)}</span>
                                      ) : null,
                                    ]
                                      .filter(Boolean)
                                      .map((node, idx) => (
                                        <React.Fragment key={idx}>
                                          {idx > 0 && <span className="mx-1 text-white/30">•</span>}
                                          {node as any}
                                        </React.Fragment>
                                      ))}
                                  </div>

                                  {/* friends module (hidden when no friends data) */}
                                  {Array.isArray(card.friendProfiles) &&
                                    card.friendProfiles.length > 0 && (
                                      <div
                                        className="mt-5 flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-left backdrop-blur-md"
                                        aria-label="Friends summary"
                                      >
                                        <div className="flex items-center gap-3">
                                          <FriendAvatarStack
                                            profiles={card.friendProfiles}
                                            max={3}
                                            size={32}
                                          />
                                          <div className="leading-tight">
                                            <p className="text-[length:var(--mn-swipe-subtitle)] font-extrabold text-white">
                                              {clamp(Math.round(nextFriendsLikedPercent), 0, 100)}%
                                              of friends
                                            </p>
                                            <p className="text-sm font-semibold text-white/60">
                                              {card.source === "from-friends" ? "watched" : "liked"}{" "}
                                              this title
                                            </p>
                                          </div>
                                        </div>
                                        <div className="grid h-[var(--mn-swipe-hit)] w-[var(--mn-swipe-hit)] place-items-center rounded-full border border-white/10 bg-white/10 text-white/70">
                                          <MaterialIcon
                                            name="chevron_right"
                                            className="text-[length:var(--mn-swipe-top-icon)]"
                                          />
                                        </div>
                                      </div>
                                    )}

                                  {/* genre chips */}
                                  {nextGenreTags.length > 0 && (
                                    <div className="mt-4 flex flex-wrap gap-3">
                                      {nextGenreTags.map((g) => (
                                        <span
                                          key={g}
                                          className="inline-flex items-center rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[length:var(--mn-swipe-chip)] font-semibold text-white/75"
                                        >
                                          #{g}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                <div className="relative h-full w-full rounded-[var(--mn-swipe-radius)] bg-gradient-to-b from-white/10 via-primary/25 to-white/10 p-[1.25px] shadow-[0_30px_90px_rgba(0,0,0,0.75)]">
                  <article
                    key={activeTitleId ?? "empty"}
                    ref={cardRef}
                    role="group"
                    aria-roledescription="Movie card"
                    aria-label={buildSwipeCardLabel(activeCard)}
                    className={`relative h-full w-full select-none overflow-hidden rounded-[var(--mn-swipe-radius)] bg-background/20 backdrop-blur-sm transform-gpu will-change-transform ${isDetailMode ? "ring-1 ring-primary/40" : ""}`}
                    onPointerDown={(e) => {
                      if (e.pointerType === "mouse" && e.button !== 0) return;
                      handlePointerDown(
                        e.clientX,
                        e.clientY,
                        e.pointerId,
                        e.target,
                        e.pointerType,
                        e.isPrimary,
                        (e as any).width,
                        (e as any).height,
                      );
                    }}
                    onPointerMove={(e) =>
                      handlePointerMove(
                        e.clientX,
                        e.clientY,
                        e.pointerId,
                        e.pointerType,
                        e.isPrimary,
                        (e as any).width,
                        (e as any).height,
                      )
                    }
                    onPointerUp={(e) => finishDrag(e.pointerId, e.clientX, e.clientY)}
                    onPointerCancel={(e) => finishDrag(e.pointerId, e.clientX, e.clientY)}
                    onMouseMove={handleMouseMoveOnCard}
                    onMouseLeave={handleMouseLeaveCard}
                    style={{
                      touchAction: isDetailMode ? "pan-y" : "none",
                      overscrollBehavior: "contain",
                      userSelect: "none",
                      WebkitUserSelect: "none",
                    }}
                  >
                    <div
                      ref={burstLayerRef}
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
                    />

                    {/* Ambient glow + specular highlight (micro-details) */}
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-[-48px] z-[1]"
                    >
                      <div
                        className="absolute inset-0 blur-3xl bg-emerald-400/30"
                        style={{ opacity: "var(--mn-swipe-like-opacity, 0)" }}
                      />
                      <div
                        className="absolute inset-0 blur-3xl bg-rose-400/30"
                        style={{ opacity: "var(--mn-swipe-nope-opacity, 0)" }}
                      />
                    </div>
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 z-[19]"
                      style={{
                        background:
                          "radial-gradient(circle at var(--mn-swipe-spec-x, 50%) var(--mn-swipe-spec-y, 30%), rgba(255,255,255,0.35), rgba(255,255,255,0) 55%)",
                        opacity: "var(--mn-swipe-spec-o, 0)",
                        mixBlendMode: "soft-light",
                      }}
                    />
                    {/* SWIPE MODE (matches mock) */}
                    {!isDetailMode && (
                      <div className="relative z-[2] h-full w-full">
                        {showActivePoster && activeCard.posterUrl ? (
                          <img
                            src={activeCard.posterUrl}
                            alt={buildSwipeCardLabel(activeCard) ?? `${activeCard.title} poster`}
                            className="h-full w-full object-cover"
                            style={{
                              transform:
                                "translate3d(var(--mn-swipe-poster-parallax, 0px), var(--mn-swipe-poster-parallax-y, 0px), 0) scale(1.035)",
                              willChange: "transform",
                            }}
                            draggable={false}
                            loading="lazy"
                            onError={() => setActivePosterFailed(true)}
                          />
                        ) : (
                          <div
                            className="h-full w-full"
                            style={{
                              transform:
                                "translate3d(var(--mn-swipe-poster-parallax, 0px), var(--mn-swipe-poster-parallax-y, 0px), 0) scale(1.02)",
                              willChange: "transform",
                            }}
                          >
                            <PosterFallback title={activeCard.title} />
                          </div>
                        )}

                        {/* overall dark overlay */}
                        <div
                          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 via-black/20 to-black/70"
                          style={{
                            transform: "translate3d(var(--mn-swipe-bg-parallax, 0px), 0, 0)",
                            willChange: "transform",
                          }}
                        />

                        {/* swipe intent overlays (opacity driven by CSS vars for smoothness) */}
                        <div className="pointer-events-none absolute inset-x-[calc(var(--mn-swipe-pad)*1.2)] top-[calc(var(--mn-swipe-pad)*0.8)] flex justify-start">
                          <div
                            className={`flex items-center gap-2 rounded-md bg-emerald-500/14 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-200 shadow-md backdrop-blur-sm ${isDragging ? "" : "transition-[opacity,transform] duration-200"}`}
                            style={{
                              opacity: "var(--mn-swipe-like-opacity, 0)",
                              transform:
                                "translate3d(0,0,0) scale(var(--mn-swipe-like-scale, 0.96))",
                            }}
                          >
                            <MaterialIcon
                              name="favorite"
                              filled
                              className="text-[18px] text-emerald-300"
                            />
                            <span>Love it</span>
                          </div>
                        </div>

                        <div className="pointer-events-none absolute inset-x-[calc(var(--mn-swipe-pad)*1.2)] top-[calc(var(--mn-swipe-pad)*0.8)] flex justify-end">
                          <div
                            className={`flex items-center gap-2 rounded-md bg-rose-500/14 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-rose-200 shadow-md backdrop-blur-sm ${isDragging ? "" : "transition-[opacity,transform] duration-200"}`}
                            style={{
                              opacity: "var(--mn-swipe-nope-opacity, 0)",
                              transform:
                                "translate3d(0,0,0) scale(var(--mn-swipe-nope-scale, 0.96))",
                            }}
                          >
                            <MaterialIcon name="close" className="text-[18px] text-rose-300" />
                            <span>No thanks</span>
                          </div>
                        </div>

                        {/* friends pill (top-left) - ONLY for friends mode */}
                        {activeCard.source === "from-friends" && (
                          <div className="absolute left-[var(--mn-swipe-pad)] top-[var(--mn-swipe-pad)]">
                            {(() => {
                              const topFriend =
                                activeCard.topFriendName ??
                                activeCard.friendProfiles?.[0]?.display_name ??
                                activeCard.friendProfiles?.[0]?.username ??
                                "";

                              const extra = Math.max(0, friendLikesCount - 1);
                              const showFriendIdentity = Boolean(topFriend);
                              const initial = (topFriend.trim().charAt(0) || "F").toUpperCase();

                              return (
                                <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-2.5 py-2 shadow-sm backdrop-blur-md">
                                  <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-full border border-white/20 bg-white/10 text-sm font-semibold text-white/90">
                                    {showFriendIdentity &&
                                    activeCard.friendProfiles?.[0]?.avatar_url ? (
                                      <img
                                        src={activeCard.friendProfiles[0].avatar_url}
                                        alt={topFriend || "Friend"}
                                        className="h-full w-full object-cover"
                                        loading="lazy"
                                        referrerPolicy="no-referrer"
                                      />
                                    ) : (
                                      <span>{initial}</span>
                                    )}
                                  </div>

                                  {extra > 0 && (
                                    <div className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/10 text-sm font-semibold text-white/90">
                                      +{extra}
                                    </div>
                                  )}

                                  <div className="pr-1 text-sm font-semibold text-white/90">
                                    {showFriendIdentity ? (
                                      <>
                                        <span className="text-primary">{topFriend}</span>
                                        <span className="text-white/80"> &amp; others watched</span>
                                      </>
                                    ) : (
                                      <span className="text-white/80">From friends</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        )}

                        {/* bottom gradient + content */}
                        <div className="absolute inset-x-0 bottom-0 px-[var(--mn-swipe-pad)] pb-[var(--mn-swipe-pad)]">
                          <div
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-x-0 bottom-0 h-[72%] bg-gradient-to-t from-black/85 via-black/40 to-transparent"
                          />

                          <div className="relative">
                            {(() => {
                              const src = activeCard.source ?? "for-you";
                              const cfg =
                                src === "trending"
                                  ? { label: "Trending", icon: "local_fire_department" }
                                  : src === "popular"
                                    ? { label: "Popular", icon: "stars" }
                                    : src === "from-friends"
                                      ? { label: "From Friends", icon: "group" }
                                      : { label: "For You", icon: "auto_awesome" };

                              return (
                                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/25 px-3 py-1.5 text-[length:var(--mn-swipe-chip)] font-semibold text-primary-foreground backdrop-blur">
                                  <MaterialIcon name={cfg.icon} filled className="text-[18px]" />
                                  <span className="tracking-[0.12em]">{cfg.label}</span>
                                  <span className="text-white/35">•</span>
                                  <span className="font-semibold text-emerald-300">
                                    {matchPercent}% Match
                                  </span>
                                </div>
                              );
                            })()}

                            <div className="flex items-start justify-between gap-3">
                              <h2 className="min-w-0 line-clamp-2 text-[length:var(--mn-swipe-title)] font-extrabold leading-[1.02] text-white">
                                {activeCard.title}
                              </h2>
                              <span className="shrink-0 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[length:var(--mn-swipe-chip)] font-extrabold tracking-[0.14em] text-white/75">
                                {typeBadgeLabel}
                              </span>
                            </div>

                            {detailDirector && (
                              <p className="mt-1 text-[length:var(--mn-swipe-subtitle)] font-semibold text-white/60">
                                Directed by {detailDirector.split(",")[0]}
                              </p>
                            )}

                            {metaLine && (
                              <div className="mt-4 text-[length:var(--mn-swipe-meta)] text-white/70 whitespace-nowrap overflow-hidden text-ellipsis">
                                {metaLine}
                              </div>
                            )}

                            {/* friends module (hidden when no friends data) */}
                            {Array.isArray(activeCard.friendProfiles) &&
                              activeCard.friendProfiles.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setIsFriendsModalOpen(true)}
                                  className="mt-5 flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-left backdrop-blur-md"
                                  aria-label="See friends"
                                  data-swipe-interactive="true"
                                >
                                  <div className="flex items-center gap-3">
                                    <FriendAvatarStack
                                      profiles={activeCard.friendProfiles}
                                      max={3}
                                      size={32}
                                    />
                                    <div className="leading-tight">
                                      <p className="text-[length:var(--mn-swipe-subtitle)] font-extrabold text-white">
                                        {clamp(Math.round(friendsLikedPercent), 0, 100)}% of friends
                                      </p>
                                      <p className="text-sm font-semibold text-white/60">
                                        {activeCard.source === "from-friends" ? "watched" : "liked"}{" "}
                                        this title
                                      </p>
                                    </div>
                                  </div>
                                  <div className="grid h-[var(--mn-swipe-hit)] w-[var(--mn-swipe-hit)] place-items-center rounded-full border border-white/10 bg-white/10 text-white/70">
                                    <MaterialIcon
                                      name="chevron_right"
                                      className="text-[length:var(--mn-swipe-top-icon)]"
                                    />
                                  </div>
                                </button>
                              )}

                            {/* genre chips */}
                            {swipeGenreTags.length > 0 && (
                              <div className="mt-4 flex flex-wrap gap-3">
                                {swipeGenreTags.map((g) => (
                                  <span
                                    key={g}
                                    className="inline-flex items-center rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[length:var(--mn-swipe-chip)] font-semibold text-white/75"
                                  >
                                    #{g}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* DETAIL MODE (keep existing, compact) */}
                    {isDetailMode && activeCard && (
                      <div className="absolute inset-0 z-10 flex h-full flex-col">
                        {/* Render as an absolute overlay and keep the poster as a BACKGROUND so details can use the full card height. */}
                        {/* Poster background (does NOT take layout height) */}
                        <div className="absolute inset-0 z-0 overflow-hidden bg-[#261933]">
                          {showActivePoster && activeCard.posterUrl ? (
                            <img
                              src={activeCard.posterUrl}
                              alt={buildSwipeCardLabel(activeCard) ?? `${activeCard.title} poster`}
                              className="h-full w-full object-cover"
                              draggable={false}
                              loading="lazy"
                              onError={() => setActivePosterFailed(true)}
                              style={{
                                filter: "blur(6px) brightness(0.60)",
                                transform: "scale(1.14)",
                              }}
                            />
                          ) : (
                            <PosterFallback title={activeCard.title} />
                          )}
                          <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-black/10 via-black/60 to-[#261933]" />
                        </div>

                        {/* Close button (floats above everything) */}
                        <button
                          type="button"
                          onClick={() => setIsDetailMode(false)}
                          className="absolute right-[var(--mn-swipe-pad)] top-[var(--mn-swipe-pad)] z-20 inline-flex h-[var(--mn-swipe-top-hit)] w-[var(--mn-swipe-top-hit)] items-center justify-center rounded-full border border-white/10 bg-white/10 text-white/80 backdrop-blur hover:bg-white/15"
                          aria-label="Close details"
                          data-swipe-interactive="true"
                        >
                          <MaterialIcon
                            name="close"
                            className="text-[length:var(--mn-swipe-top-icon)]"
                          />
                        </button>

                        {/* Foreground content (fills the full card; no dead space above) */}
                        <div className="relative z-10 flex min-h-0 flex-1 flex-col px-[var(--mn-swipe-pad)] pb-[var(--mn-swipe-pad)] pt-[calc(var(--mn-swipe-top-hit)+var(--mn-swipe-pad)*0.75)]">
                          {/* readable surface */}
                          <div
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-[#261933]/35 via-[#261933]/90 to-[#261933]"
                          />
                          <div
                            ref={detailContentRef}
                            id="swipe-detail-panel"
                            aria-label={isFullDetailOpen ? "Full details" : "Details summary"}
                            aria-live="polite"
                            className="relative z-10 mt-1 flex min-h-0 flex-1 flex-col text-left text-[13px] text-white/70"
                          >
                            <div
                              data-swipe-interactive="true"
                              className="flex min-h-0 flex-1 flex-col overflow-hidden"
                            >
                              {!isFullDetailOpen ? (
                                /* DETAILS (no scroll): show the most useful info, clamp long text */
                                <div className="flex min-h-0 flex-1 flex-col gap-3">
                                  {/* Header */}
                                  <div className="shrink-0 space-y-2">
                                    {(() => {
                                      const src = activeCard.source ?? "for-you";
                                      const cfg =
                                        src === "trending"
                                          ? { label: "Trending", icon: "local_fire_department" }
                                          : src === "popular"
                                            ? { label: "Popular", icon: "stars" }
                                            : src === "from-friends"
                                              ? { label: "From Friends", icon: "group" }
                                              : { label: "For You", icon: "auto_awesome" };

                                      return (
                                        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-[calc(var(--mn-swipe-pad)*0.75)] py-[calc(var(--mn-swipe-pad)*0.25)] text-[length:var(--mn-swipe-chip)] font-semibold text-white/80">
                                          <MaterialIcon
                                            name={cfg.icon}
                                            filled
                                            className="text-[length:calc(var(--mn-swipe-chip)+0.25rem)]"
                                          />
                                          <span className="tracking-[0.12em]">{cfg.label}</span>
                                          <span className="text-white/35">•</span>
                                          <span className="font-semibold text-emerald-300">
                                            {matchPercent}% Match
                                          </span>
                                        </div>
                                      );
                                    })()}

                                    <div className="flex items-start justify-between gap-3">
                                      <h3 className="min-w-0 line-clamp-2 text-[clamp(1.25rem,5vw,1.75rem)] font-extrabold leading-[1.06] text-white">
                                        {activeCard.title}
                                      </h3>
                                      <span className="shrink-0 rounded-full border border-white/10 bg-white/10 px-[calc(var(--mn-swipe-pad)*0.7)] py-[calc(var(--mn-swipe-pad)*0.22)] text-[length:var(--mn-swipe-chip)] font-extrabold tracking-[0.14em] text-white/75">
                                        {typeBadgeLabel}
                                      </span>
                                    </div>

                                    {metaLine && (
                                      <p className="text-[clamp(0.78rem,2.8vw,0.95rem)] text-white/60 whitespace-nowrap overflow-hidden text-ellipsis">
                                        {metaLine}
                                      </p>
                                    )}

                                    <div className="flex flex-wrap items-center gap-1.5 text-[clamp(0.70rem,2.6vw,0.8rem)] text-white/65">
                                      {detailGenres && (
                                        <div className="flex min-w-0 flex-1 items-center gap-2">
                                          <span className="shrink-0 font-semibold text-white/75">
                                            Genres
                                          </span>
                                          <span className="min-w-0 flex-1 truncate">
                                            {Array.isArray(detailGenres)
                                              ? (detailGenres as string[]).slice(0, 3).join(", ")
                                              : String(detailGenres)
                                                  .split(",")
                                                  .map((g) => g.trim())
                                                  .slice(0, 3)
                                                  .join(", ")}
                                          </span>
                                        </div>
                                      )}
                                      {detailCertification && (
                                        <span className="rounded-full border border-white/10 bg-white/10 px-2 py-0.5 font-semibold text-white/85">
                                          {detailCertification}
                                        </span>
                                      )}
                                      {detailPrimaryCountryAbbr && (
                                        <span className="rounded-full border border-white/10 bg-white/10 px-2 py-0.5 font-semibold text-white/70">
                                          {detailPrimaryCountryAbbr}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Overview (fills remaining space, no scroll). Hard-clamp with an inline fallback to avoid any overlap on mobile. */}
                                  {detailOverview ? (
                                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/10 px-3 py-2">
                                      <p className="text-[length:var(--mn-swipe-kicker)] font-semibold uppercase tracking-[0.16em] text-white/45">
                                        Overview
                                      </p>
                                      <p
                                        className="mt-1 min-h-0 flex-1 overflow-hidden text-[clamp(0.82rem,2.9vw,0.95rem)] leading-relaxed text-white/70"
                                        style={
                                          {
                                            display: "-webkit-box",
                                            WebkitBoxOrient: "vertical",
                                            WebkitLineClamp: detailOverviewClampLines,
                                            overflow: "hidden",
                                          } as any
                                        }
                                      >
                                        {detailOverview}
                                      </p>
                                    </div>
                                  ) : (
                                    <div className="min-h-0 flex-1" />
                                  )}

                                  {/* Compact credits */}
                                  {detailDirector || detailActors ? (
                                    <div className="shrink-0 min-w-0 space-y-1 text-[clamp(0.70rem,2.6vw,0.78rem)] text-white/70">
                                      {detailDirector && (
                                        <p className="line-clamp-1 min-w-0">
                                          <span className="font-semibold text-white/75">
                                            Director:
                                          </span>{" "}
                                          <span className="min-w-0">{detailDirector}</span>
                                        </p>
                                      )}
                                      {detailActors && (
                                        <p className="line-clamp-1 min-w-0">
                                          <span className="font-semibold text-white/75">Cast:</span>{" "}
                                          <span className="min-w-0">
                                            {detailActors
                                              .split(",")
                                              .map((a) => a.trim())
                                              .filter(Boolean)
                                              .slice(0, 4)
                                              .join(", ")}
                                          </span>
                                        </p>
                                      )}
                                    </div>
                                  ) : null}

                                  {/* Actions pinned to the bottom */}
                                  <div className="shrink-0 space-y-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5">
                                        <span className="text-[length:var(--mn-swipe-chip)] font-semibold text-white/50">
                                          Your rating
                                        </span>
                                        <div
                                          className="flex items-center gap-0.5"
                                          aria-label="Your rating"
                                        >
                                          {Array.from({ length: 5 }).map((_, idx) => {
                                            const value = idx + 1;
                                            const filled =
                                              currentUserRating != null &&
                                              currentUserRating >= value;
                                            return (
                                              <button
                                                key={value}
                                                type="button"
                                                onClick={() => handleStarClick(value)}
                                                className="flex h-[var(--mn-swipe-star-hit)] w-[var(--mn-swipe-star-hit)] items-center justify-center rounded-full hover:scale-105 focus-visible:outline-none"
                                              >
                                                <MaterialIcon
                                                  name="star"
                                                  filled={filled}
                                                  className={`text-[length:var(--mn-swipe-star-icon)] ${filled ? "text-yellow-400" : "text-white/30"}`}
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
                                          className={`inline-flex items-center rounded-full px-[calc(var(--mn-swipe-pad)*0.6)] py-[calc(var(--mn-swipe-pad)*0.22)] text-[length:var(--mn-swipe-chip)] font-semibold transition-colors ${
                                            statusIs(WATCHLIST_STATUS)
                                              ? "bg-primary/90 text-primary-foreground"
                                              : "border border-white/10 bg-white/10 text-white/75 hover:bg-white/15"
                                          }`}
                                        >
                                          Watchlist
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setDiaryStatus(WATCHED_STATUS)}
                                          className={`inline-flex items-center rounded-full px-[calc(var(--mn-swipe-pad)*0.6)] py-[calc(var(--mn-swipe-pad)*0.22)] text-[length:var(--mn-swipe-chip)] font-semibold transition-colors ${
                                            statusIs(WATCHED_STATUS)
                                              ? "bg-emerald-500/90 text-primary-foreground"
                                              : "border border-white/10 bg-white/10 text-white/75 hover:bg-white/15"
                                          }`}
                                        >
                                          Watched
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setIsShareSheetOpen(true)}
                                          className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/10 px-[calc(var(--mn-swipe-pad)*0.6)] py-[calc(var(--mn-swipe-pad)*0.22)] text-[length:var(--mn-swipe-chip)] font-semibold text-white/75 hover:bg-white/15"
                                        >
                                          <MaterialIcon
                                            name="share"
                                            className="text-[length:calc(var(--mn-swipe-chip)+0.2rem)]"
                                          />
                                          <span>Share</span>
                                        </button>
                                      </div>
                                    </div>

                                    {/* Friends info (fixed height; no expand, no scroll) */}
                                    {(typeof activeCard.friendLikesCount === "number" &&
                                      activeCard.friendLikesCount > 0) ||
                                    (activeCard.topFriendName &&
                                      activeCard.topFriendReviewSnippet) ? (
                                      <div className="rounded-2xl border border-white/10 bg-white/10 px-[calc(var(--mn-swipe-pad)*0.75)] py-[calc(var(--mn-swipe-pad)*0.5)] text-[length:var(--mn-swipe-chip)] text-white/80 shadow-md">
                                        {typeof activeCard.friendLikesCount === "number" &&
                                          activeCard.friendLikesCount > 0 && (
                                            <div className="inline-flex items-center gap-1 text-[length:var(--mn-swipe-chip)] text-white/60">
                                              <MaterialIcon
                                                name="local_fire_department"
                                                filled
                                                className="text-[16px] text-primary/80"
                                              />
                                              {activeCard.friendLikesCount === 1
                                                ? "1 friend likes this"
                                                : `${activeCard.friendLikesCount} friends like this`}
                                            </div>
                                          )}
                                        {activeCard.topFriendName &&
                                          activeCard.topFriendReviewSnippet && (
                                            <div className="mt-1 inline-flex w-full items-start gap-2 text-left">
                                              <MaterialIcon
                                                name="check_circle"
                                                filled
                                                className="mt-0.5 text-[16px] text-primary"
                                              />
                                              <span className="block line-clamp-2 text-[length:var(--mn-swipe-chip)]">
                                                {activeCard.topFriendName}: “
                                                {activeCard.topFriendReviewSnippet}”
                                              </span>
                                            </div>
                                          )}
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              ) : (
                                <div className="flex min-h-0 flex-1 flex-col gap-3">
                                  {/* FULL DETAILS (no scroll): compact grid, clamp values */}
                                  <div className="shrink-0 space-y-2">
                                    {(() => {
                                      const src = activeCard.source ?? "for-you";
                                      const cfg =
                                        src === "trending"
                                          ? { label: "Trending", icon: "local_fire_department" }
                                          : src === "popular"
                                            ? { label: "Popular", icon: "stars" }
                                            : src === "from-friends"
                                              ? { label: "From Friends", icon: "group" }
                                              : { label: "For You", icon: "auto_awesome" };

                                      return (
                                        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-[calc(var(--mn-swipe-pad)*0.75)] py-[calc(var(--mn-swipe-pad)*0.25)] text-[length:var(--mn-swipe-chip)] font-semibold text-white/80">
                                          <MaterialIcon
                                            name={cfg.icon}
                                            filled
                                            className="text-[length:calc(var(--mn-swipe-chip)+0.25rem)]"
                                          />
                                          <span className="tracking-[0.12em]">{cfg.label}</span>
                                          <span className="text-white/35">•</span>
                                          <span className="font-semibold text-emerald-300">
                                            {matchPercent}% Match
                                          </span>
                                        </div>
                                      );
                                    })()}

                                    <div className="flex items-start justify-between gap-3">
                                      <h3 className="min-w-0 line-clamp-1 text-[clamp(1.05rem,4.6vw,1.35rem)] font-extrabold text-white">
                                        {activeCard.title}
                                      </h3>
                                      <span className="shrink-0 rounded-full border border-white/10 bg-white/10 px-[calc(var(--mn-swipe-pad)*0.7)] py-[calc(var(--mn-swipe-pad)*0.22)] text-[length:var(--mn-swipe-chip)] font-extrabold tracking-[0.14em] text-white/75">
                                        {typeBadgeLabel}
                                      </span>
                                    </div>

                                    {metaLine && (
                                      <p className="text-[length:var(--mn-swipe-meta)] text-white/55 whitespace-nowrap overflow-hidden text-ellipsis">
                                        {metaLine}
                                      </p>
                                    )}
                                  </div>

                                  <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
                                    <div className="shrink-0 grid grid-cols-2 gap-x-3 gap-y-2 rounded-2xl border border-white/10 bg-white/10 px-[calc(var(--mn-swipe-pad)*0.75)] py-[calc(var(--mn-swipe-pad)*0.5)] text-[length:var(--mn-swipe-chip)] leading-snug text-white/75">
                                      {(() => {
                                        const tiles: Array<{ label: string; value: string }> = [];

                                        if (moreGenres.length > 0) {
                                          tiles.push({
                                            label: "Genres",
                                            value: moreGenres.slice(0, 6).join(", "),
                                          });
                                        }
                                        if (languages.length > 0) {
                                          tiles.push({
                                            label: "Languages",
                                            value: languages.slice(0, 4).join(", "),
                                          });
                                        }
                                        if (detailDirector) {
                                          tiles.push({ label: "Director", value: detailDirector });
                                        }
                                        if (detailWriter) {
                                          tiles.push({ label: "Writers", value: detailWriter });
                                        }
                                        if (detailActors) {
                                          const allNames = detailActors
                                            .split(",")
                                            .map((a) => a.trim())
                                            .filter(Boolean);
                                          const extra = allNames.slice(3);
                                          if (extra.length > 0) {
                                            tiles.push({
                                              label: "More cast",
                                              value: extra.slice(0, 8).join(", "),
                                            });
                                          }
                                        }
                                        if (detailReleased) {
                                          tiles.push({ label: "Released", value: detailReleased });
                                        }
                                        if (detailAwards) {
                                          tiles.push({ label: "Awards", value: detailAwards });
                                        }
                                        if (detailBoxOffice) {
                                          tiles.push({
                                            label: "Box office",
                                            value: detailBoxOffice,
                                          });
                                        }
                                        if (
                                          externalImdbRating &&
                                          safeNumber(externalImdbRating) != null
                                        ) {
                                          tiles.push({
                                            label: "IMDb",
                                            value: String(
                                              safeNumber(externalImdbRating)?.toFixed(1),
                                            ),
                                          });
                                        }
                                        if (externalTomato && safeNumber(externalTomato) != null) {
                                          tiles.push({
                                            label: "RT",
                                            value: `${String(safeNumber(externalTomato))}%`,
                                          });
                                        }
                                        if (imdbVotes && formatInt(imdbVotes)) {
                                          tiles.push({
                                            label: "IMDb votes",
                                            value: String(formatInt(imdbVotes)),
                                          });
                                        }
                                        if (
                                          externalMetascore &&
                                          safeNumber(externalMetascore) != null
                                        ) {
                                          tiles.push({
                                            label: "Metascore",
                                            value: String(safeNumber(externalMetascore)),
                                          });
                                        }

                                        return tiles.slice(0, 10).map((tile) => (
                                          <div key={tile.label} className="min-w-0">
                                            <p className="text-[length:var(--mn-swipe-kicker)] font-semibold uppercase tracking-[0.14em] text-white/45">
                                              {tile.label}
                                            </p>
                                            <p className="line-clamp-2">{tile.value}</p>
                                          </div>
                                        ));
                                      })()}
                                    </div>

                                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/10 px-3 py-2">
                                      <p className="text-[length:var(--mn-swipe-kicker)] font-semibold uppercase tracking-[0.14em] text-white/45">
                                        Overview
                                      </p>
                                      {detailOverview ? (
                                        <p
                                          className="mt-1 min-h-0 flex-1 overflow-hidden text-[length:var(--mn-swipe-meta)] leading-relaxed text-white/70"
                                          style={
                                            {
                                              display: "-webkit-box",
                                              WebkitBoxOrient: "vertical",
                                              WebkitLineClamp: fullOverviewClampLines,
                                              overflow: "hidden",
                                            } as any
                                          }
                                        >
                                          {detailOverview}
                                        </p>
                                      ) : (
                                        <p className="mt-1 text-[length:var(--mn-swipe-meta)] text-white/40">
                                          No overview available.
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="mt-2 flex shrink-0 justify-end">
                              <button
                                type="button"
                                onClick={() => setIsFullDetailOpen((val) => !val)}
                                aria-expanded={isFullDetailOpen}
                                aria-controls="swipe-detail-panel"
                                className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-[calc(var(--mn-swipe-pad)*0.6)] py-[calc(var(--mn-swipe-pad)*0.22)] text-[length:var(--mn-swipe-chip)] font-semibold text-white/70 hover:bg-white/10 hover:text-white"
                              >
                                <span>{isFullDetailOpen ? "Collapse" : "Full details"}</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </article>
                </div>
              </div>

              {showOnboarding && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-gradient-to-b from-background/70 via-background/50 to-background/80">
                  <div className="pointer-events-auto max-w-xs rounded-2xl border border-border bg-background/95 p-4 text-center shadow-lg">
                    <p className="text-sm font-semibold text-foreground">Swipe to decide</p>
                    <p className="mt-1 text-[12px] text-muted-foreground">
                      Swipe left to pass, right to save what you love.
                    </p>
                    <button
                      type="button"
                      className="mt-3 w-full rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white shadow-md"
                      onClick={() => {
                        setShowOnboarding(false);
                        if (typeof window !== "undefined") {
                          safeLocalStorageSetItem(ONBOARDING_STORAGE_KEY, "1");
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
        </div>

        {/* Fine-grained feedback actions */}
        <div
          className="mt-3 flex shrink-0 items-center justify-center gap-2"
          aria-label="Recommendation feedback"
        >
          <button
            type="button"
            onClick={() => performSwipe("dislike", 0, "not_interested")}
            disabled={actionsDisabled}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/70 shadow-sm backdrop-blur transition-all duration-150 hover:bg-white/10 active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Not interested"
          >
            <MaterialIcon name="thumb_down" filled className="text-[16px]" />
            Not interested
          </button>
          <button
            type="button"
            onClick={() => performSwipe("like", 0, "more_like_this")}
            disabled={actionsDisabled}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/70 shadow-sm backdrop-blur transition-all duration-150 hover:bg-white/10 active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="More like this"
          >
            <MaterialIcon name="auto_awesome" filled className="text-[16px]" />
            More like this
          </button>
        </div>

        {/* bottom actions (mock parity) */}
        <div
          className="mt-2 flex shrink-0 items-center justify-center gap-[var(--mn-swipe-gap)]"
          aria-label="Swipe actions"
        >
          <button
            type="button"
            onClick={() => performSwipe("dislike")}
            disabled={actionsDisabled}
            className="inline-flex h-[var(--mn-swipe-action)] w-[var(--mn-swipe-action)] items-center justify-center rounded-full border border-white/10 bg-white/10 text-white/60 shadow-md backdrop-blur transition-all duration-150 hover:bg-white/15 active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Dislike"
          >
            <MaterialIcon name="close" className="text-[length:var(--mn-swipe-icon)]" />
          </button>

          <button
            type="button"
            onClick={addToWatchlistAndContinue}
            disabled={actionsDisabled}
            className="relative inline-flex h-[var(--mn-swipe-action-primary)] w-[var(--mn-swipe-action-primary)] items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_22px_55px_rgba(0,0,0,0.55)] transition-all duration-150 hover:brightness-110 active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Add to watchlist"
          >
            <MaterialIcon
              name="bookmark_add"
              filled
              className="text-[length:var(--mn-swipe-icon-primary)]"
            />
          </button>

          <button
            type="button"
            onClick={() => performSwipe("like")}
            disabled={actionsDisabled}
            className="inline-flex h-[var(--mn-swipe-action)] w-[var(--mn-swipe-action)] items-center justify-center rounded-full border border-white/10 bg-white/10 text-white/60 shadow-md backdrop-blur transition-all duration-150 hover:bg-white/15 active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Like"
          >
            <MaterialIcon name="favorite" filled className="text-[length:var(--mn-swipe-icon)]" />
          </button>
        </div>

        <SwipeShareSheet
          isOpen={isShareSheetOpen}
          onClose={() => setIsShareSheetOpen(false)}
          activeCard={activeCard}
          shareUrl={shareUrl}
          onShareExternal={handleShareExternal}
        />
        <FriendsListModal
          open={isFriendsModalOpen}
          onOpenChange={setIsFriendsModalOpen}
          profiles={activeCard?.friendProfiles ?? []}
          verb={activeCard?.source === "from-friends" ? "watched" : "liked"}
        />
        <Dialog open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
          <DialogContent className="max-w-md border border-border/60 bg-card text-foreground">
            <DialogHeader>
              <DialogTitle>Filters</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Fine-tune what shows up in your Discovery deck.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-2 space-y-5">
              {/* Feedback toggles */}
              <div>
                <div className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground">
                  Feedback
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setHapticsEnabled((v) => !v)}
                    className={[
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                      hapticsEnabled
                        ? "border-primary/60 bg-primary/15 text-foreground"
                        : "border-border/60 bg-background/30 text-muted-foreground hover:bg-background/45",
                    ].join(" ")}
                  >
                    <MaterialIcon
                      name={hapticsEnabled ? "vibration" : "vibration"}
                      filled
                      className={
                        "text-[18px] " + (hapticsEnabled ? "text-primary" : "text-muted-foreground")
                      }
                    />
                    Haptics
                  </button>
                  <button
                    type="button"
                    onClick={() => setSfxEnabled((v) => !v)}
                    className={[
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                      sfxEnabled
                        ? "border-primary/60 bg-primary/15 text-foreground"
                        : "border-border/60 bg-background/30 text-muted-foreground hover:bg-background/45",
                    ].join(" ")}
                  >
                    <MaterialIcon
                      name={sfxEnabled ? "volume_up" : "volume_off"}
                      filled
                      className={
                        "text-[18px] " + (sfxEnabled ? "text-primary" : "text-muted-foreground")
                      }
                    />
                    Sound
                  </button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Turn these off if you prefer silent, minimal feedback.
                </p>
              </div>

              {/* Content type (server-side filter) */}
              <div>
                <div className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground">
                  Content type
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "All", value: null },
                    { label: "Movies", value: "movie" },
                    { label: "Series", value: "series" },
                    { label: "Anime", value: "anime" },
                  ].map((opt) => {
                    const active = kindFilter === opt.value;
                    return (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => setKindFilter(opt.value as any)}
                        className={[
                          "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                          active
                            ? "border-primary/60 bg-primary/15 text-foreground"
                            : "border-border/60 bg-background/30 text-muted-foreground hover:bg-background/45",
                        ].join(" ")}
                      >
                        {active ? (
                          <MaterialIcon
                            name="check_circle"
                            filled
                            className="text-[18px] text-primary"
                          />
                        ) : (
                          <span className="h-4 w-4" />
                        )}
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Genres (client-side filter) */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-xs font-semibold tracking-wide text-muted-foreground">
                    Genres
                  </div>
                  {genreFilter.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setGenreFilter([])}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {availableGenres.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Load a few cards to unlock genre filters.
                  </p>
                ) : (
                  <div className="max-h-40 overflow-auto rounded-xl border border-border/60 bg-background/20 p-2">
                    <div className="flex flex-wrap gap-2">
                      {availableGenres.map((g) => {
                        const active = genreFilter.some((x) => x.toLowerCase() === g.toLowerCase());
                        return (
                          <button
                            key={g}
                            type="button"
                            onClick={() =>
                              setGenreFilter((prev) =>
                                active
                                  ? prev.filter((x) => x.toLowerCase() !== g.toLowerCase())
                                  : [...prev, g],
                              )
                            }
                            className={[
                              "rounded-full border px-3 py-1 text-xs font-semibold transition",
                              active
                                ? "border-primary/60 bg-primary/15 text-foreground"
                                : "border-border/60 bg-card/40 text-muted-foreground hover:bg-card/55",
                            ].join(" ")}
                          >
                            {g}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Minimum rating (client-side filter; based on IMDb behind the scenes) */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-xs font-semibold tracking-wide text-muted-foreground">
                    Minimum rating
                  </div>
                  <div className="text-xs font-semibold text-foreground">
                    {minImdbRatingFilter <= 0 ? "Any" : minImdbRatingFilter.toFixed(1)}
                  </div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={0.5}
                  value={minImdbRatingFilter}
                  onChange={(e) => setMinImdbRatingFilter(Number(e.target.value))}
                  className="w-full"
                />
                <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                  <span>0</span>
                  <span>10</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setKindFilter(null);
                    setGenreFilter([]);
                    setMinImdbRatingFilter(0);
                  }}
                  className="flex-1 rounded-xl border border-border/60 bg-background/20 px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-background/35"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => setIsFiltersOpen(false)}
                  className="flex-1 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
                >
                  Done
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

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

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      onClose();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className="fixed inset-0 z-[9999] flex flex-col justify-end bg-black/55"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="pointer-events-auto mb-[72px] w-full max-w-md self-center rounded-t-2xl bg-card pb-3 pt-2 shadow-[0_-18px_45px_rgba(0,0,0,0.65)]"
      >
        <div className="flex items-center justify-between px-[var(--page-pad-x)] pb-2">
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground"
          >
            <MaterialIcon name="search" className="text-[18px]" />
          </button>
          <span className="text-sm font-semibold text-foreground">Send to</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition hover:bg-background/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <span className="text-[18px] leading-none">&times;</span>
          </button>
        </div>

        <section className="border-t border-border px-[var(--page-pad-x)] pt-3 pb-2">
          <h2 className="mb-2 text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground/90">
            Send to
          </h2>
          {isLoading ? (
            <div className="flex gap-3 overflow-hidden">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="flex flex-col items-center gap-1">
                  <div className="h-11 w-11 animate-pulse rounded-full bg-border/50" />
                  <div className="h-2.5 w-12 animate-pulse rounded bg-border/40" />
                </div>
              ))}
            </div>
          ) : !user ? (
            <p className="text-[12px] text-muted-foreground/80">Sign in to share via messages.</p>
          ) : conversations.length === 0 ? (
            <p className="text-[12px] text-muted-foreground/80">
              No conversations yet. Start a chat from a profile or the Messages tab.
            </p>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-1 pt-0.5">
              {conversations.map((conversation) => (
                <ShareRecipientChip key={conversation.id} conversation={conversation} text={text} />
              ))}
            </div>
          )}
        </section>

        <section className="border-t border-border px-[var(--page-pad-x)] pt-3 pb-3">
          <div className="flex gap-3 overflow-x-auto pb-1 pt-0.5">
            <WhatsAppShareChip shareUrl={shareUrl} title={activeCard.title} />
            <TelegramShareChip shareUrl={shareUrl} title={activeCard.title} />
            <MoreShareChip onShareExternal={onShareExternal} />
            <ShareCopyLinkChip shareUrl={shareUrl} />
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
    : (conversation.participants?.find((p: any) => !p.isSelf) ?? conversation.participants?.[0]);

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
        <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-muted text-xs text-muted-foreground">
          {avatarUrl ? (
            <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
          ) : (
            <span>{initials}</span>
          )}
        </div>
        {sendMessage.isSuccess && (
          <div className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500">
            <MaterialIcon name="check" filled className="text-[14px] text-primary-foreground" />
          </div>
        )}
      </div>
      <span className="line-clamp-2 max-w-[72px] text-xs text-foreground">{displayName}</span>
    </button>
  );
};

interface ShareCopyLinkChipProps {
  shareUrl: string;
}

const ShareCopyLinkChip: React.FC<ShareCopyLinkChipProps> = ({ shareUrl }) => {
  const handleClick = async () => {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(shareUrl);
      } catch {
        // Swallow copy errors silently; user can still use other share options
      }
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex w-[72px] flex-col items-center gap-1 text-center"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary">
        <MaterialIcon name="link" className="text-[18px] text-primary-foreground" />
      </div>
      <span className="line-clamp-2 max-w-[72px] text-xs text-foreground">Copy link</span>
    </button>
  );
};

interface WhatsAppShareChipProps {
  shareUrl: string;
  title: string;
}

const WhatsAppShareChip: React.FC<WhatsAppShareChipProps> = ({ shareUrl, title }) => {
  const handleClick = () => {
    if (typeof window === "undefined") return;
    const text = `Check this out: ${title}\n\n${shareUrl}`;
    const href = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(href, "_blank", "noopener,noreferrer");
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex w-[72px] flex-col items-center gap-1 text-center"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary">
        <span className="text-[16px] font-semibold text-white">W</span>
      </div>
      <span className="line-clamp-2 max-w-[72px] text-xs text-foreground">WhatsApp</span>
    </button>
  );
};

interface TelegramShareChipProps {
  shareUrl: string;
  title: string;
}

const TelegramShareChip: React.FC<TelegramShareChipProps> = ({ shareUrl, title }) => {
  const handleClick = () => {
    if (typeof window === "undefined") return;
    const text = `Check this out: ${title}\n\n${shareUrl}`;
    const href = `https://t.me/share/url?url=${encodeURIComponent(
      shareUrl,
    )}&text=${encodeURIComponent(text)}`;
    window.open(href, "_blank", "noopener,noreferrer");
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex w-[72px] flex-col items-center gap-1 text-center"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary">
        <span className="text-[16px] font-semibold text-white">T</span>
      </div>
      <span className="line-clamp-2 max-w-[72px] text-xs text-foreground">Telegram</span>
    </button>
  );
};

interface MoreShareChipProps {
  onShareExternal: () => Promise<void>;
}

const MoreShareChip: React.FC<MoreShareChipProps> = ({ onShareExternal }) => {
  const handleClick = async () => {
    await onShareExternal();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex w-[72px] flex-col items-center gap-1 text-center"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-muted">
        <MaterialIcon name="more_horiz" className="text-[18px] text-muted-foreground" />
      </div>
      <span className="line-clamp-2 max-w-[72px] text-xs text-foreground">More</span>
    </button>
  );
};

export default SwipePage;
