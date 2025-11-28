import React, { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Flame,
  Info,
  SkipForward,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import TopBar from "../../components/shared/TopBar";
import type { SwipeCardData, SwipeDirection } from "./useSwipeDeck";
import { useSwipeDeck } from "./useSwipeDeck";

const ONBOARDING_STORAGE_KEY = "mn_swipe_onboarding_seen";
const SWIPE_DISTANCE_THRESHOLD = 88;
const SWIPE_VELOCITY_THRESHOLD = 0.32; // px per ms
const MAX_DRAG = 220;
const EXIT_MULTIPLIER = 16;
const EXIT_MIN = 360;
const ROTATION_FACTOR = 14;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

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

interface CardMetadataProps {
  card: SwipeCardData;
}

const CardMetadata: React.FC<CardMetadataProps> = ({ card }) => {
  const runtimeLabel = formatRuntime(card.runtimeMinutes);
  const hasImdbRating =
    typeof card.imdbRating === "number" && !Number.isNaN(card.imdbRating) && card.imdbRating > 0;
  const hasTomatometer =
    typeof card.rtTomatoMeter === "number" &&
    !Number.isNaN(card.rtTomatoMeter) &&
    card.rtTomatoMeter > 0;

  return (
    <div className="space-y-3 text-left text-[12px] leading-relaxed">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 className="truncate text-2xl font-heading font-semibold text-mn-text-primary">
            {card.title}
          </h2>
          <p className="text-[12px] text-mn-text-secondary">
            {[card.year ?? "New", card.type, runtimeLabel].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div>
          <span className="mt-1 text-[10px]" />
        </div>
      </div>

      {card.tagline && (
        <p className="line-clamp-3 text-[12px] text-mn-text-secondary">{card.tagline}</p>
      )}

      {(hasImdbRating || hasTomatometer) && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-mn-surface-elevated/60 px-3 py-2 text-[11px] shadow-mn-soft">
          <span className="text-[10px] uppercase tracking-wide text-mn-text-muted">Ratings</span>
          {hasImdbRating && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-1 text-[11px] font-medium text-amber-100">
              <ImdbGlyph />
              <span className="text-mn-text-primary">{card.imdbRating!.toFixed(1)}</span>
            </span>
          )}
          {hasTomatometer && (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-1 text-[11px] font-medium text-rose-200">
              <TomatoGlyph />
              <span className="text-mn-text-primary">{card.rtTomatoMeter}%</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
};

const SwipePage: React.FC = () => {
  const { cards, isLoading, isError, swipe, fetchMore, trimConsumed } = useSwipeDeck("combined", {
    limit: 72,
  });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const activeCard = cards[currentIndex];
  const nextCard = cards[currentIndex + 1];

  const cardRef = useRef<HTMLDivElement | null>(null);
  const dragStartX = useRef<number | null>(null);
  const dragDelta = useRef(0);
  const rafRef = useRef<number>();
  const lastMoveX = useRef<number | null>(null);
  const lastMoveTime = useRef<number | null>(null);
  const velocityRef = useRef(0);

  useEffect(() => {
    const hasSeen = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    setShowOnboarding(!hasSeen);
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

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
    const rotate = clamp(finalX / ROTATION_FACTOR, -12, 12);

    node.style.transition = withTransition
      ? "transform 240ms cubic-bezier(0.22,0.61,0.36,1)"
      : "none";
    node.style.transform = `translateX(${finalX}px) rotate(${rotate}deg)`;
    dragDelta.current = finalX;
  };

  const resetCardPosition = () => {
    setCardTransform(0, { withTransition: true });
    dragDelta.current = 0;
    dragStartX.current = null;
    lastMoveX.current = null;
    lastMoveTime.current = null;
    velocityRef.current = 0;
  };

  const triggerHaptic = () => {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(8);
    }
  };

  const performSwipe = (direction: SwipeDirection, velocity = 0) => {
    if (!activeCard) return;

    setShowOnboarding(false);
    localStorage.setItem(ONBOARDING_STORAGE_KEY, "1");

    const directionSign = direction === "like" ? 1 : direction === "dislike" ? -1 : 0;
    const projectedExit = Math.max(EXIT_MIN, Math.abs(velocity) * 1000 * EXIT_MULTIPLIER);
    const exitX = direction === "skip" ? 0 : directionSign * projectedExit;

    if (direction !== "skip") {
      triggerHaptic();
    }

    setCardTransform(exitX, { withTransition: true, clampDrag: false });

    window.setTimeout(() => {
      setCurrentIndex((prev) => Math.min(prev + 1, cards.length));
      setCardTransform(0);
    }, 240);

    swipe({
      cardId: activeCard.id,
      direction,
      rating: activeCard.initialRating ?? null,
      inWatchlist: activeCard.initiallyInWatchlist ?? undefined,
      sourceOverride: activeCard.source,
    });
  };

  const handlePointerDown = (clientX: number, pointerId?: number) => {
    if (!activeCard) return;
    setIsDragging(true);
    dragStartX.current = clientX;
    lastMoveX.current = clientX;
    lastMoveTime.current = performance.now();
    velocityRef.current = 0;
    if (pointerId != null && cardRef.current?.setPointerCapture) {
      cardRef.current.setPointerCapture(pointerId);
    }
    setCardTransform(dragDelta.current);
  };

  const handlePointerMove = (clientX: number) => {
    if (!isDragging || dragStartX.current == null) return;
    const delta = clientX - dragStartX.current;
    dragDelta.current = clamp(delta, -MAX_DRAG, MAX_DRAG);

    const now = performance.now();
    if (lastMoveX.current != null && lastMoveTime.current != null) {
      const timeDelta = Math.max(8, now - lastMoveTime.current);
      velocityRef.current = (clientX - lastMoveX.current) / timeDelta;
    }
    lastMoveX.current = clientX;
    lastMoveTime.current = now;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = window.requestAnimationFrame(() => setCardTransform(dragDelta.current));
  };

  const finishDrag = () => {
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

  return (
    <div className="relative flex min-h-[calc(100vh-6rem)] flex-col overflow-hidden rounded-3xl border border-mn-border-subtle/70 bg-mn-bg-elevated/80 p-3 shadow-mn-card sm:p-5">
      <TopBar title="Swipe" subtitle="Combined For You, friends, and trending picks" />

      <div className="relative mt-2 flex flex-1 flex-col overflow-hidden rounded-2xl border border-mn-border-subtle/60 bg-gradient-to-b from-mn-bg/90 via-mn-bg to-mn-bg-elevated/80 p-3">
        <div
          className="relative flex flex-1 items-center justify-center overflow-hidden"
          aria-live="polite"
        >
          {isLoading && (
            <div className="flex h-full w-full flex-col items-center justify-center text-sm text-mn-text-secondary">
              <div className="mb-3 h-10 w-10 animate-spin rounded-2xl border-2 border-mn-border-subtle/60 border-t-mn-primary" />
              <p>Loading fresh picks…</p>
            </div>
          )}

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

          {activeCard && (
            <>
              {nextCard && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 mx-auto h-[70%] max-h-[460px] w-full max-w-md rounded-[30px] border border-mn-border-subtle/40 bg-mn-bg/70 shadow-mn-card blur-[0.3px]"
                  style={{ transform: "translateY(14px) scale(0.95)" }}
                />
              )}

              <article
                ref={cardRef}
                className="relative z-10 mx-auto flex h-[72%] max-h-[460px] w-full max-w-md select-none flex-col overflow-hidden rounded-[30px] border border-mn-border-subtle/70 bg-gradient-to-br from-mn-bg-elevated/95 via-mn-bg/95 to-mn-bg-elevated/90 shadow-mn-card backdrop-blur"
                onPointerDown={(e) => {
                  if (e.pointerType === "mouse" && e.button !== 0) return;
                  handlePointerDown(e.clientX, e.pointerId);
                }}
                onPointerMove={(e) => handlePointerMove(e.clientX)}
                onPointerUp={finishDrag}
                onPointerCancel={finishDrag}
                aria-label={activeCard.title}
                style={{ touchAction: "pan-y" }}
              >
                <div className="relative h-[58%] overflow-hidden bg-gradient-to-br from-mn-bg/90 via-mn-bg/85 to-mn-bg/95">
                  {activeCard.posterUrl ? (
                    <img
                      src={activeCard.posterUrl}
                      alt={`${activeCard.title} poster`}
                      className="h-full w-full object-cover"
                      draggable={false}
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-gradient-to-br from-mn-bg via-mn-bg-elevated to-mn-bg text-sm text-mn-text-secondary">
                      No artwork available
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/10 to-mn-bg/85" />
                  <div className="absolute left-3 right-3 top-3 flex flex-wrap items-center justify-between gap-2 text-[10px]">
                    <span className="inline-flex items-center gap-1 rounded-full bg-mn-bg/80 px-2 py-1 font-semibold text-mn-text-primary shadow-mn-soft">
                      <span className="h-1.5 w-1.5 rounded-full bg-mn-primary" />
                      {overlaySourceLabel}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-mn-bg/80 px-2 py-1 text-[10px] text-mn-text-secondary shadow-mn-soft">
                      <Sparkles className="h-3 w-3 text-mn-primary" />
                      Card {currentIndex + 1} / {cards.length || 1}
                    </span>
                  </div>
                </div>

                <div className="flex flex-1 flex-col justify-between bg-gradient-to-b from-mn-bg/92 via-mn-bg/96 to-mn-bg px-4 pb-4 pt-3 backdrop-blur-md">
                  <CardMetadata card={activeCard} />

                  <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-mn-text-secondary">
                    {typeof activeCard.friendLikesCount === "number" &&
                      activeCard.friendLikesCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-mn-surface-elevated/80 px-2 py-1 shadow-mn-soft">
                          <Flame className="h-4 w-4 text-mn-primary" />
                          {activeCard.friendLikesCount === 1
                            ? "1 friend likes this"
                            : `${activeCard.friendLikesCount} friends like this`}
                        </span>
                      )}
                    {activeCard.topFriendName && activeCard.topFriendReviewSnippet && (
                      <span className="inline-flex flex-1 items-start gap-2 rounded-xl bg-mn-bg-elevated/80 px-3 py-2 text-left text-mn-text-primary shadow-mn-soft">
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
                      Drag the card left to pass or right to like. You can also use the buttons
                      below.
                    </p>
                    <button
                      type="button"
                      className="mt-3 w-full rounded-full bg-mn-primary px-3 py-2 text-sm font-semibold text-white shadow-mn-soft"
                      onClick={() => {
                        setShowOnboarding(false);
                        localStorage.setItem(ONBOARDING_STORAGE_KEY, "1");
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

        <div className="mt-4 grid grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => performSwipe("dislike")}
            disabled={actionsDisabled}
            className="flex items-center justify-center gap-2 rounded-full border border-mn-border-subtle/70 bg-mn-bg px-3 py-3 text-sm font-semibold text-rose-400 shadow-mn-soft disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
            aria-label="Dislike"
          >
            <ThumbsDown className="h-5 w-5" />
            <span className="hidden sm:inline">Dislike</span>
          </button>
          <button
            type="button"
            onClick={() => performSwipe("skip")}
            disabled={actionsDisabled}
            className="flex items-center justify-center gap-2 rounded-full border border-mn-border-subtle/70 bg-mn-bg px-3 py-3 text-sm font-semibold text-mn-text-primary shadow-mn-soft disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
            aria-label="Skip"
          >
            <SkipForward className="h-5 w-5" />
            <span className="hidden sm:inline">Skip</span>
          </button>
          <button
            type="button"
            onClick={() => performSwipe("like")}
            disabled={actionsDisabled}
            className="flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-mn-primary to-amber-400 px-3 py-3 text-sm font-semibold text-white shadow-mn-card disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
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

const ImdbGlyph: React.FC = () => (
  <span className="flex h-5 w-9 items-center justify-center rounded-[4px] bg-amber-400 text-[10px] font-black text-black">
    IMDb
  </span>
);

const TomatoGlyph: React.FC = () => (
  <svg
    aria-hidden
    viewBox="0 0 64 64"
    className="h-4 w-4 text-rose-400"
    role="img"
    fill="currentColor"
  >
    <path d="M32 10c1.6-3 4.2-5 7-5.5 2-.3 3.2 1.3 2.3 2.7C39.4 10.4 38 13 38 13s3.6-3 7.5-2.6c2.7.2 4 4.5.6 5.4C39.2 18.6 45 22 45 32.5 45 43 38.5 51 32 51s-13-7.6-13-18.5C19 18 28 15 28 15s-4.4-1-6.6-1.9c-1.7-.7-1-3.4 1.1-3.5 4.5-.2 8.4 2.5 9.5 3.4Z" />
  </svg>
);

export default SwipePage;
