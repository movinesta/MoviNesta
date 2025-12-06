// supabase/functions/swipe-more-like-this/index.ts
//
// Returns a "More like this" swipe deck based on a seed title.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

import { triggerCatalogSyncForTitle } from "../_shared/catalog-sync.ts";
import { handleOptions, jsonError, jsonResponse, validateRequest } from "../_shared/http.ts";
import { log } from "../_shared/logger.ts";
import { computeUserProfile, type UserProfile } from "../_shared/preferences.ts";
import { getAdminClient, getUserClient } from "../_shared/supabase.ts";
import { loadSeenTitleIdsForUser } from "../_shared/swipe.ts";
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
].join(",");

const RequestQuerySchema = z.object({
  title_id: z.string().uuid("Invalid 'title_id' query parameter"),
});

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

    const url = new URL(req.url);
    const { title_id: seedTitleId } = RequestQuerySchema.parse({
      title_id: url.searchParams.get("title_id"),
    });

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

    const scored = scoreCandidates(seedTitle, candidates, seenTitleIds, profile);
    const deck = buildDeck(scored, 50);

    triggerBackgroundSync(req, deck.slice(0, 3));

    return jsonResponse({ ok: true, seedTitleId: seedTitle.title_id, cards: deck });
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

// ============================================================================
// Scoring and Deck Building
// ============================================================================

function scoreCandidates(
  seed: Title,
  candidates: Title[],
  seen: Set<string>,
  profile: UserProfile | null,
): { score: number; candidate: Title }[] {
  const seedGenres = new Set(seed.genres?.map((g) => g.toLowerCase()));
  const favGenres = new Set(profile?.favoriteGenres?.map((g) => g.toLowerCase()));
  const dislikedGenres = new Set(profile?.dislikedGenres?.map((g) => g.toLowerCase()));

  return candidates
    .filter((c) => !seen.has(c.title_id))
    .map((c) => ({ score: calculateScore(c, seed, seedGenres, favGenres, dislikedGenres), candidate: c }))
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
