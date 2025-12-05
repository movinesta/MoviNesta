// supabase/functions/swipe-trending/index.ts
//
// Returns a "Trending" swipe deck.
// Trending = titles that have a lot of recent activity (last ~7 days),
// with a fallback to global popularity if there isn't enough signal.
// Also triggers `catalog-sync` for up to 3 cards per call.

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

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
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

type EnvConfigError = Response | null;

function jsonOk(body: unknown, status = 200): Response {
  return jsonResponse(body, status);
}

/**
 * Validate basic environment configuration for this edge function.
 */
function validateConfig(): EnvConfigError {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error(
      "[swipe-trending] Missing SUPABASE_URL or SERVICE_ROLE_KEY env vars",
    );
    return jsonError("Server not configured", 500, "CONFIG_ERROR");
  }

  return null;
}

function getSupabaseAdminClient(req: Request) {
  return getAdminClient(req);
}

// Main handler
// ---------------------------------------------------------------------------

serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  try {
    const configError = validateConfig();
    if (configError) return configError;

    const supabase = getSupabaseAdminClient(req);
    const supabaseAuth = getUserClient(req);

    // Require authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser();

    if (authError) {
      console.error("[swipe-trending] auth error:", authError.message);
      return jsonError("Unauthorized", 401, "UNAUTHORIZED");
    }

    if (!user) {
      return jsonError("Unauthorized", 401, "UNAUTHORIZED");
    }

    // Titles this user has already interacted with (ratings, library entries, swipe events)
    const seenTitleIds = await loadSeenTitleIdsForUser(supabase, user.id);

    // Prefer titles that are actually trending in recent activity; fall back to
    // the generic popularity-based deck if there is not enough recent data.
    let allCards = await loadTrendingCards(supabase);

    if (!allCards.length) {
      allCards = await loadSwipeCards(supabase);

      if (!allCards.length) {
        // If the titles table is empty (fresh database), kick off a background
        // catalog backfill so future swipe requests have data to work with.
        triggerCatalogBackfill("swipe-trending:titles-empty");
      }
    }

    const cards = allCards.filter((card) => !seenTitleIds.has(card.id));

    // Fire-and-forget: trigger catalog sync for a few of the cards.
    const syncCandidates = cards.slice(0, 3);
    Promise.allSettled(
      syncCandidates.map((card) =>
        triggerCatalogSyncForTitle(
          req,
          {
            tmdbId: card.tmdbId,
            imdbId: card.imdbId,
            contentType: card.contentType ?? undefined,
          },
          { prefix: "[swipe-trending]" },
        )
      ),
    ).catch((err) => {
      console.warn("[swipe-trending] catalog-sync error", err);
    });

    return jsonOk({ ok: true, cards });
  } catch (error) {
    console.error("[swipe-trending] unexpected error", error);
    return jsonError("Unexpected error", 500, "UNEXPECTED_ERROR");
  }
});

// Helpers
// ---------------------------------------------------------------------------

async function triggerCatalogBackfill(reason: string) {
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

    const text = await res.text().catch(() => "");
    console.log(
      "[swipe-trending] catalog-backfill status=",
      res.status,
      "body=",
      text,
    );
  } catch (err) {
    console.warn("[swipe-trending] catalog-backfill request error:", err);
  }
}

/**
 * Load a trending deck based on recent activity_events (last 7 days),
 * aggregating counts per title, with a bit of weight from tmdb_popularity.
 *
 * NOTE: we aggregate in memory instead of using `.group()` because the
 * Supabase JS query builder in this runtime does not expose `.group()`.
 */
async function loadTrendingCards(
  supabase: ReturnType<typeof getAdminClient>,
): Promise<SwipeCard[]> {
  const since = new Date();
  since.setDate(since.getDate() - 7); // last 7 days

  // Load recent interactions per title over the last week, then aggregate
  // counts in memory.
  const { data: events, error: eventsError } = await supabase
    .from("activity_events")
    .select("title_id, created_at")
    .gte("created_at", since.toISOString())
    .not("title_id", "is", null)
    .limit(5000);

  if (eventsError) {
    console.warn(
      "[swipe-trending] activity_events fetch error:",
      eventsError.message,
    );
    return [];
  }

  const counts = new Map<string, number>();

  for (const row of events ?? []) {
    const titleId = (row as any).title_id as string | null;
    if (!titleId) continue;

    const prev = counts.get(titleId) ?? 0;
    counts.set(titleId, prev + 1);
  }

  if (!counts.size) {
    return [];
  }

  // Sort titleIds by interaction count (desc) and take top N.
  const sortedByCount = Array.from(counts.entries()).sort(
    (a, b) => b[1] - a[1],
  );
  const topEntries = sortedByCount.slice(0, 200);
  const titleIds = topEntries.map(([titleId]) => titleId);

  // Fetch metadata for these titles.
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
      ].join(","),
    )
    .in("title_id", titleIds)
    .is("deleted_at", null);

  if (titleError) {
    console.warn(
      "[swipe-trending] titles query error:",
      titleError.message,
    );
  }

  const byId = new Map<string, any>();
  for (const row of titleRows ?? []) {
    byId.set((row as any).title_id as string, row);
  }

  type Scored = { score: number; meta: any };
  const scored: Scored[] = [];

  for (const [titleId, interactions] of topEntries) {
    const meta = byId.get(titleId);
    if (!meta) continue;

    const popularity = Number((meta as any).tmdb_popularity ?? 0);

    let score = interactions;
    score += Math.log10(1 + Math.max(0, popularity)) * 0.5;

    scored.push({ score, meta });
  }

  if (!scored.length) {
    return [];
  }

  scored.sort((a, b) => b.score - a.score);

  const top = scored.slice(0, 50);

  return top.map(({ meta }) => ({
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
  }));
}

/**
 * Generic popularity-based fallback deck.
 */
async function loadSwipeCards(
  supabase: ReturnType<typeof getAdminClient>,
): Promise<SwipeCard[]> {
  const { data: rows, error } = await supabase
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
      ].join(","),
    )
    .is("deleted_at", null)
    .order("tmdb_popularity", { ascending: false })
    .limit(200);

  if (error) {
    console.error("[swipe-trending] titles query error:", error.message);
    throw new Error("Failed to load titles");
  }

  return (rows ?? []).map((meta: any) => ({
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
  }));
}
