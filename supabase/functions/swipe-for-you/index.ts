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
import { loadSeenTitleIdsForUser, mapTitleRowToSwipeCard } from "../_shared/swipe.ts";
import { buildSortTitle, fetchTasteDiveSimilar } from "../_shared/tastedive.ts";
import { searchTmdbByTitle, type TmdbMediaType } from "../_shared/tmdb.ts";
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
  | "tmdb_poster_path"
  | "tmdb_overview"
  | "runtime_minutes"
  | "tmdb_runtime"
  | "tagline"
  | "tmdb_genre_names"
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

const debugTasteDive = Boolean(Deno.env.get("DEBUG_TASTEDIVE"));

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

    const deckTitles = await buildDeck(supabaseAdmin, user.id, seenTitleIds, profile, req);
    const cards = deckTitles.map(mapTitleRowToSwipeCard);

    // Trigger background sync for the top few cards to keep them fresh.
    triggerBackgroundSync(req, deckTitles.slice(0, 3));

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
  userId: string,
  seenTitleIds: Set<string>,
  profile: UserProfile | null,
  req: Request,
): Promise<SwipeCard[]> {
  const [candidates, tasteDive] = await Promise.all([
    fetchCandidates(supabase, profile),
    fetchTasteDiveCandidates(supabase, userId, req),
  ]);

  const merged = mergeCandidates(candidates, tasteDive.matches);
  const scored = scoreCandidates(merged, seenTitleIds, profile, tasteDive.boostIds);
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

async function fetchTasteDiveCandidates(
  supabase: SupabaseClient<Database>,
  userId: string,
  req: Request,
): Promise<{ matches: Title[]; boostIds: Set<string> }> {
  const seeds = await pickTasteDiveSeeds(supabase, userId);
  if (!seeds.length) return { matches: [], boostIds: new Set<string>() };

  const matched = new Map<string, Title>();
  const boostIds = new Set<string>();
  const misses: { name: string; contentType: Title["content_type"] }[] = [];

  for (const seed of seeds.slice(0, 3)) {
    const seedTitle = seed.primary_title ?? seed.original_title;
    if (!seedTitle) continue;
    const tasteType = seed.content_type === "series" ? "show" : "movie";
    const results = await fetchTasteDiveSimilar({
      q: `${tasteType}:${seedTitle}`,
      type: tasteType,
      limit: 25,
    });

    const sortTitles = Array.from(
      new Set(
        results
          .map((r) => buildSortTitle(r.Name))
          .filter((val): val is string => Boolean(val)),
      ),
    );

    if (!sortTitles.length) continue;

    const { data, error } = await supabase
      .from("titles")
      .select(CANDIDATE_COLUMNS)
      .eq("content_type", seed.content_type)
      .in("sort_title", sortTitles)
      .is("deleted_at", null)
      .limit(50);

    if (error) {
      if (debugTasteDive) console.log("[swipe-for-you] TasteDive lookup failed", error.message);
      continue;
    }

    const rows = (data ?? []) as Title[];
    for (const row of rows) {
      matched.set(row.title_id, row);
      boostIds.add(row.title_id);
    }

    const matchedSorts = new Set(
      rows
        .map((r) => r.sort_title)
        .filter((v): v is string => Boolean(v))
        .map((v) => v.toLowerCase()),
    );
    for (const st of sortTitles) {
      if (!matchedSorts.has(st.toLowerCase())) {
        misses.push({ name: st, contentType: seed.content_type });
      }
    }
  }

  if (misses.length) {
    triggerTasteDiveSeedSearch(req, misses.slice(0, 5));
  }

  return { matches: Array.from(matched.values()), boostIds };
}

async function pickTasteDiveSeeds(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<Title[]> {
  const seedIds: string[] = [];

  const strongRatings = await fetchUserRatingsByScore(supabase, userId, 8, 15);
  for (const id of strongRatings) {
    if (!seedIds.includes(id)) seedIds.push(id);
    if (seedIds.length >= 3) break;
  }

  if (seedIds.length < 3) {
    const recentLiked = await fetchUserRatingsByScore(supabase, userId, 6, 25, true);
    for (const id of recentLiked) {
      if (!seedIds.includes(id)) seedIds.push(id);
      if (seedIds.length >= 3) break;
    }
  }

  if (seedIds.length < 3) {
    const librarySeeds = await fetchRecentLibrarySeeds(supabase, userId, 25);
    for (const id of librarySeeds) {
      if (!seedIds.includes(id)) seedIds.push(id);
      if (seedIds.length >= 3) break;
    }
  }

  if (!seedIds.length) return [];

  const { data, error } = await supabase
    .from("titles")
    .select(`${CANDIDATE_COLUMNS}, sort_title`)
    .in("title_id", seedIds)
    .is("deleted_at", null);

  if (error) {
    if (debugTasteDive) console.log("[swipe-for-you] failed to load seed titles", error.message);
    return [];
  }

  return (data ?? []).slice(0, 3) as Title[];
}

async function fetchUserRatingsByScore(
  supabase: SupabaseClient<Database>,
  userId: string,
  minScore: number,
  limit: number,
  orderByRecent: boolean = false,
): Promise<string[]> {
  const query = supabase
    .from("ratings")
    .select("title_id, rating, created_at")
    .eq("user_id", userId)
    .gte("rating", minScore)
    .limit(limit)
    .order(orderByRecent ? "created_at" : "rating", { ascending: false });

  const { data, error } = await query;
  if (error) {
    if (debugTasteDive) console.log("[swipe-for-you] ratings seed fetch failed", error.message);
    return [];
  }
  return (data ?? [])
    .map((row: any) => row.title_id as string)
    .filter((id): id is string => Boolean(id));
}

async function fetchRecentLibrarySeeds(
  supabase: SupabaseClient<Database>,
  userId: string,
  limit: number,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("library_entries")
    .select("title_id")
    .eq("user_id", userId)
    .in("status", ["watched", "watching"])
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (debugTasteDive) console.log("[swipe-for-you] library seed fetch failed", error.message);
    return [];
  }

  return (data ?? [])
    .map((row: any) => row.title_id as string)
    .filter((id): id is string => Boolean(id));
}

function triggerTasteDiveSeedSearch(
  req: Request,
  titles: { name: string; contentType: Title["content_type"] }[],
) {
  if (!titles.length) return;
  Promise.allSettled(
    titles.map(async ({ name, contentType }) => {
      const mediaType: TmdbMediaType = contentType === "series" ? "tv" : "movie";
      try {
        const results = await searchTmdbByTitle(mediaType, name);
        const hit = results?.find((r: any) => r?.id);
        if (hit?.id) {
          await triggerCatalogSyncForTitle(req, { tmdbId: hit.id, contentType });
        }
      } catch (err) {
        if (debugTasteDive) console.log("[swipe-for-you] seed search failed", name, err?.message ?? err);
      }
    }),
  ).catch((err) => {
    if (debugTasteDive) console.log("[swipe-for-you] seed search batch failed", err?.message ?? err);
  });
}

function mergeCandidates(base: Title[], tasteDive: Title[]): Title[] {
  const merged = new Map<string, Title>();
  for (const cand of base) {
    merged.set(cand.title_id, cand);
  }
  for (const cand of tasteDive) {
    merged.set(cand.title_id, cand);
  }
  return Array.from(merged.values());
}

function scoreCandidates(
  candidates: Title[],
  seenTitleIds: Set<string>,
  profile: UserProfile | null,
  tasteDiveBoostIds?: Set<string>,
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

      if (tasteDiveBoostIds?.has(candidate.title_id)) {
        score += 2;
      }

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
