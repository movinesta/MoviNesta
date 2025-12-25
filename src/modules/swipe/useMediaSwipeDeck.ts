import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { tmdbImageUrl } from "@/lib/tmdb";
import { qk } from "@/lib/queryKeys";

import type { SwipeDirection } from "./useSwipeDeck";
import {
  fetchMediaSwipeDeck,
  getOrCreateMediaSwipeSessionId,
  getOrCreateSwipeDeckSeedForMode,
  rotateSwipeDeckSeedForMode,
  sendMediaSwipeEvent,
  type MediaSwipeCard,
  type MediaSwipeDeckMode,
  type MediaSwipeEventType,
  uuidv4Fallback,
} from "./mediaSwipeApi";
import { enqueueSwipeEvent, loadQueuedEvents, removeQueuedEvents } from "./eventQueue";

/**
 * Swipe Brain v2 (media_items-only) deck hook — performance-tuned.
 *
 * Key optimizations:
 * - Prefetch only a small number of upcoming images (not the whole deck).
 * - Use smaller TMDB image size for swipe cards to reduce memory/CPU.
 * - Avoid spamming events:
 *   - impression is sent once per card per deck
 *   - dwell is debounced + thresholded
 * - Optional: disable heavy query invalidations (default OFF).
 */

export type MediaSwipeDeckKind = "for-you" | "from-friends" | "trending" | "popular";
export type MediaSwipeDeckKindOrCombined = MediaSwipeDeckKind | "combined";

export type MediaSwipeCardUI = MediaSwipeCard & {
  id: string; // media_items.id
  deckId: string; // deck id returned by edge
  position: number; // index inside deck response (0-based)
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

  // NOTE: rating/watchlist are now tracked via explicit events (eventType: "rating" / "watchlist")
  // to avoid inflating telemetry. These are intentionally NOT sent on swipe events anymore.
  rating0_10?: number | null;
  inWatchlist?: boolean | null;
};

type UseMediaSwipeDeckOptions = {
  limit?: number;
  seed?: string | null;

  /** Filter content kind server-side (movie/series/anime). */
  kindFilter?: "movie" | "series" | "anime" | null;

  /** How many images to prefetch in idle time (default 6). */
  prefetchImages?: number;

  /** Use smaller TMDB size for swipe posters (default "w342"). */
  tmdbPosterSize?: "w185" | "w342" | "w500" | "w780";

  /** Dwell threshold before sending (ms). Default 1200ms. */
  dwellThresholdMs?: number;

  /** Debounce dwell events per card (ms). Default 8000ms. */
  dwellDebounceMs?: number;

  /** Keep legacy invalidations (can be expensive). Default false. */
  invalidateHomeQueries?: boolean;
};

function mapKindToMode(kind: MediaSwipeDeckKindOrCombined): MediaSwipeDeckMode {
  if (kind === "trending" || kind === "popular") return "trending";
  if (kind === "from-friends") return "friends";
  if (kind === "combined") return "combined";
  return "for_you";
}

function mapBackendSource(src: string | null | undefined): MediaSwipeCardUI["source"] {
  if (!src) return null;
  if (src === "for_you") return "for-you";
  if (src === "friends") return "from-friends";
  if (src === "trending") return "trending";
  if (src === "popular") return "popular";
  if (src === "explore") return "explore";
  if (src === "combined") return "combined";
  return null;
}

function mapDirectionToEventType(direction: SwipeDirection): MediaSwipeEventType {
  if (direction === "like") return "like";
  if (direction === "dislike") return "dislike";
  return "skip";
}

function nextClientEventId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return uuidv4Fallback();
}

function normalizeCard(
  card: MediaSwipeCardUI,
  tmdbPosterSize: UseMediaSwipeDeckOptions["tmdbPosterSize"],
): MediaSwipeCardUI {
  const tmdbPoster = tmdbImageUrl(
    card.tmdbPosterPath ?? card.tmdbBackdropPath,
    tmdbPosterSize ?? "w342",
  );
  const posterUrl = card.posterUrl ?? tmdbPoster ?? null;

  const title = (card.title ?? "").trim() || "Untitled";

  return { ...card, posterUrl, title };
}

function scheduleAssetPrefetch(incoming: MediaSwipeCardUI[], max: number) {
  if (typeof window === "undefined") return;
  if (max <= 0) return;

  const conn = (navigator as any).connection;
  if (conn?.saveData) return; // be nice on data-saver

  const idle = (window as typeof window & { requestIdleCallback?: typeof requestIdleCallback })
    .requestIdleCallback;
  const runner = idle ?? ((cb: () => void) => window.setTimeout(cb, 300));

  const slice = incoming.slice(0, max);

  runner(() => {
    for (const card of slice) {
      if (!card.posterUrl) continue;
      const img = new Image();
      img.decoding = "async";
      img.loading = "lazy";
      img.src = card.posterUrl;
    }
  });
}

export function useMediaSwipeDeck(
  kind: MediaSwipeDeckKindOrCombined,
  options?: UseMediaSwipeDeckOptions,
) {
  const limit = options?.limit ?? 60;
  const prefetchImages = options?.prefetchImages ?? 6;
  const tmdbPosterSize = options?.tmdbPosterSize ?? "w342";
  const dwellThresholdMs = options?.dwellThresholdMs ?? 1200;
  const dwellDebounceMs = options?.dwellDebounceMs ?? 8000;
  const invalidateHomeQueries = options?.invalidateHomeQueries ?? false;

  const queryClient = useQueryClient();

  // Flush any queued swipe events (offline/failed) on mount and when the browser comes online.
  useEffect(() => {
    let cancelled = false;

    const flush = async () => {
      if (cancelled) return;
      const queued = loadQueuedEvents();
      if (!queued.length) return;

      const sent: string[] = [];
      for (const ev of queued) {
        try {
          const res = await sendMediaSwipeEvent(ev);
          if (res.ok && ev.clientEventId) sent.push(ev.clientEventId);
        } catch {
          // stop on first failure to avoid tight loops
          break;
        }
      }
      if (sent.length) removeQueuedEvents(sent);
    };

    void flush();

    const onOnline = () => void flush();
    window.addEventListener("online", onOnline);
    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
    };
  }, []);

  const sessionId = useMemo(() => getOrCreateMediaSwipeSessionId(), []);
  const mode = useMemo(() => mapKindToMode(kind), [kind]);

  const seenIdsRef = useRef<Set<string>>(new Set());
  const fetchingRef = useRef(false);
  const pageRef = useRef(0);
  const baseSeedRef = useRef<string | null>(null);

  // Avoid spamming impression/dwell
  const impressedRef = useRef<Set<string>>(new Set()); // key = `${deckId}:${mediaId}`
  const lastDwellSentAtRef = useRef<Map<string, number>>(new Map()); // key = `${deckId}:${mediaId}` -> ts

  const [state, setState] = useState<DeckState>({
    status: "idle",
    cards: [],
    errorMessage: null,
  });

  const [eventError, setEventError] = useState<{ payload: any; message: string } | null>(null);

  const setStateSafe = useCallback((updater: DeckState | ((prev: DeckState) => DeckState)) => {
    setState((prev) => (typeof updater === "function" ? (updater as any)(prev) : updater));
  }, []);

  const appendCards = useCallback(
    (incoming: MediaSwipeCardUI[]) => {
      if (!incoming.length) return;

      const seen = seenIdsRef.current;
      const fresh: MediaSwipeCardUI[] = [];

      for (const raw of incoming) {
        if (seen.has(raw.id)) continue;
        seen.add(raw.id);
        fresh.push(normalizeCard(raw, tmdbPosterSize));
      }

      if (!fresh.length) return;

      setStateSafe((prev) => {
        const next = {
          ...prev,
          status: "ready" as const,
          cards: [...prev.cards, ...fresh],
          errorMessage: null,
        };
        scheduleAssetPrefetch(fresh, prefetchImages);
        return next;
      });
    },
    [prefetchImages, setStateSafe, tmdbPosterSize],
  );

  const fetchBatch = useCallback(
    async (batchSize = limit) => {
      if (fetchingRef.current) return;
      fetchingRef.current = true;

      setStateSafe((prev) => ({
        ...prev,
        status: prev.cards.length ? "ready" : "loading",
        errorMessage: null,
      }));

      try {
        const resolvedKindFilter = options?.kindFilter ?? null;

        // Use a stable base seed (sessionStorage) and add a page suffix so fetchMore doesn't repeat.
        const baseSeed =
          options?.seed ?? getOrCreateSwipeDeckSeedForMode(sessionId, mode, resolvedKindFilter);
        if (baseSeedRef.current !== baseSeed) {
          baseSeedRef.current = baseSeed;
          pageRef.current = 0;
        }
        const seedToUse = `${baseSeed}:${pageRef.current}`;
        pageRef.current += 1;

        const resp = await fetchMediaSwipeDeck(
          {
            sessionId,
            mode,
            kindFilter: resolvedKindFilter ?? undefined,
            limit: batchSize,
            seed: seedToUse,
          },
          { timeoutMs: 25000 },
        );

        const deckId = resp.deckId;
        const incoming = (resp.cards ?? []).map((c, idx) => ({
          ...c,
          id: c.mediaItemId,
          deckId,
          position: idx,
          source: mapBackendSource((c as any).source ?? null),
        })) as MediaSwipeCardUI[];

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
          err instanceof Error
            ? err.message
            : typeof err === "string"
              ? err
              : "We couldn't load swipe cards.";
        setStateSafe((prev) => ({ ...prev, status: "error", errorMessage: message }));
      } finally {
        fetchingRef.current = false;
      }
    },
    [appendCards, limit, mode, options?.kindFilter, options?.seed, sessionId, setStateSafe],
  );

  useEffect(() => {
    // reset when kind changes
    seenIdsRef.current = new Set();
    impressedRef.current = new Set();
    lastDwellSentAtRef.current = new Map();
    fetchingRef.current = false;

    setStateSafe({ status: "loading", cards: [], errorMessage: null });
    fetchBatch(limit);
  }, [fetchBatch, kind, limit, options?.kindFilter, setStateSafe]);

  const refresh = useCallback(() => {
    // If the caller did not force a specific seed, rotate the shared mode seed
    // so a manual refresh produces a new deck (and still shares seed with prefetch).
    if (options?.seed == null) {
      rotateSwipeDeckSeedForMode(sessionId, mode, options?.kindFilter ?? null);
    }
    pageRef.current = 0;
    seenIdsRef.current = new Set();
    impressedRef.current = new Set();
    lastDwellSentAtRef.current = new Map();
    fetchingRef.current = false;

    setStateSafe({ status: "loading", cards: [], errorMessage: null });
    fetchBatch(limit);
  }, [fetchBatch, limit, mode, options?.kindFilter, options?.seed, sessionId, setStateSafe]);

  const trimConsumed = useCallback(
    (count: number) => {
      if (count <= 0) return;
      setStateSafe((prev) => ({
        ...prev,
        cards: prev.cards.slice(Math.min(count, prev.cards.length)),
      }));
    },
    [setStateSafe],
  );

  // --- Events ---
  const eventMutation = useMutation({
    mutationFn: async (payload: any) => sendMediaSwipeEvent(payload, { timeoutMs: 20000 }),
    onError: (error, variables) => {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "We couldn't save that action.";
      enqueueSwipeEvent(variables);
      setEventError({ payload: variables, message });
    },
    onSuccess: () => {
      setEventError(null);

      if (invalidateHomeQueries) {
        queryClient.invalidateQueries({ queryKey: qk.homeFeed(null) });
        queryClient.invalidateQueries({ queryKey: qk.homeForYou(null) });
      }
    },
  });

  const trackImpression = useCallback(
    (card: MediaSwipeCardUI | undefined, positionOverride?: number) => {
      if (!card) return;

      const key = `${card.deckId}:${card.id}`;
      if (impressedRef.current.has(key)) return;
      impressedRef.current.add(key);

      eventMutation.mutate({
        sessionId,
        deckId: card.deckId,
        position: positionOverride ?? card.position,
        mediaItemId: card.id,
        eventType: "impression" satisfies MediaSwipeEventType,
        source: card.source ?? null,
        clientEventId: nextClientEventId(),
      });
    },
    [eventMutation, sessionId],
  );

  const trackDwell = useCallback(
    (card: MediaSwipeCardUI | undefined, dwellMs: number, positionOverride?: number) => {
      if (!card) return;
      if (!Number.isFinite(dwellMs) || dwellMs < dwellThresholdMs) return;

      const key = `${card.deckId}:${card.id}`;
      const now = Date.now();
      const last = lastDwellSentAtRef.current.get(key) ?? 0;
      if (now - last < dwellDebounceMs) return;
      lastDwellSentAtRef.current.set(key, now);

      eventMutation.mutate({
        sessionId,
        deckId: card.deckId,
        position: positionOverride ?? card.position,
        mediaItemId: card.id,
        eventType: "dwell" satisfies MediaSwipeEventType,
        dwellMs: Math.round(dwellMs),
        source: card.source ?? null,
        clientEventId: nextClientEventId(),
      });
    },
    [dwellDebounceMs, dwellThresholdMs, eventMutation, sessionId],
  );

  const swipe = useCallback(
    (payload: SwipeEventPayload) => {
      const card = payload.card;
      eventMutation.mutate({
        sessionId,
        deckId: card.deckId,
        position: card.position,
        mediaItemId: card.id,
        eventType: mapDirectionToEventType(payload.direction),
        source: card.source ?? null,
        clientEventId: nextClientEventId(),
      });
    },
    [eventMutation, sessionId],
  );

  const swipeAsync = useCallback(
    async (payload: SwipeEventPayload) => {
      const card = payload.card;
      return eventMutation.mutateAsync({
        sessionId,
        deckId: card.deckId,
        position: card.position,
        mediaItemId: card.id,
        eventType: mapDirectionToEventType(payload.direction),
        source: card.source ?? null,
        clientEventId: nextClientEventId(),
      });
    },
    [eventMutation, sessionId],
  );

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
