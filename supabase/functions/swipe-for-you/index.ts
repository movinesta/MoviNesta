// supabase/functions/swipe-for-you/index.ts
//
// Returns a "For You" swipe deck for the current user.
// Uses a UserProfile built from ratings/library/activity (if available)
// and always avoids titles the user has already seen.
// Also triggers `catalog-sync` for up to 3 cards per call.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { triggerCatalogSyncForTitle } from "../_shared/catalog-sync.ts";
import { loadSeenTitleIdsForUser } from "../_shared/swipe.ts";
import { computeUserProfile, type UserProfile } from "../_shared/preferences.ts";
import {
  corsHeaders,
  handleOptions,
  jsonError,
  jsonResponse,
} from "../_shared/http.ts";
import { getUserClient } from "../_shared/supabase.ts";
import { log } from "../_shared/logger.ts";

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
const CANDIDATE_LIMIT = 150;
const CATALOG_SYNC_LIMIT = 3;

serve(async (req: Request): Promise<Response> => {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== "GET") {
    return jsonError("Method not allowed", 405, "METHOD_NOT_ALLOWED");
  }

  const supabase = getUserClient(req);

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("[swipe-for-you] auth error:", authError.message);
    return jsonError("Unauthorized", 401, "UNAUTHORIZED");
  }

  if (!user) {
    return jsonError("Unauthorized", 401, "UNAUTHORIZED");
  }

  const ctx = { fn: "swipe-for-you", userId: user.id as string | null };
  log(ctx, "request start");

  try {
    const seenTitleIds = await loadSeenTitleIdsForUser(supabase, user.id);
    const profile: UserProfile | null = await computeUserProfile(
      supabase,
      user.id,
    );

    const cards = await buildForYouDeck(req, supabase, seenTitleIds, profile);

    log(ctx, "response", { cardCount: cards.length });

    return jsonResponse({ cards });
  } catch (err) {
    console.error("[swipe-for-you] unexpected error:", err);
    return jsonError("Internal server error", 500, "INTERNAL_ERROR");
  }
});

async function buildForYouDeck(
  req: Request,
  supabase: any,
  seenTitleIds: Set<string>,
  profile: UserProfile | null,
): Promise<SwipeCard[]> {
  // Base query: popular titles
  let query = supabase
    .from("titles")
    .select(
      "title_id, primary_title, release_year, poster_url, backdrop_url, imdb_rating, rt_tomato_pct, tmdb_id, omdb_imdb_id, content_type, genres",
    )
    .order("imdb_votes", { ascending: false })
    .limit(CANDIDATE_LIMIT);

  // If we have favorite genres, bias towards them
  if (profile && profile.favoriteGenres.length > 0) {
    const favGenres = profile.favoriteGenres.slice(0, 5);
    // "genres" is an array column; overlaps = any common genre
    query = query.overlaps("genres", favGenres);
  }

  const { data: rows, error } = await query;

  if (error) {
    console.error("[swipe-for-you] titles query error", error);
    throw error;
  }

  const filtered = (rows ?? []).filter((row: any) => {
    if (!row?.title_id) return false;
    return !seenTitleIds.has(String(row.title_id));
  });

  const cards = mapRowsToCards(filtered).slice(0, MAX_DECK_SIZE);

  // Fire-and-forget catalog sync for the first few cards
  const toSync = cards.slice(0, CATALOG_SYNC_LIMIT);
  for (const card of toSync) {
    triggerCatalogSyncForTitle(req, {
      tmdbId: card.tmdbId,
      imdbId: card.imdbId ?? undefined,
      contentType: card.contentType,
    }).catch((err) =>
      console.warn("[swipe-for-you] catalog-sync error:", err)
    );
  }

  return cards;
}

function mapRowsToCards(rows: any[]): SwipeCard[] {
  return rows.map((meta: any) => ({
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
  }));
}
