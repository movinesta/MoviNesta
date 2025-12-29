import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/supabase";
import {
  safeLocalStorageGetItem,
  safeLocalStorageSetItem,
  safeSessionStorageGetItem,
  safeSessionStorageSetItem,
} from "@/lib/storage";

export type MediaSwipeDeckMode = "for_you" | "friends" | "trending" | "combined";

export type MediaSwipeEventType =
  | "impression"
  | "detail_open"
  | "detail_close"
  | "dwell"
  | "like"
  | "dislike"
  | "skip"
  | "watchlist"
  | "rating"
  | "share";

type LegacyMediaSwipeEventType = "open" | "seen";

export type FriendProfile = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

// Schema source of truth: public.media_kind enum in schema_full_20251224_004751.sql
export type MediaKind = Database["public"]["Enums"]["media_kind"];
// The swipe deck edge function may return any schema-valid kind when no filter is applied.
// Keep an internal fallback for defensive UI handling.
export type MediaSwipeCardKind = MediaKind | "unknown";

export type MediaSwipeCard = {
  mediaItemId: string;
  title: string | null;
  overview: string | null;
  kind: MediaSwipeCardKind;
  releaseDate: string | null;
  releaseYear: number | null;
  runtimeMinutes: number | null;
  posterUrl: string | null;
  genres?: string[] | null;
  language?: string | null;
  country?: string | null;
  imdbRating?: number | null;
  rtTomatoMeter?: number | null;

  // Extra OMDb details used by the details UI
  director?: string | null;
  writer?: string | null;
  actors?: string | null;
  rated?: string | null;
  metascore?: string | null;
  imdbVotes?: string | null;
  awards?: string | null;
  boxOffice?: string | null;

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
  // Server currently validates kindFilter to: movie | series | anime.
  kindFilter?: Exclude<MediaKind, "episode" | "other"> | null;
  // When true, the server will return the base deck order without calling the reranker (used for background prefetch).
  skipRerank?: boolean;

  // Optional server-side filtering (non-breaking; edge function may ignore).
  minImdbRating?: number | null;
  genresAny?: string[] | null;
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
  eventType: MediaSwipeEventType | LegacyMediaSwipeEventType;
  source?: string | null;
  dwellMs?: number | null;
  rating0_10?: number | null;
  inWatchlist?: boolean | null;
  clientEventId?: string | null;
  payload?: Record<string, unknown> | null;
};

export type SendMediaSwipeBatchEvent = {
  eventType: MediaSwipeEventType | LegacyMediaSwipeEventType;
  dwellMs?: number | null;
  rating0_10?: number | null;
  inWatchlist?: boolean | null;
  clientEventId?: string | null;
  payload?: Record<string, unknown> | null;
};

export type SendMediaSwipeEventsBatchInput = {
  sessionId: string;
  deckId?: string | null;
  position?: number | null;
  mediaItemId: string;
  source?: string | null;
  events: SendMediaSwipeBatchEvent[];
};

export function uuidv4Fallback(): string {
  // RFC4122-ish UUID v4 (good enough as a client session id)

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getOrCreateMediaSwipeSessionId(): string {
  if (typeof window === "undefined") return "00000000-0000-0000-0000-000000000000";
  const key = "mediaSwipeSessionId";
  const existing = safeLocalStorageGetItem(key);
  if (existing) return existing;

  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : uuidv4Fallback();

  safeLocalStorageSetItem(key, id);
  return id;
}

export function normalizeMediaEventSource(source: string | null | undefined): string | null {
  if (!source) return null;
  let s = String(source).trim().toLowerCase();
  if (!s) return null;

  // Normalize separators (kebab/space) => snake_case
  s = s.replace(/\s+/g, "_").replace(/-+/g, "_");

  // Known UI aliases
  if (s === "for_you" || s === "for-you" || s === "foryou") return "for_you";
  if (s === "from_friends" || s === "from-friends" || s === "friends") return "friends";

  // Pass through known canonical values
  if (s === "trending") return "trending";
  if (s === "popular") return "popular";
  if (s === "combined") return "combined";
  if (s === "explore") return "explore";
  if (s === "search") return "search";
  if (s === "onboarding") return "onboarding";
  if (s === "unknown") return "unknown";

  return s;
}

const SWIPE_DECK_SEED_STORAGE_KEY = "mn_swipe_deck_seed_v1";

function deckSeedStorageKey(
  sessionId: string,
  mode: MediaSwipeDeckMode,
  kindFilter: string | null | undefined,
): string {
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
  const existing = safeSessionStorageGetItem(key) ?? safeLocalStorageGetItem(key);
  if (existing) return existing;

  const seed =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : uuidv4Fallback();
  try {
    safeSessionStorageSetItem(key, seed);
  } catch {
    // ignore
  }
  try {
    safeLocalStorageSetItem(key, seed);
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
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : uuidv4Fallback();

  try {
    safeSessionStorageSetItem(key, seed);
  } catch {
    // ignore
  }
  try {
    safeLocalStorageSetItem(key, seed);
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
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (value && typeof value === "string" && uuidRe.test(value)) return value;
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

  // Backwards-compatible: older servers returned { deckId, cards } without { ok }.
  if (data?.ok === false) {
    throw new Error(data?.message || data?.code || "media-swipe-deck failed");
  }

  const payload = data?.ok === true ? data : data;
  const deckId = payload?.deckId;
  const cards = payload?.cards;

  if (!deckId || !Array.isArray(cards)) {
    throw new Error("Invalid media-swipe-deck response");
  }

  return { deckId, cards };
}

function normalizeEventType(type: any): any {
  return type === "open" ? "detail_open" : type === "seen" ? "detail_close" : type;
}

export async function sendMediaSwipeEventsBatch(
  input: SendMediaSwipeEventsBatchInput,
  opts?: { timeoutMs?: number },
): Promise<{ ok: true } | { ok: false; message?: string }> {
  const payload = {
    ...input,
    source: normalizeMediaEventSource((input as any).source) ?? (input as any).source ?? null,
    events: (Array.isArray((input as any).events) ? (input as any).events : []).map((ev: any) => ({
      ...ev,
      eventType: normalizeEventType(ev?.eventType),
      clientEventId: ensureClientEventId(ev?.clientEventId),
    })),
  };

  const run = supabase.functions.invoke("media-swipe-event", { body: payload });
  const res = await timeout(run, opts?.timeoutMs ?? 20000);
  if (res.error) throw res.error;

  const data = res.data as any;
  if (data?.ok === true) return { ok: true };
  return { ok: false, message: data?.message };
}

export async function sendMediaSwipeEvent(
  input: SendMediaSwipeEventInput,
  opts?: { timeoutMs?: number },
): Promise<{ ok: true } | { ok: false; message?: string }> {
  // Supports both single-event and batch payloads.
  const anyInput: any = input as any;
  if (Array.isArray(anyInput?.events)) {
    return await sendMediaSwipeEventsBatch(anyInput as any, opts);
  }

  const eventType = normalizeEventType(anyInput.eventType);
  const payload = {
    ...input,
    eventType,
    source: normalizeMediaEventSource(input.source) ?? input.source ?? null,
    clientEventId: ensureClientEventId(input.clientEventId),
  };

  const run = supabase.functions.invoke("media-swipe-event", { body: payload });

  const res = await timeout(run, opts?.timeoutMs ?? 20000);
  if (res.error) throw res.error;

  const data = res.data as any;
  if (data?.ok === true) return { ok: true };
  return { ok: false, message: data?.message };
}
export type SendOnboardingInitialLikesInput = {
  sessionId: string;
  mediaItemIds: string[];
};

/**
 * Onboarding: send a small set of "initial likes" to bootstrap taste vectors.
 * Backed by Edge Function: onboarding-initial-likes
 */
export async function sendOnboardingInitialLikes(
  input: SendOnboardingInitialLikesInput,
  opts?: { timeoutMs?: number },
): Promise<{ ok: true } | { ok: false; message?: string }> {
  const payload: SendOnboardingInitialLikesInput = {
    sessionId: input.sessionId,
    mediaItemIds: Array.isArray(input.mediaItemIds) ? input.mediaItemIds : [],
  };

  const run = supabase.functions.invoke("onboarding-initial-likes", { body: payload });

  const res = await timeout(run, opts?.timeoutMs ?? 25000);
  if (res.error) throw res.error;

  const data = res.data as any;
  if (data?.ok === true) return { ok: true };
  return { ok: false, message: data?.message };
}
