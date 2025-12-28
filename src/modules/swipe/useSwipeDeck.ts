import { useCallback, useMemo, useState } from "react";
import type { QueryClient } from "@tanstack/react-query";

import type { TitleType } from "../../types/supabase-helpers";
import {
  fetchMediaSwipeDeck,
  getOrCreateMediaSwipeSessionId,
  type MediaSwipeDeckMode,
} from "./mediaSwipeApi";
import { useMediaSwipeDeck } from "./useMediaSwipeDeck";

// Canonical swipe intents used across the Swipe UI.
// - dislike: swipe left
// - like: swipe right
// - skip: swipe up (or fast-dismiss)
export type SwipeDirection = "dislike" | "like" | "skip";

export type SwipeDeckKind = "for-you" | "from-friends" | "trending" | "popular";
export type SwipeDeckKindOrCombined = SwipeDeckKind | "combined";

type SwipeBackendSource = "for_you" | "friends" | "trending" | "popular" | "combined" | "explore";
export type FriendProfileLite = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

export type SwipeCardData = {
  id: string;
  title: string;
  overview?: string | null;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  year?: number | null;
  type?: TitleType;
  releaseDate?: string | null;
  runtimeMinutes?: number | null;
  // extra metadata (optional)
  director?: string | null;
  writer?: string | null;
  actors?: string | null;
  rated?: string | null;
  metascore?: string | null;
  imdbVotes?: string | null;
  awards?: string | null;
  boxOffice?: string | null;
  genres?: string[] | null;
  language?: string | null;
  country?: string | null;
  imdbRating?: number | null;
  rtTomatoMeter?: number | null;

  // social
  friendProfiles?: FriendProfileLite[];
  friendIds?: string[];
  friendLikesCount?: number;

  // deck context
  deckId?: string | null;
  position?: number;
  source?: SwipeDeckKindOrCombined | "explore" | null;

  // optional user state
  initialRating?: number | null;
  initiallyInWatchlist?: boolean | null;
};

type SwipeDeckStatus = "idle" | "loading" | "ready" | "exhausted" | "error";

type SwipeDeckState = {
  status: SwipeDeckStatus;
  cards: SwipeCardData[];
  index: number | null;
  errorMessage?: string | null;
};

export const swipeDeckQueryKey = (kind: SwipeDeckKindOrCombined) =>
  ["swipeDeck", { variant: kind }] as const;

export const SOURCE_WEIGHTS_STORAGE_KEY = "mn_swipe_source_weights_v1";

export function loadInitialSourceWeights(): Record<SwipeDeckKind, number> {
  if (typeof window === "undefined") {
    return {
      "for-you": 1,
      "from-friends": 1,
      trending: 1,
      popular: 1,
    };
  }

  try {
    const raw = window.localStorage.getItem(SOURCE_WEIGHTS_STORAGE_KEY);
    if (!raw) {
      return {
        "for-you": 1,
        "from-friends": 1,
        trending: 1,
        popular: 1,
      };
    }

    const parsed = JSON.parse(raw) as Partial<Record<SwipeDeckKind, number>>;
    return {
      "for-you": typeof parsed["for-you"] === "number" ? parsed["for-you"] : 1,
      "from-friends": typeof parsed["from-friends"] === "number" ? parsed["from-friends"] : 1,
      trending: typeof parsed.trending === "number" ? parsed.trending : 1,
      popular: typeof parsed.popular === "number" ? parsed.popular : 1,
    };
  } catch {
    return {
      "for-you": 1,
      "from-friends": 1,
      trending: 1,
      popular: 1,
    };
  }
}

interface SwipeEventPayload {
  cardId: string;
  direction: SwipeDirection;
  rating?: number | null;
  inWatchlist?: boolean | null;
  sourceOverride?: SwipeDeckKind;
}

function mapKindToMode(kind: SwipeDeckKindOrCombined): MediaSwipeDeckMode {
  // Server currently supports modes: for_you | friends | trending | combined.
  // "popular" is served via the trending deck but tagged via the card.source field.
  if (kind === "trending" || kind === "popular") return "trending";
  if (kind === "from-friends") return "friends";
  if (kind === "combined") return "combined";
  return "for_you";
}

function mapBackendSource(src: string | null | undefined): SwipeCardData["source"] {
  if (!src) return null;
  const normalized = src.replace("-", "_") as SwipeBackendSource;
  if (normalized === "for_you") return "for-you";
  if (normalized === "friends") return "from-friends";
  if (normalized === "trending") return "trending";
  if (normalized === "popular") return "popular";
  if (normalized === "combined") return "combined";
  if (normalized === "explore") return "explore";
  return null;
}

function mapKindToTitleType(kind: unknown): TitleType {
  if (kind === "series") return "series";
  if (kind === "anime") return "anime";
  return "movie";
}

function mapDeckCardToSwipeCardData(
  card: any,
  deckId: string | null,
  position: number,
  fallbackSource: SwipeDeckKindOrCombined,
): SwipeCardData {
  const friendProfiles: FriendProfileLite[] | undefined = Array.isArray(card.friendProfiles)
    ? card.friendProfiles
    : undefined;

  const friendIds: string[] | undefined = Array.isArray(card.friendIds)
    ? card.friendIds
    : undefined;

  return {
    id: String(card.mediaItemId ?? card.id),
    title: (card.title ?? "Untitled") as string,
    overview: card.overview ?? null,
    posterUrl: card.posterUrl ?? null,
    backdropUrl: card.backdropUrl ?? null,
    year: typeof card.releaseYear === "number" ? card.releaseYear : null,
    type: mapKindToTitleType(card.kind),
    releaseDate: card.releaseDate ?? null,
    runtimeMinutes: typeof card.runtimeMinutes === "number" ? card.runtimeMinutes : null,

    director: card.director ?? null,
    writer: card.writer ?? null,
    actors: card.actors ?? null,
    rated: card.rated ?? null,
    metascore: card.metascore ?? null,
    imdbVotes: card.imdbVotes ?? null,
    awards: card.awards ?? null,
    boxOffice: card.boxOffice ?? null,

    genres: Array.isArray(card.genres) ? card.genres : null,
    language: card.language ?? null,
    country: card.country ?? null,
    imdbRating: typeof card.imdbRating === "number" ? card.imdbRating : null,
    rtTomatoMeter: typeof card.rtTomatoMeter === "number" ? card.rtTomatoMeter : null,

    friendProfiles,
    friendIds,
    friendLikesCount: friendProfiles?.length ?? 0,

    deckId,
    position,
    source: mapBackendSource(card.source) ?? fallbackSource,

    initialRating: typeof card.initialRating === "number" ? card.initialRating : null,
    initiallyInWatchlist:
      typeof card.initiallyInWatchlist === "boolean" ? card.initiallyInWatchlist : null,
  };
}

export async function fetchSwipeBatch(
  kind: SwipeDeckKindOrCombined,
  limit: number,
  // legacy arg kept for compatibility; ignored by the new deck API
  _weights?: Partial<Record<SwipeDeckKind, number>>,
  opts?: { kindFilter?: "movie" | "series" | "anime" | null; skipRerank?: boolean },
): Promise<SwipeCardData[]> {
  const sessionId = getOrCreateMediaSwipeSessionId();
  const mode = mapKindToMode(kind);

  const resp = await fetchMediaSwipeDeck({
    sessionId,
    mode,
    limit,
    kindFilter: opts?.kindFilter ?? null,
    skipRerank: opts?.skipRerank ?? false,
  });

  const deckId = resp.deckId ?? null;
  const cards = Array.isArray(resp.cards) ? resp.cards : [];

  return cards.map((c: any, idx: number) => mapDeckCardToSwipeCardData(c, deckId, idx, kind));
}

export async function prefillSwipeDeckCache(
  queryClient: QueryClient,
  kind: SwipeDeckKindOrCombined,
  options?: {
    limit?: number;
    weights?: Partial<Record<SwipeDeckKind, number>>;
    kindFilter?: "movie" | "series" | "anime" | null;
    skipRerank?: boolean;
  },
): Promise<void> {
  const limit = options?.limit ?? 20;

  const existing = queryClient.getQueryData<SwipeDeckState>(swipeDeckQueryKey(kind));
  if (existing && existing.status === "ready" && existing.cards.length >= Math.min(limit, 10)) {
    return;
  }

  const cards = await fetchSwipeBatch(kind, limit, options?.weights, {
    kindFilter: options?.kindFilter ?? null,
    skipRerank: options?.skipRerank ?? false,
  });

  queryClient.setQueryData<SwipeDeckState>(swipeDeckQueryKey(kind), {
    status: cards.length ? "ready" : "exhausted",
    cards,
    index: cards.length ? 0 : null,
    errorMessage: null,
  });
}

export function buildInterleavedDeck(lists: SwipeCardData[][], limit: number): SwipeCardData[] {
  if (limit <= 0) return [];
  const result: SwipeCardData[] = [];
  const queues = lists.map((l) => [...l]);

  while (result.length < limit) {
    let progressed = false;
    for (const q of queues) {
      const next = q.shift();
      if (next) {
        result.push(next);
        progressed = true;
        if (result.length >= limit) break;
      }
    }
    if (!progressed) break;
  }

  return result;
}

export function trimDeck(
  cards: SwipeCardData[],
  consumed: number,
): { remaining: SwipeCardData[]; exhausted: boolean } {
  if (consumed <= 0) return { remaining: cards, exhausted: false };
  const remaining = cards.slice(consumed);
  return { remaining, exhausted: remaining.length === 0 };
}

/**
 * @deprecated Prefer `useMediaSwipeDeck` + local `currentIndex` state (as in SwipePage).
 * This wrapper is kept for backwards compatibility.
 */
export function useSwipeDeck(
  kind: SwipeDeckKindOrCombined,
  options?: { limit?: number; kindFilter?: "movie" | "series" | "anime" | null },
) {
  const limit = options?.limit ?? 40;

  const {
    cards: rawCards,
    isLoading,
    isError,
    deckError,
    fetchMore,
    refresh,
    trimConsumed: trimRawConsumed,
    swipe,
    swipeSyncError,
    retryFailedSwipe,
    isRetryingSwipe,
    sendEvent,
    sendEventAsync,
  } = useMediaSwipeDeck(kind as any, {
    limit,
    kindFilter: (options?.kindFilter ?? null) as any,
  });

  const [currentIndex, setCurrentIndex] = useState<number>(0);

  const cards = useMemo(() => {
    return rawCards.map((c: any, idx: number) =>
      mapDeckCardToSwipeCardData(c, c.deckId ?? null, idx, kind),
    );
  }, [rawCards, kind]);

  const activeCard = cards[currentIndex] ?? null;

  const setActiveCardIndex = useCallback(
    (index: number) => {
      setCurrentIndex(() => {
        if (!Number.isFinite(index)) return 0;
        return Math.max(0, Math.min(index, Math.max(0, cards.length - 1)));
      });
    },
    [cards.length],
  );

  const trimConsumedCompat = useCallback(
    (consumed: number) => {
      trimRawConsumed(consumed);
      setCurrentIndex((i) => Math.max(0, i - consumed));
    },
    [trimRawConsumed],
  );

  const refreshCompat = useCallback(
    async (opts?: { resetSeed?: boolean }) => {
      await refresh(opts);
      setCurrentIndex(0);
    },
    [refresh],
  );

  const swipeCompat = useCallback(
    (payload: SwipeEventPayload) => {
      const raw = rawCards.find((c: any) => c.id === payload.cardId);
      if (!raw) return;

      swipe({ card: raw, direction: payload.direction });

      // Optional feedback side-events (best-effort, queued offline).
      const source = payload.sourceOverride ?? raw.source ?? null;
      if (typeof payload.rating === "number") {
        sendEvent({
          eventType: "rating",
          mediaItemId: raw.mediaItemId ?? raw.id,
          mediaKind: raw.kind,
          deckId: raw.deckId ?? null,
          position: raw.position ?? null,
          source,
          rating0_10: payload.rating,
        });
      }
      if (typeof payload.inWatchlist === "boolean") {
        sendEvent({
          eventType: "watchlist",
          mediaItemId: raw.mediaItemId ?? raw.id,
          mediaKind: raw.kind,
          deckId: raw.deckId ?? null,
          position: raw.position ?? null,
          source,
          inWatchlist: payload.inWatchlist,
        });
      }

      setCurrentIndex((i) => Math.min(i + 1, Math.max(0, cards.length - 1)));
    },
    [rawCards, swipe, sendEvent, cards.length],
  );

  const swipeAsyncCompat = useCallback(
    async (payload: SwipeEventPayload) => {
      swipeCompat(payload);
      // Also await any explicit feedback events to preserve callsites that expect a Promise.
      const raw = rawCards.find((c: any) => c.id === payload.cardId);
      if (!raw) return;

      const source = payload.sourceOverride ?? raw.source ?? null;
      if (typeof payload.rating === "number") {
        await sendEventAsync({
          eventType: "rating",
          mediaItemId: raw.mediaItemId ?? raw.id,
          mediaKind: raw.kind,
          deckId: raw.deckId ?? null,
          position: raw.position ?? null,
          source,
          rating0_10: payload.rating,
        });
      }
      if (typeof payload.inWatchlist === "boolean") {
        await sendEventAsync({
          eventType: "watchlist",
          mediaItemId: raw.mediaItemId ?? raw.id,
          mediaKind: raw.kind,
          deckId: raw.deckId ?? null,
          position: raw.position ?? null,
          source,
          inWatchlist: payload.inWatchlist,
        });
      }
    },
    [rawCards, swipeCompat, sendEventAsync],
  );

  return {
    cards,
    isLoading,
    isError,
    currentIndex,
    activeCard,
    deckError,
    setActiveCardIndex,
    fetchMore,
    refresh: refreshCompat,
    trimConsumed: trimConsumedCompat,
    swipe: swipeCompat,
    swipeAsync: swipeAsyncCompat,
    swipeSyncError,
    retryFailedSwipe,
    isRetryingSwipe,
  };
}
