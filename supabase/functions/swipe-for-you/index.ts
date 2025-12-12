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

// Make TasteDive "More like this" visible inside the For You deck.
// Inject up to N TasteDive-scored recommendations into the first window.
const MORE_LIKE_THIS_QUOTA = 6;
const MORE_LIKE_THIS_WINDOW = 20;
const MORE_LIKE_THIS_SLICE_LIMIT = 20;

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

    const { deckTitles, whyById } = await buildDeck(supabaseAdmin, user.id, seenTitleIds, profile, req);
    const cards = deckTitles.map((title) => ({
      ...mapTitleRowToSwipeCard(title),
      why: whyById.get(title.title_id) ?? null,
    }));

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
): Promise<{ deckTitles: SwipeCard[]; whyById: Map<string, string> }> {
  const [candidates, tasteDive] = await Promise.all([
    fetchCandidates(supabase, profile),
    fetchTasteDiveSeededBundle(supabase, userId, req, seenTitleIds, profile),
  ]);

  // Base personalization scoring (existing logic)
  const merged = mergeCandidates(candidates, tasteDive.matches);
  const scored = scoreCandidates(merged, seenTitleIds, profile, tasteDive.boostIds);
  const baseDeck = applyDiversityAndCaps(scored, seenTitleIds);

  // Inject visible TasteDive "more like this" picks up front.
  const { deckTitles, whyById } = injectMoreLikeThis(baseDeck, tasteDive.moreLikeThis, tasteDive.seedLabel);
  return { deckTitles, whyById };
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

type TasteDiveSeededBundle = {
  // Raw DB matches for any TasteDive results we already have in the catalog.
  matches: Title[];
  boostIds: Set<string>;

  // A scored, seed-specific "more like this" slice to inject into the For You deck.
  moreLikeThis: Title[];

  // Label used by the UI (optional)
  seedLabel: string | null;
};

async function fetchTasteDiveSeededBundle(
  supabase: SupabaseClient<Database>,
  userId: string,
  req: Request,
  seenTitleIds: Set<string>,
  profile: UserProfile | null,
): Promise<TasteDiveSeededBundle> {
  const seed = await pickTasteDiveSeed(supabase, userId);
  if (!seed) {
    return { matches: [], boostIds: new Set<string>(), moreLikeThis: [], seedLabel: null };
  }

  const seedTitleText = (seed.primary_title ?? "").trim();
  if (!seedTitleText) {
    return { matches: [], boostIds: new Set<string>(), moreLikeThis: [], seedLabel: null };
  }

  const tasteType = seed.content_type === "series" ? "show" : "movie";
  const results = await fetchTasteDiveSimilar({
    q: `${tasteType}:${seedTitleText}`,
    type: tasteType,
    limit: 25,
    info: 1,
    slimit: 1,
  });

  const sortTitles = Array.from(
    new Set(
      results
        .map((r) => buildSortTitle(r.Name))
        .filter((val): val is string => Boolean(val)),
    ),
  );

  if (debugTasteDive) {
    console.log(`[swipe-for-you] TasteDive seed="${seedTitleText}" results=${results.length} normalized=${sortTitles.length}`);
  }

  let matches: Title[] = [];
  const boostIds = new Set<string>();

  const misses: { name: string; contentType: Title["content_type"] }[] = [];

  if (sortTitles.length) {
    const { data, error } = await supabase
      .from("titles")
      .select(CANDIDATE_COLUMNS)
      .eq("content_type", seed.content_type)
      .in("sort_title", sortTitles)
      .is("deleted_at", null)
      .limit(50);

    if (!error) {
      matches = (data ?? []) as Title[];
      for (const row of matches) {
        boostIds.add(row.title_id);
      }

      const matchedSorts = new Set(
        matches
          .map((r) => r.sort_title)
          .filter((v): v is string => Boolean(v))
          .map((v) => v.toLowerCase()),
      );

      for (const st of sortTitles) {
        if (!matchedSorts.has(st.toLowerCase())) {
          misses.push({ name: st, contentType: seed.content_type });
        }
      }
    } else if (debugTasteDive) {
      console.log("[swipe-for-you] TasteDive lookup failed", error.message);
    }
  }

  if (misses.length) {
    triggerTasteDiveSeedSearch(req, misses.slice(0, 5));
  }

  // Build a seed-specific "more like this" slice we can inject into the deck.
  const pool = await fetchMoreLikeThisCandidatePool(supabase, seed.title_id, seed.content_type);
  const mergedPool = mergeCandidates(pool, matches);
  const scored = scoreMoreLikeThisCandidates(seed, mergedPool, seenTitleIds, profile, boostIds);
  const moreLikeThis = buildMoreLikeThisDeck(scored, MORE_LIKE_THIS_SLICE_LIMIT);

  const seedLabel = seed.primary_title ? `More like ${seed.primary_title}` : "More like this";

  return { matches, boostIds, moreLikeThis, seedLabel };
}

async function pickTasteDiveSeed(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<Title | null> {
  // Priority: strong ratings (8+), else recent liked (6+), else recent library.
  const strong = await fetchUserRatingsByScore(supabase, userId, 8, 15);
  const recentLiked = strong.length ? [] : await fetchUserRatingsByScore(supabase, userId, 6, 25, true);
  const library = (!strong.length && !recentLiked.length)
    ? await fetchRecentLibrarySeeds(supabase, userId, 25)
    : [];

  const seedId = strong[0] ?? recentLiked[0] ?? library[0] ?? null;
  if (!seedId) return null;

  const { data, error } = await supabase
    .from("titles")
    .select(CANDIDATE_COLUMNS)
    .eq("title_id", seedId)
    .is("deleted_at", null)
    .single();

  if (error) {
    if (debugTasteDive) console.log("[swipe-for-you] failed to load seed title", error.message);
    return null;
  }

  return data as Title;
}

async function fetchMoreLikeThisCandidatePool(
  supabase: SupabaseClient<Database>,
  seedTitleId: string,
  contentType: Title["content_type"],
): Promise<Title[]> {
  const { data, error } = await supabase
    .from("titles")
    .select(CANDIDATE_COLUMNS)
    .eq("content_type", contentType)
    .is("deleted_at", null)
    .neq("title_id", seedTitleId)
    .order("tmdb_popularity", { ascending: false })
    .limit(MAX_CANDIDATES);

  if (error) {
    if (debugTasteDive) console.log("[swipe-for-you] more-like-this candidate pool fetch failed", error.message);
    return [];
  }
  return (data ?? []) as Title[];
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
// TasteDive "More like this" scoring + injection
// ============================================================================

function scoreMoreLikeThisCandidates(
  seed: Title,
  candidates: Title[],
  seen: Set<string>,
  profile: UserProfile | null,
  tasteDiveBoostIds?: Set<string>,
): { score: number; candidate: Title }[] {
  const seedGenres = new Set((seed.genres ?? []).map((g) => g.toLowerCase()));
  const favGenres = new Set(profile?.favoriteGenres?.map((g) => g.toLowerCase()));
  const dislikedGenres = new Set(profile?.dislikedGenres?.map((g) => g.toLowerCase()));

  return candidates
    .filter((c) => !seen.has(c.title_id) && c.title_id !== seed.title_id)
    .map((c) => {
      let score = calculateMoreLikeThisScore(c, seed, seedGenres, favGenres, dislikedGenres);
      if (tasteDiveBoostIds?.has(c.title_id)) score += 2;
      return { score, candidate: c };
    })
    .filter(({ score }) => score > 0);
}

function calculateMoreLikeThisScore(
  candidate: Title,
  seed: Title,
  seedGenres: Set<string>,
  favGenres: Set<string>,
  dislikedGenres: Set<string>,
): number {
  const candGenres = new Set((candidate.genres ?? []).map((g) => g.toLowerCase()));
  const intersection = new Set([...seedGenres].filter((g) => candGenres.has(g))).size;
  const union = new Set([...seedGenres, ...candGenres]).size;
  const jaccard = union > 0 ? intersection / union : 0;

  const yearDiff = Math.abs((seed.release_year ?? 0) - (candidate.release_year ?? 0));
  const yearScore = Math.max(0, 1 - yearDiff / 20);

  const pop = candidate.tmdb_popularity ?? 0;
  const popScore = Math.log10(1 + pop);

  const tasteAdj = (candidate.genres ?? []).reduce((adj, g) => {
    const lg = g.toLowerCase();
    if (favGenres.has(lg)) return adj + 0.3;
    if (dislikedGenres.has(lg)) return adj - 0.5;
    return adj;
  }, 0);

  let score = jaccard * 6 + yearScore * 2 + popScore * 0.5 + tasteAdj;
  if (candidate.content_type === seed.content_type) score += 1;
  if (jaccard === 0 && yearScore < 0.2) score -= 2;

  // tiny randomization to avoid identical ordering
  return score + (Math.random() - 0.5) * 0.25;
}

function buildMoreLikeThisDeck(scored: { score: number; candidate: Title }[], limit: number): Title[] {
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(0, limit))
    .map(({ candidate }) => candidate);
}

function injectMoreLikeThis(
  baseDeck: SwipeCard[],
  moreLikeThis: Title[],
  seedLabel: string | null,
): { deckTitles: SwipeCard[]; whyById: Map<string, string> } {
  const whyById = new Map<string, string>();
  if (!moreLikeThis.length || !seedLabel) {
    return { deckTitles: baseDeck.slice(0, MAX_DECK_SIZE), whyById };
  }

  const quota = Math.min(MORE_LIKE_THIS_QUOTA, moreLikeThis.length, MAX_DECK_SIZE);
  const window = Math.min(Math.max(quota, MORE_LIKE_THIS_WINDOW), MAX_DECK_SIZE);

  const base = baseDeck ?? [];
  const taste = moreLikeThis ?? [];
  const used = new Set<string>();
  const deck: SwipeCard[] = [];

  const tryAdd = (title: Title | undefined, why?: string) => {
    if (!title) return false;
    const id = title.title_id;
    if (!id || used.has(id)) return false;
    used.add(id);
    deck.push(title);
    if (why) whyById.set(id, why);
    return true;
  };

  let tIdx = 0;
  let bIdx = 0;
  let injected = 0;

  while (deck.length < MAX_DECK_SIZE && (bIdx < base.length || tIdx < taste.length)) {
    const pos = deck.length;

    if (pos < window && injected < quota) {
      // Prefer TasteDive picks in the early window.
      let added = false;
      while (tIdx < taste.length && !added) {
        const cand = taste[tIdx++];
        added = tryAdd(cand, seedLabel);
      }
      if (added) {
        injected += 1;
        continue;
      }
    }

    // Fill with the base deck.
    while (bIdx < base.length) {
      const cand = base[bIdx++];
      if (tryAdd(cand)) break;
    }

    // If base is exhausted, append remaining TasteDive picks.
    if (bIdx >= base.length && tIdx < taste.length) {
      while (tIdx < taste.length && deck.length < MAX_DECK_SIZE) {
        const cand = taste[tIdx++];
        tryAdd(cand, seedLabel);
      }
    }
  }

  // If a TasteDive pick also appears later via base scoring, label it too.
  const tasteIds = new Set(taste.map((t) => t.title_id));
  for (const t of deck) {
    if (tasteIds.has(t.title_id) && !whyById.has(t.title_id)) {
      whyById.set(t.title_id, seedLabel);
    }
  }

  return { deckTitles: deck.slice(0, MAX_DECK_SIZE), whyById };
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
