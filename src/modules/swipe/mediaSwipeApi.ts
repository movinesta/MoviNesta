import { callSupabaseFunction } from "@/lib/callSupabaseFunction";

/**
 * Frontend client for Swipe Brain v2 (media_items-only).
 *
 * Edge Functions:
 *  - media-swipe-deck
 *  - media-swipe-event
 *
 * Notes:
 *  - Session ID is generated client-side and persisted in localStorage.
 *  - Deck ID is returned by media-swipe-deck and should be attached to subsequent events.
 */

export type MediaSwipeDeckMode = "for_you" | "trending" | "friends" | "combined";

export type MediaSwipeCard = {
  mediaItemId: string;
  kind: "movie" | "series" | "other" | null;

  title: string | null;
  overview: string | null;

  posterUrl: string | null;
  tmdbPosterPath: string | null;
  tmdbBackdropPath: string | null;

  releaseYear: number | null;
  runtimeMinutes: number | null;

  tmdbVoteAverage: number | null;
  tmdbVoteCount: number | null;
  tmdbPopularity: number | null;

  completeness: number | null;

  why?: string | null;
  source?: string | null;

  // Optional debug info if you enable debug=true on the backend (we keep it typed loosely)
  debugScore?: Record<string, unknown>;
};

export type MediaSwipeDeckRequest = {
  sessionId?: string | null;
  mode?: MediaSwipeDeckMode;
  limit?: number;
  kind?: "movie" | "series" | null;
  seed?: string | null;
  debug?: boolean;
};

export type MediaSwipeDeckResponse = {
  ok: boolean;
  deckId: string;
  cards: MediaSwipeCard[];
};

export async function fetchMediaSwipeDeck(
  req: MediaSwipeDeckRequest,
  opts?: { timeoutMs?: number },
): Promise<MediaSwipeDeckResponse> {
  return callSupabaseFunction<MediaSwipeDeckResponse>(
    "media-swipe-deck",
    req,
    { timeoutMs: opts?.timeoutMs ?? 25000 },
  );
}

/**
 * Keep this union small and stable — only use values your DB enum supports.
 * (We'll expand later when we wire more UI interactions.)
 */
export type MediaSwipeEventType = "impression" | "like" | "dislike" | "skip" | "dwell";

export type MediaSwipeEventRequest = {
  sessionId: string;
  deckId?: string | null;
  position?: number | null;

  mediaItemId: string;
  eventType: MediaSwipeEventType;

  source?: string | null;
  dwellMs?: number | null;

  // optional state updates:
  rating0_10?: number | null;
  inWatchlist?: boolean | null;

  payload?: Record<string, unknown> | null;
};

export type MediaSwipeEventResponse = {
  ok: boolean;
};

export async function sendMediaSwipeEvent(
  req: MediaSwipeEventRequest,
  opts?: { timeoutMs?: number },
): Promise<MediaSwipeEventResponse> {
  return callSupabaseFunction<MediaSwipeEventResponse>(
    "media-swipe-event",
    req,
    { timeoutMs: opts?.timeoutMs ?? 20000 },
  );
}

const SESSION_STORAGE_KEY = "mn_media_swipe_session_id_v1";

function fallbackUuid(): string {
  // RFC4122 v4-ish (good enough for client session IDs)
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function getOrCreateMediaSwipeSessionId(): string {
  if (typeof window === "undefined") {
    // SSR fallback (should not generally be used for swipe interactions)
    return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : fallbackUuid();
  }

  const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (existing && existing.length >= 30) return existing;

  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : fallbackUuid();
  window.localStorage.setItem(SESSION_STORAGE_KEY, id);
  return id;
}

export function resetMediaSwipeSessionId(): string {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  }
  return getOrCreateMediaSwipeSessionId();
}
