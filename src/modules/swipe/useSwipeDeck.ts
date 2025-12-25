/**
 * Central hook that orchestrates the swipe experience across Edge Functions
 * (for-you, from-friends, trending). Handles card extraction/validation,
 * interleaving, and local weight adjustments so callers only worry about
 * rendering cards and firing swipes. Assumes the Edge Functions return the
 * minimal card fields defined in `SwipeCardData` and that Supabase RLS limits
 * access by user.
 */
import { QueryClient, useMutation, useQueryClient } from "@tanstack/react-query";
import { qk } from "../../lib/queryKeys";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { tmdbImageUrl } from "@/lib/tmdb";
import { TitleType } from "@/types/supabase-helpers";
import {
  fetchMediaSwipeDeck,
  getOrCreateMediaSwipeSessionId,
  getOrCreateSwipeDeckSeedForMode,
  rotateSwipeDeckSeedForMode,
  sendMediaSwipeEvent,
  uuidv4Fallback,
  type MediaSwipeDeckMode,
} from "./mediaSwipeApi";

export type SwipeDirection = "like" | "dislike" | "skip";

export type SwipeCardData = {
  id: string;
  title: string;
  deckId?: string | null;
  position?: number | null;

  // Core identity
  year?: number | null;
  type?: TitleType | null;

  // Time / mood
  runtimeMinutes?: number | null;
  tagline?: string | null;
  mood?: string | null;
  vibeTag?: string | null;

  // Artwork
  posterUrl?: string | null;
  tmdbPosterPath?: string | null;
  tmdbBackdropPath?: string | null;

  // Social
  friendLikesCount?: number | null;
  topFriendName?: string | null;
  topFriendInitials?: string | null;
  topFriendReviewSnippet?: string | null;
  friendIds?: string[] | null;
  friendProfiles?: FriendProfileLite[] | null;

  // User personalization (initial state)
  initialRating?: number | null;
  initiallyInWatchlist?: boolean;

  // External ratings
  imdbRating?: number | null;
  rtTomatoMeter?: number | null;

  // Source of this card (for-you, from-friends, trending)
  source?: SwipeDeckKind | "combined" | "explore" | null;

  // Optional explanation label (e.g., "More like Inception")
  why?: string | null;

  // 🔥 New: richer metadata pulled from the same fields TitleDetailPage uses
  overview?: string | null; // plot / tmdb_overview
  genres?: string[] | null; // genres / tmdb_genre_names
  language?: string | null; // primary language
  country?: string | null; // primary country
};

export type SwipeDeckKind = "for-you" | "from-friends" | "trending" | "popular";
export type SwipeDeckKindOrCombined = SwipeDeckKind | "combined";
type SwipeBackendSource = "for_you" | "friends" | "trending" | "popular" | "explore" | "combined";

export type FriendProfileLite = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

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
  if (kind === "trending") return "trending";
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

function nextClientEventId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return uuidv4Fallback();
}

export async function fetchSwipeCardsFromSource(
  source: SwipeDeckKindOrCombined,
  count: number,
  sessionId: string,
  opts?: { skipRerank?: boolean },
): Promise<SwipeCardData[]> {
  const mode = mapKindToMode(source);

  try {
    const response = await fetchMediaSwipeDeck(
      {
        sessionId,
        mode,
        limit: Math.max(count, 12),
        // IMPORTANT: a stable seed is required for server-side rerank caching to hit.
        // Use the shared seed store (same one used by useMediaSwipeDeck) so prefetch + main deck share keys.
        seed: getOrCreateSwipeDeckSeedForMode(sessionId, mode, undefined),
        // Background prefetch should avoid calling the reranker.
        skipRerank: opts?.skipRerank === true,
      },
      { timeoutMs: 25000 },
    );

    const cards = (response?.cards ?? []).map((card, idx) => {
      const posterUrl =
        card.posterUrl ?? tmdbImageUrl(card.tmdbPosterPath ?? card.tmdbBackdropPath, "w780");
      const title = (card.title ?? "").trim() || "Untitled";
      const type: TitleType | null =
        card.kind === "series" ? "series" : card.kind === "anime" ? "anime" : "movie";

      return {
        id: card.mediaItemId,
        deckId: response.deckId ?? null,
        position: idx,
        title,
        year: card.releaseYear ?? null,
        type,
        runtimeMinutes: card.runtimeMinutes ?? null,
        posterUrl: posterUrl ?? null,
        tmdbPosterPath: card.tmdbPosterPath ?? null,
        tmdbBackdropPath: card.tmdbBackdropPath ?? null,
        imdbRating: card.tmdbVoteAverage ?? null,
        rtTomatoMeter: null,
        source: mapBackendSource((card as any).source ?? mode),
        why: card.why ?? null,
        overview: card.overview ?? null,
        genres: null,
        language: null,
        country: null,
      } satisfies SwipeCardData;
    });

    if (cards.length) {
      console.debug("[useSwipeDeck]", mode, "returned", cards.length, "cards");
      return cards;
    }
  } catch (err) {
    if ((err as Error)?.name === "AbortError") {
      console.warn("[useSwipeDeck]", mode, "timed out");
    } else {
      console.warn("[useSwipeDeck] invoke error from", mode, err);
    }
  }

  return [];
}

export async function fetchSwipeBatch(
  kind: SwipeDeckKindOrCombined,
  batchSize: number,
  weights?: Record<SwipeDeckKind, number>,
  opts?: { skipRerank?: boolean },
): Promise<SwipeCardData[]> {
  const sessionId = getOrCreateMediaSwipeSessionId();

  if (kind === "combined") {
    const plannedTotal = Math.max(batchSize, 24);
    return fetchSwipeCardsFromSource("combined", plannedTotal, sessionId, opts);
  }

  return fetchSwipeCardsFromSource(kind as SwipeDeckKind, Math.max(batchSize, 12), sessionId, opts);
}

export async function prefillSwipeDeckCache(
  queryClient: QueryClient,
  kind: SwipeDeckKindOrCombined,
  options?: { limit?: number; weights?: Record<SwipeDeckKind, number>; skipRerank?: boolean },
): Promise<void> {
  const limit = options?.limit ?? 40;
  const existing = queryClient.getQueryData<SwipeDeckState>(swipeDeckQueryKey(kind));
  if (existing?.cards.length) return;

  const cards = await fetchSwipeBatch(kind, limit, options?.weights, {
    skipRerank: options?.skipRerank ?? true,
  });
  queryClient.setQueryData(swipeDeckQueryKey(kind), {
    status: cards.length ? "ready" : "loading",
    cards,
    index: null,
    errorMessage: null,
  });
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
  const deckCacheKey = useMemo(() => swipeDeckQueryKey(kind), [kind]);
  const sessionId = useMemo(() => getOrCreateMediaSwipeSessionId(), []);

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
        const raw = await fetchSwipeBatch(kind, batchSize, sourceWeightsRef.current, {
          skipRerank: false,
        });

        if (!raw.length) {
          // No new cards available right now – this is a valid state (end of deck),
          // not necessarily an error. Leave isError=false so the UI can show
          // the "All caught up" message instead of an error state.
          setDeckStateWithCache((prev) => ({
            ...prev,
            status: cardsRef.current.length > 0 ? "ready" : "exhausted",
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
    [appendCards, kind, limit, setDeckStateWithCache],
  );

  useEffect(() => {
    cardsRef.current = [];
    seenIdsRef.current = new Set();
    const cached = queryClient.getQueryData<SwipeDeckState>(deckCacheKey);

    const initialState: SwipeDeckState = cached
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
  }, [deckCacheKey, fetchBatch, kind, limit, queryClient, sessionId, setDeckStateWithCache]);

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
    rotateSwipeDeckSeedForMode(sessionId, mapKindToMode(kind), undefined);
    seenIdsRef.current = new Set();
    cardsRef.current = [];
    fetchingRef.current = false;
    queryClient.removeQueries({ queryKey: deckCacheKey });
    setDeckStateWithCache({ status: "loading", cards: [], index: null, errorMessage: null });
    fetchBatch(limit);
  }, [deckCacheKey, fetchBatch, kind, limit, queryClient, sessionId, setDeckStateWithCache]);

  const swipeMutation = useMutation({
    mutationFn: async ({ cardId, direction, sourceOverride }: SwipeEventPayload) => {
      const card = cardsRef.current.find((c) => c.id === cardId);
      const pos = typeof card?.position === "number" && card.position >= 0 ? card.position : null;

      await sendMediaSwipeEvent({
        sessionId,
        deckId: card?.deckId ?? null,
        position: pos,
        mediaItemId: cardId,
        eventType: direction === "like" ? "like" : direction === "dislike" ? "dislike" : "skip",
        source: sourceOverride ?? (kind === "combined" ? "combined" : kind),
        clientEventId: nextClientEventId(),
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
