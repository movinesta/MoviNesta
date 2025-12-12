// supabase/functions/swipe-from-friends/index.ts
//
// Returns a "From Friends" swipe deck, built from titles that users the
// current user follows have rated highly.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

import { triggerCatalogSyncForTitle } from "../_shared/catalog-sync.ts";
import { handleOptions, jsonError, jsonResponse } from "../_shared/http.ts";
import { log } from "../_shared/logger.ts";
import { computeUserProfile, type UserProfile } from "../_shared/preferences.ts";
import { getAdminClient, getUserClient } from "../_shared/supabase.ts";
import { loadSeenTitleIdsForUser, mapTitleRowToSwipeCard } from "../_shared/swipe.ts";
import type { Database } from "../../../src/types/supabase.ts";

const FN_NAME = "swipe-from-friends";

// ============================================================================
// Type Definitions
// ============================================================================

type Title = Database["public"]["Tables"]["titles"]["Row"];
type Rating = Database["public"]["Tables"]["ratings"]["Row"];
type SwipeCard = Pick<
  Title,
  | "title_id"
  | "primary_title"
  | "release_year"
  | "poster_url"
  | "backdrop_url"
  | "imdb_rating"
  | "rt_tomato_pct"
  | "tmdb_id"
  | "omdb_imdb_id"
  | "content_type"
  | "tmdb_poster_path"
  | "tmdb_overview"
  | "runtime_minutes"
  | "tmdb_runtime"
  | "tagline"
  | "tmdb_genre_names"
>;

const MAX_DECK_SIZE = 30;
const MAX_RATING_ROWS = 5000;
const MAX_TITLE_ROWS = 400;
const MAX_PER_GENRE = 5;

const CANDIDATE_COLUMNS = [
  "title_id",
  "content_type",
  "tmdb_id",
  "omdb_imdb_id",
  "primary_title",
  "release_year",
  "poster_url",
  "tmdb_poster_path",
  "tmdb_overview",
  "backdrop_url",
  "imdb_rating",
  "rt_tomato_pct",
  "tmdb_popularity",
  "genres",
  "runtime_minutes",
  "tmdb_runtime",
  "tagline",
  "tmdb_genre_names",
  "sort_title",
].join(",");

// ============================================================================
// Main Request Handler
// ============================================================================

serve(async (req: Request) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  const logCtx = { fn: FN_NAME };

  try {
    const supabaseAdmin = getAdminClient();
    const supabaseAuth = getUserClient(req);

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      log(logCtx, "Auth error", { error: authError?.message });
      return jsonError("Unauthorized", 401, "UNAUTHORIZED");
    }

    log(logCtx, "Request received", { userId: user.id });

    const followedIds = await loadFollowedUserIds(supabaseAdmin, user.id);
    if (!followedIds.length) {
      log(logCtx, "User follows no one, returning empty deck", { userId: user.id });
      return jsonResponse({ ok: true, cards: [] });
    }

    const seenTitleIds = await loadSeenTitleIdsForUser(supabaseAdmin, user.id);
    const profile = await computeUserProfile(supabaseAdmin, user.id).catch((err) => {
      log(logCtx, "Failed to compute user profile", { userId: user.id, error: err.message });
      return null;
    });

    const cards = await buildDeck(supabaseAdmin, followedIds, seenTitleIds, profile);
    triggerBackgroundSync(req, cards.slice(0, 3));

    const apiCards = cards.map(mapTitleRowToSwipeCard);

    return jsonResponse({ ok: true, cards: apiCards });
  } catch (err) {
    log(logCtx, "Unexpected error", { error: err.message, stack: err.stack });
    return jsonError("Internal server error", 500, "INTERNAL_ERROR");
  }
});

// ============================================================================
// Deck Building Logic
// ============================================================================

async function buildDeck(
  supabase: SupabaseClient<Database>,
  followedIds: string[],
  seenTitleIds: Set<string>,
  profile: UserProfile | null,
): Promise<SwipeCard[]> {
  const friendsRatings = await fetchFriendsRatings(supabase, followedIds);
  const aggregated = aggregateRatings(friendsRatings);
  const candidates = await fetchCandidates(supabase, Array.from(aggregated.keys()));
  const scored = scoreCandidates(candidates, aggregated, seenTitleIds, profile);
  return applyDiversityAndCaps(scored, seenTitleIds);
}

async function loadFollowedUserIds(supabase: SupabaseClient<Database>, userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("follows")
    .select("followed_id")
    .eq("follower_id", userId)
    .limit(1000);
  if (error) {
    log({ fn: FN_NAME }, "Failed to load followed user IDs", { userId, error: error.message });
    return [];
  }
  return data.map((f) => f.followed_id);
}

async function fetchFriendsRatings(
  supabase: SupabaseClient<Database>,
  followedIds: string[],
): Promise<Rating[]> {
  const { data, error } = await supabase
    .from("ratings")
    .select("title_id, rating")
    .in("user_id", followedIds)
    .gte("rating", 6)
    .limit(MAX_RATING_ROWS);
  if (error) {
    log({ fn: FN_NAME }, "Failed to fetch friends' ratings", { error: error.message });
    return [];
  }
  return data as Rating[];
}

function aggregateRatings(ratings: Rating[]): Map<string, { count: number; sum: number }> {
  return ratings.reduce((agg, { title_id, rating }) => {
    const current = agg.get(title_id) ?? { count: 0, sum: 0 };
    current.count++;
    current.sum += rating;
    agg.set(title_id, current);
    return agg;
  }, new Map());
}

async function fetchCandidates(supabase: SupabaseClient<Database>, titleIds: string[]): Promise<Title[]> {
  if (titleIds.length === 0) return [];
  const { data, error } = await supabase
    .from("titles")
    .select(CANDIDATE_COLUMNS)
    .in("title_id", titleIds.slice(0, MAX_TITLE_ROWS))
    .is("deleted_at", null);
  if (error) {
    log({ fn: FN_NAME }, "Failed to fetch candidate titles", { error: error.message });
    return [];
  }
  return data as Title[];
}

function scoreCandidates(
  candidates: Title[],
  aggregated: Map<string, { count: number; sum: number }>,
  seenTitleIds: Set<string>,
  profile: UserProfile | null,
): { score: number; candidate: Title }[] {
  const positiveGenres = new Set(profile?.favoriteGenres?.map((g) => g.toLowerCase()));
  const negativeGenres = new Set(profile?.dislikedGenres?.map((g) => g.toLowerCase()));

  return candidates
    .filter((c) => !seenTitleIds.has(c.title_id))
    .map((candidate) => {
      const { count, sum } = aggregated.get(candidate.title_id) ?? { count: 0, sum: 0 };
      const avgRating = count > 0 ? sum / count : 0;
      const pop = candidate.tmdb_popularity ?? 0;
      const imdb = candidate.imdb_rating ?? 0;

      let score = avgRating * 1.2 + Math.log10(1 + count) + Math.log10(1 + pop) * 0.5 + imdb * 0.3;

      const genreBoost = (candidate.genres ?? []).reduce((boost, g) => {
        const lg = g.toLowerCase();
        if (positiveGenres.has(lg)) return boost + 1;
        if (negativeGenres.has(lg)) return boost - 1.5;
        return boost;
      }, 0);
      score += genreBoost;

      const ctWeight = profile?.contentTypeWeights?.[candidate.content_type as keyof UserProfile["contentTypeWeights"]] ?? 0;
      score *= 1 + ctWeight * 0.4;

      return { score, candidate };
    });
}

function applyDiversityAndCaps(
  scored: { score: number; candidate: Title }[],
  seenTitleIds: Set<string>,
): SwipeCard[] {
  scored.sort((a, b) => b.score - a.score);

  const genreCounts = new Map<string, number>();
  const deck: SwipeCard[] = [];

  for (const { candidate } of scored) {
    if (deck.length >= MAX_DECK_SIZE || seenTitleIds.has(candidate.title_id)) continue;
    const genres = (candidate.genres ?? []).map((g) => g.toLowerCase());
    if (genres.some((g) => (genreCounts.get(g) ?? 0) >= MAX_PER_GENRE)) continue;
    deck.push(candidate);
    genres.forEach((g) => genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1));
  }
  return deck;
}

// ============================================================================
// Utils
// ============================================================================

function triggerBackgroundSync(req: Request, cards: SwipeCard[]) {
  Promise.allSettled(
    cards.map((card) =>
      triggerCatalogSyncForTitle(req, {
        tmdbId: card.tmdb_id,
        imdbId: card.omdb_imdb_id,
        contentType: card.content_type,
      })
    ),
  ).catch((err) => {
    log({ fn: FN_NAME }, "Background sync failed", { error: err.message });
  });
}
