// supabase/functions/swipe-from-friends/index.ts
//
// Returns a "From Friends" swipe deck.
// Here "friends" means: people the current user follows (follows.follower_id = auth user).
// The deck is built from titles those followed users have rated highly, with
// a bit of personalization based on the current user's own profile.
//
// Behaviour:
// - If the user follows nobody, this returns an empty deck.
// - Aggregates community ratings from followed users only.
// - Scores by avg rating, rating count, tmdb_popularity, imdb_rating.
// - Boosts titles that match the caller's genres / content-type preferences.
// - Filters out titles the caller has already interacted with.
// - Enforces genre diversity caps.
// - Triggers catalog-sync for a few cards per call.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { triggerCatalogSyncForTitle } from "../_shared/catalog-sync.ts";
import { loadSeenTitleIdsForUser } from "../_shared/swipe.ts";
import { computeUserProfile, type UserProfile } from "../_shared/preferences.ts";
import {
  handleOptions,
  jsonError,
  jsonResponse,
} from "../_shared/http.ts";
import { getAdminClient, getUserClient } from "../_shared/supabase.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

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

const MAX_DECK_SIZE = 30;
const MAX_RATING_ROWS = 5000;
const MAX_TITLE_ROWS = 400;
const MAX_PER_GENRE = 5;

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

    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser();

    if (authError) {
      console.error("[swipe-from-friends] auth error:", authError.message);
      return jsonError("Unauthorized", 401, "UNAUTHORIZED");
    }
    if (!user) {
      return jsonError("Unauthorized", 401, "UNAUTHORIZED_NO_USER");
    }

    const userId = user.id as string;
    console.log("[swipe-from-friends] request", { userId });

    const seenTitleIds = await loadSeenTitleIdsForUser(supabaseAdmin, userId);
    const profile = await safeComputeUserProfile(supabaseAdmin, userId);

    // Load the set of user_ids this user follows.
    const followedIds = await loadFollowedUserIds(supabaseAdmin, userId);

    // If the user follows nobody, the "From Friends" feed should be empty.
    if (!followedIds.length) {
      console.log("[swipe-from-friends] user has no follows; empty deck");
      return jsonResponse({ ok: true, cards: [] });
    }

    const cards = await buildFromFriendsDeck(
      supabaseAdmin,
      followedIds,
      seenTitleIds,
      profile,
    );

    // Fire-and-forget catalog sync for a few cards
    const toSync = cards.slice(0, 3);
    for (const card of toSync) {
      triggerCatalogSyncForTitle(req, {
        tmdbId: card.tmdbId,
        imdbId: card.imdbId ?? undefined,
        contentType: card.contentType,
      }).catch((err) =>
        console.warn("[swipe-from-friends] catalog-sync error:", err),
      );
    }

    return jsonResponse({ ok: true, cards });
  } catch (err) {
    console.error("[swipe-from-friends] unexpected error:", err);
    return jsonError("Internal server error", 500, "INTERNAL_ERROR");
  }
});

function validateConfig(): Response | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error(
      "[swipe-from-friends] Missing SUPABASE_URL or SUPABASE_ANON_KEY",
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
    console.warn("[swipe-from-friends] computeUserProfile failed:", err);
    return null;
  }
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

/**
 * Returns the list of user_ids the caller follows.
 * Uses the `follows` table: follower_id -> followed_id.
 */
async function loadFollowedUserIds(
  supabase: ReturnType<typeof getAdminClient>,
  userId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("follows")
    .select("followed_id")
    .eq("follower_id", userId)
    .limit(1000);

  if (error) {
    console.warn("[swipe-from-friends] follows query error:", error.message);
    return [];
  }

  const ids: string[] = [];
  for (const row of data ?? []) {
    const id = (row as any).followed_id as string | null;
    if (id) ids.push(id);
  }
  return Array.from(new Set(ids));
}

// ------------------------------------------------------------
// Deck building
// ------------------------------------------------------------

async function buildFromFriendsDeck(
  supabase: ReturnType<typeof getAdminClient>,
  followedIds: string[],
  seenTitleIds: Set<string>,
  profile: UserProfile | null,
): Promise<SwipeCard[]> {
  // Step 1: sample ratings from followed users only
  const { data: rows, error } = await supabase
    .from("ratings")
    .select("title_id, rating, user_id")
    .in("user_id", followedIds)
    .gte("rating", 6)
    .limit(MAX_RATING_ROWS);

  if (error) {
    console.error("[swipe-from-friends] ratings query error:", error.message);
    return [];
  }

  if (!rows || !rows.length) {
    return [];
  }

  // Aggregate rating count & average per title
  type Agg = { count: number; sum: number };
  const agg = new Map<string, Agg>();

  for (const row of rows) {
    const titleId = (row as any).title_id as string | null;
    const rating = (row as any).rating as number | null;
    if (!titleId || rating == null) continue;

    let entry = agg.get(titleId);
    if (!entry) {
      entry = { count: 0, sum: 0 };
      agg.set(titleId, entry);
    }
    entry.count += 1;
    entry.sum += rating;
  }

  if (!agg.size) {
    return [];
  }

  const entries = Array.from(agg.entries());
  const sortedByCount = entries.sort((a, b) => b[1].count - a[1].count);
  const topEntries = sortedByCount.slice(0, MAX_TITLE_ROWS);
  const titleIds = topEntries.map(([titleId]) => titleId);

  // Step 2: load title metadata
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
    console.warn(
      "[swipe-from-friends] titles query error:",
      titleError.message,
    );
    return [];
  }

  const byId = new Map<string, any>();
  for (const row of titleRows ?? []) {
    byId.set(String((row as any).title_id), row);
  }

  const favoriteGenres = profile?.favoriteGenres ?? [];
  const dislikedGenres = profile?.dislikedGenres ?? [];
  const contentTypeWeights = profile?.contentTypeWeights ?? {};

  const positiveGenreSet = new Set(favoriteGenres.map((g) => g.toLowerCase()));
  const negativeGenreSet = new Set(dislikedGenres.map((g) => g.toLowerCase()));

  type Scored = { score: number; meta: any };

  const scored: Scored[] = [];

  for (const [titleId, { count, sum }] of topEntries) {
    const meta = byId.get(titleId);
    if (!meta) continue;

    const id = String(meta.title_id);
    if (seenTitleIds.has(id)) continue;

    const avgRating = sum / Math.max(1, count);
    const popularity = Number(meta.tmdb_popularity ?? 0);
    const imdbRating = Number(meta.imdb_rating ?? 0);

    // Base score: strong friends consensus + volume
    let score = 0;
    score += avgRating * 1.2;
    score += Math.log10(1 + count) * 1.0;
    score += Math.log10(1 + Math.max(0, popularity)) * 0.5;
    if (imdbRating > 0) {
      score += imdbRating * 0.3;
    }

    // Personalization boosts based on caller's profile
    const genres: string[] = Array.isArray(meta.genres)
      ? meta.genres
      : typeof meta.genres === "string"
      ? (meta.genres as string).split(",").map((g) => g.trim())
      : [];

    let genreBoost = 0;
    for (const g of genres) {
      const lg = g.toLowerCase();
      if (positiveGenreSet.has(lg)) {
        genreBoost += 1;
      }
      if (negativeGenreSet.has(lg)) {
        genreBoost -= 1.5;
      }
    }
    score += genreBoost;

    const ct = (meta.content_type ?? "").toString();
    const ctWeight = contentTypeWeights[ct] ?? 0;
    score *= 1 + ctWeight * 0.4;

    scored.push({ score, meta });
  }

  if (!scored.length) {
    return [];
  }

  scored.sort((a, b) => b.score - a.score);

  // Apply genre diversity
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
    for (const g of genres) {
      const key = g.toLowerCase();
      const current = genreCounts.get(key) ?? 0;
      if (current >= MAX_PER_GENRE) {
        skipForGenreCap = true;
        break;
      }
    }
    if (skipForGenreCap) continue;

    final.push(mapMetaToCard(meta));

    for (const g of genres) {
      const key = g.toLowerCase();
      genreCounts.set(key, (genreCounts.get(key) ?? 0) + 1);
    }
  }

  return final;
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
