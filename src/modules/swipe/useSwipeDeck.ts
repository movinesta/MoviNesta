import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

interface SwipeEventPayload {
  cardId: string;
  direction: SwipeDirection;
  rating?: number | null;
  inWatchlist?: boolean | null;
  sourceOverride?: SwipeDeckKind;
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

  const cacheKey = useMemo(() => `mn_swipe_cache_${kind}`, [kind]);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const cardsRef = useRef<SwipeCardData[]>([]);
  const fetchingRef = useRef(false);
  const [cards, setCards] = useState<SwipeCardData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const sourceWeightsRef = useRef<Record<SwipeDeckKind, number>>({
    "for-you": 1,
    "from-friends": 1,
    trending: 1,
  });

  const cacheCards = useCallback(
    (nextCards: SwipeCardData[]) => {
      try {
        localStorage.setItem(cacheKey, JSON.stringify(nextCards.slice(0, 80)));
      } catch (error) {
        console.warn("[useSwipeDeck] failed to cache cards", error);
      }
    },
    [cacheKey],
  );

  const loadCachedCards = useCallback((): SwipeCardData[] => {
    try {
      const stored = localStorage.getItem(cacheKey);
      if (!stored) return [];
      const parsed = JSON.parse(stored) as SwipeCardData[];
      for (const card of parsed) {
        seenIdsRef.current.add(card.id);
      }
      return parsed;
    } catch (error) {
      console.warn("[useSwipeDeck] failed to parse cache", error);
      return [];
    }
  }, [cacheKey]);

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
        cacheCards(next);
        scheduleAssetPrefetch(deduped);
        return next;
      });
    },
    [cacheCards, getNewCards, scheduleAssetPrefetch],
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

          const rawCards = Array.isArray((data as any)?.cards)
            ? (data as any).cards
            : Array.isArray(data)
              ? (data as any)
              : [];

          const cards = rawCards.map((card: any) => ({ ...card, source }));
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

      // 2) Direct Supabase table fallback
      try {
        const { data: rows, error: tableError } = await supabase
          .from("titles")
          .select(
            `
            id,
            title,
            year,
            runtime_minutes,
            synopsis,
            poster_url,
            backdrop_url,
            external_ratings (
              imdb_rating,
              rt_tomato_meter
            )
          `,
          )
          .order("year", { ascending: false })
          .limit(Math.max(count, 16));

        if (tableError) {
          console.warn("[useSwipeDeck] titles table fallback error", tableError);
        }

        if (rows && rows.length) {
          const tableCards: SwipeCardData[] = rows.map((row: any) => ({
            id: String(row.id),
            title: row.title ?? "Untitled",
            year: row.year ?? null,
            runtimeMinutes: row.runtime_minutes ?? null,
            tagline: row.synopsis ?? null,
            imdbRating: row.external_ratings?.imdb_rating ?? null,
            rtTomatoMeter: row.external_ratings?.rt_tomato_meter ?? null,
            posterUrl: row.poster_url ?? row.backdrop_url ?? null,
            source,
          }));
          console.debug(
            "[useSwipeDeck] titles table fallback returned",
            tableCards.length,
            "cards",
          );
          return tableCards;
        }
      } catch (err) {
        console.warn("[useSwipeDeck] titles table fallback threw", err);
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
          const cached = loadCachedCards();
          if (cached.length) {
            setCards(cached);
            cardsRef.current = cached;
            setIsError(false);
          } else {
            setIsError(true);
          }
          return;
        }

        appendCards(raw);
      } catch (error) {
        console.warn("[useSwipeDeck] fetch error", error);
        setIsError(true);

        if (!cardsRef.current.length) {
          const cached = loadCachedCards();
          if (cached.length) {
            setCards(cached);
            cardsRef.current = cached;
            setIsError(false);
          }
        }

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
    [
      appendCards,
      fetchCombinedBatch,
      fetchFromSource,
      kind,
      limit,
      loadCachedCards,
    ],
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
      sourceWeightsRef.current = {
        ...sourceWeightsRef.current,
        [source]: Math.max(0.2, Math.min(3.5, (sourceWeightsRef.current[source] ?? 1) + delta)),
      };
    },
    [],
  );

  const trimConsumed = useCallback(
    (count: number) => {
      if (count <= 0) return;
      setCards((prev) => {
        if (!prev.length) return prev;
        const next = prev.slice(Math.min(count, prev.length));
        cardsRef.current = next;
        cacheCards(next);
        return next;
      });
    },
    [cacheCards],
  );

  const swipeMutation = useMutation({
    mutationFn: async ({
      cardId,
      direction,
      rating,
      inWatchlist,
      sourceOverride,
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
      }
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
  };
}
