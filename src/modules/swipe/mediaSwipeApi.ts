import { supabase } from "@/lib/supabase";

export type MediaSwipeDeckMode = "for_you" | "friends" | "trending" | "combined";

export type MediaSwipeEventType =
  | "impression"
  | "dwell"
  | "like"
  | "dislike"
  | "skip"
  | "watchlist"
  | "rating";

export type MediaSwipeCard = {
  mediaItemId: string;

  // minimal UI fields
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

  // optional
  source?: string | null; // "for_you" | "friends" | "trending" | "explore" | "combined"
  why?: string | null;
};

export type FetchMediaSwipeDeckInput = {
  sessionId: string;
  mode: MediaSwipeDeckMode;
  limit?: number;
  seed?: string | null;
  kindFilter?: "movie" | "series" | "anime" | null;
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

export function getOrCreateMediaSwipeSessionId(): string {
  if (typeof window === "undefined") return "00000000-0000-0000-0000-000000000000";
  const key = "mediaSwipeSessionId";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  window.localStorage.setItem(key, id);
  return id;
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
  const run = supabase.functions.invoke("media-swipe-event", { body: input });

  const res = await timeout(run, opts?.timeoutMs ?? 20000);
  if (res.error) throw res.error;

  const data = res.data as any;
  if (data?.ok === true) return { ok: true };
  return { ok: false, message: data?.message };
}
