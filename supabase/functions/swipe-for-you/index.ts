// supabase/functions/swipe-for-you/index.ts
//
// Returns a "For You" swipe deck for the current user.
// Simple version: popular, recent titles, not deleted.
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

type SwipeCardLike = {
  tmdbId?: number | null;
  imdbId?: string | null;
  contentType?: "movie" | "series" | null;
  imdbRating?: number | null;
  rtTomatoMeter?: number | null;
};

// ---------------------------------------------------------------------------
// Helper: call catalog-sync for some cards
// ---------------------------------------------------------------------------

async function triggerCatalogSyncForCards(req: Request, cards: SwipeCardLike[]) {
  console.log("[swipe-for-you] triggerCatalogSyncForCards called, cards.length =", cards.length);

  const candidates = cards
    .filter((c) => c.tmdbId || c.imdbId)
    .slice(0, 3); // soft limit per request to protect TMDb/OMDb quotas

  if (!candidates.length) {
    console.log("[swipe-for-you] no cards with tmdbId/imdbId to sync");
    return;
  }

  // Fire-and-forget: we intentionally do not await this in the handler.
  void Promise.allSettled(
    candidates.map((card) =>
      triggerCatalogSyncForTitle(req, card, { prefix: "[swipe-for-you]" }),
    ),
  );
}

async function triggerCatalogBackfill(reason: string) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn("[swipe-for-you] cannot trigger catalog-backfill, missing URL or ANON key");
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
      "[swipe-for-you] catalog-backfill status=",
      res.status,
      "body=",
      text,
    );
  } catch (err) {
    console.warn("[swipe-for-you] catalog-backfill request error:", err);
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

// ---------------------------------------------------------------------------
// Handler
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
      console.error("[swipe-for-you] auth error:", authError.message);
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

    // Load a personalized deck using the richer profile; if profile is missing we still
    // fall back to a popularity-based deck inside the helper.
    const allCards = await loadPersonalizedSwipeCardsV2(supabase, profile);

    if (!allCards.length) {
      // If the titles table is empty (fresh database), kick off a background
      // catalog backfill so future swipe requests have data to work with.
      triggerCatalogBackfill("swipe-for-you:titles-empty");
    }

    const cards = allCards.filter((card) => !seenTitleIds.has(card.id));

    // 🔄 trigger catalog-sync for some cards we are about to show, but do not
    // block the response on it. This keeps swipe latency low.
    triggerCatalogSyncForCards(req, cards);

    return jsonOk(
      {
        ok: true,
        cards,
      },
      200,
    );
  } catch (err) {
    console.error("[swipe-for-you] unhandled error:", err);
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
    console.error("[swipe-for-you] Missing SUPABASE_URL or SERVICE_ROLE_KEY");
    return jsonError("Server misconfigured", 500, "SERVER_MISCONFIGURED");
  }

  if (!SUPABASE_ANON_KEY) {
    console.error("[swipe-for-you] Missing SUPABASE_ANON_KEY");
    return jsonError("Server misconfigured", 500, "SERVER_MISCONFIGURED");
  }

  return null;
}



async function computeUserGenrePreferences(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  userId: string,
): Promise<string[] | null> {
  // Look at positively-rated titles (rating >= 7 on the 0–10 scale)
  const { data: ratings, error: ratingsError } = await supabase
    .from("ratings")
    .select("title_id, rating")
    .eq("user_id", userId)
    .gte("rating", 7)
    .order("rating", { ascending: false })
    .limit(200);

  if (ratingsError) {
    console.warn("[swipe-for-you] computeUserGenrePreferences ratings error:", ratingsError.message);
    return null;
  }

  if (!ratings || ratings.length === 0) {
    return null;
  }

  const ratedTitleIds = ratings.map((r: any) => r.title_id).filter(Boolean);
  if (!ratedTitleIds.length) {
    return null;
  }

  const { data: titleRows, error: titleError } = await supabase
    .from("titles")
    .select("title_id, genres, omdb_genre_names, tmdb_genre_names")
    .in("title_id", ratedTitleIds);

  if (titleError) {
    console.warn("[swipe-for-you] computeUserGenrePreferences titles error:", titleError.message);
    return null;
  }

  const weightByGenre = new Map<string, number>();

  for (const row of titleRows ?? []) {
    const id = (row as any).title_id;
    const rating = (ratings.find((r: any) => r.title_id === id)?.rating as number | undefined) ?? 7;
    const weight = Math.max(0, rating - 6); // 1–4 for ratings 7–10

    const rawGenres: unknown =
      (row as any).genres ??
      (row as any).omdb_genre_names ??
      (row as any).tmdb_genre_names ??
      [];

    const genres: string[] = Array.isArray(rawGenres)
      ? rawGenres.map((g) => String(g))
      : [];

    for (const g of genres) {
      const key = g.trim().toLowerCase();
      if (!key) continue;
      weightByGenre.set(key, (weightByGenre.get(key) ?? 0) + weight);
    }
  }

  const sorted = Array.from(weightByGenre.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

  if (!sorted.length) {
    return null;
  }

  // Top N favorite genres
  return sorted.slice(0, 8);
}

async function loadPersonalizedSwipeCards(
  supabase: ReturnType<typeof getSupabaseAdminClient>,

async function loadPersonalizedSwipeCardsV2(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  profile: UserProfile | null,
): Promise<SwipeCard[]> {
  // If we have no preferences yet, just fall back to the generic query.
  if (!profile || !profile.favoriteGenres.length) {
    return loadSwipeCards(supabase);
  }

  const { favoriteGenres, dislikedGenres, contentTypeWeights } = profile;

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
        "genres",
        "omdb_genre_names",
        "tmdb_genre_names",
      ].join(","),
    )
    .is("deleted_at", null)
    .order("tmdb_popularity", { ascending: false })
    .limit(200);

  if (error) {
    console.error("[swipe-for-you] personalized titles query error:", error.message);
    throw new Error("Failed to load titles");
  }

  type Scored = { score: number; meta: any };

  const favSet = new Set(
    favoriteGenres.map((g) => g.trim().toLowerCase()).filter(Boolean),
  );
  const dislikedSet = new Set(
    (dislikedGenres ?? [])
      .map((g) => g.trim().toLowerCase())
      .filter(Boolean),
  );

  const scored: Scored[] = [];
  const currentYear = new Date().getFullYear();

  for (const meta of rows ?? []) {
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

    let score = 0;

    // Genre match / mismatch
    let favMatches = 0;
    let badMatches = 0;
    for (const g of genres) {
      if (favSet.has(g)) favMatches += 1;
      if (dislikedSet.has(g)) badMatches += 1;
    }

    score += favMatches * 8;  // reward liked genres
    score -= badMatches * 10; // strongly penalize disliked genres

    // Content type preference (movie vs series)
    if (contentType) {
      const ctWeight = contentTypeWeights[contentType] ?? 0;
      score += ctWeight * 3;
    }

    // Popularity with diminishing returns
    score += Math.log10(1 + Math.max(0, popularity));

    // Recency boost for titles from roughly last 5 years
    if (typeof year === "number" && Number.isFinite(year)) {
      const age = Math.max(0, currentYear - year);
      const recencyBoost = age < 5 ? 5 - age : 0;
      score += recencyBoost * 1.5;
    }

    // Light exploration noise to avoid deterministic ordering for ties
    score += (Math.random() - 0.5) * 0.5;

    scored.push({ score, meta });
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
  favoriteGenres: string[] | null,
): Promise<SwipeCard[]> {
  // If we have no preferences yet, just fall back to the generic query.
  if (!favoriteGenres || !favoriteGenres.length) {
    return loadSwipeCards(supabase);
  }

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
        "genres",
        "omdb_genre_names",
        "tmdb_genre_names",
      ].join(","),
    )
    .is("deleted_at", null)
    .order("tmdb_popularity", { ascending: false })
    .limit(200);

  if (error) {
    console.error("[swipe-for-you] personalized titles query error:", error.message);
    throw new Error("Failed to load titles");
  }

  const favSet = new Set(favoriteGenres.map((g) => g.toLowerCase()));

  type Scored = { score: number; meta: any };

  const scored: Scored[] = [];

  for (const meta of rows ?? []) {
    const rawGenres: unknown =
      (meta as any).genres ??
      (meta as any).omdb_genre_names ??
      (meta as any).tmdb_genre_names ??
      [];

    const genres: string[] = Array.isArray(rawGenres)
      ? rawGenres.map((g) => String(g))
      : [];

    let genreMatches = 0;
    for (const g of genres) {
      const key = g.trim().toLowerCase();
      if (favSet.has(key)) {
        genreMatches += 1;
      }
    }

    const popularity = Number((meta as any).tmdb_popularity ?? 0);

    // Simple heuristic: prioritize genre matches first, popularity second.
    const score = genreMatches * 10 + Math.log10(1 + Math.max(0, popularity));

    scored.push({ score, meta });
  }

  scored.sort((a, b) => b.score - a.score);

  const top = scored.slice(0, 50).map(({ meta }) => meta);

  return top.map((meta: any) => ({
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
    .order("release_year", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[swipe-for-you] titles query error:", error.message);
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
    contentType: meta.content_type ?? null, // "movie" | "series"
  }));
}