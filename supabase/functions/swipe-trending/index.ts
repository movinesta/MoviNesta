// supabase/functions/swipe-trending/index.ts
//
// "Ultimate" Trending swipe deck.
// - Primary signal: recent activity_events (last 7 days), weighted by type + time decay.
// - Secondary signal: tmdb_popularity.
// - Personalized: gently boosted towards the user's favorite genres / types.
// - Diverse: limits how many cards per genre.
// - Safe: filters out titles the user has already seen.

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

const FN_NAME = "swipe-trending";

// ============================================================================
// Type Definitions
// ============================================================================

type Title = Database["public"]["Tables"]["titles"]["Row"];
type ActivityEvent = Database["public"]["Tables"]["activity_events"]["Row"];
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
const MIN_TRENDING_CARDS = 12;
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

export async function handler(req: Request) {
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
    const profile = await computeUserProfile(supabaseAdmin, user.id).catch(() => null);

    let cards = await buildTrendingDeck(supabaseAdmin, seenTitleIds, profile);
    if (cards.length < MIN_TRENDING_CARDS) {
      const fallback = await buildPopularityDeck(
        supabaseAdmin,
        seenTitleIds,
        new Set(cards.map((c) => c.title_id)),
      );
      cards = [...cards, ...fallback].slice(0, MAX_DECK_SIZE);
    }

    // Map DB rows -> API shape expected by useSwipeDeck
    const apiCards = cards.map((card) => ({
      id: card.title_id,                           // REQUIRED
      title: card.primary_title ?? "(Untitled)",   // REQUIRED
      year: card.release_year ?? null,
      type: card.content_type ?? null,
      posterUrl: card.poster_url ?? null,
      tmdbPosterPath: null,                        // optional: you could expose tmdb_poster_path here
      tmdbBackdropPath: null,                      // optional: or tmdb_backdrop_path
      imdbRating: card.imdb_rating ?? null,
      rtTomatoMeter: card.rt_tomato_pct ?? null,
    }));

    triggerBackgroundSync(req, cards.slice(0, 3));

    return jsonResponse({ ok: true, cards: apiCards });

  } catch (err) {
    log(logCtx, "Unexpected error", { error: err.message, stack: err.stack });
    return jsonError("Internal server error", 500, "INTERNAL_ERROR");
  }
}

serve(handler);

// ============================================================================
// Deck Building
// ============================================================================

async function buildTrendingDeck(
  supabase: SupabaseClient<Database>,
  seenTitleIds: Set<string>,
  profile: UserProfile | null,
): Promise<SwipeCard[]> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const events = await fetchRecentActivity(supabase, since);
  if (events.length === 0) return [];

  const scores = scoreActivity(events);
  const candidates = await fetchCandidates(supabase, Array.from(scores.keys()));
  const scored = scoreCandidates(candidates, scores, profile);

  return applyDiversityAndCaps(scored, seenTitleIds);
}

async function buildPopularityDeck(
  supabase: SupabaseClient<Database>,
  seenTitleIds: Set<string>,
  excludeIds: Set<string>,
): Promise<SwipeCard[]> {
  const { data, error } = await supabase
    .from("titles")
    .select(CANDIDATE_COLUMNS)
    .is("deleted_at", null)
    .order("tmdb_popularity", { ascending: false })
    .limit(200);

  if (error) {
    log({ fn: FN_NAME }, "Failed to build popularity deck", { error: error.message });
    return [];
  }

  return (data as Title[])
    .filter((t) => !seenTitleIds.has(t.title_id) && !excludeIds.has(t.title_id))
    .slice(0, MAX_DECK_SIZE);
}

// ============================================================================
// Data Fetching & Scoring
// ============================================================================

async function fetchRecentActivity(supabase: SupabaseClient<Database>, since: string): Promise<ActivityEvent[]> {
  const { data, error } = await supabase
    .from("activity_events")
    .select("title_id, created_at, event_type")
    .gte("created_at", since)
    .not("title_id", "is", null)
    .limit(5000);
  if (error) {
    log({ fn: FN_NAME }, "Failed to fetch recent activity", { error: error.message });
    return [];
  }
  return data as ActivityEvent[];
}

function scoreActivity(events: ActivityEvent[]): Map<string, number> {
  const nowMs = Date.now();
  return events.reduce((scores, { title_id, created_at, event_type }) => {
    if (!title_id) return scores;
    const hoursAgo = (nowMs - new Date(created_at).getTime()) / 36e5;
    const weight = event_type.includes("rating") ? 3 : event_type.includes("library") ? 2 : 1;
    const decay = Math.pow(0.5, hoursAgo / 48);
    scores.set(title_id, (scores.get(title_id) ?? 0) + weight * decay);
    return scores;
  }, new Map());
}

async function fetchCandidates(supabase: SupabaseClient<Database>, titleIds: string[]): Promise<Title[]> {
  const { data, error } = await supabase
    .from("titles")
    .select(CANDIDATE_COLUMNS)
    .in("title_id", titleIds)
    .is("deleted_at", null);
  if (error) {
    log({ fn: FN_NAME }, "Failed to fetch candidate titles", { error: error.message });
    return [];
  }
  return data as Title[];
}

function scoreCandidates(
  candidates: Title[],
  activityScores: Map<string, number>,
  profile: UserProfile | null,
): { score: number; candidate: Title }[] {
  return candidates.map((candidate) => {
    const activityScore = activityScores.get(candidate.title_id) ?? 0;
    const popScore = Math.log10(1 + (candidate.tmdb_popularity ?? 0)) * 0.7;
    let score = activityScore + popScore;
    score *= computeUserBoost(candidate, profile);
    return { score, candidate };
  });
}

function computeUserBoost(candidate: Title, profile: UserProfile | null): number {
  if (!profile) return 1;
  let boost = 1;
  if (profile.favoriteGenres?.some((g) => candidate.genres?.includes(g))) {
    boost += 0.2;
  }
  if (candidate.content_type === getPreferredContentType(profile.contentTypeWeights)) {
    boost += 0.1;
  }
  return boost;
}

function applyDiversityAndCaps(
  scored: { score: number; candidate: Title }[],
  seen: Set<string>,
): SwipeCard[] {
  scored.sort((a, b) => b.score - a.score);
  const genreCounts = new Map<string, number>();
  const deck: SwipeCard[] = [];
  for (const { candidate } of scored) {
    if (deck.length >= MAX_DECK_SIZE || seen.has(candidate.title_id)) continue;
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
