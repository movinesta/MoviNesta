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
};

export type FetchMediaSwipeDeckInput = {
  sessionId: string;
  mode: MediaSwipeDeckMode;
  limit?: number;
  seed?: string | null;
  kindFilter?: "movie" | "series" | "anime" | null;
  // If true, the Edge Function will skip rerank (useful for background prefetch).
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
  const run = supabase.functions.invoke("media-swipe-deck", { body: input });

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
