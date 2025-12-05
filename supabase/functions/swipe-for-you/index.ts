// supabase/functions/swipe-for-you/index.ts
//
// Returns a strongly personalized "For You" swipe deck for the current user.
// - Uses a UserProfile built from ratings, library, and activity events.
// - Scores candidates based on genre matches, content type preference,
//   and global popularity/ratings.
// - Ensures the user does not see titles they've already interacted with.
// - Applies genre diversity caps.
// - Triggers `catalog-sync` for a few cards per call.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { triggerCatalogSyncForTitle } from "../_shared/catalog-sync.ts";
import { loadSeenTitleIdsForUser } from "../_shared/swipe.ts";
import { computeUserProfile, type UserProfile } from "../_shared/preferences.ts";
import {
  handleOptions,
  jsonError,
  jsonResponse,
} from "../_shared/http.ts";
import { getAdminClient, getUserClient } from "../_shared/supabase.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
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

const MAX_DECK_SIZE = 30;
const MAX_CANDIDATES = 400;
const MAX_PER_GENRE = 5;

// ------------------------------------------------------------
// Main handler
// ------------------------------------------------------------

serve(async (req: Request): Promise<Response> => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  try {
    const configError = validateConfig();
    if (configError) return configError;

    const supabaseAdmin = getAdminClient(req);
    const supabaseAuth = getUserClient(req);

    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser();

    if (authError) {
      console.error("[swipe-for-you] auth error:", authError.message);
      return jsonError("Unauthorized", 401, "UNAUTHORIZED");
    }
    if (!user) {
      return jsonError("Unauthorized", 401, "UNAUTHORIZED_NO_USER");
    }

    const userId = user.id as string;
    console.log("[swipe-for-you] request", { userId });

    const seenTitleIds = await loadSeenTitleIdsForUser(supabaseAdmin, userId);
    const profile = await safeComputeUserProfile(supabaseAdmin, userId);

    const cards = await buildForYouDeck(supabaseAdmin, seenTitleIds, profile);

    // Fire-and-forget catalog sync for a few cards
    const toSync = cards.slice(0, 3);
    for (const card of toSync) {
      triggerCatalogSyncForTitle(req, {
        tmdbId: card.tmdbId,
        imdbId: card.imdbId ?? undefined,
        contentType: card.contentType,
      }).catch((err) =>
        console.warn("[swipe-for-you] catalog-sync error:", err),
      );
    }

    return jsonResponse({ ok: true, cards });
  } catch (err) {
    console.error("[swipe-for-you] unexpected error:", err);
    return jsonError("Internal server error", 500, "INTERNAL_ERROR");
  }
});

function validateConfig(): Response | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("[swipe-for-you] Missing SUPABASE_URL or SUPABASE_ANON_KEY");
    return jsonError("Server not configured", 500, "CONFIG_ERROR");
  }
  return null;
}

async function safeComputeUserProfile(
  supabase: ReturnType<typeof getAdminClient>,
  userId: string,
): Promise<UserProfile | null> {
  try {
    return await computeUserProfile(supabase, userId);
  } catch (err) {
    console.warn("[swipe-for-you] computeUserProfile failed:", err);
    return null;
  }
}

// ------------------------------------------------------------
// Deck building
// ------------------------------------------------------------

async function buildForYouDeck(
  supabase: ReturnType<typeof getAdminClient>,
  seenTitleIds: Set<string>,
  profile: UserProfile | null,
): Promise<SwipeCard[]> {
  // If no profile, fall back to a popularity-based personalized-ish deck:
  // newer and popular titles the user hasn't seen.
  if (!profile) {
    return await buildFallbackDeck(supabase, seenTitleIds);
  }

  const favoriteGenres = profile.favoriteGenres ?? [];
  const dislikedGenres = profile.dislikedGenres ?? [];
  const contentTypeWeights = profile.contentTypeWeights ?? {};

  // Choose the best content type (if any) as a soft preference.
  const preferredContentType = getPreferredContentType(contentTypeWeights);

  let query = supabase
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
      ].join(","),
    )
    .is("deleted_at", null)
    .order("tmdb_popularity", { ascending: false })
    .order("imdb_rating", { ascending: false })
    .limit(MAX_CANDIDATES);

  if (favoriteGenres.length) {
    // Bias towards the user's top genres
    query = query.overlaps("genres", favoriteGenres.slice(0, 5));
  }

  if (preferredContentType) {
    // Bias towards the preferred content type (movies vs series)
    query = query.eq("content_type", preferredContentType);
  }

  const { data: rows, error } = await query;

  if (error) {
    console.error("[swipe-for-you] titles query error:", error.message);
    return [];
  }

  type Scored = { score: number; meta: any };

  const positiveGenreSet = new Set(
    favoriteGenres.map((g) => g.toLowerCase()),
  );
  const negativeGenreSet = new Set(
    dislikedGenres.map((g) => g.toLowerCase()),
  );

  const scored: Scored[] = [];

  for (const meta of rows ?? []) {
    const id = String(meta.title_id);
    if (seenTitleIds.has(id)) continue;

    const genres: string[] = Array.isArray(meta.genres)
      ? meta.genres
      : typeof meta.genres === "string"
      ? (meta.genres as string).split(",").map((g) => g.trim())
      : [];

    const ct = (meta.content_type ?? "").toString();
    const ctWeight = contentTypeWeights[ct] ?? 0;

    const popularity = Number(meta.tmdb_popularity ?? 0);
    const rating = Number(meta.imdb_rating ?? 0);

    // Base score from popularity + rating (favor strong rating more)
    let score = Math.log10(1 + Math.max(0, popularity)) * 0.7;
    if (rating > 0) {
      score += rating * 0.8;
    }

    // Genre boosts / penalties
    let genreBoost = 0;
    for (const g of genres) {
      const lg = g.toLowerCase();
      if (positiveGenreSet.has(lg)) {
        genreBoost += 1;
      }
      if (negativeGenreSet.has(lg)) {
        genreBoost -= 1.5;
      }
    }
    score += genreBoost;

    // Content type preference
    score *= 1 + ctWeight * 0.4;

    scored.push({ score, meta });
  }

  if (!scored.length) {
    return [];
  }

  scored.sort((a, b) => b.score - a.score);

  // Genre diversity + final cap
  const genreCounts = new Map<string, number>();
  const final: SwipeCard[] = [];

  for (const { meta } of scored) {
    if (final.length >= MAX_DECK_SIZE) break;

    const id = String(meta.title_id);
    if (seenTitleIds.has(id)) continue;

    const genres: string[] = Array.isArray(meta.genres)
      ? meta.genres
      : typeof meta.genres === "string"
      ? (meta.genres as string).split(",").map((g) => g.trim())
      : [];

    let skipForGenreCap = false;
    for (const g of genres) {
      const key = g.toLowerCase();
      const current = genreCounts.get(key) ?? 0;
      if (current >= MAX_PER_GENRE) {
        skipForGenreCap = true;
        break;
      }
    }
    if (skipForGenreCap) continue;

    final.push(mapMetaToCard(meta));

    for (const g of genres) {
      const key = g.toLowerCase();
      genreCounts.set(key, (genreCounts.get(key) ?? 0) + 1);
    }
  }

  return final;
}

async function buildFallbackDeck(
  supabase: ReturnType<typeof getAdminClient>,
  seenTitleIds: Set<string>,
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
        "genres",
      ].join(","),
    )
    .is("deleted_at", null)
    .order("tmdb_popularity", { ascending: false })
    .order("imdb_rating", { ascending: false })
    .limit(MAX_CANDIDATES);

  if (error) {
    console.error("[swipe-for-you] fallback titles query error:", error.message);
    return [];
  }

  const cards: SwipeCard[] = [];

  for (const meta of rows ?? []) {
    if (cards.length >= MAX_DECK_SIZE) break;
    const id = String(meta.title_id);
    if (seenTitleIds.has(id)) continue;
    cards.push(mapMetaToCard(meta));
  }

  return cards;
}

function getPreferredContentType(
  contentTypeWeights: Record<string, number>,
): string | null {
  const entries = Object.entries(contentTypeWeights);
  if (!entries.length) return null;

  entries.sort((a, b) => b[1] - a[1]);
  const [bestType, bestScore] = entries[0];
  if (bestScore <= 0) return null;
  return bestType;
}

function mapMetaToCard(meta: any): SwipeCard {
  return {
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
  };
}
