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
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import TopBar from "../../components/shared/TopBar";
import type { SwipeCardData, SwipeDirection } from "./useSwipeDeck";
import { useSwipeDeck } from "./useSwipeDeck";
import SwipeSyncBanner from "./SwipeSyncBanner";

const ONBOARDING_STORAGE_KEY = "mn_swipe_onboarding_seen";
const SWIPE_DISTANCE_THRESHOLD = 88;
const SWIPE_VELOCITY_THRESHOLD = 0.32; // px per ms
const MAX_DRAG = 220;
const EXIT_MULTIPLIER = 16;
const EXIT_MIN = 360;
const ROTATION_FACTOR = 14;

// For overlays (less than full swipe threshold so you see them earlier)
const DRAG_INTENT_THRESHOLD = 32;

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

const getSourceLabel = (source?: string) => {
  switch (source) {
    case "from-friends":
      return "From friends";
    case "trending":
      return "Trending now";
    default:
      return "For you";
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
}

export const CardMetadata: React.FC<CardMetadataProps> = ({ card }) => {
  const runtimeLabel = formatRuntime(card.runtimeMinutes);
  const hasImdbRating =
    typeof card.imdbRating === "number" && !Number.isNaN(card.imdbRating) && card.imdbRating > 0;
  const hasTomatometer =
    typeof card.rtTomatoMeter === "number" &&
    !Number.isNaN(card.rtTomatoMeter) &&
    card.rtTomatoMeter > 0;

  const metaPieces: (string | null)[] = [];

  if (card.year) metaPieces.push(String(card.year));
  if (card.type) metaPieces.push(card.type);
  if (runtimeLabel) metaPieces.push(runtimeLabel);
  if (hasImdbRating) metaPieces.push(`IMDb ${card.imdbRating!.toFixed(1)}`);
  if (hasTomatometer) metaPieces.push(`${card.rtTomatoMeter}% RT`);

  return (
    <div className="space-y-3 text-left text-[12px] leading-relaxed">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 className="truncate text-2xl font-heading font-semibold text-mn-text-primary">
            {card.title}
          </h2>
          <p className="text-[12px] text-mn-text-secondary">{metaPieces.join(" · ")}</p>
        </div>
        <span className="mt-1 text-[10px]" />
      </div>

      {card.tagline && (
        <p className="line-clamp-3 text-[12px] text-mn-text-secondary">{card.tagline}</p>
      )}
    </div>
  );
};

export const PosterFallback: React.FC<{ title?: string }> = ({ title }) => (
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
 * Animated loading skeleton with 3D “wiggle”
 */
export const LoadingSwipeCard: React.FC = () => {
  const [offset, setOffset] = useState(0);
  const directionRef = useRef<1 | -1>(1);

  useEffect(() => {
    const interval = window.setInterval(() => {
      directionRef.current = (directionRef.current === 1 ? -1 : 1) as 1 | -1;
      const nextOffset = directionRef.current * 14; // px
      setOffset(nextOffset);
    }, 850);

    return () => window.clearInterval(interval);
  }, []);

  const rotation = offset / 5;

  return (
    <article
      className="relative z-10 mx-auto flex h-[72%] max-h-[480px] w-full max-w-md select-none flex-col overflow-hidden rounded-2xl border border-mn-border-subtle/80 bg-gradient-to-br from-mn-bg-elevated/95 via-mn-bg/95 to-mn-bg-elevated/90 shadow-[0_24px_70px_rgba(0,0,0,0.8)] backdrop-blur transform-gpu will-change-transform"
      style={{
        transform: `perspective(1400px) translateX(${offset}px) rotateZ(${rotation}deg) rotateY(${offset / 6}deg) scale(1.02)`,
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

const SwipePage: React.FC = () => {
  const navigate = useNavigate();

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

  // For overlays & parallax
  const [dragIntent, setDragIntent] = useState<"like" | "dislike" | null>(null);
  const [nextParallaxX, setNextParallaxX] = useState(0);

  const activeCard = cards[currentIndex];
  const nextCard = cards[currentIndex + 1];

  const showActivePoster = Boolean(activeCard?.posterUrl && !activePosterFailed);
  const showNextPoster = Boolean(nextCard?.posterUrl && !nextPosterFailed);

  const cardRef = useRef<HTMLDivElement | null>(null);
  const dragStartX = useRef<number | null>(null);
  const dragDelta = useRef(0);
  const rafRef = useRef<number>();
  const lastMoveX = useRef<number | null>(null);
  const lastMoveTime = useRef<number | null>(null);
  const velocityRef = useRef(0);

  // Long-press detection
  const longPressTimeoutRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);

  // Haptic state for crossing thresholds
  const lastHapticIntentRef = useRef<"like" | "dislike" | null>(null);

  // Web Audio for swipe sounds
  const audioContextRef = useRef<AudioContext | null>(null);

  const ensureAudioContext = () => {
    if (typeof window === "undefined") return null;
    if (audioContextRef.current) return audioContextRef.current;
    const AC =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    audioContextRef.current = ctx;
    return ctx;
  };

  const playSwipeSound = (direction: SwipeDirection, intensity: number) => {
    const ctx = ensureAudioContext();
    if (!ctx) return;

    // Try to resume if suspended (required on some browsers)
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {
        // ignore
      });
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    let startFreq = 440;
    let endFreq = 440;

    if (direction === "like") {
      startFreq = 420;
      endFreq = 640;
    } else if (direction === "dislike") {
      startFreq = 260;
      endFreq = 180;
    } else if (direction === "skip") {
      startFreq = 340;
      endFreq = 300;
    }

    const now = ctx.currentTime;
    const duration = 0.08 + intensity * 0.07; // 80–150ms

    osc.type = "triangle";
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.linearRampToValueAtTime(endFreq, now + duration);

    const startGain = 0.24 + intensity * 0.2; // 0.24–0.44
    gain.gain.setValueAtTime(startGain, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  };

  const playDirectionalHaptic = (intent: "like" | "dislike") => {
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
    const duration = intent === "like" ? 10 : 14;
    navigator.vibrate(duration);
  };

  const playSwipeCommitHaptic = (direction: SwipeDirection, intensity: number) => {
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;

    const base = direction === "skip" ? 12 : 18;
    const extra = Math.round(intensity * 50); // up to +50ms
    const total = base + extra;

    navigator.vibrate(total);
  };

  useEffect(() => {
    const hasSeen =
      typeof window !== "undefined" ? localStorage.getItem(ONBOARDING_STORAGE_KEY) : null;
    setShowOnboarding(!hasSeen);
  }, []);

  useEffect(() => {
    setActivePosterFailed(false);
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
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {
          // ignore
        });
      }
    },
    [],
  );

  // Animate next-card preview when the next card changes
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
    }: { withTransition?: boolean; clampDrag?: boolean } = {},
  ) => {
    const node = cardRef.current;
    if (!node) return;

    const finalX = clampDrag ? clamp(x, -MAX_DRAG, MAX_DRAG) : x;

    // Base Z-rotation (like a piece of paper)
    const rotateZ = clamp(finalX / ROTATION_FACTOR, -12, 12);

    // 3D Y-rotation to tilt toward/away from the user
    const rotateY = clamp(finalX / 26, -10, 10);

    // Slight “pop-out” scale
    const baseScale = 1.02;
    const extraScale = Math.min(Math.abs(finalX) / 900, 0.04);
    const scale = baseScale + extraScale;

    node.style.transition = withTransition
      ? "transform 260ms cubic-bezier(0.22,0.61,0.36,1)"
      : "none";

    node.style.transform = `
      perspective(1400px)
      translateX(${finalX}px)
      rotateZ(${rotateZ}deg)
      rotateY(${rotateY}deg)
      scale(${scale})
    `;

    dragDelta.current = finalX;
  };

  const resetCardPosition = () => {
    setCardTransform(0, { withTransition: true });
    dragDelta.current = 0;
    dragStartX.current = null;
    lastMoveX.current = null;
    lastMoveTime.current = null;
    velocityRef.current = 0;
    setDragIntent(null);
    setNextParallaxX(0);
    lastHapticIntentRef.current = null;
  };

  const performSwipe = (direction: SwipeDirection, velocity = 0) => {
    if (!activeCard) return;

    setShowOnboarding(false);
    if (typeof window !== "undefined") {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, "1");
    }

    // Always send the event
    swipe({
      cardId: activeCard.id,
      direction,
      rating: activeCard.initialRating ?? null,
      inWatchlist: activeCard.initiallyInWatchlist ?? undefined,
      sourceOverride: activeCard.source,
    });

    // Reset overlay intent immediately so it doesn't linger
    setDragIntent(null);
    setNextParallaxX(0);
    lastHapticIntentRef.current = null;

    // SKIP → drop + fade
    if (direction === "skip") {
      const node = cardRef.current;
      if (node) {
        node.style.transition =
          "transform 220ms cubic-bezier(0.22,0.61,0.36,1), opacity 220ms ease-out";
        node.style.transform = "translateX(0px) translateY(24px) scale(0.95)";
        node.style.opacity = "0";
      }

      // Basic intensity based on vertical drop distance
      const skipIntensity = 0.4;
      playSwipeCommitHaptic(direction, skipIntensity);
      playSwipeSound(direction, skipIntensity);

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

    // LIKE / DISLIKE: fling off-screen
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
        rotateZ(${exitRotateZ}deg)
        rotateY(${exitRotateY}deg)
        scale(1.02)
      `;
    }

    // Intensity based on how far the card needs to travel
    const travelMagnitude = Math.abs(baseExit);
    const intensity = Math.min(1, travelMagnitude / 520);

    playSwipeCommitHaptic(direction, intensity);
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
    lastHapticIntentRef.current = null;

    // Prepare AudioContext on a user gesture
    ensureAudioContext();

    // Long press: open title detail
    if (longPressTimeoutRef.current != null) {
      window.clearTimeout(longPressTimeoutRef.current);
    }
    longPressTriggeredRef.current = false;

    longPressTimeoutRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      setIsDragging(false);
      resetCardPosition();

      // Optional tiny haptic on long press
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        navigator.vibrate(20);
      }

      if (activeCard?.id) {
        navigate(`/titles/${activeCard.id}`);
      }
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

    // If user is clearly dragging, cancel long-press
    if (longPressTimeoutRef.current != null && Math.abs(dx) > 10 && !longPressTriggeredRef.current) {
      window.clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }

    setCardTransform(dx, { withTransition: false });

    // Update swipe intent overlays
    let nextIntent: "like" | "dislike" | null = null;
    if (dx > DRAG_INTENT_THRESHOLD) {
      nextIntent = "like";
    } else if (dx < -DRAG_INTENT_THRESHOLD) {
      nextIntent = "dislike";
    }

    setDragIntent(nextIntent);

    // Haptic when crossing into a new intent zone
    if (nextIntent && nextIntent !== lastHapticIntentRef.current) {
      playDirectionalHaptic(nextIntent);
      lastHapticIntentRef.current = nextIntent;
    }
    if (!nextIntent) {
      lastHapticIntentRef.current = null;
    }

    // Parallax on the next card (move slightly opposite the drag)
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
    // Always clear pending long-press
    if (longPressTimeoutRef.current != null) {
      window.clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }

    // If the long press already triggered, don't treat this as a swipe
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
    const shouldSwipe =
      Math.abs(projected) >= SWIPE_DISTANCE_THRESHOLD ||
      Math.abs(velocityRef.current) >= SWIPE_VELOCITY_THRESHOLD;

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

  // Keyboard shortcuts: ← dislike, → like, ↓ / Space skip (hint text removed, behavior kept)
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

  // Simple deck indicator: first few cards with current highlighted
  const renderDeckIndicator = () => {
    if (!cards.length) return null;

    const maxDots = 8;
    const total = Math.min(cards.length, maxDots);

    // Center window of dots around currentIndex when possible
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

  return (
    <div className="flex min-h-[calc(100vh-6rem)] flex-col">
      <TopBar title="Swipe" subtitle="Combined For You, friends, and trending picks" />

      <SwipeSyncBanner
        message={swipeSyncError}
        onRetry={retryFailedSwipe}
        isRetrying={isRetryingSwipe}
      />

      <div className="relative mt-2 flex flex-1 flex-col overflow-visible rounded-2xl border border-mn-border-subtle/60 bg-gradient-to-b from-mn-bg/90 via-mn-bg to-mn-bg-elevated/80 p-3">
        {renderDeckIndicator()}

        <div
          className="relative flex flex-1 items-center justify-center overflow-visible [perspective:1400px]"
          aria-live="polite"
        >
          {/* Loading */}
          {isLoading && !activeCard && !isError && <LoadingSwipeCard />}

          {isError && !isLoading && (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-center text-sm text-mn-text-secondary">
              <Info className="h-8 w-8 text-amber-400" />
              <p>We couldn&apos;t load your swipe deck. Please retry from the menu.</p>
            </div>
          )}

          {!isLoading && !isError && !activeCard && (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-center text-sm text-mn-text-secondary">
              <Sparkles className="h-8 w-8 text-mn-primary" />
              <p>All caught up. New cards will appear soon.</p>
            </div>
          )}

          {!isLoading && activeCard && (
            <>
              {/* Next-card preview with parallax */}
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

              {/* Active card */}
              <article
                ref={cardRef}
                className="relative z-10 mx-auto flex h-[72%] max-h-[480px] w-full max-w-md select-none flex-col overflow-hidden rounded-2xl border border-mn-border-subtle/80 bg-gradient-to-br from-mn-bg-elevated/95 via-mn-bg/95 to-mn-bg-elevated/90 shadow-[0_28px_80px_rgba(0,0,0,0.85)] backdrop-blur transform-gpu will-change-transform"
                onPointerDown={(e) => {
                  if (e.pointerType === "mouse" && e.button !== 0) return;
                  handlePointerDown(e.clientX, e.pointerId);
                }}
                onPointerMove={(e) => handlePointerMove(e.clientX)}
                onPointerUp={finishDrag}
                onPointerCancel={finishDrag}
                aria-label={buildSwipeCardLabel(activeCard)}
                style={{ touchAction: "pan-y" }}
              >
                <div className="relative h-[58%] overflow-hidden bg-gradient-to-br from-mn-bg/90 via-mn-bg/85 to-mn-bg/95">
                  {showActivePoster && activeCard.posterUrl ? (
                    <img
                      src={activeCard.posterUrl}
                      alt={buildSwipeCardLabel(activeCard) ?? `${activeCard.title} poster`}
                      className="h-full w-full object-cover"
                      draggable={false}
                      loading="lazy"
                      onError={() => setActivePosterFailed(true)}
                    />
                  ) : (
                    <PosterFallback title={activeCard.title} />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/10 to-mn-bg/85" />

                  {/* NEW swipe overlays design */}
                  {dragIntent === "like" && (
                    <>
                      <div className="pointer-events-none absolute inset-x-8 top-6 flex justify-start">
                        <div className="flex items-center gap-2 rounded-md border border-emerald-400/70 bg-emerald-500/12 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-200 shadow-mn-soft backdrop-blur-sm">
                          <ThumbsUp className="h-4 w-4 text-emerald-300" />
                          <span>Add to picks</span>
                        </div>
                      </div>
                      <div className="pointer-events-none absolute inset-y-8 right-2 w-1 rounded-full bg-gradient-to-b from-emerald-400/0 via-emerald-400/40 to-emerald-400/0" />
                    </>
                  )}
                  {dragIntent === "dislike" && (
                    <>
                      <div className="pointer-events-none absolute inset-x-8 top-6 flex justify-end">
                        <div className="flex items-center gap-2 rounded-md border border-rose-400/70 bg-rose-500/12 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-rose-200 shadow-mn-soft backdrop-blur-sm">
                          <ThumbsDown className="h-4 w-4 text-rose-300" />
                          <span>Skip this</span>
                        </div>
                      </div>
                      <div className="pointer-events-none absolute inset-y-8 left-2 w-1 rounded-full bg-gradient-to-b from-rose-400/0 via-rose-400/40 to-rose-400/0" />
                    </>
                  )}

                  <div className="absolute left-3 right-3 top-3 flex flex-wrap items-center justify-between gap-2 text-[10px]">
                    {/* Context badge: square-ish chip */}
                    <span className="inline-flex items-center gap-1 rounded-md bg-mn-bg/80 px-2 py-1 text-[10px] font-semibold text-mn-text-primary shadow-mn-soft">
                      <span className="h-1.5 w-1.5 rounded-full bg-mn-primary" />
                      {overlaySourceLabel}
                    </span>

                    {/* Plain text, no bg */}
                    <span className="flex items-center gap-1 text-[10px] font-medium text-mn-text-secondary/80">
                      <Sparkles className="h-3 w-3 text-mn-primary/80" />
                      Card {currentIndex + 1} / {cards.length || 1}
                    </span>
                  </div>
                </div>

                <div className="flex flex-1 flex-col justify-between bg-gradient-to-b from-mn-bg/92 via-mn-bg/96 to-mn-bg px-4 pb-4 pt-3 backdrop-blur-md">
                  <CardMetadata card={activeCard} />

                  <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-mn-text-secondary">
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
                      <span className="inline-flex flex-1 items-start gap-2 rounded-2xl bg-mn-bg-elevated/80 px-3 py-2 text-left text-mn-text-primary shadow-mn-soft">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 text-mn-primary" />
                        <span className="line-clamp-2">
                          {activeCard.topFriendName}: “{activeCard.topFriendReviewSnippet}”
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              </article>

              {showOnboarding && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-gradient-to-b from-mn-bg/70 via-mn-bg/50 to-mn-bg/80">
                  <div className="pointer-events-auto max-w-xs rounded-2xl border border-mn-border-subtle/70 bg-mn-bg/95 p-4 text-center shadow-mn-card">
                    <p className="text-sm font-semibold text-mn-text-primary">Swipe to decide</p>
                    <p className="mt-1 text-[12px] text-mn-text-secondary">
                      Drag the card left to skip or right to add to your picks. Long-press to open
                      details.
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
        </div>

        <div className="mt-3 grid grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => performSwipe("dislike")}
            disabled={actionsDisabled}
            className="flex items-center justify-center gap-2 rounded-xl border border-mn-border-subtle/70 bg-mn-bg px-3 py-3 text-sm font-semibold text-rose-400 shadow-mn-soft disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg active:translate-y-[1px] active:scale-[0.99] active:shadow-none transition-all duration-150"
            aria-label="Dislike"
          >
            <ThumbsDown className="h-5 w-5" />
            <span className="hidden sm:inline">Pass</span>
          </button>
          <button
            type="button"
            onClick={() => performSwipe("skip")}
            disabled={actionsDisabled}
            className="flex items-center justify-center gap-2 rounded-xl border border-mn-border-subtle/70 bg-mn-bg px-3 py-3 text-sm font-semibold text-mn-text-secondary shadow-mn-soft disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-border-subtle focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg active:translate-y-[1px] active:scale-[0.99] active:shadow-none transition-all duration-150"
            aria-label="Skip"
          >
            <SkipForward className="h-5 w-5" />
            <span className="hidden sm:inline">Skip</span>
          </button>
          <button
            type="button"
            onClick={() => performSwipe("like")}
            disabled={actionsDisabled}
            className="flex items-center justify-center gap-2 rounded-xl border border-transparent bg-mn-primary/95 px-3 py-3 text-sm font-semibold text-mn-bg shadow-mn-soft disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg active:translate-y-[1px] active:scale-[0.99] active:shadow-none transition-all duration-150"
            aria-label="Like"
          >
            <ThumbsUp className="h-5 w-5" />
            <span className="hidden sm:inline">Like</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SwipePage;
