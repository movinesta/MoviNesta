// supabase/functions/swipe-for-you/index.ts
//
// Returns a strongly personalized "For You" swipe deck for the current user.
// - Uses a UserProfile built from ratings, library, and activity events.
// - Scores candidates based on genre matches, content type preference, etc.
// - Ensures the user does not see titles they've already interacted with.
// - Applies genre diversity caps.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

import { triggerCatalogSyncForTitle } from "../_shared/catalog-sync.ts";
import { handleOptions, jsonError, jsonResponse } from "../_shared/http.ts";
import { log } from "../_shared/logger.ts";
import {
  computeUserProfile,
  getPreferredContentType,
  type UserProfile,
} from "../_shared/preferences.ts";
import { getAdminClient, getUserClient } from "../_shared/supabase.ts";
import { loadSeenTitleIdsForUser } from "../_shared/swipe.ts";
import type { Database } from "../../../src/types/supabase.ts";

const FN_NAME = "swipe-for-you";

// ============================================================================
// Type Definitions
// ============================================================================

type Title = Database["public"]["Tables"]["titles"]["Row"];
type ContentType = Database["public"]["Enums"]["content_type"];
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
>;

const MAX_DECK_SIZE = 30;
const MAX_CANDIDATES = 400;
const MAX_PER_GENRE = 5;

const CANDIDATE_COLUMNS = [
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
  "tmdb_popularity",
  "genres",
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

    const seenTitleIds = await loadSeenTitleIdsForUser(supabaseAdmin, user.id);
    const profile = await computeUserProfile(supabaseAdmin, user.id).catch((err) => {
      log(logCtx, "Failed to compute user profile", { userId: user.id, error: err.message });
      return null;
    });

    const cards = await buildDeck(supabaseAdmin, seenTitleIds, profile);

    // Trigger background sync for the top few cards to keep them fresh.
    triggerBackgroundSync(req, cards.slice(0, 3));

    return jsonResponse({ ok: true, cards });
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
  seenTitleIds: Set<string>,
  profile: UserProfile | null,
): Promise<SwipeCard[]> {
  const candidates = await fetchCandidates(supabase, profile);
  const scored = scoreCandidates(candidates, seenTitleIds, profile);
  const deck = applyDiversityAndCaps(scored, seenTitleIds);
  return deck;
}

async function fetchCandidates(
  supabase: SupabaseClient<Database>,
  profile: UserProfile | null,
): Promise<Title[]> {
  let query = supabase
    .from("titles")
    .select(CANDIDATE_COLUMNS)
    .is("deleted_at", null)
    .order("tmdb_popularity", { ascending: false })
    .order("imdb_rating", { ascending: false, nullsFirst: true })
    .limit(MAX_CANDIDATES);

  if (profile?.favoriteGenres?.length) {
    query = query.overlaps("genres", profile.favoriteGenres.slice(0, 5));
  }
  const preferredContentType = getPreferredContentType(profile?.contentTypeWeights);
  if (preferredContentType) {
    query = query.eq("content_type", preferredContentType);
  }

  const { data, error } = await query;
  if (error) {
    log({ fn: FN_NAME }, "Failed to fetch candidates", { error: error.message });
    return [];
  }
  return data as Title[];
}

function scoreCandidates(
  candidates: Title[],
  seenTitleIds: Set<string>,
  profile: UserProfile | null,
): { score: number; candidate: Title }[] {
  if (!profile) {
    // Fallback for new users: just use popularity.
    return candidates
      .filter((c) => !seenTitleIds.has(c.title_id))
      .map((candidate) => ({ score: candidate.tmdb_popularity ?? 0, candidate }));
  }

  const positiveGenres = new Set(profile.favoriteGenres?.map((g) => g.toLowerCase()));
  const negativeGenres = new Set(profile.dislikedGenres?.map((g) => g.toLowerCase()));

  return candidates
    .filter((c) => !seenTitleIds.has(c.title_id))
    .map((candidate) => {
      const pop = candidate.tmdb_popularity ?? 0;
      const rating = candidate.imdb_rating ?? 0;
      let score = Math.log10(1 + pop) + rating;

      // Genre boosts/penalties
      const genreBoost = (candidate.genres ?? []).reduce((boost, g) => {
        const lg = g.toLowerCase();
        if (positiveGenres.has(lg)) return boost + 1;
        if (negativeGenres.has(lg)) return boost - 1.5;
        return boost;
      }, 0);
      score += genreBoost;

      // Content type preference
      const ctWeight = profile.contentTypeWeights?.[candidate.content_type as ContentType] ?? 0;
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
    if (deck.length >= MAX_DECK_SIZE || seenTitleIds.has(candidate.title_id)) {
      continue;
    }

    const genres = (candidate.genres ?? []).map((g) => g.toLowerCase());
    if (genres.some((g) => (genreCounts.get(g) ?? 0) >= MAX_PER_GENRE)) {
      continue;
    }

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
