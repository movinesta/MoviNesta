import { supabase } from "@/lib/supabase";

export type MediaSwipeDeckMode = "for_you" | "friends" | "trending" | "combined";

export type MediaSwipeEventType =
  | "impression"
  | "dwell"
  | "like"
  | "dislike"
  | "skip"
  | "watchlist"
  | "rating"
  | "open"
  | "seen"
  | "share";

export type FriendProfile = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

export type MediaSwipeCard = {
  mediaItemId: string;
  title: string | null;
  overview: string | null;
  kind: "movie" | "series" | "anime" | "unknown";
  releaseDate: string | null;
  releaseYear: number | null;
  runtimeMinutes: number | null;
  posterUrl: string | null;
  tmdbPosterPath: string | null;
  tmdbBackdropPath: string | null;
  tmdbVoteAverage: number | null;
  tmdbVoteCount: number | null;
  tmdbPopularity: number | null;
  completeness: number | null;
  source?: string | null;
  why?: string | null;
  friendIds?: string[] | null;
  friendProfiles?: FriendProfile[] | null;
};

export type FetchMediaSwipeDeckInput = {
  sessionId: string;
  mode: MediaSwipeDeckMode;
  limit?: number;
  // Stable seed is important for server-side caching. If null/undefined is sent,
  // the server will treat it as "no seed" and generate a random one (causing cache misses).
  seed?: string | null;
  kindFilter?: "movie" | "series" | "anime" | null;
  // When true, the server will return the base deck order without calling the reranker (used for background prefetch).
  skipRerank?: boolean;
};

export type FetchMediaSwipeDeckResponse = {
  deckId: string;
  cards: MediaSwipeCard[];
};

export type SendMediaSwipeEventInput = {
  sessionId: string;
  deckId?: string | null;
  position?: number | null;
  mediaItemId: string;
  eventType: MediaSwipeEventType;
  source?: string | null;
  dwellMs?: number | null;
  rating0_10?: number | null;
  inWatchlist?: boolean | null;
  clientEventId?: string | null;
  payload?: Record<string, unknown> | null;
};

export function uuidv4Fallback(): string {
  // RFC4122-ish UUID v4 (good enough as a client session id)
  // eslint-disable-next-line no-bitwise
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getOrCreateMediaSwipeSessionId(): string {
  if (typeof window === "undefined") return "00000000-0000-0000-0000-000000000000";
  const key = "mediaSwipeSessionId";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;

  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : uuidv4Fallback();

  window.localStorage.setItem(key, id);
  return id;
}

const SWIPE_DECK_SEED_STORAGE_KEY = "mn_swipe_deck_seed_v1";

function deckSeedStorageKey(sessionId: string, mode: MediaSwipeDeckMode, kindFilter: string | null | undefined): string {
  return `${SWIPE_DECK_SEED_STORAGE_KEY}:${sessionId}:${mode}:${kindFilter ?? "*"}`;
}

/**
 * Ensures a stable (non-null) seed for swipe deck requests, so the Edge Function can cache rerank results.
 * We store it in sessionStorage (falls back to localStorage) so it survives refetches but can still change between sessions.
 */
export function getOrCreateSwipeDeckSeedForMode(
  sessionId: string,
  mode: MediaSwipeDeckMode,
  kindFilter: string | null | undefined,
): string {
  if (typeof window === "undefined") return uuidv4Fallback();
  const key = deckSeedStorageKey(sessionId, mode, kindFilter);
  const existing = window.sessionStorage.getItem(key) ?? window.localStorage.getItem(key);
  if (existing) return existing;

  const seed =
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : uuidv4Fallback();
  try {
    window.sessionStorage.setItem(key, seed);
  } catch {
    // ignore
  }
  try {
    window.localStorage.setItem(key, seed);
  } catch {
    // ignore
  }
  return seed;
}


/**
 * Rotates the stable seed for a given (sessionId, mode, kindFilter) so the next deck request
 * generates a fresh candidate set. Useful for a user-initiated refresh.
 */
export function rotateSwipeDeckSeedForMode(
  sessionId: string,
  mode: MediaSwipeDeckMode,
  kindFilter: string | null | undefined,
): string {
  if (typeof window === "undefined") return uuidv4Fallback();
  const key = deckSeedStorageKey(sessionId, mode, kindFilter);
  const seed =
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : uuidv4Fallback();

  try {
    window.sessionStorage.setItem(key, seed);
  } catch {
    // ignore
  }
  try {
    window.localStorage.setItem(key, seed);
  } catch {
    // ignore
  }

  return seed;
}

function timeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("Request timed out")), ms);
    p.then((v) => {
      clearTimeout(t);
      resolve(v);
    }).catch((e) => {
      clearTimeout(t);
      reject(e);
    });
  });
}

function ensureClientEventId(value: string | null | undefined): string {
  if (value && typeof value === "string") return value;
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return uuidv4Fallback();
}

export async function fetchMediaSwipeDeck(
  input: FetchMediaSwipeDeckInput,
  opts?: { timeoutMs?: number },
): Promise<FetchMediaSwipeDeckResponse> {
  // IMPORTANT: some callers historically passed `seed: null`. That forces the server to generate
  // a new random seed on each request, which breaks rerank caching. Always ensure a stable seed.
  const body: FetchMediaSwipeDeckInput = {
    ...input,
    seed:
      input.seed && typeof input.seed === "string"
        ? input.seed
        : getOrCreateSwipeDeckSeedForMode(input.sessionId, input.mode, input.kindFilter),
  };

  const run = supabase.functions.invoke("media-swipe-deck", { body });

  const res = await timeout(run, opts?.timeoutMs ?? 25000);
  if (res.error) throw res.error;

  const data = res.data as any;
  if (!data?.deckId || !Array.isArray(data?.cards)) {
    throw new Error("Invalid media-swipe-deck response");
  }
  return { deckId: data.deckId, cards: data.cards };
}

export async function sendMediaSwipeEvent(
  input: SendMediaSwipeEventInput,
  opts?: { timeoutMs?: number },
): Promise<{ ok: true } | { ok: false; message?: string }> {
  const payload = {
    ...input,
    clientEventId: ensureClientEventId(input.clientEventId),
  };

  const run = supabase.functions.invoke("media-swipe-event", { body: payload });

  const res = await timeout(run, opts?.timeoutMs ?? 20000);
  if (res.error) throw res.error;

  const data = res.data as any;
  if (data?.ok === true) return { ok: true };
  return { ok: false, message: data?.message };
}
