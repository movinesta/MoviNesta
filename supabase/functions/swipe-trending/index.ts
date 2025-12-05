// supabase/functions/swipe-trending/index.ts
//
// "Ultimate" Trending swipe deck.
// --------------------------------
// - Primary signal: recent activity_events (last 7 days), weighted by
//   event type + time decay.
// - Secondary signal: tmdb_popularity.
// - Personalized: gently boosted towards the user's favorite genres / types.
// - Diverse: limits how many cards per genre to avoid repetition.
// - Safe: filters out titles the user has already interacted with and
//   falls back to a global popularity deck if data is sparse.
// - Still triggers catalog-sync and catalog-backfill in the background.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { triggerCatalogSyncForTitle } from "../_shared/catalog-sync.ts";
import { loadSeenTitleIdsForUser } from "../_shared/swipe.ts";
import {
  handleOptions,
  jsonError,
  jsonResponse,
} from "../_shared/http.ts";
import { getAdminClient, getUserClient } from "../_shared/supabase.ts";
import {
  computeUserProfile,
  type UserProfile,
} from "../_shared/preferences.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Deck sizing constants
const MAX_DECK_SIZE = 30;
const MIN_TRENDING_CARDS = 12; // if we have fewer than this, blend in popularity
const MAX_PER_GENRE = 5;

type SwipeCard = {
  id: string;
  title: string | null;
  year: number | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  imdbRating: number | null;
  rtTomatoMeter: number | null;
  tmdbId: number | null;
  imdbId: string | null;
  contentType: "movie" | "series" | null;
};

// ------------------------------------------------------------
// Main handler
// ------------------------------------------------------------

serve(async (req: Request): Promise<Response> => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  try {
    const configError = validateConfig();
    if (configError) return configError;

    const supabaseAdmin = getAdminClient(req);
    const supabaseAuth = getUserClient(req);

    // Require authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser();

    if (authError) {
      console.error("[swipe-trending] auth error:", authError.message);
      return jsonError("Unauthorized", 401, "UNAUTHORIZED");
    }

    if (!user) {
      return jsonError("Unauthorized", 401, "UNAUTHORIZED_NO_USER");
    }

    const userId = user.id as string;
    console.log("[swipe-trending] request", { userId });

    // Titles the user has already interacted with (ratings, library, events)
    const seenTitleIds = await loadSeenTitleIdsForUser(supabaseAdmin, userId);

    // Lightweight preference profile for personalization
    const userProfile = await safeComputeUserProfile(supabaseAdmin, userId);

    // 1) Build trending deck from recent activity
    let cards = await buildTrendingDeck(
      supabaseAdmin,
      seenTitleIds,
      userProfile,
    );

    // 2) If not enough trending data, blend in a fallback popularity deck
    if (cards.length < MIN_TRENDING_CARDS) {
      const existingIds = new Set(cards.map((c) => c.id));
      const fallback = await buildPopularityDeck(
        supabaseAdmin,
        seenTitleIds,
        existingIds,
      );
      cards = cards.concat(fallback).slice(0, MAX_DECK_SIZE);
    }

    // 3) If we still have nothing, trigger a catalog backfill
    if (!cards.length) {
      await triggerCatalogBackfill("swipe-trending: empty deck");
    }

    // Fire-and-forget catalog sync for the first few cards
    const toSync = cards.slice(0, 3);
    for (const card of toSync) {
      triggerCatalogSyncForTitle(req, {
        tmdbId: card.tmdbId,
        imdbId: card.imdbId ?? undefined,
        contentType: card.contentType,
      }).catch((err) =>
        console.warn("[swipe-trending] catalog-sync error:", err),
      );
    }

    return jsonResponse({ ok: true, cards });
  } catch (err) {
    console.error("[swipe-trending] unexpected error:", err);
    return jsonError("Internal server error", 500, "INTERNAL_ERROR");
  }
});

// ------------------------------------------------------------
// Core logic
// ------------------------------------------------------------

function validateConfig(): Response | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE_KEY) {
    console.error(
      "[swipe-trending] Missing required env vars (SUPABASE_URL / ANON / SERVICE_ROLE)",
    );
    return jsonError("Server not configured", 500, "CONFIG_ERROR");
  }
  return null;
}

async function safeComputeUserProfile(
  supabase: ReturnType<typeof getAdminClient>,
  userId: string,
): Promise<UserProfile | null> {
  try {
    return await computeUserProfile(supabase, userId);
  } catch (err) {
    console.warn("[swipe-trending] computeUserProfile failed:", err);
    return null;
  }
}

/**
 * Build the main "trending" deck:
 * - Uses recent activity_events (last 7 days)
 * - Weights by event type + time decay
 * - Mixes in tmdb_popularity
 * - Boosts scores slightly if they match the user profile
 * - Applies genre-based diversity and seen filtering
 */
async function buildTrendingDeck(
  supabase: ReturnType<typeof getAdminClient>,
  seenTitleIds: Set<string>,
  userProfile: UserProfile | null,
): Promise<SwipeCard[]> {
  const since = new Date();
  since.setDate(since.getDate() - 7); // last 7 days

  const { data: events, error: eventsError } = await supabase
    .from("activity_events")
    .select("title_id, created_at, event_type")
    .gte("created_at", since.toISOString())
    .not("title_id", "is", null)
    .limit(5000);

  if (eventsError) {
    console.warn(
      "[swipe-trending] activity_events fetch error:",
      eventsError.message,
    );
    return [];
  }

  if (!events || !events.length) {
    return [];
  }

  // Aggregate weighted, time-decayed interactions per title_id
  const nowMs = Date.now();
  const counts = new Map<string, number>();

  for (const row of events) {
    const titleId = (row as any).title_id as string | null;
    if (!titleId) continue;

    const eventType = (row as any).event_type as string | null;
    const createdAt = new Date((row as any).created_at).getTime();

    const hoursAgo = (nowMs - createdAt) / 36e5;

    // Event-type weights
    const baseWeight =
      eventType === "rating_created" || eventType === "rating_updated"
        ? 3
        : eventType === "library_added"
        ? 2
        : eventType?.startsWith("swipe_")
        ? 1
        : 1;

    // Time decay: half-life ~48h
    const decay = Math.pow(0.5, hoursAgo / 48);

    const contribution = baseWeight * decay;
    const prev = counts.get(titleId) ?? 0;
    counts.set(titleId, prev + contribution);
  }

  if (!counts.size) {
    return [];
  }

  // Take top N by interaction score so we don't query too many titles
  const sortedByInteractions = Array.from(counts.entries()).sort(
    (a, b) => b[1] - a[1],
  );
  const topEntries = sortedByInteractions.slice(0, 300);
  const titleIds = topEntries.map(([titleId]) => titleId);

  const { data: titleRows, error: titleError } = await supabase
    .from("titles")
    .select(
      [
        "title_id",
        "content_type",
        "tmdb_id",
        "omdb_imdb_id",
        "primary_title",
        "release_year",
        "poster_url",
        "backdrop_url",
        "imdb_rating",
        "rt_tomato_pct",
        "deleted_at",
        "tmdb_popularity",
        "genres",
      ].join(","),
    )
    .in("title_id", titleIds)
    .is("deleted_at", null);

  if (titleError) {
    console.warn("[swipe-trending] titles query error:", titleError.message);
    return [];
  }

  const byId = new Map<string, any>();
  for (const row of titleRows ?? []) {
    byId.set((row as any).title_id as string, row);
  }

  type Scored = { score: number; meta: any };

  const scored: Scored[] = [];

  for (const [titleId, interactions] of topEntries) {
    const meta = byId.get(titleId);
    if (!meta) continue;

    const popularity = Number((meta as any).tmdb_popularity ?? 0);
    const popScore = Math.log10(1 + Math.max(0, popularity)) * 0.7;

    let score = interactions + popScore;

    // Personalization boost
    score *= computeUserBoost(meta, userProfile);

    scored.push({ score, meta });
  }

  if (!scored.length) {
    return [];
  }

  scored.sort((a, b) => b.score - a.score);

  // Apply diversity + seen filtering
  const genreCounts = new Map<string, number>();
  const final: SwipeCard[] = [];

  for (const { meta } of scored) {
    if (final.length >= MAX_DECK_SIZE) break;

    const id = String(meta.title_id);
    if (seenTitleIds.has(id)) continue;

    const genres: string[] = Array.isArray(meta.genres)
      ? meta.genres
      : typeof meta.genres === "string"
      ? (meta.genres as string).split(",").map((g) => g.trim())
      : [];

    let skipForGenreCap = false;
    if (genres.length) {
      for (const g of genres) {
        const current = genreCounts.get(g) ?? 0;
        if (current >= MAX_PER_GENRE) {
          skipForGenreCap = true;
          break;
        }
      }
    }

    if (skipForGenreCap) continue;

    final.push(mapMetaToCard(meta));

    for (const g of genres) {
      genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1);
    }
  }

  return final;
}

/**
 * Popularity-based fallback deck.
 * Uses tmdb_popularity, filters seen titles, and avoids duplicates.
 */
async function buildPopularityDeck(
  supabase: ReturnType<typeof getAdminClient>,
  seenTitleIds: Set<string>,
  alreadyIncludedIds: Set<string>,
): Promise<SwipeCard[]> {
  const { data: rows, error } = await supabase
    .from("titles")
    .select(
      [
        "title_id",
        "content_type",
        "tmdb_id",
        "omdb_imdb_id",
        "primary_title",
        "release_year",
        "poster_url",
        "backdrop_url",
        "imdb_rating",
        "rt_tomato_pct",
        "deleted_at",
        "tmdb_popularity",
        "genres",
      ].join(","),
    )
    .is("deleted_at", null)
    .order("tmdb_popularity", { ascending: false })
    .limit(200);

  if (error) {
    console.warn(
      "[swipe-trending] fallback titles query error:",
      error.message,
    );
    return [];
  }

  const cards: SwipeCard[] = [];

  for (const meta of rows ?? []) {
    if (cards.length >= MAX_DECK_SIZE) break;

    const id = String((meta as any).title_id);
    if (seenTitleIds.has(id)) continue;
    if (alreadyIncludedIds.has(id)) continue;

    cards.push(mapMetaToCard(meta));
  }

  return cards;
}

// ------------------------------------------------------------
// Scoring helpers
// ------------------------------------------------------------

function computeUserBoost(meta: any, profile: UserProfile | null): number {
  if (!profile) return 1;

  let boost = 1;

  // Genre-based boost
  const userGenres = profile.favoriteGenres ?? [];
  if (userGenres.length) {
    const genres: string[] = Array.isArray(meta.genres)
      ? meta.genres
      : typeof meta.genres === "string"
      ? (meta.genres as string).split(",").map((g) => g.trim())
      : [];

    const overlap = genres.filter((g) => userGenres.includes(g));
    if (overlap.length > 0) {
      boost += 0.2;
    }
  }

  // Content-type preference
  if (profile.preferredContentType && meta.content_type) {
    if (meta.content_type === profile.preferredContentType) {
      boost += 0.1;
    }
  }

  return boost;
}

function mapMetaToCard(meta: any): SwipeCard {
  return {
    id: String(meta.title_id),
    title: meta.primary_title ?? null,
    year: meta.release_year ?? null,
    posterUrl: meta.poster_url ?? null,
    backdropUrl: meta.backdrop_url ?? null,
    imdbRating: meta.imdb_rating ?? null,
    rtTomatoMeter: meta.rt_tomato_pct ?? null,
    tmdbId: meta.tmdb_id ?? null,
    imdbId: meta.omdb_imdb_id ?? null,
    contentType: meta.content_type ?? null,
  };
}

// ------------------------------------------------------------
// Catalog helpers
// ------------------------------------------------------------

async function triggerCatalogBackfill(reason: string): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn(
      "[swipe-trending] Cannot trigger catalog-backfill; missing env vars",
    );
    return;
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/catalog-backfill`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ reason }),
    });

    const txt = await res.text().catch(() => "");
    console.log(
      "[swipe-trending] catalog-backfill response",
      res.status,
      txt.slice(0, 200),
    );
  } catch (err) {
    console.warn("[swipe-trending] catalog-backfill fetch error", err);
  }
}
