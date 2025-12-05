// supabase/functions/swipe-more-like-this/index.ts
//
// Returns a "More like this" swipe deck based on a seed title.
// Usage (from client):
//   GET /functions/v1/swipe-more-like-this?title_id=<uuid>

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

type TitleRow = {
  title_id: string;
  content_type: "movie" | "series" | null;
  tmdb_id: number | null;
  omdb_imdb_id: string | null;
  primary_title: string | null;
  release_year: number | null;
  poster_url: string | null;
  backdrop_url: string | null;
  imdb_rating: number | null;
  rt_tomato_pct: number | null;
  deleted_at: string | null;
  tmdb_popularity: number | null;
  genres: unknown;
  omdb_genre_names: unknown;
  tmdb_genre_names: unknown;
};

function normalizeGenres(meta: Partial<TitleRow>): string[] {
  const raw =
    (meta.genres as unknown) ??
    (meta.omdb_genre_names as unknown) ??
    (meta.tmdb_genre_names as unknown) ??
    [];

  if (!Array.isArray(raw)) return [];
  return raw
    .map((g) => String(g).trim().toLowerCase())
    .filter((g) => g.length > 0);
}

type ScoredCandidate = {
  score: number;
  meta: TitleRow;
};

function scoreCandidate(
  seed: TitleRow,
  candidate: TitleRow,
  profile: UserProfile | null,
): number {
  const seedGenres = normalizeGenres(seed);
  const candGenres = normalizeGenres(candidate);

  const seedSet = new Set(seedGenres);
  const candSet = new Set(candGenres);

  let intersection = 0;
  for (const g of candSet) {
    if (seedSet.has(g)) intersection += 1;
  }
  const unionSize = new Set([...seedSet, ...candSet]).size || 1;
  const jaccard = intersection / unionSize;

  const sameContentType =
    seed.content_type && candidate.content_type &&
    seed.content_type === candidate.content_type
      ? 1
      : 0;

  const seedYear = seed.release_year ?? null;
  const year = candidate.release_year ?? null;
  let yearScore = 0;
  if (seedYear && year) {
    const diff = Math.abs(seedYear - year);
    yearScore = Math.max(0, 1 - diff / 20);
  }

  const popularity = Number(candidate.tmdb_popularity ?? 0);
  const popularityScore = Math.log10(1 + Math.max(0, popularity));

  let tasteAdj = 0;
  if (profile) {
    const favSet = new Set(
      (profile.favoriteGenres ?? [])
        .map((g) => g.trim().toLowerCase())
        .filter(Boolean),
    );
    const dislikedSet = new Set(
      (profile.dislikedGenres ?? [])
        .map((g) => g.trim().toLowerCase())
        .filter(Boolean),
    );

    let favMatches = 0;
    let badMatches = 0;
    for (const g of candSet) {
      if (favSet.has(g)) favMatches += 1;
      if (dislikedSet.has(g)) badMatches += 1;
    }

    tasteAdj += favMatches * 0.3;
    tasteAdj -= badMatches * 0.5;
  }

  let score = 0;
  score += jaccard * 6;
  score += yearScore * 2;
  score += sameContentType * 1;
  score += popularityScore * 0.5;
  score += tasteAdj;

  if (jaccard === 0 && yearScore < 0.2 && popularityScore < 1) {
    score -= 2;
  }

  score += (Math.random() - 0.5) * 0.25;

  return score;
}

function jsonError(message: string, status: number, code?: string): Response {
  return jsonResponse({ ok: false, error: message, errorCode: code }, status);
}

function jsonOk(body: unknown, status = 200): Response {
  return jsonResponse(body, status);
}

serve(async (req: Request) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  if (req.method !== "GET") {
    return jsonError("Method not allowed", 405, "METHOD_NOT_ALLOWED");
  }

  let supabase;
  try {
    supabase = getAdminClient(req);
  } catch (error) {
    console.error("[swipe-more-like-this] Supabase configuration error", error);
    return jsonError("Server misconfigured", 500, "SERVER_MISCONFIGURED");
  }
  const url = new URL(req.url);
  const titleId = url.searchParams.get("title_id");

  if (!titleId) {
    return jsonError("Missing 'title_id' query parameter", 400, "BAD_REQUEST");
  }

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("[swipe-more-like-this] auth error:", authError.message);
      return jsonError("Unauthorized", 401, "UNAUTHORIZED");
    }
    if (!user) {
      return jsonError("Unauthorized", 401, "UNAUTHORIZED");
    }

    const [
      { data: seed, error: seedError },
      { data: candidates, error: titlesError },
      seenTitleIds,
      profile,
    ] = await Promise.all([
      supabase
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
        .eq("title_id", titleId)
        .maybeSingle<TitleRow>(),
      supabase
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
        .neq("title_id", titleId)
        .order("tmdb_popularity", { ascending: false } as any)
        .limit(400),
      loadSeenTitleIdsForUser(supabase, user.id),
      computeUserProfile(supabase, user.id),
    ]);

    if (seedError) {
      console.error("[swipe-more-like-this] seed title error:", seedError);
      return jsonError("Failed to load seed title", 500, "SEED_LOAD_FAILED");
    }
    if (!seed || seed.deleted_at) {
      return jsonError("Seed title not found", 404, "SEED_NOT_FOUND");
    }
    if (titlesError) {
      console.error(
        "[swipe-more-like-this] candidates query error:",
        titlesError,
      );
      return jsonError("Failed to load titles", 500, "TITLE_QUERY_FAILED");
    }

    const scored: ScoredCandidate[] = [];

    for (const row of candidates ?? []) {
      const meta = row as unknown as TitleRow;

      if (!meta.title_id) continue;
      if (seenTitleIds.has(meta.title_id)) continue;

      const score = scoreCandidate(seed, meta, profile);
      if (score <= 0) continue;

      scored.push({ score, meta });
    }

    if (!scored.length) {
      return jsonOk(
        {
          ok: true,
          seedTitleId: seed.title_id,
          cards: [] as SwipeCard[],
        },
        200,
      );
    }

    scored.sort((a, b) => b.score - a.score);

    const top = scored.slice(0, 50);

    const cards: SwipeCard[] = top.map(({ meta }) => ({
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

    const syncCandidates = cards.slice(0, 3);
    Promise.allSettled(
      syncCandidates.map((c) =>
        triggerCatalogSyncForTitle(
          req,
          {
            tmdbId: c.tmdbId,
            imdbId: c.imdbId,
            contentType: c.contentType ?? undefined,
          },
          { prefix: "[swipe-more-like-this]" },
        )
      ),
    ).catch((err) => {
      console.warn("[swipe-more-like-this] catalog-sync error", err);
    });

    return jsonOk(
      {
        ok: true,
        seedTitleId: seed.title_id,
        cards,
      },
      200,
    );
  } catch (err) {
    console.error("[swipe-more-like-this] unexpected error:", err);
    return jsonError("Internal server error", 500, "UNEXPECTED_ERROR");
  }
});
