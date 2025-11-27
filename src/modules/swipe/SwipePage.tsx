import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookmarkPlus, Flame, Sparkles, Star, ThumbsDown, ThumbsUp } from "lucide-react";
import { useSwipeDeck } from "./useSwipeDeck";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const SWIPE_THRESHOLD_PX = 78;

const SwipePage: React.FC = () => {
  const { cards, isLoading, swipe } = useSwipeDeck("for-you", { limit: 50 });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const startXRef = useRef<number | null>(null);
  const animationFrame = useRef<number | null>(null);

  useEffect(() => {
    const hasSeen =
      typeof window !== "undefined" ? localStorage.getItem("mn_swipe_onboarding_seen") : "1";
    setShowOnboarding(!hasSeen);
  }, []);

  const currentCard = cards[currentIndex];
  const nextCard = cards[currentIndex + 1];

  useEffect(() => {
    setCurrentIndex(0);
    resetDrag();
  }, [cards.length, resetDrag]);

  const resetDrag = useCallback(() => {
    setIsDragging(false);
    setDragX(0);
    startXRef.current = null;
  }, []);

  const commitOnboarding = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("mn_swipe_onboarding_seen", "1");
    }
    setShowOnboarding(false);
  };

  const handleSwipe = (direction: "like" | "dislike" | "skip") => {
    if (!currentCard) return;

    swipe({ cardId: currentCard.id, direction });
    setCurrentIndex((prev) => Math.min(prev + 1, cards.length));
    resetDrag();
    if (showOnboarding) commitOnboarding();
  };

  const scheduleDragUpdate = (nextX: number) => {
    if (animationFrame.current) cancelAnimationFrame(animationFrame.current);
    animationFrame.current = requestAnimationFrame(() => {
      setDragX(nextX);
    });
  };

  const startDrag = (clientX: number) => {
    if (!currentCard) return;
    setIsDragging(true);
    startXRef.current = clientX;
  };

  const moveDrag = (clientX: number) => {
    if (!isDragging || startXRef.current == null) return;
    scheduleDragUpdate(clientX - startXRef.current);
  };

  const endDrag = () => {
    if (!isDragging) return;

    if (Math.abs(dragX) > SWIPE_THRESHOLD_PX) {
      const direction = dragX > 0 ? "like" : "dislike";
      handleSwipe(direction);
    } else {
      resetDrag();
    }
  };

  useEffect(
    () => () => {
      if (animationFrame.current) cancelAnimationFrame(animationFrame.current);
    },
    [],
  );

  const dragProgress = clamp(dragX / 120, -1, 1);
  const rotation = dragProgress * 5.5;

  const metadataChips = useMemo(() => {
    if (!currentCard) return [] as { label: string; value: string }[];

    const chips: { label: string; value: string }[] = [];
    if (currentCard.type) chips.push({ label: "Format", value: currentCard.type });
    if (currentCard.year) chips.push({ label: "Year", value: String(currentCard.year) });
    if (currentCard.runtimeMinutes)
      chips.push({
        label: "Runtime",
        value: `${Math.floor(currentCard.runtimeMinutes / 60)}h ${
          currentCard.runtimeMinutes % 60
        }m`,
      });
    if (typeof currentCard.imdbRating === "number" && !Number.isNaN(currentCard.imdbRating)) {
      chips.push({ label: "IMDb", value: `${currentCard.imdbRating.toFixed(1)}★` });
    }
    if (typeof currentCard.rtTomatoMeter === "number" && !Number.isNaN(currentCard.rtTomatoMeter)) {
      chips.push({ label: "Tomatometer", value: `${currentCard.rtTomatoMeter}%` });
    }
    if (currentCard.friendLikesCount != null) {
      chips.push({ label: "Friends", value: `${currentCard.friendLikesCount} liked` });
    }
    if (currentCard.vibeTag) chips.push({ label: "Vibe", value: currentCard.vibeTag });
    if (currentCard.mood) chips.push({ label: "Mood", value: currentCard.mood });

    return chips.slice(0, 6);
  }, [currentCard]);

  const cardBackground = currentCard?.posterUrl
    ? {
        backgroundImage: `linear-gradient(180deg, rgba(8,8,12,0.08) 0%, rgba(8,8,12,0.65) 55%, rgba(8,8,12,0.9) 100%), url(${currentCard.posterUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : {
        backgroundImage:
          "radial-gradient(circle at 20% 20%, rgba(248, 113, 113, 0.18), transparent 45%), radial-gradient(circle at 80% 10%, rgba(94, 234, 212, 0.16), transparent 35%), linear-gradient(145deg, rgba(15,23,42,0.9), rgba(30,41,59,0.92))",
      };

  return (
    <div className="relative flex h-full min-h-[calc(100vh-6.25rem)] flex-col overflow-hidden rounded-3xl border border-mn-border-subtle/70 bg-mn-bg-elevated/80 shadow-mn-card">
      <header className="flex items-start justify-between gap-3 px-4 pb-3 pt-4 sm:px-6">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-mn-primary-soft">
            Swipe
          </p>
          <div className="flex flex-wrap items-baseline gap-2">
            <h1 className="text-2xl font-semibold leading-tight">For you</h1>
            <span className="rounded-full bg-mn-bg/70 px-2 py-0.5 text-[11px] text-mn-text-secondary">
              {currentCard ? `Card ${currentIndex + 1} of ${cards.length}` : "No cards"}
            </span>
          </div>
          <p className="text-[12px] text-mn-text-secondary">
            Drag the card left to pass or right to save. Tap actions inside the card for quick
            moves.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 text-[11px] text-mn-text-secondary">
          <span className="inline-flex items-center gap-1 rounded-full bg-mn-bg/70 px-2 py-1">
            <Flame className="h-4 w-4 text-mn-primary" aria-hidden />
            Live tune
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-mn-bg/70 px-2 py-1">
            <Sparkles className="h-4 w-4 text-mn-primary" aria-hidden />
            Stable swipe motion
          </span>
        </div>
      </header>

      <div className="relative flex flex-1 items-center justify-center px-4 pb-4 sm:px-6">
        <div className="relative flex w-full max-w-sm flex-1 justify-center">
          {nextCard && (
            <div
              aria-hidden
              className="absolute inset-0 m-auto h-full max-h-[520px] w-full scale-[0.97] rounded-[28px] border border-mn-border-subtle/60 bg-mn-bg/60 blur-[0.5px]"
            />
          )}

          {currentCard && (
            <article
              role="presentation"
              className="relative z-10 m-auto flex h-full max-h-[520px] w-full max-w-sm select-none flex-col overflow-hidden rounded-[28px] border border-mn-border-subtle/80 shadow-mn-card"
              style={{
                ...cardBackground,
                transform: `translate3d(${dragX}px, ${dragProgress * 6}px, 0) rotate(${rotation}deg)`,
                transition: isDragging
                  ? "transform 18ms linear"
                  : "transform 240ms cubic-bezier(0.22, 0.61, 0.36, 1)",
              }}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                try {
                  e.currentTarget.setPointerCapture(e.pointerId);
                } catch {
                  /* noop */
                }
                startDrag(e.clientX);
              }}
              onPointerMove={(e) => moveDrag(e.clientX)}
              onPointerUp={(e) => {
                try {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                } catch {
                  /* noop */
                }
                endDrag();
              }}
              onPointerCancel={resetDrag}
              onTouchStart={(e) => startDrag(e.touches[0]?.clientX ?? 0)}
              onTouchMove={(e) => moveDrag(e.touches[0]?.clientX ?? 0)}
              onTouchEnd={endDrag}
              onTouchCancel={resetDrag}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent" />

              <div className="flex items-center justify-between px-4 pt-4 text-[11px] font-medium text-mn-text-secondary drop-shadow">
                <span className="inline-flex items-center gap-1 rounded-full bg-mn-bg/70 px-2 py-1 text-mn-text-primary">
                  Swipe-ready
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-mn-bg/70 px-2 py-1">
                  <Star className="h-3.5 w-3.5 text-amber-300" aria-hidden />
                  Responsive motion
                </span>
              </div>

              <div className="relative mt-auto space-y-4 px-4 pb-4">
                <div className="rounded-2xl bg-mn-bg/85 p-4 shadow-mn-soft backdrop-blur">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <h2 className="text-lg font-semibold leading-tight text-mn-text-primary line-clamp-2">
                        {currentCard.title}
                      </h2>
                      {currentCard.tagline && (
                        <p className="text-[12px] text-mn-text-secondary line-clamp-2">
                          {currentCard.tagline}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end text-[11px] text-mn-text-secondary">
                      <span className="rounded-full bg-mn-bg/80 px-2 py-1">
                        {currentCard.type ?? "Title"}
                      </span>
                      <span className="mt-1 text-[11px] text-mn-text-muted">
                        {currentCard.year ?? "New"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-mn-text-secondary">
                    {metadataChips.map((chip) => (
                      <span
                        key={`${chip.label}-${chip.value}`}
                        className="rounded-full bg-mn-bg-elevated/80 px-2 py-1 text-mn-text-primary"
                      >
                        <span className="text-mn-text-muted">{chip.label} · </span>
                        {chip.value}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 text-[12px] font-medium">
                    <button
                      type="button"
                      className="group flex items-center justify-center gap-2 rounded-xl border border-mn-border-subtle/80 bg-mn-bg hover:border-mn-border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary"
                      onClick={() => handleSwipe("dislike")}
                    >
                      <ThumbsDown
                        className="h-4 w-4 text-rose-400 transition-transform group-hover:translate-y-[-1px]"
                        aria-hidden
                      />
                      Pass
                    </button>
                    <button
                      type="button"
                      className="group flex items-center justify-center gap-2 rounded-xl border border-mn-border-subtle/80 bg-mn-bg hover:border-mn-border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary"
                      onClick={() => handleSwipe("skip")}
                    >
                      <BookmarkPlus
                        className="h-4 w-4 text-amber-200 transition-transform group-hover:translate-y-[-1px]"
                        aria-hidden
                      />
                      Save
                    </button>
                    <button
                      type="button"
                      className="group flex items-center justify-center gap-2 rounded-xl border border-mn-border-subtle/80 bg-mn-bg hover:border-mn-border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary"
                      onClick={() => handleSwipe("like")}
                    >
                      <ThumbsUp
                        className="h-4 w-4 text-emerald-300 transition-transform group-hover:translate-y-[-1px]"
                        aria-hidden
                      />
                      Like
                    </button>
                  </div>
                </div>
              </div>

              {showOnboarding && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
                  <div className="pointer-events-auto w-full max-w-xs rounded-2xl bg-mn-bg/95 p-4 text-center text-[13px] text-mn-text-primary shadow-mn-card">
                    <p className="font-semibold text-mn-text-primary">Swipe to explore</p>
                    <p className="mt-1 text-mn-text-secondary">
                      Drag this card left or right. Use the buttons below if you prefer taps.
                    </p>
                    <button
                      type="button"
                      className="mt-3 inline-flex items-center justify-center gap-2 rounded-full bg-mn-primary px-3 py-1.5 text-sm font-semibold text-white shadow-mn-soft"
                      onClick={commitOnboarding}
                    >
                      Got it
                    </button>
                  </div>
                </div>
              )}
            </article>
          )}

          {!currentCard && (
            <div className="flex h-full max-h-[520px] w-full max-w-sm flex-col items-center justify-center rounded-[28px] border border-dashed border-mn-border-subtle/80 bg-mn-bg/70 text-center text-sm text-mn-text-secondary">
              {isLoading
                ? "Loading swipe cards…"
                : "You’re caught up for now. Check back soon for more picks."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SwipePage;
