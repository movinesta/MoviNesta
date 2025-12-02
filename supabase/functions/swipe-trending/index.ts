// supabase/functions/swipe-trending/index.ts
//
// Returns a "Trending" swipe deck.
// Trending = titles that have a lot of recent activity (last ~7 days),
// with a fallback to global popularity if there isn't enough signal.
// Also triggers `catalog-sync` for up to 3 cards per call.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { triggerCatalogSyncForTitle } from "../_shared/catalog-sync.ts";
import { loadSeenTitleIdsForUser } from "../_shared/swipe.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function jsonError(message: string, status = 500, code?: string): Response {
  return new Response(JSON.stringify({ error: message, code }), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
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
  const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    global: {
      headers: {
        Authorization: req.headers.get("Authorization") ?? "",
        apikey: SUPABASE_ANON_KEY,
      },
    },
  });

  return client;
}

// Main handler
// ---------------------------------------------------------------------------

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const configError = validateConfig();
    if (configError) return configError;

    const supabase = getSupabaseAdminClient(req);

    // Require authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

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
 */
async function loadTrendingCards(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
): Promise<SwipeCard[]> {
  const since = new Date();
  since.setDate(since.getDate() - 7); // last 7 days

  // Aggregate interactions per title over the last week.
  const { data: aggRows, error: aggError } = await supabase
    .from("activity_events")
    .select("title_id, count:count(*)")
    .gte("created_at", since.toISOString())
    .not("title_id", "is", null)
    .group("title_id")
    .order("count", { ascending: false })
    .limit(200);

  if (aggError) {
    console.warn(
      "[swipe-trending] activity_events aggregate error:",
      aggError.message,
    );
    return [];
  }

  const titleIds = (aggRows ?? [])
    .map((r: any) => r.title_id as string | null)
    .filter(Boolean) as string[];

  if (!titleIds.length) {
    return [];
  }

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

  for (const row of aggRows ?? []) {
    const titleId = (row as any).title_id as string | null;
    if (!titleId) continue;
    const meta = byId.get(titleId);
    if (!meta) continue;

    const interactions = Number((row as any).count ?? 0);
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
  supabase: ReturnType<typeof getSupabaseAdminClient>,
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
