import React, { useCallback, useMemo, useRef, useState } from "react";
import { BookmarkPlus, Clock, Film, Star, ThumbsDown, ThumbsUp, Users } from "lucide-react";
import { useSwipeDeck } from "./useSwipeDeck";

type SwipeDirection = "like" | "dislike" | "skip";

interface LastSwipe {
  cardId: string;
  title: string;
  direction: SwipeDirection;
  at: string;
}

const SWIPE_THRESHOLD_PX = 80;
const MAX_ROTATION_DEG = 8;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const formatRuntime = (minutes?: number): string | null => {
  if (!minutes || minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours <= 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
};

const directionLabel = (direction: SwipeDirection): string => {
  if (direction === "like") return "Liked";
  if (direction === "dislike") return "Disliked";
  return "Skipped";
};

const directionColorClass = (direction: SwipeDirection): string => {
  if (direction === "like") return "text-emerald-400";
  if (direction === "dislike") return "text-rose-400";
  return "text-mn-text-secondary";
};

const SwipeFromFriendsTab: React.FC = () => {
  const { cards, swipe, swipeAsync } = useSwipeDeck("from-friends", { limit: 40 });

  const deck = useMemo(() => cards, [cards]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [lastSwipe, setLastSwipe] = useState<LastSwipe | null>(null);

  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [watchlist, setWatchlist] = useState<Record<string, boolean>>({});

  React.useEffect(() => {
    if (!cards.length) return;

    const nextRatings: Record<string, number> = {};
    const nextWatchlist: Record<string, boolean> = {};

    for (const card of cards) {
      if (card.initialRating != null) {
        nextRatings[card.id] = card.initialRating;
      }
      if (card.initiallyInWatchlist != null) {
        nextWatchlist[card.id] = card.initiallyInWatchlist;
      }
    }

    setRatings(nextRatings);
    setWatchlist(nextWatchlist);
  }, [cards]);

  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef<number | null>(null);

  const currentCard = useMemo(() => deck[currentIndex] ?? null, [deck, currentIndex]);
  const nextCard = useMemo(() => deck[currentIndex + 1] ?? null, [deck, currentIndex]);

  const handleSwipe = useCallback(
    (direction: SwipeDirection) => {
      setIsDragging(false);
      setDragX(0);
      dragStartX.current = null;

      const card = deck[currentIndex];
      if (!card) return;

      const ratingForCard = ratings[card.id] ?? card.initialRating ?? null;
      const watchlistForCard = watchlist[card.id] ?? card.initiallyInWatchlist ?? undefined;

      swipe({
        cardId: card.id,
        direction,
        rating: ratingForCard,
        inWatchlist: watchlistForCard,
      });

      setLastSwipe({
        cardId: card.id,
        title: card.title,
        direction,
        at: new Date().toISOString(),
      });

      setCurrentIndex((idx) => (idx + 1 >= deck.length ? deck.length : idx + 1));
    },
    [currentIndex, deck, ratings, swipe, watchlist],
  );

  const hasMore = currentIndex < deck.length;

  const startDrag = (clientX: number) => {
    if (!currentCard) return;
    setIsDragging(true);
    dragStartX.current = clientX;
  };

  const moveDrag = (clientX: number) => {
    if (!isDragging || dragStartX.current == null) return;
    const deltaX = clientX - dragStartX.current;
    setDragX(deltaX);
  };

  const endDrag = () => {
    if (!isDragging) return;

    const absX = Math.abs(dragX);
    if (absX > SWIPE_THRESHOLD_PX) {
      const direction: SwipeDirection = dragX > 0 ? "like" : "dislike";
      handleSwipe(direction);
    } else {
      setIsDragging(false);
      setDragX(0);
      dragStartX.current = null;
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    startDrag(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (!isDragging) return;
    moveDrag(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    endDrag();
  };

  const handlePointerCancel = () => {
    endDrag();
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLElement>) => {
    const touch = e.touches[0];
    if (!touch) return;
    startDrag(touch.clientX);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLElement>) => {
    const touch = e.touches[0];
    if (!touch) return;
    moveDrag(touch.clientX);
  };

  const handleTouchEnd = () => {
    endDrag();
  };

  const handleTouchCancel = () => {
    endDrag();
  };

  const adjustRating = (cardId: string, delta: number) => {
    setRatings((prev) => {
      const current = prev[cardId] ?? 0;
      const next = clamp(current + delta, 0, 5);
      const nextState = {
        ...prev,
        [cardId]: next,
      };

      swipeAsync({
        cardId,
        direction: next === 0 ? "skip" : "like",
        rating: next === 0 ? null : next,
        inWatchlist: watchlist[cardId] ?? undefined,
      }).catch(() => {
        setRatings((currentState) => ({
          ...currentState,
          [cardId]: current,
        }));
      });

      return nextState;
    });
  };

  const toggleWatchlist = (cardId: string) => {
    setWatchlist((prev) => {
      const previous = !!prev[cardId];
      const nextValue = !previous;
      const nextState = {
        ...prev,
        [cardId]: nextValue,
      };

      swipeAsync({
        cardId,
        direction: "skip",
        rating: ratings[cardId] ?? null,
        inWatchlist: nextValue,
      }).catch(() => {
        setWatchlist((currentState) => ({
          ...currentState,
          [cardId]: previous,
        }));
      });

      return nextState;
    });
  };

  if (!hasMore || !currentCard) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-3 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-mn-primary/15">
          <Users className="h-5 w-5 text-mn-primary" aria-hidden={true} />
        </div>
        <h2 className="text-sm font-heading font-semibold text-mn-text-primary">
          You&apos;re all caught up on friends&apos; picks
        </h2>
        <p className="mt-1 max-w-xs text-[11px] text-mn-text-secondary">
          You&apos;ve swiped through all of your friends&apos; latest picks. As they log new titles
          and update their diaries, new cards will show up here.
        </p>
        {lastSwipe && (
          <div className="mt-3 rounded-lg border border-mn-border-subtle/60 bg-mn-surface-elevated/80 px-3 py-2 text-[11px] text-mn-text-secondary">
            <p className="inline-flex flex-wrap items-center gap-1">
              <span className="text-mn-text-muted">Last swipe:</span>
              <span className={`font-medium ${directionColorClass(lastSwipe.direction)}`}>
                {directionLabel(lastSwipe.direction)}
              </span>{" "}
              <span className="font-medium text-mn-text-primary">{lastSwipe.title}</span>
            </p>
          </div>
        )}
      </div>
    );
  }

  const runtimeLabel = formatRuntime(currentCard.runtimeMinutes);
  const dragProgress = clamp(dragX / 120, -1, 1);
  const rotation = dragProgress * MAX_ROTATION_DEG;

  const likeHint = dragX > 40;
  const dislikeHint = dragX < -40;

  const currentRating = ratings[currentCard.id] ?? 0;
  const currentInWatchlist = !!watchlist[currentCard.id];

  const ratingLabel = currentRating === 0 ? "Not rated yet" : `${currentRating.toFixed(1)}★`;

  const friendLikes = currentCard.friendLikesCount ?? 0;
  const friendLikesLabel =
    friendLikes === 0
      ? "No friends have rated this yet"
      : friendLikes === 1
        ? "1 friend liked this"
        : `${friendLikes} friends liked this`;

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between gap-2 px-1 pb-1">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-mn-primary-soft">
            From Friends · Swipe deck
          </p>
          <h2 className="text-sm font-heading font-semibold text-mn-text-primary">
            What your friends are watching
          </h2>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-mn-text-muted">
          <Clock className="h-3.5 w-3.5" aria-hidden={true} />
          <span>Swipe through friends&apos; picks</span>
        </div>
      </header>

      <div className="relative mt-2 flex flex-1 flex-col">
        <div className="relative flex flex-1 items-center justify-center">
          {nextCard && (
            <div
              aria-hidden={true}
              className="pointer-events-none absolute inset-0 mx-auto h-[72%] max-h-[360px] max-w-md rounded-[26px] border border-mn-border-subtle/40 bg-mn-bg-elevated/60 shadow-mn-card blur-[0.5px]"
            />
          )}

          <article
            className={`relative z-10 mx-auto h-[72%] max-h-[360px] w-full max-w-md rounded-[26px] border border-mn-border-subtle/80 bg-gradient-to-br from-mn-bg-elevated/90 via-mn-bg-elevated/85 to-purple-900/60 shadow-mn-card ${
              !isDragging ? "transition-transform duration-200 ease-out" : ""
            }`}
            style={{
              transform: `translateX(${dragX}px) rotate(${rotation}deg)`,
              touchAction: "pan-y",
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchCancel}
          >
            {/* Floating swipe hints */}
            <div className="pointer-events-none absolute inset-x-0 top-3 flex items-center justify-between px-4 text-[10px] font-semibold uppercase tracking-wide">
              <div
                className={`rounded-md border px-2 py-1 ${
                  dislikeHint
                    ? "border-rose-400/80 bg-rose-500/10 text-rose-400"
                    : "border-transparent text-transparent"
                }`}
              >
                Nope
              </div>
              <div
                className={`rounded-md border px-2 py-1 ${
                  likeHint
                    ? "border-emerald-400/80 bg-emerald-500/10 text-emerald-400"
                    : "border-transparent text-transparent"
                }`}
              >
                Like
              </div>
            </div>

            <div className="flex h-full flex-col">
              <div className="flex-1 px-4 pb-3 pt-6">
                <div className="flex items-start gap-3">
                  <div className="relative h-32 w-24 flex-shrink-0 overflow-hidden rounded-2xl border border-mn-border-subtle/70 bg-mn-bg-elevated/80">
                    {currentCard.posterUrl ? (
                      <>
                        <img
                          src={currentCard.posterUrl}
                          alt={`${currentCard.title} poster`}
                          className="h-full w-full object-cover"
                        />
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-mn-bg-elevated/70 via-transparent to-transparent" />
                      </>
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-gradient-to-br from-mn-surface-elevated/80 via-mn-bg to-mn-primary/70 text-[10px] text-mn-text-muted">
                        <Film className="h-4 w-4 text-mn-primary" aria-hidden={true} />
                        <span>No poster yet</span>
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-mn-primary-soft">
                      From your friends
                    </p>
                    <h3 className="mt-0.5 line-clamp-2 text-lg font-heading font-semibold leading-snug text-mn-text-primary">
                      {currentCard.title}
                    </h3>
                    <p className="mt-1 text-[11px] text-mn-text-secondary">
                      {currentCard.year ?? "New"}
                      {currentCard.type ? ` · ${currentCard.type}` : null}
                      {runtimeLabel ? ` · ${runtimeLabel}` : null}
                    </p>
                    {currentCard.mood && (
                      <p className="mt-0.5 text-[10px] text-mn-text-muted">{currentCard.mood}</p>
                    )}
                    {currentCard.vibeTag && (
                      <p className="mt-0.5 text-[10px] text-mn-primary-soft">
                        {currentCard.vibeTag}
                      </p>
                    )}
                  </div>
                </div>

                {currentCard.tagline && (
                  <p className="mt-3 text-[11px] text-mn-text-secondary line-clamp-3">
                    {currentCard.tagline}
                  </p>
                )}

                {/* Friends who liked it + best friend review snippet */}
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2 text-[10px] text-mn-text-secondary">
                    <div className="inline-flex items-center gap-1 rounded-full bg-mn-surface-elevated/80 px-2 py-0.5">
                      <Users className="h-3.5 w-3.5 text-mn-primary" aria-hidden={true} />
                      <span>{friendLikesLabel}</span>
                    </div>
                    {currentCard.topFriendName && (
                      <span className="text-mn-text-muted">
                        Most similar taste:{" "}
                        <span className="font-medium text-mn-text-primary">
                          {currentCard.topFriendName}
                        </span>
                      </span>
                    )}
                  </div>

                  {currentCard.topFriendName && currentCard.topFriendReviewSnippet && (
                    <div className="flex gap-2 rounded-xl border border-mn-border-subtle/60 bg-mn-bg-elevated/80 px-3 py-2 text-[11px] text-mn-text-secondary">
                      <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-mn-primary/20 text-[10px] font-semibold text-mn-primary">
                        {currentCard.topFriendInitials ??
                          currentCard.topFriendName.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-medium text-mn-primary-soft uppercase tracking-wide">
                          {currentCard.topFriendName}&apos;s review
                        </p>
                        <p className="mt-0.5 line-clamp-2 italic">
                          “{currentCard.topFriendReviewSnippet}”
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Rating + watchlist controls */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wide text-mn-text-muted">
                      Your rating
                    </span>
                    <div className="inline-flex items-center gap-1 rounded-full border border-mn-border-subtle/70 bg-mn-surface-elevated/80 px-2 py-0.5">
                      <button
                        type="button"
                        className="h-6 w-6 rounded-full text-xs font-semibold text-mn-text-primary hover:bg-mn-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-1 focus-visible:ring-offset-mn-bg"
                        onClick={() => adjustRating(currentCard.id, -0.5)}
                        aria-label="Decrease rating"
                      >
                        −
                      </button>
                      <div className="flex items-center gap-1">
                        <Star
                          className={`h-3.5 w-3.5 ${
                            currentRating > 0 ? "text-amber-300" : "text-mn-text-muted"
                          }`}
                          aria-hidden={true}
                        />
                        <span className="min-w-[3.5rem] text-center font-medium">
                          {ratingLabel}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="h-6 w-6 rounded-full text-xs font-semibold text-mn-text-primary hover:bg-mn-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-1 focus-visible:ring-offset-mn-bg"
                        onClick={() => adjustRating(currentCard.id, 0.5)}
                        aria-label="Increase rating"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleWatchlist(currentCard.id)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium shadow-mn-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-1 focus-visible:ring-offset-mn-bg ${
                      currentInWatchlist
                        ? "border-mn-primary/70 bg-mn-primary/15 text-mn-primary"
                        : "border-mn-border-subtle/70 bg-mn-surface-elevated/80 text-mn-text-primary hover:border-mn-primary/60 hover:bg-mn-surface-elevated"
                    }`}
                  >
                    <BookmarkPlus className="h-3.5 w-3.5" aria-hidden={true} />
                    <span>{currentInWatchlist ? "In Watchlist" : "Add to Watchlist"}</span>
                  </button>
                </div>
              </div>

              {/* Bottom swipe controls */}
              <div className="flex items-center justify-center gap-4 border-t border-mn-border-subtle/60 bg-mn-bg-elevated/80 px-4 py-3">
                <button
                  type="button"
                  onClick={() => handleSwipe("dislike")}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-rose-500/50 bg-rose-500/10 text-rose-300 shadow-mn-card transition hover:bg-rose-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1 focus-visible:ring-offset-mn-bg"
                  aria-label="Dislike"
                >
                  <ThumbsDown className="h-4 w-4" aria-hidden={true} />
                </button>

                <button
                  type="button"
                  onClick={() => handleSwipe("skip")}
                  className="inline-flex items-center justify-center rounded-full border border-mn-border-subtle/70 bg-mn-surface-elevated/80 px-3 py-1.5 text-[11px] font-medium text-mn-text-secondary shadow-mn-card hover:border-mn-primary/60 hover:text-mn-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-1 focus-visible:ring-offset-mn-bg"
                  aria-label="Skip this title"
                >
                  Skip
                </button>

                <button
                  type="button"
                  onClick={() => handleSwipe("like")}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-emerald-500/60 bg-emerald-500/10 text-emerald-300 shadow-mn-card transition hover:bg-emerald-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1 focus-visible:ring-offset-mn-bg"
                  aria-label="Like"
                >
                  <ThumbsUp className="h-4 w-4" aria-hidden={true} />
                </button>
              </div>
            </div>
          </article>
        </div>

        {/* Last swipe summary bar */}
        {lastSwipe && (
          <div className="pointer-events-none mt-2 flex justify-center px-2">
            <div className="pointer-events-auto inline-flex max-w-md flex-1 items-center justify-between gap-2 rounded-full border border-mn-border-subtle/70 bg-mn-surface-elevated/90 px-3 py-1.5 text-[10px] text-mn-text-secondary shadow-mn-card">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-full bg-mn-bg-elevated/80 px-2 py-0.5 font-medium ${directionColorClass(
                    lastSwipe.direction,
                  )}`}
                >
                  <span>{directionLabel(lastSwipe.direction)}</span>
                </span>
                <span className="truncate text-mn-text-primary">{lastSwipe.title}</span>
              </div>
              <span className="hidden text-[9px] text-mn-text-muted sm:inline">
                Swipe to keep tuning your friends feed
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SwipeFromFriendsTab;
