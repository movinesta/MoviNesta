import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Flame,
  Info,
  SkipForward,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import TopBar from "../../components/shared/TopBar";
import { SwipeDirection, useSwipeDeck } from "./useSwipeDeck";

const ONBOARDING_STORAGE_KEY = "mn_swipe_onboarding_seen";
const SWIPE_THRESHOLD = 72;
const MAX_DRAG = 160;

const formatRuntime = (minutes?: number | null): string | null => {
  if (!minutes || minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
};

const SwipePage: React.FC = () => {
  const { cards, isLoading, isError, swipe } = useSwipeDeck("for-you", { limit: 32 });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const activeCard = useMemo(() => cards[currentIndex], [cards, currentIndex]);
  const nextCard = useMemo(() => cards[currentIndex + 1], [cards, currentIndex]);

  const cardRef = useRef<HTMLDivElement | null>(null);
  const dragStartX = useRef<number | null>(null);
  const dragDelta = useRef(0);
  const rafRef = useRef<number>();

  useEffect(() => {
    const hasSeen = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    setShowOnboarding(!hasSeen);
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const setCardTransform = (x: number, withTransition: boolean) => {
    const node = cardRef.current;
    if (!node) return;

    const limitedX = Math.max(-MAX_DRAG, Math.min(MAX_DRAG, x));
    const rotate = Math.max(-10, Math.min(10, (limitedX / MAX_DRAG) * 12));

    node.style.transition = withTransition
      ? "transform 220ms cubic-bezier(0.22,0.61,0.36,1)"
      : "none";
    node.style.transform = `translateX(${limitedX}px) rotate(${rotate}deg)`;
    dragDelta.current = limitedX;
  };

  const resetCardPosition = () => {
    setCardTransform(0, true);
    dragDelta.current = 0;
    dragStartX.current = null;
  };

  const performSwipe = (direction: SwipeDirection) => {
    if (!activeCard) return;

    setShowOnboarding(false);
    localStorage.setItem(ONBOARDING_STORAGE_KEY, "1");

    const exitX = direction === "like" ? 520 : direction === "dislike" ? -520 : 0;

    setCardTransform(exitX, true);

    window.setTimeout(() => {
      setCurrentIndex((prev) => Math.min(prev + 1, cards.length));
      setCardTransform(0, false);
    }, 220);

    swipe({
      cardId: activeCard.id,
      direction,
      rating: activeCard.initialRating ?? null,
      inWatchlist: activeCard.initiallyInWatchlist ?? undefined,
    });
  };

  const handlePointerDown = (clientX: number) => {
    if (!activeCard) return;
    setIsDragging(true);
    dragStartX.current = clientX;
    setCardTransform(dragDelta.current, false);
  };

  const handlePointerMove = (clientX: number) => {
    if (!isDragging || dragStartX.current == null) return;
    const delta = clientX - dragStartX.current;
    dragDelta.current = Math.max(-MAX_DRAG, Math.min(MAX_DRAG, delta));

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = window.requestAnimationFrame(() => setCardTransform(dragDelta.current, false));
  };

  const finishDrag = () => {
    setIsDragging(false);
    const distance = dragDelta.current;

    if (Math.abs(distance) >= SWIPE_THRESHOLD) {
      performSwipe(distance > 0 ? "like" : "dislike");
      return;
    }

    resetCardPosition();
  };

  const renderCardMetadata = () => {
    if (!activeCard) return null;

    const runtimeLabel = formatRuntime(activeCard.runtimeMinutes);
    const badges = [activeCard.type, runtimeLabel, activeCard.mood, activeCard.vibeTag].filter(
      Boolean,
    );

    return (
      <div className="space-y-2 text-left text-[12px] leading-relaxed">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-0.5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-mn-primary-soft">
              Curated for you
            </p>
            <h2 className="truncate text-xl font-semibold text-mn-text-primary">
              {activeCard.title}
            </h2>
            <p className="text-[12px] text-mn-text-secondary">
              {[activeCard.year ?? "New", runtimeLabel].filter(Boolean).join(" · ")}
            </p>
          </div>
          <div className="flex flex-col items-end rounded-2xl bg-mn-bg/70 px-3 py-2 text-[11px] text-mn-text-secondary shadow-mn-soft">
            <div className="inline-flex items-center gap-1 text-xs font-semibold text-mn-primary">
              <Flame className="h-4 w-4" />
              <span>Swipe</span>
            </div>
            <span className="mt-1 text-[10px]">
              Card {currentIndex + 1} / {cards.length || 1}
            </span>
          </div>
        </div>

        {activeCard.tagline && (
          <p className="line-clamp-2 text-[12px] text-mn-text-secondary">{activeCard.tagline}</p>
        )}

        {badges.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {badges.map((badge) => (
              <span
                key={badge}
                className="rounded-full bg-mn-bg-elevated/70 px-2 py-1 text-[10px] text-mn-text-secondary shadow-mn-soft"
              >
                {badge}
              </span>
            ))}
          </div>
        )}

        {(typeof activeCard.imdbRating === "number" ||
          typeof activeCard.rtTomatoMeter === "number") && (
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-mn-text-secondary">
            {typeof activeCard.imdbRating === "number" &&
              !Number.isNaN(activeCard.imdbRating) &&
              activeCard.imdbRating > 0 && (
                <div className="inline-flex items-center gap-1 rounded-full bg-mn-surface-elevated/80 px-2 py-1">
                  <StarIcon />
                  <span className="font-semibold text-mn-text-primary">IMDb</span>{" "}
                  {activeCard.imdbRating.toFixed(1)}
                </div>
              )}
            {typeof activeCard.rtTomatoMeter === "number" &&
              !Number.isNaN(activeCard.rtTomatoMeter) &&
              activeCard.rtTomatoMeter > 0 && (
                <div className="inline-flex items-center gap-1 rounded-full bg-mn-surface-elevated/80 px-2 py-1">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span className="font-semibold text-mn-text-primary">Tomatometer</span>{" "}
                  {activeCard.rtTomatoMeter}%
                </div>
              )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="relative flex min-h-[calc(100vh-6rem)] flex-col overflow-hidden rounded-3xl border border-mn-border-subtle/70 bg-mn-bg-elevated/80 p-3 shadow-mn-card sm:p-5">
      <TopBar title="Swipe" subtitle="One focused card, no clutter" />

      <div className="relative mt-2 flex flex-1 flex-col overflow-hidden rounded-2xl border border-mn-border-subtle/60 bg-gradient-to-b from-mn-bg/90 via-mn-bg to-mn-bg-elevated/80 p-3">
        <header className="mb-3 flex items-center justify-between text-[12px] text-mn-text-secondary">
          <div className="inline-flex items-center gap-2 rounded-full bg-mn-bg-elevated/70 px-3 py-2 text-mn-text-primary shadow-mn-soft">
            <Sparkles className="h-4 w-4 text-mn-primary" />
            <span>Swipe to tune recommendations</span>
          </div>
          <div className="hidden items-center gap-2 rounded-full bg-mn-bg/70 px-3 py-2 shadow-mn-soft sm:flex">
            <Clock className="h-4 w-4" />
            <span>Right = like · Left = dislike</span>
          </div>
        </header>

        <div className="relative flex flex-1 items-center justify-center overflow-hidden">
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
                  className="pointer-events-none absolute inset-0 mx-auto h-[68%] max-h-[420px] w-full max-w-md rounded-[28px] border border-mn-border-subtle/40 bg-mn-bg/70 shadow-mn-card"
                  style={{ transform: "translateY(12px) scale(0.96)" }}
                />
              )}

              <article
                ref={cardRef}
                className="relative z-10 mx-auto flex h-[70%] max-h-[440px] w-full max-w-md flex-col overflow-hidden rounded-[28px] border border-mn-border-subtle/70 bg-gradient-to-br from-mn-bg-elevated/95 via-mn-bg/95 to-mn-bg-elevated/90 shadow-mn-card"
                onPointerDown={(e) => e.button === 0 && handlePointerDown(e.clientX)}
                onPointerMove={(e) => handlePointerMove(e.clientX)}
                onPointerUp={finishDrag}
                onPointerCancel={finishDrag}
                onTouchStart={(e) => handlePointerDown(e.touches[0]?.clientX ?? 0)}
                onTouchMove={(e) => handlePointerMove(e.touches[0]?.clientX ?? 0)}
                onTouchEnd={finishDrag}
                aria-label={activeCard.title}
              >
                {activeCard.posterUrl && (
                  <div className="relative h-1/2 overflow-hidden">
                    <img
                      src={activeCard.posterUrl}
                      alt=""
                      className="h-full w-full object-cover"
                      draggable={false}
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-mn-bg via-transparent to-transparent" />
                  </div>
                )}

                <div className="flex flex-1 flex-col justify-between bg-gradient-to-b from-mn-bg/90 via-mn-bg/95 to-mn-bg/98 px-4 pb-4 pt-3">
                  {renderCardMetadata()}

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-mn-text-secondary">
                    {typeof activeCard.friendLikesCount === "number" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-mn-surface-elevated/80 px-2 py-1">
                        <Flame className="h-4 w-4 text-mn-primary" />
                        {activeCard.friendLikesCount === 1
                          ? "1 friend likes this"
                          : `${activeCard.friendLikesCount ?? 0} friends like this`}
                      </span>
                    )}
                    {activeCard.topFriendName && activeCard.topFriendReviewSnippet && (
                      <span className="line-clamp-1 text-mn-text-primary">
                        {activeCard.topFriendName}: “{activeCard.topFriendReviewSnippet}”
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
            className="flex items-center justify-center gap-2 rounded-full border border-mn-border-subtle/70 bg-mn-bg px-3 py-3 text-sm font-semibold text-rose-400 shadow-mn-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
            aria-label="Dislike"
          >
            <ThumbsDown className="h-5 w-5" />
            <span className="hidden sm:inline">Dislike</span>
          </button>
          <button
            type="button"
            onClick={() => performSwipe("skip")}
            className="flex items-center justify-center gap-2 rounded-full border border-mn-border-subtle/70 bg-mn-bg px-3 py-3 text-sm font-semibold text-mn-text-primary shadow-mn-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
            aria-label="Skip"
          >
            <SkipForward className="h-5 w-5" />
            <span className="hidden sm:inline">Skip</span>
          </button>
          <button
            type="button"
            onClick={() => performSwipe("like")}
            className="flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-mn-primary to-amber-400 px-3 py-3 text-sm font-semibold text-white shadow-mn-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
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

const StarIcon: React.FC = () => (
  <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 fill-amber-300 text-amber-300" role="img">
    <path d="M12 .587l3.668 7.431 8.207 1.193-5.938 5.787 1.402 8.168L12 18.896l-7.339 3.87 1.402-8.168L.125 9.211l8.207-1.193z" />
  </svg>
);

export default SwipePage;
