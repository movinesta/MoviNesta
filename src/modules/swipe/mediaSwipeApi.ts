import { ApiError, callSupabaseFunction } from "@/lib/callSupabaseFunction";
import type { Database } from "@/types/supabase";
import {
  safeLocalStorageGetItem,
  safeLocalStorageRemoveItem,
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

  // Optional server-stamped fields (for stable joins between impressions/features/events)
  position?: number | null;
  dedupeKey?: string | null;
  dedupe_key?: string | null;
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

  /** Optional experiment assignments (A/B). If present, the server may alter deck logic. */
  experiments?: Record<string, string> | null;
};

export type FetchMediaSwipeDeckResponse = {
  deckId: string;
  recRequestId?: string | null;
  cards: MediaSwipeCard[];
};

export type SendMediaSwipeEventInput = {
  sessionId: string;
  deckId?: string | null;
  recRequestId?: string | null;
  position?: number | null;
  dedupeKey?: string | null;
  dedupe_key?: string | null;
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
  recRequestId?: string | null;
  position?: number | null;
  dedupeKey?: string | null;
  dedupe_key?: string | null;
  mediaItemId: string;
  source?: string | null;
  events: SendMediaSwipeBatchEvent[];
};


export type SendMediaSwipeEventsMultiResponse = {
  ok: true;
  requestId?: string;
  acceptedClientEventIds?: string[];
  rejectedClientEventIds?: string[];
  retryClientEventIds?: string[];
  shouldRetry?: boolean;
  issues?: unknown[];
};

export type SendMediaSwipeEventsMultiResult =
  | SendMediaSwipeEventsMultiResponse
  | { ok: false; message?: string };

export function uuidv4Fallback(): string {
  // RFC4122-ish UUID v4 (good enough as a client session id)

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function getOrCreateMediaSwipeSessionId(): string {
  if (typeof window === "undefined") return "00000000-0000-0000-0000-000000000000";
  const key = "mediaSwipeSessionId";
  const existing = safeLocalStorageGetItem(key);
  if (existing && isUuidLike(existing)) return existing;
  if (existing && !isUuidLike(existing)) {
    // Legacy builds stored non-UUID session ids (e.g. "search_v2_*"), which the Edge Function rejects.
    // Clear it so downstream calls can self-heal.
    safeLocalStorageRemoveItem(key);
  }

  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : uuidv4Fallback();

  safeLocalStorageSetItem(key, id);
  return id;
}

export function resetMediaSwipeSessionId(): string {
  if (typeof window === "undefined") return "00000000-0000-0000-0000-000000000000";
  const key = "mediaSwipeSessionId";
  safeLocalStorageRemoveItem(key);
  return getOrCreateMediaSwipeSessionId();
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

// Debug: persist last ingest envelope so dev UI can quickly diagnose queue/validation issues.
const SWIPE_LAST_INGEST_STORAGE_KEY = "mn_swipe_last_ingest_v1";

type SwipeLastIngestSnapshot = {
  at: number;
  requestId?: string;
  accepted: number;
  rejected: number;
  retry: number;
  shouldRetry: boolean;
  issues?: Array<{ code?: string; message?: string; clientEventId?: string; eventType?: string }>;
};

function persistLastIngestSnapshot(snapshot: SwipeLastIngestSnapshot) {
  try {
    // Bound the payload to avoid localStorage bloat.
    const limited: SwipeLastIngestSnapshot = {
      ...snapshot,
      issues: Array.isArray(snapshot.issues) ? snapshot.issues.slice(0, 25) : undefined,
    };
    safeLocalStorageSetItem(SWIPE_LAST_INGEST_STORAGE_KEY, JSON.stringify(limited));
  } catch {
    // Ignore storage errors (quota/private mode)
  }
}


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

  const invoke = async (payload: FetchMediaSwipeDeckInput) =>
    await callSupabaseFunction<any>("media-swipe-deck", payload, {
      timeoutMs: opts?.timeoutMs ?? 25_000,
      requireAuth: true,
    });

  let data: any;
  let attempts = 0;
  let payload: FetchMediaSwipeDeckInput = body;

  while (attempts < 2) {
    try {
      data = await invoke(payload);
      break;
    } catch (err) {
      const e = err as any;
      const code = e instanceof ApiError ? e.code : String(e?.code ?? "");
      if (code === "INVALID_SESSION") {
        const freshSessionId = resetMediaSwipeSessionId();
        payload = {
          ...body,
          sessionId: freshSessionId,
          seed: getOrCreateSwipeDeckSeedForMode(freshSessionId, body.mode, body.kindFilter),
        };
        attempts += 1;
        continue;
      }
      throw err;
    }
  }

  if (data?.ok === false && data?.code === "INVALID_SESSION") {
    throw new Error("Your swipe session expired. Please refresh and try again.");
  }

  // Backwards-compatible: older servers returned { deckId, cards } without { ok }.
  if (data?.ok === false) {
    throw new Error(data?.message || data?.code || "media-swipe-deck failed");
  }

  const response = data?.ok === true ? data : data;
  const deckId = response?.deckId;
  const recRequestId = response?.recRequestId ?? response?.rec_request_id ?? null;
  const cards = response?.cards;

  if (!deckId || !Array.isArray(cards)) {
    throw new Error("Invalid media-swipe-deck response");
  }

  return { deckId, recRequestId, cards };
}

function normalizeEventType(type: unknown): MediaSwipeEventType | LegacyMediaSwipeEventType | null {
  if (typeof type !== "string") return null;
  const trimmed = type.trim();
  if (!trimmed) return null;
  if (trimmed === "open") return "detail_open";
  if (trimmed === "seen") return "detail_close";
  return trimmed as MediaSwipeEventType | LegacyMediaSwipeEventType;
}

function computeDedupeKey(recRequestId: unknown, position: unknown, mediaItemId: unknown): string | null {
  const rr = String(recRequestId ?? "").trim();
  const mi = String(mediaItemId ?? "").trim();
  const p = Number(position);
  if (!rr || !mi || !Number.isFinite(p) || p < 0) return null;
  return `${rr}:${Math.trunc(p)}:${mi}`;
}

function ensureDedupeKey(it: any): string | null {
  const raw = String(it?.dedupeKey ?? it?.dedupe_key ?? "").trim();
  if (raw) return raw;
  return computeDedupeKey(it?.recRequestId ?? it?.rec_request_id, it?.position, it?.mediaItemId);
}

export async function sendMediaSwipeEventsMulti(
  items: SendMediaSwipeEventsBatchInput[],
  opts?: { timeoutMs?: number },
): Promise<SendMediaSwipeEventsMultiResult> {
  const normalizedItems = (Array.isArray(items) ? items : [])
    .map((it: any) => {
      const dedupeKey = ensureDedupeKey(it);
      const events = (Array.isArray(it?.events) ? it.events : [])
        .map((ev: any) => {
          const eventType = normalizeEventType(ev?.eventType);
          if (!eventType) return null;
          return {
            ...ev,
            eventType,
            clientEventId: ensureClientEventId(ev?.clientEventId),
          };
        })
        .filter(Boolean);
      const hasDeckContext =
        it?.deckId != null ||
        it?.recRequestId != null ||
        (it as any)?.rec_request_id != null ||
        it?.position != null ||
        String(it?.dedupeKey ?? it?.dedupe_key ?? "").trim();

      // If we cannot build a served dedupe key, strip deck context so the server won't reject the entire batch.
      // (The event will still be recorded, but it won't join to impressions.)
      const safeDeckId = dedupeKey ? (it?.deckId ?? null) : null;
      const safeRecRequestId = dedupeKey ? ((it as any)?.recRequestId ?? (it as any)?.rec_request_id ?? null) : null;
      const safePosition = dedupeKey ? (it?.position ?? null) : null;

      return {
        ...it,
        deckId: hasDeckContext && !dedupeKey ? null : safeDeckId,
        recRequestId: hasDeckContext && !dedupeKey ? null : safeRecRequestId,
        rec_request_id: hasDeckContext && !dedupeKey ? null : ((it as any)?.rec_request_id ?? safeRecRequestId),
        position: hasDeckContext && !dedupeKey ? null : safePosition,
        dedupeKey: dedupeKey ?? (it as any)?.dedupeKey ?? (it as any)?.dedupe_key ?? null,
        dedupe_key: dedupeKey ?? (it as any)?.dedupe_key ?? (it as any)?.dedupeKey ?? null,
        source: normalizeMediaEventSource(it?.source) ?? it?.source ?? null,
        events,
      };
    })
    .filter((it) => it.events.length > 0);

  if (!normalizedItems.length) return { ok: true };

  const payload = { items: normalizedItems };

  try {
    const data = await callSupabaseFunction<any>("media-swipe-event", payload, {
      timeoutMs: opts?.timeoutMs ?? 20_000,
      requireAuth: true,
    });

    if (data?.ok === true) {
      const acceptedClientEventIds = Array.isArray(data?.acceptedClientEventIds)
        ? data.acceptedClientEventIds.filter(Boolean)
        : [];
      const rejectedClientEventIds = Array.isArray(data?.rejectedClientEventIds)
        ? data.rejectedClientEventIds.filter(Boolean)
        : [];
      const retryClientEventIds = Array.isArray(data?.retryClientEventIds)
        ? data.retryClientEventIds.filter(Boolean)
        : [];

      persistLastIngestSnapshot({
        at: Date.now(),
        requestId: typeof data?.requestId === "string" ? data.requestId : undefined,
        accepted: acceptedClientEventIds.length,
        rejected: rejectedClientEventIds.length,
        retry: retryClientEventIds.length,
        shouldRetry: Boolean(data?.shouldRetry) || retryClientEventIds.length > 0,
        issues: Array.isArray(data?.issues)
          ? data.issues.map((it: any) => ({
              code: typeof it?.code === "string" ? it.code : undefined,
              message: typeof it?.message === "string" ? it.message : undefined,
              clientEventId: typeof it?.clientEventId === "string" ? it.clientEventId : undefined,
              eventType: typeof it?.eventType === "string" ? it.eventType : undefined,
            }))
          : undefined,
      });

      return {
        ok: true,
        requestId: typeof data?.requestId === "string" ? data.requestId : undefined,
        acceptedClientEventIds,
        rejectedClientEventIds,
        retryClientEventIds,
        shouldRetry: Boolean(data?.shouldRetry) || retryClientEventIds.length > 0,
        issues: Array.isArray(data?.issues) ? data.issues : undefined,
      };
    }

    if (data?.ok === false) return { ok: false, message: data?.message };
    // Backwards-compatible: if server returned no envelope, treat as success.
    return { ok: true, acceptedClientEventIds: [], rejectedClientEventIds: [], retryClientEventIds: [], shouldRetry: false };
  } catch (err) {
    if (err instanceof ApiError) {
      // Preserve historical behavior: app-level (structured) errors return ok:false,
      // but auth/transport issues still throw.
      const status = Number(err.status ?? 0);
      if (err.code || (status >= 400 && status < 500 && status !== 401 && status !== 403)) {
        return { ok: false, message: err.message };
      }
    }
    throw err;
  }
}

export async function sendMediaSwipeEventsBatch(
  input: SendMediaSwipeEventsBatchInput,
  opts?: { timeoutMs?: number },
): Promise<{ ok: true } | { ok: false; message?: string }> {
  const events = (Array.isArray((input as any).events) ? (input as any).events : [])
    .map((ev: any) => {
      const eventType = normalizeEventType(ev?.eventType);
      if (!eventType) return null;
      return {
        ...ev,
        eventType,
        clientEventId: ensureClientEventId(ev?.clientEventId),
      };
    })
    .filter(Boolean);

  if (!events.length) return { ok: true };

  const dedupeKey = ensureDedupeKey(input as any);

  const anyInput = input as any;
  const hasDeckContext =
    anyInput?.deckId != null ||
    anyInput?.recRequestId != null ||
    anyInput?.rec_request_id != null ||
    anyInput?.position != null ||
    String(anyInput?.dedupeKey ?? anyInput?.dedupe_key ?? "").trim();

  const safeDeckId = dedupeKey ? (anyInput?.deckId ?? null) : null;
  const safeRecRequestId = dedupeKey ? (anyInput?.recRequestId ?? anyInput?.rec_request_id ?? null) : null;
  const safePosition = dedupeKey ? (anyInput?.position ?? null) : null;

  const payload = {
    ...input,
    deckId: hasDeckContext && !dedupeKey ? null : safeDeckId,
    recRequestId: hasDeckContext && !dedupeKey ? null : safeRecRequestId,
    rec_request_id: hasDeckContext && !dedupeKey ? null : (anyInput?.rec_request_id ?? safeRecRequestId),
    position: hasDeckContext && !dedupeKey ? null : safePosition,
    dedupeKey: dedupeKey ?? (input as any).dedupeKey ?? null,
    dedupe_key: dedupeKey ?? (input as any).dedupe_key ?? null,
    source: normalizeMediaEventSource((input as any).source) ?? (input as any).source ?? null,
    events,
  };

  try {
    const data = await callSupabaseFunction<any>("media-swipe-event", payload, {
      timeoutMs: opts?.timeoutMs ?? 20_000,
      requireAuth: true,
    });

    if (data?.ok === true) {
      const acceptedClientEventIds = Array.isArray(data?.acceptedClientEventIds)
        ? data.acceptedClientEventIds.filter(Boolean)
        : [];
      const rejectedClientEventIds = Array.isArray(data?.rejectedClientEventIds)
        ? data.rejectedClientEventIds.filter(Boolean)
        : [];
      const retryClientEventIds = Array.isArray(data?.retryClientEventIds)
        ? data.retryClientEventIds.filter(Boolean)
        : [];

      persistLastIngestSnapshot({
        at: Date.now(),
        requestId: typeof data?.requestId === "string" ? data.requestId : undefined,
        accepted: acceptedClientEventIds.length,
        rejected: rejectedClientEventIds.length,
        retry: retryClientEventIds.length,
        shouldRetry: Boolean(data?.shouldRetry) || retryClientEventIds.length > 0,
        issues: Array.isArray(data?.issues)
          ? data.issues.map((it: any) => ({
              code: typeof it?.code === "string" ? it.code : undefined,
              message: typeof it?.message === "string" ? it.message : undefined,
              clientEventId: typeof it?.clientEventId === "string" ? it.clientEventId : undefined,
              eventType: typeof it?.eventType === "string" ? it.eventType : undefined,
            }))
          : undefined,
      });

      return {
        ok: true,
        requestId: typeof data?.requestId === "string" ? data.requestId : undefined,
        acceptedClientEventIds,
        rejectedClientEventIds,
        retryClientEventIds,
        shouldRetry: Boolean(data?.shouldRetry) || retryClientEventIds.length > 0,
        issues: Array.isArray(data?.issues) ? data.issues : undefined,
      };
    }

    if (data?.ok === false) return { ok: false, message: data?.message };
    // Backwards-compatible: if server returned no envelope, treat as success.
    return { ok: true, acceptedClientEventIds: [], rejectedClientEventIds: [], retryClientEventIds: [], shouldRetry: false };
  } catch (err) {
    if (err instanceof ApiError) {
      const status = Number(err.status ?? 0);
      if (err.code || (status >= 400 && status < 500 && status !== 401 && status !== 403)) {
        return { ok: false, message: err.message };
      }
    }
    throw err;
  }
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
  if (!eventType) return { ok: true };

  const dedupeKey = ensureDedupeKey(anyInput);

  const hasDeckContext =
    anyInput?.deckId != null ||
    anyInput?.recRequestId != null ||
    anyInput?.rec_request_id != null ||
    anyInput?.position != null ||
    String(anyInput?.dedupeKey ?? anyInput?.dedupe_key ?? "").trim();

  const safeDeckId = dedupeKey ? (anyInput?.deckId ?? null) : null;
  const safeRecRequestId = dedupeKey ? (anyInput?.recRequestId ?? anyInput?.rec_request_id ?? null) : null;
  const safePosition = dedupeKey ? (anyInput?.position ?? null) : null;

  const payload = {
    ...input,
    deckId: hasDeckContext && !dedupeKey ? null : safeDeckId,
    recRequestId: hasDeckContext && !dedupeKey ? null : safeRecRequestId,
    rec_request_id: hasDeckContext && !dedupeKey ? null : (anyInput?.rec_request_id ?? safeRecRequestId),
    position: hasDeckContext && !dedupeKey ? null : safePosition,
    eventType,
    dedupeKey: dedupeKey ?? input.dedupeKey ?? null,
    dedupe_key: dedupeKey ?? input.dedupe_key ?? null,
    source: normalizeMediaEventSource(input.source) ?? input.source ?? null,
    clientEventId: ensureClientEventId(input.clientEventId),
  };

  try {
    const data = await callSupabaseFunction<any>("media-swipe-event", payload, {
      timeoutMs: opts?.timeoutMs ?? 20_000,
      requireAuth: true,
    });

    if (data?.ok === true) return { ok: true };
    if (data?.ok === false) return { ok: false, message: data?.message };
    return { ok: true };
  } catch (err) {
    if (err instanceof ApiError) {
      const status = Number(err.status ?? 0);
      if (err.code || (status >= 400 && status < 500 && status !== 401 && status !== 403)) {
        return { ok: false, message: err.message };
      }
    }
    throw err;
  }
}
export type SendOnboardingInitialLikesInput = {
  sessionId: string;
  mediaItemIds: string[];
  /** Optional onboarding taste prefs. Stored in public.user_preferences (recsys). */
  preferredGenres?: string[];
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
    preferredGenres: Array.isArray(input.preferredGenres)
      ? input.preferredGenres
          .map((g) => String(g).trim())
          .filter(Boolean)
          .slice(0, 20)
      : undefined,
  };

  try {
    const data = await callSupabaseFunction<any>("onboarding-initial-likes", payload, {
      timeoutMs: opts?.timeoutMs ?? 25_000,
      requireAuth: true,
    });

    if (data?.ok === true) return { ok: true };
    if (data?.ok === false) return { ok: false, message: data?.message };
    return { ok: true };
  } catch (err) {
    if (err instanceof ApiError) {
      const status = Number(err.status ?? 0);
      if (err.code || (status >= 400 && status < 500 && status !== 401 && status !== 403)) {
        return { ok: false, message: err.message };
      }
    }
    throw err;
  }
}
