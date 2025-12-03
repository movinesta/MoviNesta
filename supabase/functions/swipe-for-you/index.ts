// supabase/functions/swipe-for-you/index.ts
//
// Returns a "For You" swipe deck for the current user.
// Uses a UserProfile built from ratings, library, and activity events.
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
import { getAdminClient } from "../_shared/supabase.ts";

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
      "[swipe-for-you] Missing SUPABASE_URL or SERVICE_ROLE_KEY env vars",
    );
    return jsonError("Server not configured", 500, "CONFIG_ERROR");
  }

  return null;
}

// Handler
// ---------------------------------------------------------------------------

serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  try {
    const configError = validateConfig();
    if (configError) return configError;

    const supabase = getAdminClient(req);

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
    let allCards = await loadPersonalizedSwipeCardsV2(supabase, profile);

    // If that returns nothing (e.g. empty titles table), fall back to generic.
    if (!allCards.length) {
      allCards = await loadSwipeCards(supabase);

      if (!allCards.length) {
        // If the titles table is empty (fresh database), kick off a background
        // catalog backfill so future swipe requests have data to work with.
        triggerCatalogBackfill("swipe-for-you:titles-empty");
        return jsonOk({ ok: true, cards: [] });
      }
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

// NEW V2 personalized loader using full UserProfile
async function loadPersonalizedSwipeCardsV2(
  supabase: ReturnType<typeof getAdminClient>,
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
    contentType: meta.content_type ?? null,
  }));
}
