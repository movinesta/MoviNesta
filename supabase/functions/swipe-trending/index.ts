// supabase/functions/swipe-trending/index.ts
//
// Returns a "Trending" swipe deck.
// Trending = globally popular titles, filtered so the user doesn't see
// anything they've already interacted with (ratings, library, swipes).
// Also triggers `catalog-sync` for up to 3 cards per call and will
// kick off `catalog-backfill` if the catalog looks empty.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { triggerCatalogSyncForTitle } from "../_shared/catalog-sync.ts";
import { loadSeenTitleIdsForUser } from "../_shared/swipe.ts";
import {
  corsHeaders,
  handleOptions,
  jsonError,
  jsonResponse,
} from "../_shared/http.ts";
import { getAdminClient, getUserClient } from "../_shared/supabase.ts";
import { log } from "../_shared/logger.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

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

function validateConfig(): Response | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE_KEY) {
    console.error(
      "[swipe-trending] Missing SUPABASE_URL or SERVICE_ROLE_KEY env vars",
    );
    return jsonError("Server not configured", 500, "CONFIG_ERROR");
  }

  return null;
}

// Main handler
// ---------------------------------------------------------------------------

serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  try {
    const configError = validateConfig();
    if (configError) return configError;

    // Admin client for DB queries (full visibility, bypasses RLS)
    const supabase = getAdminClient(req);
    // User client for auth only
    const supabaseAuth = getUserClient(req);

    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser();

    if (authError) {
      console.error("[swipe-trending] auth error:", authError);
      return jsonError("Unauthorized", 401, "UNAUTHORIZED");
    }

    if (!user) {
      return jsonError("Unauthorized", 401, "UNAUTHORIZED_NO_USER");
    }

    const ctx = { fn: "swipe-trending", userId: user.id as string | null };
    log(ctx, "request start");

    // Titles the user has already seen/rated/etc.
    const seenTitleIds = await loadSeenTitleIdsForUser(supabase, user.id);

    const cards = await loadTrendingCards(req, supabase, seenTitleIds);

    if (!cards.length) {
      await triggerCatalogBackfill("swipe-trending: no trending results");
    }

    log(ctx, "response", { cardCount: cards.length });

    return jsonResponse({ cards });
  } catch (err) {
    console.error("[swipe-trending] unexpected error:", err);
    return jsonError("Internal server error", 500, "INTERNAL_ERROR");
  }
});

// Build the trending deck
// ---------------------------------------------------------------------------

async function loadTrendingCards(
  req: Request,
  supabase: any,
  seenTitleIds: Set<string>,
): Promise<SwipeCard[]> {
  // Simple global popularity-based "trending":
  // order by vote count then rating, and filter out titles the user
  // has already interacted with.
  const { data: rows, error } = await supabase
    .from("titles")
    .select(
      "title_id, primary_title, release_year, poster_url, backdrop_url, imdb_rating, rt_tomato_pct, tmdb_id, omdb_imdb_id, content_type",
    )
    .order("imdb_votes", { ascending: false, nullsFirst: false })
    .order("imdb_rating", { ascending: false, nullsFirst: false })
    .limit(CANDIDATE_LIMIT);

  if (error) {
    console.error("[swipe-trending] titles query error", error);
    throw error;
  }

  const filtered = (rows ?? []).filter((row: any) => {
    if (!row?.title_id) return false;
    return !seenTitleIds.has(row.title_id as string);
  });

  const cards: SwipeCard[] = filtered
    .map((meta: any) => ({
      id: meta.title_id,
      title: meta.primary_title ?? null,
      year: meta.release_year ?? null,
      posterUrl: meta.poster_url ?? null,
      backdropUrl: meta.backdrop_url ?? null,
      imdbRating: meta.imdb_rating ?? null,
      rtTomatoMeter: meta.rt_tomato_pct ?? null,
      tmdbId: meta.tmdb_id ?? null,
      imdbId: meta.omdb_imdb_id ?? null,
      contentType: meta.content_type ?? null,
    }))
    .slice(0, MAX_DECK_SIZE);

  // Fire-and-forget catalog sync for a few cards to keep external
  // metadata fresh.
  const toSync = cards.slice(0, CATALOG_SYNC_LIMIT);
  for (const card of toSync) {
    triggerCatalogSyncForTitle(req, {
      tmdbId: card.tmdbId,
      imdbId: card.imdbId ?? undefined,
      contentType: card.contentType,
    }).catch((err) =>
      console.warn("[swipe-trending] catalog-sync error:", err),
    );
  }

  return cards;
}

// Catalog backfill helper
// ---------------------------------------------------------------------------

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
      "[swipe-trending] catalog-backfill response status=",
      res.status,
      "body=",
      txt,
    );
  } catch (err) {
    console.warn("[swipe-trending] catalog-backfill fetch error", err);
  }
}
