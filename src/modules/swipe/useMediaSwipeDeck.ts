import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { tmdbImageUrl } from "@/lib/tmdb";
import { qk } from "@/lib/queryKeys";

import type { SwipeDirection } from "./useSwipeDeck";
import {
  fetchMediaSwipeDeck,
  getOrCreateMediaSwipeSessionId,
  sendMediaSwipeEvent,
  type MediaSwipeCard,
  type MediaSwipeDeckMode,
  type MediaSwipeEventType,
} from "./mediaSwipeApi";

/**
 * Swipe Brain v2 (media_items-only) deck hook.
 *
 * - Fetches decks from `media-swipe-deck`
 * - Sends events to `media-swipe-event`
 * - Tracks deckId + position per card (important for analytics + future learning)
 *
 * This hook is intentionally UI-agnostic: SwipePage tells it which card is active
 * (via `trackImpression` / `trackDwell`), and calls `swipe()` when user acts.
 */

export type MediaSwipeDeckKind = "for-you" | "from-friends" | "trending";
export type MediaSwipeDeckKindOrCombined = MediaSwipeDeckKind | "combined";

export type MediaSwipeCardUI = MediaSwipeCard & {
  /** media_items.id */
  id: string;

  /** deck id returned by Edge function */
  deckId: string;

  /** index inside the deck response (0-based) */
  position: number;

  /** normalized source for existing UI labels */
  source: MediaSwipeDeckKind | "explore" | "combined" | null;
};

type DeckStatus = "idle" | "loading" | "ready" | "exhausted" | "error";

type DeckState = {
  status: DeckStatus;
  cards: MediaSwipeCardUI[];
  errorMessage?: string | null;
};

type SwipeEventPayload = {
  card: MediaSwipeCardUI;
  direction: SwipeDirection;
  rating0_10?: number | null;
  inWatchlist?: boolean | null;
};

function mapKindToMode(kind: MediaSwipeDeckKindOrCombined): MediaSwipeDeckMode {
  if (kind === "trending") return "trending";
  if (kind === "from-friends") return "friends";
  if (kind === "combined") return "combined";
  return "for_you";
}

function mapBackendSource(src: string | null | undefined): MediaSwipeCardUI["source"] {
  if (!src) return null;
  if (src === "for_you") return "for-you";
  if (src === "friends") return "from-friends";
  if (src === "trending") return "trending";
  if (src === "explore") return "explore";
  if (src === "combined") return "combined";
  return null;
}

function mapDirectionToEventType(direction: SwipeDirection): MediaSwipeEventType {
  if (direction === "like") return "like";
  if (direction === "dislike") return "dislike";
  return "skip";
}

function normalizeCard(card: MediaSwipeCardUI): MediaSwipeCardUI {
  // Prefer explicit posterUrl; otherwise derive from tmdb paths.
  const tmdbPoster = tmdbImageUrl(card.tmdbPosterPath ?? card.tmdbBackdropPath, "w780");
  const posterUrl = card.posterUrl ?? tmdbPoster ?? null;

  // Ensure a title is always available to avoid empty UI states.
  const title = (card.title ?? "").trim() || "Untitled";

  return { ...card, posterUrl, title };
}

function scheduleAssetPrefetch(incoming: MediaSwipeCardUI[]) {
  if (typeof window === "undefined") return;

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
}

export function useMediaSwipeDeck(
  kind: MediaSwipeDeckKindOrCombined,
  options?: { limit?: number; seed?: string | null },
) {
  const limit = options?.limit ?? 60;
  const queryClient = useQueryClient();

  const sessionId = useMemo(() => getOrCreateMediaSwipeSessionId(), []);
  const mode = useMemo(() => mapKindToMode(kind), [kind]);

  const seenIdsRef = useRef<Set<string>>(new Set());
  const fetchingRef = useRef(false);

  const [state, setState] = useState<DeckState>({
    status: "idle",
    cards: [],
    errorMessage: null,
  });

  const [eventError, setEventError] = useState<{
    payload: any;
    message: string;
  } | null>(null);

  const setStateSafe = useCallback((updater: DeckState | ((prev: DeckState) => DeckState)) => {
    setState((prev) => (typeof updater === "function" ? (updater as any)(prev) : updater));
  }, []);

  const appendCards = useCallback((incoming: MediaSwipeCardUI[]) => {
    if (!incoming.length) return;

    const seen = seenIdsRef.current;
    const fresh: MediaSwipeCardUI[] = [];

    for (const raw of incoming) {
      if (seen.has(raw.id)) continue;
      seen.add(raw.id);
      fresh.push(normalizeCard(raw));
    }

    if (!fresh.length) return;

    setStateSafe((prev) => {
      const next = { ...prev, status: "ready" as const, cards: [...prev.cards, ...fresh], errorMessage: null };
      scheduleAssetPrefetch(fresh);
      return next;
    });
  }, [setStateSafe]);

  const fetchBatch = useCallback(async (batchSize = limit) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    setStateSafe((prev) => ({ ...prev, status: "loading", errorMessage: null }));

    try {
      const resp = await fetchMediaSwipeDeck(
        {
          sessionId,
          mode,
          limit: batchSize,
          seed: options?.seed ?? null,
        },
        { timeoutMs: 25000 },
      );

      const deckId = resp.deckId;
      const incoming = (resp.cards ?? []).map((c, idx) => {
        const mapped: MediaSwipeCardUI = {
          ...c,
          id: c.mediaItemId,
          deckId,
          position: idx,
          source: mapBackendSource((c as any).source ?? null),
        };
        return mapped;
      });

      if (!incoming.length) {
        setStateSafe((prev) => ({
          ...prev,
          status: prev.cards.length ? "ready" : "exhausted",
          errorMessage: null,
        }));
        return;
      }

      appendCards(incoming);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : typeof err === "string" ? err : "We couldn't load swipe cards.";

      setStateSafe((prev) => ({ ...prev, status: "error", errorMessage: message }));
    } finally {
      fetchingRef.current = false;
      setStateSafe((prev) => (prev.status === "loading" && prev.cards.length ? { ...prev, status: "ready" } : prev));
    }
  }, [appendCards, limit, mode, options?.seed, sessionId, setStateSafe]);

  useEffect(() => {
    // reset when kind changes
    seenIdsRef.current = new Set();
    fetchingRef.current = false;

    setStateSafe({ status: "loading", cards: [], errorMessage: null });
    fetchBatch(limit);
  }, [fetchBatch, kind, limit, setStateSafe]);

  const refresh = useCallback(() => {
    seenIdsRef.current = new Set();
    fetchingRef.current = false;

    setStateSafe({ status: "loading", cards: [], errorMessage: null });
    fetchBatch(limit);
  }, [fetchBatch, limit, setStateSafe]);

  const trimConsumed = useCallback((count: number) => {
    if (count <= 0) return;
    setStateSafe((prev) => {
      const remaining = prev.cards.slice(Math.min(count, prev.cards.length));
      return { ...prev, cards: remaining };
    });
  }, [setStateSafe]);

  // --- Events ---
  const eventMutation = useMutation({
    mutationFn: async (payload: any) => {
      return sendMediaSwipeEvent(payload, { timeoutMs: 20000 });
    },
    onError: (error, variables) => {
      const message =
        error instanceof Error ? error.message : typeof error === "string" ? error : "We couldn't save that action.";
      setEventError({ payload: variables, message });
    },
    onSuccess: () => {
      setEventError(null);

      // Existing app may still rely on these invalidations; harmless if unused.
      queryClient.invalidateQueries({ queryKey: qk.homeFeed(null) });
      queryClient.invalidateQueries({ queryKey: qk.homeForYou(null) });
    },
  });

  const trackImpression = useCallback((card: MediaSwipeCardUI | undefined, positionOverride?: number) => {
    if (!card) return;

    eventMutation.mutate({
      sessionId,
      deckId: card.deckId,
      position: positionOverride ?? card.position,
      mediaItemId: card.id,
      eventType: "impression" satisfies MediaSwipeEventType,
      source: card.source ?? null,
    });
  }, [eventMutation, sessionId]);

  const trackDwell = useCallback((card: MediaSwipeCardUI | undefined, dwellMs: number, positionOverride?: number) => {
    if (!card) return;
    if (!Number.isFinite(dwellMs) || dwellMs <= 0) return;

    eventMutation.mutate({
      sessionId,
      deckId: card.deckId,
      position: positionOverride ?? card.position,
      mediaItemId: card.id,
      eventType: "dwell" satisfies MediaSwipeEventType,
      dwellMs: Math.round(dwellMs),
      source: card.source ?? null,
    });
  }, [eventMutation, sessionId]);

  const swipe = useCallback((payload: SwipeEventPayload) => {
    const card = payload.card;
    eventMutation.mutate({
      sessionId,
      deckId: card.deckId,
      position: card.position,
      mediaItemId: card.id,
      eventType: mapDirectionToEventType(payload.direction),
      source: card.source ?? null,
      rating0_10: payload.rating0_10 ?? null,
      inWatchlist: payload.inWatchlist ?? null,
    });
  }, [eventMutation, sessionId]);

  const swipeAsync = useCallback(async (payload: SwipeEventPayload) => {
    const card = payload.card;
    return eventMutation.mutateAsync({
      sessionId,
      deckId: card.deckId,
      position: card.position,
      mediaItemId: card.id,
      eventType: mapDirectionToEventType(payload.direction),
      source: card.source ?? null,
      rating0_10: payload.rating0_10 ?? null,
      inWatchlist: payload.inWatchlist ?? null,
    });
  }, [eventMutation, sessionId]);

  return {
    sessionId,
    mode,

    cards: state.cards,
    status: state.status,

    isLoading: state.status === "loading",
    isError: state.status === "error",
    isExhausted: state.status === "exhausted",
    deckError: state.errorMessage ?? null,

    fetchMore: fetchBatch,
    refresh,
    trimConsumed,

    trackImpression,
    trackDwell,

    swipe,
    swipeAsync,

    swipeSyncError: eventError?.message ?? null,
    retryFailedSwipe: () => {
      if (eventError) eventMutation.mutate(eventError.payload);
    },
    isRetryingSwipe: eventMutation.isPending && Boolean(eventError),
  };
}
