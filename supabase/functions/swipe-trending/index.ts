// supabase/functions/swipe-trending/index.ts
//
// Returns a "Trending" swipe deck.
// Simple version: order by tmdb_popularity desc, not deleted.
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

type SwipeCardLike = {
  tmdbId?: number | null;
  imdbId?: string | null;
  contentType?: "movie" | "series" | null;
  imdbRating?: number | null;
  rtTomatoMeter?: number | null;
};

async function triggerCatalogSyncForCards(req: Request, cards: SwipeCardLike[]) {
  console.log("[swipe-trending] triggerCatalogSyncForCards called, cards.length =", cards.length);

  const candidates = cards
    .filter((c) => c.tmdbId || c.imdbId)
    .slice(0, 3); // soft limit per request to protect TMDb/OMDb quotas

  if (!candidates.length) {
    console.log("[swipe-trending] no cards with tmdbId/imdbId to sync");
    return;
  }

  // Fire-and-forget: we intentionally do not await this in the handler.
  void Promise.allSettled(
    candidates.map((card) =>
      triggerCatalogSyncForTitle(req, card, { prefix: "[swipe-trending]" }),
    ),
  );
}

async function triggerCatalogBackfill(reason: string) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn("[swipe-trending] cannot trigger catalog-backfill, missing URL or ANON key");
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

function getSupabaseAdminClient(req: Request) {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    global: {
      headers: {
        Authorization: req.headers.get("Authorization") ?? "",
      },
    },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const configError = validateConfig();
    if (configError) return configError;

    const supabase = getSupabaseAdminClient(req);

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

    const allCards = await loadSwipeCards(supabase);

    if (!allCards.length) {
      // If the titles table is empty (fresh database), kick off a background
      // catalog backfill so future swipe requests have data to work with.
      triggerCatalogBackfill("swipe-trending:titles-empty");
    }

    const cards = allCards.filter((card) => !seenTitleIds.has(card.id));

    // Do not block on catalog-sync; keep the swipe experience snappy.
    triggerCatalogSyncForCards(req, cards);

    return jsonOk(
      {
        ok: true,
        cards,
      },
      200,
    );
  } catch (err) {
    console.error("[swipe-trending] unhandled error:", err);
    return jsonError("Internal server error", 500, "INTERNAL_ERROR");
  }
});

function jsonOk(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function jsonError(message: string, status: number, code?: string): Response {
  return jsonOk({ ok: false, error: message, errorCode: code }, status);
}

function validateConfig(): Response | null {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("[swipe-trending] Missing SUPABASE_URL or SERVICE_ROLE_KEY");
    return jsonError("Server misconfigured", 500, "SERVER_MISCONFIGURED");
  }

  if (!SUPABASE_ANON_KEY) {
    console.error("[swipe-trending] Missing SUPABASE_ANON_KEY");
    return jsonError("Server misconfigured", 500, "SERVER_MISCONFIGURED");
  }

  return null;
}

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
        "title_stats(avg_rating, ratings_count, watch_count)",
      ].join(","),
    )
    .leftJoin("title_stats", "title_stats.title_id", "titles.title_id" as any)
    .is("deleted_at", null)
    .order("title_stats.watch_count", { ascending: false } as any)
    .order("title_stats.ratings_count", { ascending: false } as any)
    .order("tmdb_popularity", { ascending: false })
    .limit(50);

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
