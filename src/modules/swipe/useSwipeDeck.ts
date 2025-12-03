import { useMutation, useQueryClient } from "@tanstack/react-query";
import { qk } from "../../lib/queryKeys";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

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

const SOURCE_WEIGHTS_STORAGE_KEY = "mn_swipe_source_weights_v1";

function loadInitialSourceWeights(): Record<SwipeDeckKind, number> {
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
      "from-friends":
        typeof parsed["from-friends"] === "number" ? parsed["from-friends"] : 1,
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
  title?: string;
}

function buildInterleavedDeck(lists: SwipeCardData[][], limit: number): SwipeCardData[] {
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

export function useSwipeDeck(kind: SwipeDeckKindOrCombined, options?: { limit?: number }) {
  const limit = options?.limit ?? 40;

  const seenIdsRef = useRef<Set<string>>(new Set());
  const cardsRef = useRef<SwipeCardData[]>([]);
  const fetchingRef = useRef(false);
  const [cards, setCards] = useState<SwipeCardData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [swipeError, setSwipeError] = useState<{
    payload: SwipeEventPayload;
    message: string;
  } | null>(null);
  const sourceWeightsRef = useRef<Record<SwipeDeckKind, number>>(
    loadInitialSourceWeights(),
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

  const normalizeRatings = useCallback((card: SwipeCardData): SwipeCardData => {
    const imdbRating =
      card.imdbRating == null || Number.isNaN(Number(card.imdbRating))
        ? null
        : Number(card.imdbRating);
    const rtTomatoMeter =
      card.rtTomatoMeter == null || Number.isNaN(Number(card.rtTomatoMeter))
        ? null
        : Number(card.rtTomatoMeter);

    return { ...card, imdbRating, rtTomatoMeter };
  }, []);

  const getNewCards = useCallback(
    (incoming: SwipeCardData[]): SwipeCardData[] => {
      if (!incoming.length) return incoming;
      const seen = seenIdsRef.current;
      const fresh: SwipeCardData[] = [];

      for (const card of incoming) {
        if (seen.has(card.id)) continue;
        seen.add(card.id);
        fresh.push(normalizeRatings(card));
      }

      return fresh;
    },
    [normalizeRatings],
  );

  const appendCards = useCallback(
    (incoming: SwipeCardData[]) => {
      const deduped = getNewCards(incoming);
      if (!deduped.length) return;

      setCards((prev) => {
        const next = [...prev, ...deduped];
        cardsRef.current = next;
        scheduleAssetPrefetch(deduped);
        return next;
      });
    },
    [getNewCards, scheduleAssetPrefetch],
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
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 25000);

        try {
          const { data, error } = await supabase.functions.invoke<SwipeDeckResponse>(fnName, {
            body: { limit: count },
            signal: controller.signal,
          });

          if (error) {
            console.warn("[useSwipeDeck] error from", fnName, error);
          }

          const cards = extractSwipeCards(data).map((card) => ({ ...card, source }));
          if (cards.length) {
            console.debug("[useSwipeDeck]", fnName, "returned", cards.length, "cards");
            return cards;
          }
        } finally {
          window.clearTimeout(timeout);
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
      setIsError(false);
      setIsLoading(true);

      try {
        const raw =
          kind === "combined"
            ? await fetchCombinedBatch(batchSize)
            : await fetchFromSource(kind as SwipeDeckKind, Math.max(batchSize, 12));

        if (!raw.length) {
          // No new cards available right now – this is a valid state (end of deck),
          // not necessarily an error. Leave isError=false so the UI can show
          // the "All caught up" message instead of an error state.
          return;
        }

        appendCards(raw);
      } catch (error) {
        console.warn("[useSwipeDeck] fetch error", error);
        setIsError(true);

        window.setTimeout(() => {
          fetchingRef.current = false;
          fetchBatch(batchSize);
        }, 3200);
        return;
      } finally {
        setIsLoading(false);
        fetchingRef.current = false;
      }
    },
    [appendCards, fetchCombinedBatch, fetchFromSource, kind, limit],
  );

  useEffect(() => {
    setCards([]);
    cardsRef.current = [];
    seenIdsRef.current = new Set();
    setIsLoading(true);
    fetchBatch(limit);
  }, [fetchBatch, limit]);

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

  const trimConsumed = useCallback((count: number) => {
    if (count <= 0) return;
    setCards((prev) => {
      if (!prev.length) return prev;
      const next = prev.slice(Math.min(count, prev.length));
      cardsRef.current = next;
      return next;
    });
  }, []);

  const swipeMutation = useMutation({
    mutationFn: async ({
      cardId,
      direction,
      rating,
      inWatchlist,
      sourceOverride,
      title,
    }: SwipeEventPayload) => {
      const { error } = await supabase.functions.invoke("swipe-event", {
        body: {
          titleId: cardId,
          direction,
          source: sourceOverride ?? (kind === "combined" ? undefined : kind),
          rating,
          inWatchlist,
        },
      });

      if (error) {
        console.warn("[useSwipeDeck] swipe-event error", error);
        throw new Error(error.message ?? "Failed to log swipe");
      }
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
    cards,
    isLoading,
    isError,
    fetchMore: fetchBatch,
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