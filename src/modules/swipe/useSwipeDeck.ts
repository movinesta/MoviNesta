/**
 * Central hook that orchestrates the swipe experience across Edge Functions
 * (for-you, from-friends, trending). Handles card extraction/validation,
 * interleaving, and local weight adjustments so callers only worry about
 * rendering cards and firing swipes. Assumes the Edge Functions return the
 * minimal card fields defined in `SwipeCardData` and that Supabase RLS limits
 * access by user.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { qk } from "../../lib/queryKeys";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { callSupabaseFunction } from "@/lib/callSupabaseFunction";
import { tmdbImageUrl } from "@/lib/tmdb";

export type SwipeDirection = "like" | "dislike" | "skip";

export type SwipeCardData = {
  id: string;
  title: string;
  year?: number | null;
  runtimeMinutes?: number | null;
  tagline?: string | null;
  mood?: string | null;
  vibeTag?: string | null;
  type?: string | null;
  posterUrl?: string | null;
  tmdbPosterPath?: string | null;
  tmdbBackdropPath?: string | null;
  friendLikesCount?: number | null;
  topFriendName?: string | null;
  topFriendInitials?: string | null;
  topFriendReviewSnippet?: string | null;
  initialRating?: number | null;
  initiallyInWatchlist?: boolean;
  imdbRating?: number | null;
  rtTomatoMeter?: number | null;
  source?: SwipeDeckKind;
};

export type SwipeDeckKind = "for-you" | "from-friends" | "trending";
export type SwipeDeckKindOrCombined = SwipeDeckKind | "combined";

type SwipeDeckStatus = "idle" | "loading" | "ready" | "exhausted" | "error";

interface SwipeDeckState {
  status: SwipeDeckStatus;
  cards: SwipeCardData[];
  index: number | null;
  errorMessage?: string | null;
}

interface SwipeDeckResponse {
  cards: SwipeCardData[];
}

const hasSwipeCardFields = (value: unknown): value is SwipeCardData => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.id === "string" && typeof candidate.title === "string";
};

const extractSwipeCards = (value: unknown): SwipeCardData[] => {
  if (Array.isArray(value)) {
    return value.filter(hasSwipeCardFields);
  }

  const cards = (value as { cards?: unknown }).cards;
  if (Array.isArray(cards)) {
    return cards.filter(hasSwipeCardFields);
  }

  return [];
};

export const SOURCE_WEIGHTS_STORAGE_KEY = "mn_swipe_source_weights_v1";

export function loadInitialSourceWeights(): Record<SwipeDeckKind, number> {
  if (typeof window === "undefined") {
    return {
      "for-you": 1,
      "from-friends": 1,
      trending: 1,
    };
  }

  try {
    const raw = window.localStorage.getItem(SOURCE_WEIGHTS_STORAGE_KEY);
    if (!raw) {
      return {
        "for-you": 1,
        "from-friends": 1,
        trending: 1,
      };
    }

    const parsed = JSON.parse(raw) as Partial<Record<SwipeDeckKind, number>>;
    return {
      "for-you": typeof parsed["for-you"] === "number" ? parsed["for-you"] : 1,
      "from-friends": typeof parsed["from-friends"] === "number" ? parsed["from-friends"] : 1,
      trending: typeof parsed.trending === "number" ? parsed.trending : 1,
    };
  } catch {
    return {
      "for-you": 1,
      "from-friends": 1,
      trending: 1,
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

export function buildInterleavedDeck(lists: SwipeCardData[][], limit: number): SwipeCardData[] {
  const maxLength = Math.max(...lists.map((list) => list.length));
  const interleaved: SwipeCardData[] = [];

  for (let i = 0; i < maxLength; i += 1) {
    for (const list of lists) {
      const card = list[i];
      if (card) {
        interleaved.push(card);
        if (interleaved.length >= limit) return interleaved;
      }
    }
  }

  return interleaved.slice(0, limit);
}

export const trimDeck = (
  cards: SwipeCardData[],
  consumed: number,
): { remaining: SwipeCardData[]; exhausted: boolean } => {
  if (consumed <= 0 || cards.length === 0) {
    return { remaining: cards, exhausted: cards.length === 0 };
  }

  const remaining = cards.slice(Math.min(consumed, cards.length));
  return { remaining, exhausted: remaining.length === 0 };
};

export function useSwipeDeck(kind: SwipeDeckKindOrCombined, options?: { limit?: number }) {
  const limit = options?.limit ?? 40;
  const queryClient = useQueryClient();
  const deckCacheKey = useMemo(() => ["swipeDeck", { variant: kind }], [kind]);

  const seenIdsRef = useRef<Set<string>>(new Set());
  const cardsRef = useRef<SwipeCardData[]>([]);
  const fetchingRef = useRef(false);
  const [deckState, setDeckState] = useState<SwipeDeckState>({
    status: "idle",
    cards: [],
    index: null,
    errorMessage: null,
  });
  const [swipeError, setSwipeError] = useState<{
    payload: SwipeEventPayload;
    message: string;
  } | null>(null);
  const sourceWeightsRef = useRef<Record<SwipeDeckKind, number>>(loadInitialSourceWeights());

  const setDeckStateWithCache = useCallback(
    (updater: SwipeDeckState | ((prev: SwipeDeckState) => SwipeDeckState)) => {
      setDeckState((prev) => {
        const next =
          typeof updater === "function"
            ? (updater as (p: SwipeDeckState) => SwipeDeckState)(prev)
            : updater;
        queryClient.setQueryData(deckCacheKey, next);
        return next;
      });
    },
    [deckCacheKey, queryClient],
  );

  const scheduleAssetPrefetch = useCallback((incoming: SwipeCardData[]) => {
    const idle = (window as typeof window & { requestIdleCallback?: typeof requestIdleCallback })
      .requestIdleCallback;
    const runner = idle ?? ((cb: () => void) => window.setTimeout(cb, 280));

    runner(() => {
      for (const card of incoming) {
        if (!card.posterUrl) continue;
        const img = new Image();
        img.loading = "lazy";
        img.src = card.posterUrl;
      }
    });
  }, []);

  const normalizeCard = useCallback((card: SwipeCardData): SwipeCardData => {
    const tmdbPoster = tmdbImageUrl(card.tmdbPosterPath ?? card.tmdbBackdropPath, "w780");
    const posterUrl = card.posterUrl ?? tmdbPoster ?? null;

    const imdbRating =
      card.imdbRating == null || Number.isNaN(Number(card.imdbRating))
        ? null
        : Number(card.imdbRating);
    const rtTomatoMeter =
      card.rtTomatoMeter == null || Number.isNaN(Number(card.rtTomatoMeter))
        ? null
        : Number(card.rtTomatoMeter);

    return { ...card, imdbRating, rtTomatoMeter, posterUrl };
  }, []);

  const getNewCards = useCallback(
    (incoming: SwipeCardData[]): SwipeCardData[] => {
      if (!incoming.length) return incoming;
      const seen = seenIdsRef.current;
      const fresh: SwipeCardData[] = [];

      for (const card of incoming) {
        if (seen.has(card.id)) continue;
        seen.add(card.id);
        fresh.push(normalizeCard(card));
      }

      return fresh;
    },
    [normalizeCard],
  );

  const appendCards = useCallback(
    (incoming: SwipeCardData[]) => {
      const deduped = getNewCards(incoming);
      if (!deduped.length) return;

      setDeckStateWithCache((prev) => {
        const nextCards = [...prev.cards, ...deduped];
        cardsRef.current = nextCards;
        scheduleAssetPrefetch(deduped);

        return {
          status: "ready",
          cards: nextCards,
          index: prev.index,
          errorMessage: null,
        };
      });
    },
    [getNewCards, scheduleAssetPrefetch, setDeckStateWithCache],
  );

  const fetchFromSource = useCallback(
    async (source: SwipeDeckKind, count: number): Promise<SwipeCardData[]> => {
      const fnName =
        source === "for-you"
          ? "swipe-for-you"
          : source === "from-friends"
            ? "swipe-from-friends"
            : "swipe-trending";

      // 1) Edge function primary
      try {
        const response = await callSupabaseFunction<SwipeDeckResponse>(
          fnName,
          { limit: count },
          { timeoutMs: 25000 },
        );

        const cards = extractSwipeCards(response).map((card) => ({ ...card, source }));
        if (cards.length) {
          console.debug("[useSwipeDeck]", fnName, "returned", cards.length, "cards");
          return cards;
        }
      } catch (err) {
        if ((err as Error)?.name === "AbortError") {
          console.warn("[useSwipeDeck]", fnName, "timed out");
        } else {
          console.warn("[useSwipeDeck] invoke error from", fnName, err);
        }
      }

      return [];
    },
    [],
  );

  const fetchCombinedBatch = useCallback(
    async (batchSize: number): Promise<SwipeCardData[]> => {
      const weights = sourceWeightsRef.current;
      const weightTotal = Object.values(weights).reduce((acc, weight) => acc + weight, 0);
      const plannedTotal = Math.max(batchSize, 18);

      const plannedCounts: Record<SwipeDeckKind, number> = {
        "for-you": Math.max(6, Math.round((weights["for-you"] / weightTotal) * plannedTotal)),
        "from-friends": Math.max(
          4,
          Math.round((weights["from-friends"] / weightTotal) * plannedTotal),
        ),
        trending: Math.max(4, Math.round((weights.trending / weightTotal) * plannedTotal)),
      };

      const [forYou, friends, trending] = await Promise.all([
        fetchFromSource("for-you", plannedCounts["for-you"]),
        fetchFromSource("from-friends", plannedCounts["from-friends"]),
        fetchFromSource("trending", plannedCounts.trending),
      ]);

      let collected: SwipeCardData[][] = [forYou, friends, trending];

      const collectedFlat = collected.flat();
      if (collectedFlat.length < plannedTotal) {
        const deficit = plannedTotal - collectedFlat.length;
        const prioritizedSource = Object.entries(weights).sort(
          (a, b) => b[1] - a[1],
        )[0]?.[0] as SwipeDeckKind;
        const fallback = await fetchFromSource(prioritizedSource ?? "for-you", deficit + 6);
        collected = [...collected, fallback];
      }

      return buildInterleavedDeck(collected, plannedTotal);
    },
    [fetchFromSource],
  );

  const fetchBatch = useCallback(
    async (batchSize = limit) => {
      if (fetchingRef.current) return;
      fetchingRef.current = true;
      setDeckStateWithCache((prev) => ({
        ...prev,
        status: "loading",
        index: prev.index,
        errorMessage: null,
      }));

      try {
        const raw =
          kind === "combined"
            ? await fetchCombinedBatch(batchSize)
            : await fetchFromSource(kind as SwipeDeckKind, Math.max(batchSize, 12));

        if (!raw.length) {
          // No new cards available right now – this is a valid state (end of deck),
          // not necessarily an error. Leave isError=false so the UI can show
          // the "All caught up" message instead of an error state.
          setDeckStateWithCache((prev) => ({
            ...prev,
            status: cardsRef.current.length ? "ready" : "exhausted",
            index: prev.index,
            errorMessage: null,
          }));
          return;
        }

        appendCards(raw);
      } catch (error) {
        console.warn("[useSwipeDeck] fetch error", error);
        const message =
          error instanceof Error
            ? error.message
            : typeof error === "string"
              ? error
              : "We couldn't load swipe cards. Please retry.";

        setDeckStateWithCache((prev) => ({
          ...prev,
          status: "error",
          index: prev.index,
          errorMessage: message,
        }));

        window.setTimeout(() => {
          fetchingRef.current = false;
          fetchBatch(batchSize);
        }, 3200);
        return;
      } finally {
        fetchingRef.current = false;
        setDeckStateWithCache((prev) =>
          prev.status === "loading" && prev.cards.length ? { ...prev, status: "ready" } : prev,
        );
      }
    },
    [appendCards, fetchCombinedBatch, fetchFromSource, kind, limit, setDeckStateWithCache],
  );

  useEffect(() => {
    cardsRef.current = [];
    seenIdsRef.current = new Set();
    const cached = queryClient.getQueryData<SwipeDeckState>(deckCacheKey);

    const initialState = cached
      ? cached.status === "loading" && cached.cards.length
        ? { ...cached, status: "ready" }
        : cached
      : { status: "loading", cards: [], index: null, errorMessage: null };

    cardsRef.current = initialState.cards;
    seenIdsRef.current = new Set(initialState.cards.map((card) => card.id));

    setDeckStateWithCache(initialState);

    if (!initialState.cards.length) {
      fetchBatch(limit);
    }
  }, [deckCacheKey, fetchBatch, limit, queryClient, setDeckStateWithCache]);

  const updateSourceWeights = useCallback(
    (source: SwipeDeckKind | undefined, direction: SwipeDirection) => {
      if (!source) return;
      const delta = direction === "like" ? 0.45 : direction === "dislike" ? -0.35 : -0.1;

      const current = sourceWeightsRef.current;
      const next: Record<SwipeDeckKind, number> = {
        ...current,
        [source]: Math.max(0.2, Math.min(3.5, (current[source] ?? 1) + delta)),
      };

      sourceWeightsRef.current = next;

      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(SOURCE_WEIGHTS_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // Ignore storage errors (private mode, quotas, etc.)
        }
      }
    },
    [],
  );

  const trimConsumed = useCallback(
    (count: number) => {
      if (count <= 0) return;
      setDeckStateWithCache((prev) => {
        const { remaining } = trimDeck(prev.cards, count);
        if (remaining.length === prev.cards.length) return prev;
        cardsRef.current = remaining;
        return { ...prev, cards: remaining };
      });
    },
    [setDeckStateWithCache],
  );

  const refreshDeck = useCallback(() => {
    seenIdsRef.current = new Set();
    cardsRef.current = [];
    fetchingRef.current = false;
    queryClient.removeQueries({ queryKey: deckCacheKey });
    setDeckStateWithCache({ status: "loading", cards: [], index: null, errorMessage: null });
    fetchBatch(limit);
  }, [deckCacheKey, fetchBatch, limit, queryClient, setDeckStateWithCache]);

  const swipeMutation = useMutation({
    mutationFn: async ({
      cardId,
      direction,
      rating,
      inWatchlist,
      sourceOverride,
    }: SwipeEventPayload) => {
      await callSupabaseFunction("swipe-event", {
        titleId: cardId,
        direction,
        source: sourceOverride ?? (kind === "combined" ? undefined : kind),
        rating,
        inWatchlist,
      });
    },
    onError: (error, variables) => {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "We couldn't save that swipe. Please retry.";

      setSwipeError({
        payload: variables,
        message,
      });
    },
    onSuccess: () => {
      // Swiping updates ratings, library entries, and activity feed via the edge function.
      // Invalidate relevant queries so the rest of the app (diary, stats, home) stays in sync.
      queryClient.invalidateQueries({ queryKey: qk.diaryLibrary(null) });
      queryClient.invalidateQueries({ queryKey: qk.homeForYou(null) });
      queryClient.invalidateQueries({ queryKey: qk.homeFeed(null) });
      setSwipeError(null);
    },
  });

  return {
    cards: deckState.cards,
    status: deckState.status,
    isLoading: deckState.status === "loading",
    isError: deckState.status === "error",
    isExhausted: deckState.status === "exhausted",
    deckError: deckState.errorMessage ?? null,
    fetchMore: fetchBatch,
    refresh: refreshDeck,
    trimConsumed,
    swipe: (payload: SwipeEventPayload) => {
      updateSourceWeights(payload.sourceOverride, payload.direction);
      swipeMutation.mutate(payload);
    },
    swipeAsync: async (payload: SwipeEventPayload) => {
      updateSourceWeights(payload.sourceOverride, payload.direction);
      return swipeMutation.mutateAsync(payload);
    },
    swipeSyncError: swipeError?.message ?? null,
    retryFailedSwipe: () => {
      if (swipeError) {
        swipeMutation.mutate(swipeError.payload);
      }
    },
    isRetryingSwipe: swipeMutation.isPending && Boolean(swipeError),
  };
}
