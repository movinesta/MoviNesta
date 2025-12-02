// supabase/functions/swipe-from-friends/index.ts
//
// Returns a "From Friends" swipe deck.
// "Friends" here is approximated as "other users on the service" by looking
// at recent activity_events from *other* user_ids. You can later wire this up
// to a real friends/follow graph by restricting which user_ids are considered.
//
// Also triggers `catalog-sync` for up to 3 cards per call.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { triggerCatalogSyncForTitle } from "../_shared/catalog-sync.ts";

import { loadSeenTitleIdsForUser } from "../_shared/swipe.ts";
import { computeUserProfile, type UserProfile } from "../_shared/preferences.ts";

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
      "[swipe-from-friends] Missing SUPABASE_URL or SERVICE_ROLE_KEY env vars",
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
      console.error("[swipe-from-friends] auth error:", authError.message);
      return jsonError("Unauthorized", 401, "UNAUTHORIZED");
    }

    if (!user) {
      return jsonError("Unauthorized", 401, "UNAUTHORIZED");
    }

    // Titles this user has already interacted with (ratings, library entries, swipes)
    // and a richer preference profile built from ratings, library, and activity events.
    const [seenTitleIds, profile] = await Promise.all([
      loadSeenTitleIdsForUser(supabase, user.id),
      computeUserProfile(supabase, user.id),
    ]);

    // Prefer titles that friends have recently interacted with, and that also line up
    // reasonably well with this user's own taste profile.
    let allCards = await loadSwipeCardsFromFriends(supabase, user.id, profile);

    // If we don't have enough friend-based cards, fall back to a generic deck.
    if (!allCards.length) {
      allCards = await loadSwipeCards(supabase);

      if (!allCards.length) {
        // If the titles table is empty (fresh database), kick off a background
        // catalog backfill so future swipe requests have data to work with.
        triggerCatalogBackfill("swipe-from-friends:titles-empty");
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
          { prefix: "[swipe-from-friends]" },
        )
      ),
    ).catch((err) => {
      console.warn("[swipe-from-friends] catalog-sync error", err);
    });

    return jsonOk({ ok: true, cards });
  } catch (error) {
    console.error("[swipe-from-friends] unexpected error", error);
    return jsonError("Unexpected error", 500, "UNEXPECTED_ERROR");
  }
});

// Helpers
// ---------------------------------------------------------------------------

async function triggerCatalogBackfill(reason: string) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn(
      "[swipe-from-friends] Cannot trigger catalog-backfill; missing env vars",
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
      "[swipe-from-friends] catalog-backfill status=",
      res.status,
      "body=",
      text,
    );
  } catch (err) {
    console.warn("[swipe-from-friends] catalog-backfill request error:", err);
  }
}

/**
 * Friend-based deck: score titles based on recent activity from other users,
 * then adjust by this user's own taste profile.
 */
async function loadSwipeCardsFromFriends(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  userId: string,
  profile: UserProfile | null,
): Promise<SwipeCard[]> {
  // 1) Load recent activity events from "friends" (approximated as "everyone except userId").
  const {
    data: events,
    error: eventsError,
  } = await supabase
    .from("activity_events")
    .select("title_id, event_type, created_at, payload, user_id")
    .neq("user_id", userId)
    .not("title_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1000);

  if (eventsError) {
    console.error(
      "[swipe-from-friends] activity_events error:",
      eventsError.message,
    );
    throw new Error("Failed to load friend activity");
  }

  type TitleScore = {
    baseScore: number;
  };

  const now = Date.now();
  const perTitle = new Map<string, TitleScore>();

  for (const ev of events ?? []) {
    const titleId = (ev as any).title_id as string | null;
    if (!titleId) continue;

    const createdAtStr = (ev as any).created_at as string | null;
    let recencyFactor = 1;
    if (createdAtStr) {
      const createdAt = new Date(createdAtStr).getTime();
      const days = Math.max(0, (now - createdAt) / (1000 * 60 * 60 * 24));
      recencyFactor = 1 / (1 + days / 7); // half-life ~1 week
    }

    const prev = perTitle.get(titleId) ?? { baseScore: 0 };
    prev.baseScore += 1 * recencyFactor;
    perTitle.set(titleId, prev);
  }

  if (!perTitle.size) {
    return [];
  }

  const candidateTitleIds = Array.from(perTitle.keys());

  // 2) Fetch metadata for these titles.
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
        "genres",
        "omdb_genre_names",
        "tmdb_genre_names",
      ].join(","),
    )
    .in("title_id", candidateTitleIds)
    .is("deleted_at", null);

  if (titleError) {
    console.error(
      "[swipe-from-friends] titles query error:",
      titleError.message,
    );
    throw new Error("Failed to load titles");
  }

  const favSet = new Set(
    (profile?.favoriteGenres ?? [])
      .map((g) => g.trim().toLowerCase())
      .filter(Boolean),
  );
  const dislikedSet = new Set(
    (profile?.dislikedGenres ?? [])
      .map((g) => g.trim().toLowerCase())
      .filter(Boolean),
  );
  const ctWeights = profile?.contentTypeWeights ?? {};
  const currentYear = new Date().getFullYear();

  type Scored = { score: number; meta: any };
  const scored: Scored[] = [];

  for (const meta of titleRows ?? []) {
    const titleId = (meta as any).title_id as string | null;
    if (!titleId) continue;

    const baseScore = perTitle.get(titleId)?.baseScore ?? 0;
    if (baseScore <= 0) continue;

    const rawGenres: unknown =
      (meta as any).genres ??
      (meta as any).omdb_genre_names ??
      (meta as any).tmdb_genre_names ??
      [];
    const genres: string[] = Array.isArray(rawGenres)
      ? rawGenres
          .map((g) => String(g).trim().toLowerCase())
          .filter(Boolean)
      : [];

    const popularity = Number((meta as any).tmdb_popularity ?? 0);
    const year = (meta as any).release_year as number | null;
    const contentTypeRaw = (meta as any).content_type as string | null;
    const contentType = contentTypeRaw ? contentTypeRaw.toLowerCase() : "";

    let score = baseScore;

    // Align with this user's own taste.
    let favMatches = 0;
    let badMatches = 0;
    for (const g of genres) {
      if (favSet.has(g)) favMatches += 1;
      if (dislikedSet.has(g)) badMatches += 1;
    }

    score += favMatches * 4;
    score -= badMatches * 6;

    if (contentType) {
      const ctWeight = ctWeights[contentType] ?? 0;
      score += ctWeight * 2;
    }

    // Add a bit of global popularity signal.
    score += Math.log10(1 + Math.max(0, popularity)) * 0.5;

    // Very light recency bias on release year as well.
    if (typeof year === "number" && Number.isFinite(year)) {
      const age = Math.max(0, currentYear - year);
      const recencyBoost = age < 10 ? (10 - age) * 0.2 : 0;
      score += recencyBoost;
    }

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
    console.error("[swipe-from-friends] titles query error:", error.message);
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
