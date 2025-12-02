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

const corsHeaders = {
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
      "[swipe-for-you] Missing SUPABASE_URL or SERVICE_ROLE_KEY env vars",
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

      return jsonOk({ ok: true, cards: [] });
    }

    // Filter out titles that the user has already seen in any way.
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
          { prefix: "[swipe-for-you]" },
        )
      ),
    ).catch((err) => {
      console.warn("[swipe-for-you] catalog-sync error", err);
    });

    return jsonOk({ ok: true, cards });
  } catch (error) {
    console.error("[swipe-for-you] unexpected error", error);
    return jsonError("Unexpected error", 500, "UNEXPECTED_ERROR");
  }
});

// Helpers
// ---------------------------------------------------------------------------

async function triggerCatalogBackfill(reason: string) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn(
      "[swipe-for-you] cannot trigger catalog-backfill, missing URL or ANON key",
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
      "[swipe-for-you] catalog-backfill status=",
      res.status,
      "body=",
      text,
    );
  } catch (err) {
    console.warn("[swipe-for-you] catalog-backfill request error:", err);
  }
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
    console.warn(
      "[swipe-for-you] computeUserGenrePreferences ratings error:",
      ratingsError.message,
    );
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
    .select(
      [
        "title_id",
        "genres",
        "omdb_genre_names",
        "tmdb_genre_names",
      ].join(","),
    )
    .in("title_id", ratedTitleIds);

  if (titleError) {
    console.warn(
      "[swipe-for-you] computeUserGenrePreferences titles error:",
      titleError.message,
    );
    return null;
  }

  const weightByGenre = new Map<string, number>();

  for (const ratingRow of ratings ?? []) {
    const titleId = (ratingRow as any).title_id as string | null;
    const rating = (ratingRow as any).rating as number | null;

    if (!titleId || rating == null) continue;

    const titleMeta = (titleRows ?? []).find(
      (row: any) => row.title_id === titleId,
    );
    if (!titleMeta) continue;

    const genres: string[] = normalizeGenresFromTitle(titleMeta);
    const weight = rating - 6; // 7 => 1, 8 => 2, 9 => 3, 10 => 4

    for (const g of genres) {
      const key = g.trim().toLowerCase();
      if (!key) continue;

      const prev = weightByGenre.get(key) ?? 0;
      weightByGenre.set(key, prev + weight);
    }
  }

  if (!weightByGenre.size) {
    return null;
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

function normalizeGenresFromTitle(meta: any): string[] {
  const raw =
    (meta.genres as unknown) ??
    (meta.omdb_genre_names as unknown) ??
    (meta.tmdb_genre_names as unknown) ??
    [];

  if (!Array.isArray(raw)) return [];
  return raw.map((g) => String(g));
}

async function loadPersonalizedSwipeCards(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
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
    console.error("[swipe-for-you] titles query error:", error.message);
    throw new Error("Failed to load titles");
  }

  type Scored = {
    score: number;
    meta: any;
  };

  const favSet = new Set(
    favoriteGenres.map((g) => g.trim().toLowerCase()),
  );

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
    const score = genreMatches * 10 +
      Math.log10(1 + Math.max(0, popularity));

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

// NEW V2 personalized loader using full UserProfile
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
    console.error(
      "[swipe-for-you] personalized titles query error:",
      error.message,
    );
 
