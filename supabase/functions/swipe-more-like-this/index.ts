// supabase/functions/swipe-more-like-this/index.ts
//
// Returns a "More like this" swipe deck based on a seed title.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

import { triggerCatalogSyncForTitle } from "../_shared/catalog-sync.ts";
import { handleOptions, jsonError, jsonResponse } from "../_shared/http.ts";
import { log } from "../_shared/logger.ts";
import { computeUserProfile, type UserProfile } from "../_shared/preferences.ts";
import { getAdminClient, getUserClient } from "../_shared/supabase.ts";
import { loadSeenTitleIdsForUser, mapTitleRowToSwipeCard } from "../_shared/swipe.ts";
import { buildSortTitle, fetchTasteDiveSimilar } from "../_shared/tastedive.ts";
import { searchTmdbByTitle, type TmdbMediaType } from "../_shared/tmdb.ts";
import type { Database } from "../../../src/types/supabase.ts";

const FN_NAME = "swipe-more-like-this";

// ============================================================================
// Type Definitions
// ============================================================================

type Title = Database["public"]["Tables"]["titles"]["Row"];
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

const TITLE_COLUMNS = [
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
  "tmdb_poster_path",
  "tmdb_overview",
  "runtime_minutes",
  "tmdb_runtime",
  "tagline",
  "tmdb_genre_names",
  "sort_title",
].join(",");

const RequestQuerySchema = z.object({
  title_id: z.string().uuid("Invalid 'title_id' query parameter").optional(),
});

const RequestBodySchema = z.object({
  titleId: z.string().uuid("Invalid 'titleId' body parameter"),
});

const debugTasteDive = Boolean(Deno.env.get("DEBUG_TASTEDIVE"));

// ============================================================================
// Main Request Handler
// ============================================================================

export async function handler(req: Request){
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

    const seedTitleId = await resolveSeedTitleId(req);
    if (!seedTitleId) {
      return jsonError("Missing seed title id", 400, "BAD_REQUEST");
    }

    log(logCtx, "Request received", { userId: user.id, seedTitleId });

    const [seedTitle, candidates, seenTitleIds, profile] = await Promise.all([
      fetchTitle(supabaseAdmin, seedTitleId),
      fetchCandidates(supabaseAdmin, seedTitleId),
      loadSeenTitleIdsForUser(supabaseAdmin, user.id),
      computeUserProfile(supabaseAdmin, user.id).catch(() => null),
    ]);

    if (!seedTitle) {
      return jsonError("Seed title not found", 404, "SEED_NOT_FOUND");
    }

    const { matches: tasteDiveMatches, boostIds } = await fetchTasteDiveMatches(
      supabaseAdmin,
      seedTitle,
      req,
    );

    const mergedCandidates = mergeCandidates(candidates, tasteDiveMatches, seedTitleId);
    const scored = scoreCandidates(seedTitle, mergedCandidates, seenTitleIds, profile, boostIds);
    const deckTitles = buildDeck(scored, 50);
    const cards = deckTitles.map(mapTitleRowToSwipeCard);

    triggerBackgroundSync(req, deckTitles.slice(0, 3));

    return jsonResponse({ ok: true, seedTitleId: seedTitle.title_id, cards });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError("Invalid query parameters", 400, "BAD_REQUEST");
    }
    log(logCtx, "Unexpected error", { error: err.message, stack: err.stack });
    return jsonError("Internal server error", 500, "INTERNAL_ERROR");
  }
}

serve(handler);

// ============================================================================
// Data Fetching
// ============================================================================

async function resolveSeedTitleId(req: Request): Promise<string | null> {
  const url = new URL(req.url);
  const parsedQuery = RequestQuerySchema.safeParse({ title_id: url.searchParams.get("title_id") });
  if (parsedQuery.success && parsedQuery.data.title_id) {
    return parsedQuery.data.title_id;
  }

  if (req.method === "POST") {
    try {
      const body = await req.json();
      const parsedBody = RequestBodySchema.safeParse(body);
      if (parsedBody.success) return parsedBody.data.titleId;
    } catch (_err) {
      return null;
    }
  }

  return null;
}

async function fetchTitle(supabase: SupabaseClient<Database>, titleId: string): Promise<Title | null> {
  const { data, error } = await supabase
    .from("titles")
    .select(TITLE_COLUMNS)
    .eq("title_id", titleId)
    .is("deleted_at", null)
    .single();
  if (error) {
    log({ fn: FN_NAME }, "Failed to fetch seed title", { titleId, error: error.message });
  }
  return data as Title | null;
}

async function fetchCandidates(supabase: SupabaseClient<Database>, seedTitleId: string): Promise<Title[]> {
  const { data, error } = await supabase
    .from("titles")
    .select(TITLE_COLUMNS)
    .is("deleted_at", null)
    .neq("title_id", seedTitleId)
    .order("tmdb_popularity", { ascending: false })
    .limit(400);
  if (error) {
    log({ fn: FN_NAME }, "Failed to fetch candidates", { error: error.message });
    return [];
  }
  return data as Title[];
}

async function fetchTasteDiveMatches(
  supabase: SupabaseClient<Database>,
  seedTitle: Title,
  req: Request,
): Promise<{ matches: Title[]; boostIds: Set<string> }> {
  const seedTitleText = seedTitle.primary_title ?? seedTitle.original_title;
  if (!seedTitleText) return { matches: [], boostIds: new Set<string>() };

  const tasteType = seedTitle.content_type === "series" ? "show" : "movie";
  const results = await fetchTasteDiveSimilar({
    q: `${tasteType}:${seedTitleText}`,
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

  if (debugTasteDive) {
    console.log(`[TasteDive] fetched ${results.length} results, normalized ${sortTitles.length}`);
  }

  if (!sortTitles.length) return { matches: [], boostIds: new Set<string>() };

  const { data, error } = await supabase
    .from("titles")
    .select(TITLE_COLUMNS)
    .eq("content_type", seedTitle.content_type)
    .in("sort_title", sortTitles)
    .is("deleted_at", null)
    .limit(50);

  if (error) {
    if (debugTasteDive) {
      console.log("[TasteDive] lookup error", error.message);
    }
    return { matches: [], boostIds: new Set<string>() };
  }

  const matches = (data ?? []) as Title[];
  const matchedSortTitles = new Set(
    matches
      .map((m) => m.sort_title)
      .filter((st): st is string => Boolean(st))
      .map((st) => st.toLowerCase()),
  );

  const misses = sortTitles.filter((st) => !matchedSortTitles.has(st.toLowerCase()));
  if (misses.length) {
    triggerTasteDiveSeedSearch(req, misses.slice(0, 5), seedTitle.content_type);
  }

  return { matches, boostIds: new Set(matches.map((m) => m.title_id)) };
}

function triggerTasteDiveSeedSearch(
  req: Request,
  titles: string[],
  contentType: Title["content_type"],
) {
  if (!titles.length) return;
  const mediaType: TmdbMediaType = contentType === "series" ? "tv" : "movie";

  Promise.allSettled(
    titles.map(async (name) => {
      try {
        const results = await searchTmdbByTitle(mediaType, name);
        const hit = results?.find((r: any) => r?.id);
        if (hit?.id) {
          await triggerCatalogSyncForTitle(req, { tmdbId: hit.id, contentType });
        }
      } catch (err) {
        if (debugTasteDive) console.log("[TasteDive] seed search failed", name, err?.message ?? err);
      }
    }),
  ).catch((err) => {
    if (debugTasteDive) console.log("[TasteDive] seed search batch failed", err?.message ?? err);
  });
}

function mergeCandidates(base: Title[], tasteDive: Title[], seedTitleId: string): Title[] {
  const merged = new Map<string, Title>();
  for (const cand of base) {
    if (cand.title_id !== seedTitleId) {
      merged.set(cand.title_id, cand);
    }
  }
  for (const cand of tasteDive) {
    if (cand.title_id !== seedTitleId) {
      merged.set(cand.title_id, cand);
    }
  }
  return Array.from(merged.values());
}

// ============================================================================
// Scoring and Deck Building
// ============================================================================

function scoreCandidates(
  seed: Title,
  candidates: Title[],
  seen: Set<string>,
  profile: UserProfile | null,
  tasteDiveBoostIds?: Set<string>,
): { score: number; candidate: Title }[] {
  const seedGenres = new Set(seed.genres?.map((g) => g.toLowerCase()));
  const favGenres = new Set(profile?.favoriteGenres?.map((g) => g.toLowerCase()));
  const dislikedGenres = new Set(profile?.dislikedGenres?.map((g) => g.toLowerCase()));

  return candidates
    .filter((c) => !seen.has(c.title_id))
    .map((c) => {
      let score = calculateScore(c, seed, seedGenres, favGenres, dislikedGenres);
      if (tasteDiveBoostIds?.has(c.title_id)) score += 2;
      return { score, candidate: c };
    })
    .filter(({ score }) => score > 0);
}

function calculateScore(
  candidate: Title,
  seed: Title,
  seedGenres: Set<string>,
  favGenres: Set<string>,
  dislikedGenres: Set<string>,
): number {
  const candGenres = new Set(candidate.genres?.map((g) => g.toLowerCase()));
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

  return score + (Math.random() - 0.5) * 0.25;
}

function buildDeck(scored: { score: number; candidate: Title }[], limit: number): SwipeCard[] {
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ candidate }) => candidate);
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
