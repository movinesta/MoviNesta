import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Flame,
  Info,
  Menu,
  SkipForward,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Share2,
  Star,
  Search,
  Link2,
} from "lucide-react";
import TopBar from "../../components/shared/TopBar";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "../../lib/queryKeys";
import { useAuth } from "../auth/AuthProvider";
import { useConversations } from "../messages/useConversations";
import { useSendMessage } from "../messages/ConversationPage";
import { supabase } from "../../lib/supabase";
import { sendMediaSwipeEvent } from "./mediaSwipeApi";
import type { SwipeCardData, SwipeDirection } from "./useSwipeDeck";
import {
  clamp,
  cleanText,
  formatRuntime,
  abbreviateCountry,
  safeNumber,
  formatInt,
  getSourceLabel,
  buildSwipeCardLabel,
} from "./swipeCardMeta";
import { useMediaSwipeDeck } from "./useMediaSwipeDeck";
import SwipeSyncBanner from "./SwipeSyncBanner";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { TitleType } from "@/types/supabase-helpers";
import { CardMetadata, PosterFallback } from "./SwipeCardComponents";
import FriendAvatarStack from "./FriendAvatarStack";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ONBOARDING_STORAGE_KEY = "mn_swipe_onboarding_seen";
const SWIPE_DISTANCE_THRESHOLD = 88;
const SWIPE_VELOCITY_THRESHOLD = 0.32; // px per ms
const MAX_DRAG = 220;
const EXIT_MULTIPLIER = 16;
const EXIT_MIN = 360;
const ROTATION_FACTOR = 14;
const DRAG_INTENT_THRESHOLD = 32;
const FEEDBACK_ENABLED = true;

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

const rating0_10ToStars = (rating0_10: unknown): number | null => {
  if (rating0_10 == null) return null;
  const n = typeof rating0_10 === "number" ? rating0_10 : Number(String(rating0_10).trim());
  if (!Number.isFinite(n)) return null;
  const stars = Math.round(n / 2);
  return stars <= 0 ? null : Math.min(5, Math.max(1, stars));
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

  const kind = card?.kind === "series" ? "series" : card?.kind === "movie" ? "movie" : "movie";

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
    year: Number.isFinite(releaseYear as any) ? releaseYear : null,
    type: kind,
    runtimeMinutes: Number.isFinite(runtimeMinutes as any) ? runtimeMinutes : null,
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
    overview: card?.overview ?? null,
  };
};

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
  omdb_rated: string | null;
}

const WATCHLIST_STATUS = "want_to_watch" as DiaryStatus;
const WATCHED_STATUS = "watched" as DiaryStatus;

const SwipePageClassic: React.FC = () => {
  const navigate = useNavigate();
  const {
    cards: rawCards,
    sessionId,
    isLoading,
    isError,
    deckError,
    swipe,
    fetchMore,
    trimConsumed,
    swipeSyncError,
    retryFailedSwipe,
    isRetryingSwipe,
    trackImpression,
    trackDwell,
  } = useMediaSwipeDeck("combined", {
    limit: 72,
  });

  const cards = useMemo(() => rawCards.map(adaptMediaSwipeCard), [rawCards]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const activeCardRaw = rawCards[currentIndex];
  const nextCardRaw = rawCards[currentIndex + 1];

  const activeCard = cards[currentIndex];
  const nextCard = cards[currentIndex + 1];

  const [isDragging, setIsDragging] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    const hasSeen = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    return !hasSeen;
  });
  const [isNextPreviewActive, setIsNextPreviewActive] = useState(false);
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
  const setNextPosterFailed = (failed: boolean) => updatePosterFailure(nextCard?.id, failed);

  const activePosterFailed = !!activeCard?.id && failedPosterIds.includes(activeCard.id);
  const nextPosterFailed = !!nextCard?.id && failedPosterIds.includes(nextCard.id);

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

  const activeTitleId = activeCard?.id ?? null;

  const { user } = useAuth();
  const queryClient = useQueryClient();

  const feedbackQueryKey = [
    "mediaFeedback",
    { userId: user?.id ?? null, mediaItemId: activeTitleId },
  ] as const;

  const { data: feedbackRow } = useQuery<{
    in_watchlist: boolean | null;
    rating_0_10: number | null;
    last_action: string | null;
  } | null>({
    queryKey: feedbackQueryKey,
    enabled: Boolean(user?.id && activeTitleId),
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!user?.id || !activeTitleId) return null;

      const { data, error } = await supabase
        .from("media_feedback")
        .select("in_watchlist, rating_0_10, last_action")
        .eq("user_id", user.id)
        .eq("media_item_id", activeTitleId)
        .maybeSingle();

      if (error) throw error;
      return (data ?? null) as any;
    },
  });

  const serverStatus: DiaryStatus | null = feedbackRow?.in_watchlist
    ? WATCHLIST_STATUS
    : feedbackRow?.last_action === "like"
      ? WATCHED_STATUS
      : null;

  const serverRating = rating0_10ToStars(feedbackRow?.rating_0_10);

  const [localStatus, setLocalStatus] = useState<DiaryStatus | null>(null);

  const [localRating, setLocalRating] = useState<number | null>(null);

  const diaryEntry = { status: localStatus ?? serverStatus, rating: localRating ?? serverRating };

  const feedbackMutation = useMutation({
    mutationFn: async (vars: { status?: DiaryStatus | null; ratingStars?: number | null }) => {
      if (!user?.id || !activeCardRaw) return;

      const base: any = {
        sessionId,
        deckId: activeCardRaw.deckId ?? null,
        position: activeCardRaw.position ?? null,
        mediaItemId: activeCardRaw.id,
        source: activeCardRaw.source ?? null,
        payload: {
          ui: "SwipePage",
          action: vars.status ? "status" : vars.ratingStars != null ? "rating" : "feedback",
        },
      };

      const events: any[] = [];

      // Status updates
      if (vars.status !== undefined) {
        if (vars.status === WATCHED_STATUS) {
          events.push({ ...base, eventType: "like" as const });
        } else {
          // watchlist toggle (want_to_watch or clearing it)
          events.push({
            ...base,
            eventType: "watchlist" as const,
            inWatchlist: vars.status === WATCHLIST_STATUS,
          });
        }
      }

      // Rating updates (explicit event type)
      if (vars.ratingStars !== undefined) {
        events.push({
          ...base,
          eventType: "rating" as const,
          rating0_10: starsToRating0_10(vars.ratingStars),
        });
      }

      if (!events.length) return;

      // Send sequentially (keeps behavior predictable; avoids partial state updates)
      for (const e of events) {
        await sendMediaSwipeEvent(e);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: feedbackQueryKey });
    },
  });
  const longPressTimeoutRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const hoverTiltRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

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
      ctx.resume().catch(() => { });
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
        .from("media_items")
        .select(
          "id, kind, omdb_plot, tmdb_overview, omdb_director, omdb_writer, omdb_actors, omdb_genre, omdb_language, tmdb_original_language, omdb_country, omdb_imdb_rating, omdb_imdb_votes, omdb_metascore, omdb_rating_rotten_tomatoes, omdb_poster, tmdb_poster_path, tmdb_backdrop_path, omdb_awards, omdb_box_office, omdb_released, tmdb_vote_average, tmdb_vote_count, tmdb_popularity, omdb_rated, omdb_runtime",
        )
        .eq("id", activeTitleId)
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
        tmdb_overview: (data as any).tmdb_overview ?? null,
        tagline: null,
        omdb_director: (data as any).omdb_director ?? null,
        omdb_writer: (data as any).omdb_writer ?? null,
        omdb_actors: (data as any).omdb_actors ?? null,
        genres,
        tmdb_genre_names: null,
        language: null,
        omdb_language: (data as any).omdb_language ?? null,
        tmdb_original_language: (data as any).tmdb_original_language ?? null,
        country: null,
        omdb_country: (data as any).omdb_country ?? null,
        imdb_rating: (data as any).omdb_imdb_rating ?? null,
        imdb_votes: (data as any).omdb_imdb_votes ?? null,
        metascore: (data as any).omdb_metascore ?? null,
        rt_tomato_pct: rt,
        poster_url: (data as any).omdb_poster ?? null,
        tmdb_poster_path: (data as any).tmdb_poster_path ?? null,
        backdrop_url: (data as any).tmdb_backdrop_path ?? null,
        omdb_awards: (data as any).omdb_awards ?? null,
        omdb_box_office_str: (data as any).omdb_box_office ?? null,
        omdb_box_office: null,
        omdb_released: (data as any).omdb_released ?? null,
        tmdb_vote_average: (data as any).tmdb_vote_average ?? null,
        tmdb_vote_count: (data as any).tmdb_vote_count ?? null,
        tmdb_popularity: (data as any).tmdb_popularity ?? null,
        tmdb_episode_run_time: null,
        omdb_rated: (data as any).omdb_rated ?? null,
      } as TitleDetailRow;
    },
  });

  // clean + merged fields (hide "N/A")
  const detailOverview =
    cleanText(titleDetail?.plot) ??
    cleanText(titleDetail?.tmdb_overview) ??
    cleanText(activeCard?.overview) ??
    null;

  const detailGenres =
    titleDetail?.tmdb_genre_names ?? titleDetail?.genres ?? activeCard?.genres ?? null;

  const primaryLanguageRaw =
    titleDetail?.language ??
    titleDetail?.omdb_language ??
    titleDetail?.tmdb_original_language ??
    activeCard?.language ??
    null;
  const detailPrimaryLanguage = cleanText(primaryLanguageRaw);

  const primaryCountryRaw =
    titleDetail?.country ?? titleDetail?.omdb_country ?? activeCard?.country ?? null;
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
    titleDetail?.language ?? null,
    titleDetail?.omdb_language ?? null,
    titleDetail?.tmdb_original_language ?? null,
    activeCard?.language ?? null,
  ];
  const languages = Array.from(
    new Set(allLanguagesRaw.map((l) => cleanText(l)).filter((l): l is string => !!l)),
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
    if (!activeTitleId || !activeCardRaw || !ensureSignedIn() || feedbackMutation.isPending) return;

    if (status === WATCHLIST_STATUS) {
      const next = diaryEntry.status === WATCHLIST_STATUS ? null : WATCHLIST_STATUS;
      setLocalStatus(next);
      feedbackMutation.mutate({ status: next });
      return;
    }

    if (status === WATCHED_STATUS) {
      setLocalStatus(WATCHED_STATUS);
      feedbackMutation.mutate({ status: WATCHED_STATUS });
    }
  };

  const setDiaryRating = (nextRating: number | null) => {
    if (!activeTitleId || !activeCardRaw || !ensureSignedIn() || feedbackMutation.isPending) return;
    setLocalRating(nextRating);
    feedbackMutation.mutate({ ratingStars: nextRating });
  };

  const statusIs = (status: DiaryStatus) => diaryEntry?.status === status;

  const diaryServerRating = diaryEntry?.rating ?? null;
  const currentUserRating = localRating ?? diaryServerRating;

  useEffect(() => {
    // Reset local overrides when the active card or server feedback changes
    setLocalRating(null);
    setLocalStatus(null);
  }, [activeTitleId, diaryServerRating, serverStatus]);

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
  const showNextPoster = Boolean(nextCard?.posterUrl && !nextPosterFailed);

  const cardRef = useRef<HTMLDivElement | null>(null);
  const dragStartX = useRef<number | null>(null);
  const dragDelta = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastMoveX = useRef<number | null>(null);
  const lastMoveTime = useRef<number | null>(null);
  const velocityRef = useRef(0);
  const dwellStartRef = useRef<number | null>(null);
  const dwellCardIdRef = useRef<string | null>(null);
  const dwellCardRef = useRef<any | null>(null);

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

  // Track impressions + dwell time for the "Swipe Brain v2" learning loop
  useEffect(() => {
    if (!activeCardRaw) return;

    const now = performance.now();

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

    trackImpression(activeCardRaw);

    dwellCardRef.current = activeCardRaw;
    dwellCardIdRef.current = activeCardRaw.id;
    dwellStartRef.current = now;
  }, [activeCardRaw?.id, trackDwell, trackImpression]);

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
      if (longPressTimeoutRef.current != null) window.clearTimeout(longPressTimeoutRef.current);
      if (undoTimeoutRef.current != null) window.clearTimeout(undoTimeoutRef.current);
      if (smartHintTimeoutRef.current != null) window.clearTimeout(smartHintTimeoutRef.current);
      if (audioContextRef.current) audioContextRef.current.close().catch(() => { });
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

  const performSwipe = (direction: SwipeDirection, velocity = 0) => {
    if (!activeCard || !activeCardRaw) return;

    setShowOnboarding(false);
    if (typeof window !== "undefined") {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, "1");
    }

    setUndo(activeCard, direction);

    swipe({
      card: activeCardRaw,
      direction,
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

  const handlePointerDown = (x: number, pointerId: number, target: EventTarget | null) => {
    if (!activeCard || !activeCardRaw) return;

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
      isDetailMode && detailContentRef.current && detailContentRef.current.contains(target as Node);
    dragStartedInDetailAreaRef.current = !!startedInDetail;

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

    if (
      longPressTimeoutRef.current != null &&
      Math.abs(dx) > 10 &&
      !longPressTriggeredRef.current
    ) {
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
    const distanceThreshold = isDetailDrag
      ? SWIPE_DISTANCE_THRESHOLD * 1.6
      : SWIPE_DISTANCE_THRESHOLD;
    const velocityThreshold = isDetailDrag
      ? SWIPE_VELOCITY_THRESHOLD * 1.4
      : SWIPE_VELOCITY_THRESHOLD;

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

  const overlaySourceLabel = activeCard?.why ?? getSourceLabel((activeCard?.source ?? undefined) as any);
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
                className={`h-1.5 rounded-md transition-all ${isActive ? "w-4 bg-primary" : "w-2 bg-border/70"
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
        <div className="pointer-events-auto inline-flex items-center gap-3 rounded-md border border-border bg-background/95 px-3 py-2 text-[12px] text-foreground shadow-lg backdrop-blur">
          <span>{label}</span>
          <button
            type="button"
            onClick={handleUndo}
            className="text-xs font-semibold uppercase tracking-[0.14em] text-primary hover:text-primary/80"
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
        <div className="pointer-events-auto inline-flex max-w-md items-start gap-2 rounded-md border border-border bg-background/95 px-3 py-2 text-xs text-muted-foreground shadow-lg backdrop-blur">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 text-primary" />
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
    if (activeCard.why) return activeCard.why;
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
    <div className="relative flex flex-1 min-h-0 flex-col gap-3 overflow-hidden overscroll-none h-[calc(100dvh-(5.5rem+env(safe-area-inset-bottom)))] sm:h-[calc(100dvh-(6rem+env(safe-area-inset-bottom)))]">
      <TopBar
        title="Swipe"
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-foreground hover:bg-muted"
                aria-label="Swipe options"
              >
                <Menu className="h-5 w-5" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate("/settings")}>Settings</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/search")}>Find titles</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <SwipeSyncBanner
        message={swipeSyncError}
        onRetry={retryFailedSwipe}
        isRetrying={isRetryingSwipe}
      />

      <div className="relative flex flex-1 min-h-0 flex-col overflow-visible">
        {renderDeckIndicator()}

        <div
          className="relative flex flex-1 min-h-0 items-center justify-center overflow-visible [perspective:1400px]"
          aria-live="polite"
        >
          {isLoading && !activeCard && !isError && <LoadingScreen />}

          {isError && !isLoading && (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
              <Info className="h-8 w-8 text-amber-400" />
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
              <Sparkles className="h-8 w-8 text-primary" />
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
              {/* intent glow */}

              {/* next preview */}
              {nextCard && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 mx-auto flex h-[72%] max-h-[480px] w-full max-w-md items-center justify-center rounded-2xl transition-all duration-300 ease-out"
                  style={{
                    transform: `${isNextPreviewActive
                      ? "translateY(-40px) scale(0.9)"
                      : "translateY(-10px) scale(0.84)"
                      } translateX(${nextParallaxX}px)`,
                    opacity: isNextPreviewActive ? 1 : 0,
                  }}
                >
                  <div className="relative h-full w-full overflow-hidden rounded-2xl border border-border/40 shadow-lg">
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
                        <div className="absolute inset-0 bg-gradient-to-b from-background/0 via-background/30 to-background/90" />
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
                className={`relative z-10 mx-auto flex h-[72%] max-h-[480px] w-full max-w-md select-none flex-col overflow-hidden rounded-2xl bg-gradient-to-br from-card/95 via-background/95 to-card/90 shadow-[0_28px_80px_rgba(0,0,0,0.85)] backdrop-blur transform-gpu will-change-transform ${isDetailMode ? "ring-1 ring-primary/40" : "border border-border/60"
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
                style={{ touchAction: "none" }}
              >
                {/* light leak */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 mix-blend-screen opacity-[0.14]"
                ></div>

                {/* header / poster */}
                <div
                  className={`relative overflow-hidden bg-gradient-to-br from-background/90 via-background/85 to-background/95 transition-all duration-300 ease-out ${isDetailMode ? "h-[40%]" : "h-[58%]"
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
                            className="overflow-hidden rounded-2xl border border-border bg-background shadow-[0_14px_40px_rgba(0,0,0,0.85)]"
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

                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 via-black/40 to-background/95" />

                  {/* swipe overlays */}
                  {dragIntent === "like" && (
                    <>
                      <div className="pointer-events-none absolute inset-x-8 bottom-3 flex justify-start">
                        <div className="flex items-center gap-2 rounded-md bg-emerald-500/14 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-200 shadow-md backdrop-blur-sm">
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
                        <div className="flex items-center gap-2 rounded-md bg-rose-500/14 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-rose-200 shadow-md backdrop-blur-sm">
                          <ThumbsDown className="h-4 w-4 text-rose-300" />
                          <span>No thanks</span>
                        </div>
                      </div>
                      <div className="pointer-events-none absolute inset-y-8 left-2 w-1 rounded-full bg-gradient-to-b from-rose-400/0 via-rose-400/40 to-rose-400/0" />
                    </>
                  )}

                  {/* badges top */}
                  <div className="absolute left-3 right-3 top-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                    {activeCard?.source === "from-friends" && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-background/80 px-2 py-1 text-xs font-semibold text-foreground shadow-md">
                        <span className="h-1.5 w-1.5 rounded-sm bg-primary" />
                        {overlaySourceLabel}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 rounded-md bg-background/70 px-2 py-1 text-xs font-medium text-muted-foreground/85 shadow-md">
                      <Sparkles className="h-3 w-3 text-primary/80" />
                      {currentIndex + 1} / {cards.length || 1}
                    </span>
                  </div>
                </div>

                {/* bottom content: swipe vs detail vs full details (same footprint, no scroll) */}
                <div className="relative flex flex-1 flex-col bg-gradient-to-b from-background/92 via-background/96 to-background px-4 pb-4 pt-3 backdrop-blur-md">
                  {/* SWIPE MODE: compact */}
                  {!isDetailMode && (
                    <>
                      <CardMetadata
                        card={activeCard}
                        metaLine={metaLine}
                        highlightLabel={highlightLabel}
                      />

                      {/* friends info under swipe card */}
                      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        {Array.isArray(activeCard.friendProfiles) &&
                          activeCard.friendProfiles.length > 0 && (
                            <div className="inline-flex items-center gap-2">
                              <FriendAvatarStack profiles={activeCard.friendProfiles} max={3} />
                              <span className="text-xs text-muted-foreground">
                                {activeCard.friendProfiles.length === 1
                                  ? `Picked by ${activeCard.friendProfiles[0].display_name ?? activeCard.friendProfiles[0].username ?? "a friend"}`
                                  : `Picked by ${activeCard.friendProfiles.length} friends`}
                              </span>
                            </div>
                          )}

                        {(!Array.isArray(activeCard.friendProfiles) ||
                          activeCard.friendProfiles.length === 0) &&
                          typeof activeCard.friendLikesCount === "number" &&
                          activeCard.friendLikesCount > 0 && (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Flame className="h-4 w-4 text-primary/80" />
                              {activeCard.friendLikesCount === 1
                                ? "1 friend likes this"
                                : `${activeCard.friendLikesCount} friends like this`}
                            </span>
                          )}

                        {activeCard.topFriendName && activeCard.topFriendReviewSnippet && (
                          <button
                            type="button"
                            onClick={() => setShowFullFriendReview((v) => !v)}
                            className="inline-flex flex-1 items-start gap-2 rounded-xl border border-border/70 bg-card/80 px-3 py-2 text-left text-foreground shadow-md hover:bg-card"
                          >
                            <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                            <div
                              className={`overflow-hidden transition-all duration-200 ${showFullFriendReview ? "max-h-32" : "max-h-10"
                                }`}
                            >
                              <span
                                className={`block text-xs ${showFullFriendReview ? "" : "line-clamp-2"
                                  }`}
                              >
                                {activeCard.topFriendName}: “{activeCard.topFriendReviewSnippet}”
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
                      className="mt-2 flex flex-1 flex-col text-left text-xs text-muted-foreground"
                    >
                      <div className="flex min-h-0 flex-1 flex-col overflow-hidden pr-1">
  {!isFullDetailOpen ? (
    // DETAILS (no scroll): show the most useful info, clamp long text
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="shrink-0 space-y-1.5">
        <h3 className="line-clamp-2 text-[clamp(1rem,3.8vw,1.25rem)] font-semibold text-foreground">
          {activeCard.title}
        </h3>
        {metaLine && <p className="text-[11px] text-muted-foreground/90">{metaLine}</p>}

        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground/90">
          {detailGenres && (
            <span className="inline-flex items-center gap-1 min-w-0">
              <span className="font-medium text-foreground/90">Genres</span>
              <span className="truncate max-w-[220px]">
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
            <span className="rounded-full bg-card/80 px-2 py-0.5 text-[11px] font-medium text-foreground/90">
              {detailCertification}
            </span>
          )}
          {detailPrimaryCountryAbbr && (
            <span className="rounded-full bg-card/80 px-2 py-0.5 text-[11px] text-muted-foreground/90">
              {detailPrimaryCountryAbbr}
            </span>
          )}
        </div>
      </div>

      {detailOverview ? (
        <div className="min-h-0 flex-1 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
            Overview
          </p>
          <p className="line-clamp-4 sm:line-clamp-5 md:line-clamp-6 text-[11px] leading-relaxed text-muted-foreground/90">
            {detailOverview}
          </p>
        </div>
      ) : (
        <div className="min-h-0 flex-1" />
      )}

      {(detailDirector || detailActors) ? (
        <div className="shrink-0 space-y-1 text-[10.5px] text-muted-foreground/90">
          {detailDirector && (
            <p className="line-clamp-1">
              <span className="font-medium text-foreground/90">Director:</span>{" "}
              <span>{detailDirector}</span>
            </p>
          )}
          {detailActors && (
            <p className="line-clamp-1">
              <span className="font-medium text-foreground/90">Cast:</span>{" "}
              <span>
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

      <div className="shrink-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1 rounded-full bg-card/80 px-2.5 py-1">
            <span className="text-[11px] text-muted-foreground/80">Your rating</span>
            <div className="flex items-center gap-0.5" aria-label="Your rating">
              {Array.from({ length: 5 }).map((_, idx) => {
                const value = idx + 1;
                const filled = currentUserRating != null && currentUserRating >= value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleStarClick(value)}
                    className="flex h-5 w-5 items-center justify-center rounded-full hover:scale-105 focus-visible:outline-none"
                  >
                    <Star
                      className={`h-3.5 w-3.5 ${filled ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
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
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                statusIs(WATCHLIST_STATUS)
                  ? "bg-primary/90 text-primary-foreground"
                  : "border border-border bg-card/80 text-muted-foreground hover:border-primary/70 hover:text-primary"
              }`}
            >
              Watchlist
            </button>
            <button
              type="button"
              onClick={() => setDiaryStatus(WATCHED_STATUS)}
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                statusIs(WATCHED_STATUS)
                  ? "bg-emerald-500/90 text-primary-foreground"
                  : "border border-border bg-card/80 text-muted-foreground hover:border-emerald-400/80 hover:text-emerald-300"
              }`}
            >
              Watched
            </button>
            <button
              type="button"
              onClick={() => setIsShareSheetOpen(true)}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-card/80 px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:border-primary/70 hover:text-primary"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Share</span>
            </button>
          </div>
        </div>

        {(typeof activeCard.friendLikesCount === "number" && activeCard.friendLikesCount > 0) ||
        (activeCard.topFriendName && activeCard.topFriendReviewSnippet) ? (
          <div className="rounded-2xl bg-card/80 px-3 py-2 text-[11px] text-foreground shadow-md">
            {typeof activeCard.friendLikesCount === "number" && activeCard.friendLikesCount > 0 && (
              <div className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <Flame className="h-4 w-4 text-primary/80" />
                {activeCard.friendLikesCount === 1
                  ? "1 friend likes this"
                  : `${activeCard.friendLikesCount} friends like this`}
              </div>
            )}
            {activeCard.topFriendName && activeCard.topFriendReviewSnippet && (
              <div className="mt-1 inline-flex w-full items-start gap-2 text-left">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                <span className="block line-clamp-2 text-[11px]">
                  {activeCard.topFriendName}: “{activeCard.topFriendReviewSnippet}”
                </span>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  ) : (
    // FULL DETAILS (no scroll): compact grid, clamp values
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="shrink-0">
        <h3 className="line-clamp-1 text-[clamp(0.95rem,3.4vw,1.1rem)] font-semibold text-foreground">
          {activeCard.title}
        </h3>
        {metaLine && <p className="mt-0.5 text-[11px] text-muted-foreground/90">{metaLine}</p>}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-2xl border border-border/70 bg-card/80 px-3 py-2 text-[11px] leading-snug text-muted-foreground">
  {(() => {
    const tiles: Array<{ label: string; value: string }> = [];

    if (moreGenres.length > 0) {
      tiles.push({ label: "Genres", value: moreGenres.slice(0, 6).join(", ") });
    }
    if (languages.length > 0) {
      tiles.push({ label: "Languages", value: languages.slice(0, 4).join(", ") });
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
        tiles.push({ label: "More cast", value: extra.slice(0, 8).join(", ") });
      }
    }
    if (detailReleased) {
      tiles.push({ label: "Released", value: detailReleased });
    }
    if (detailAwards) {
      tiles.push({ label: "Awards", value: detailAwards });
    }
    if (detailBoxOffice) {
      tiles.push({ label: "Box office", value: detailBoxOffice });
    }
    if (imdbVotes && formatInt(imdbVotes)) {
      tiles.push({ label: "IMDb votes", value: String(formatInt(imdbVotes)) });
    }
    if (externalMetascore && safeNumber(externalMetascore) != null) {
      tiles.push({ label: "Metascore", value: String(safeNumber(externalMetascore)) });
    }
    if (tmdbVoteAverage && safeNumber(tmdbVoteAverage) != null) {
      tiles.push({
        label: "TMDB",
        value: String(safeNumber(tmdbVoteAverage)?.toFixed(1)),
      });
    }

    return tiles.slice(0, 8).map((tile) => (
      <div key={tile.label} className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
          {tile.label}
        </p>
        <p className="line-clamp-2">{tile.value}</p>
      </div>
    ));
  })()}
</div>

{detailOverview && (
          <div className="mt-2 rounded-2xl border border-border/70 bg-card/80 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">Overview</p>
            <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground/90">{detailOverview}</p>
          </div>
        )}
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
                          className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:border-primary/70 hover:text-primary"
                        >
                          <span>{isFullDetailOpen ? "Collapse" : "Full details"}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </article>

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
        <div className="mt-2 grid grid-cols-3 gap-3" aria-label="Swipe actions">
          <button
            type="button"
            onClick={() => performSwipe("dislike")}
            disabled={actionsDisabled}
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-3 text-sm font-semibold text-rose-400 shadow-md disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-[1px] active:scale-[0.99] active:shadow-none transition-all duration-150"
            aria-label="No thanks"
          >
            <ThumbsDown className="h-5 w-5" />
            <span className="hidden sm:inline">No thanks</span>
          </button>
          <button
            type="button"
            onClick={() => performSwipe("skip")}
            disabled={actionsDisabled}
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-3 text-sm font-semibold text-muted-foreground shadow-md disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-[1px] active:scale-[0.99] active:shadow-none transition-all duration-150"
            aria-label="Not now"
          >
            <SkipForward className="h-5 w-5" />
            <span className="hidden sm:inline">Not now</span>
          </button>
          <button
            type="button"
            onClick={() => performSwipe("like")}
            disabled={actionsDisabled}
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-transparent bg-primary/95 px-3 py-3 text-sm font-semibold text-primary-foreground shadow-md disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-[1px] active:scale-[0.99] active:shadow-none transition-all duration-150"
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
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 pb-2">
          <button
            type="button"
            className="rounded-full p-1 text-muted-foreground hover:bg-background/80"
          >
            <Search className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold text-foreground">Send to</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground hover:bg-background/80"
          >
            <span className="text-[18px] leading-none">&times;</span>
          </button>
        </div>

        <section className="border-t border-border px-4 pt-3 pb-2">
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

        <section className="border-t border-border px-4 pt-3 pb-3">
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
            <CheckCircle2 className="h-3 w-3 text-primary-foreground" />
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
        <Link2 className="h-4 w-4 text-primary-foreground" />
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
        <Share2 className="h-4 w-4 text-muted-foreground" />
      </div>
      <span className="line-clamp-2 max-w-[72px] text-xs text-foreground">More</span>
    </button>
  );
};

export default SwipePageClassic;
