// supabase/functions/swipe-from-friends/index.ts
//
// Returns a "From Friends" swipe deck.
// Placeholder version: same as trending (you can replace the query with
// real "friends activity").
// Also triggers `catalog-sync` for up to 3 cards per call.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { triggerCatalogSyncForTitle } from "../_shared/catalog-sync.ts";

import { computeUserProfile, type UserProfile } from "../_shared/preferences.ts";
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
  console.log("[swipe-from-friends] triggerCatalogSyncForCards called, cards.length =", cards.length);

  const candidates = cards
    .filter((c) => c.tmdbId || c.imdbId)
    .slice(0, 3); // soft limit per request to protect TMDb/OMDb quotas

  if (!candidates.length) {
    console.log("[swipe-from-friends] no cards with tmdbId/imdbId to sync");
    return;
  }

  // Fire-and-forget: we intentionally do not await this in the handler.
  void Promise.allSettled(
    candidates.map((card) =>
      triggerCatalogSyncForTitle(req, card, { prefix: "[swipe-from-friends]" }),
    ),
  );
}

async function triggerCatalogBackfill(reason: string) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn("[swipe-from-friends] cannot trigger catalog-backfill, missing URL or ANON key");
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
    console.error("[swipe-from-friends] unhandled error:", err);
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
    console.error("[swipe-from-friends] Missing SUPABASE_URL or SERVICE_ROLE_KEY");
    return jsonError("Server misconfigured", 500, "SERVER_MISCONFIGURED");
  }

  if (!SUPABASE_ANON_KEY) {
    console.error("[swipe-from-friends] Missing SUPABASE_ANON_KEY");
    return jsonError("Server misconfigured", 500, "SERVER_MISCONFIGURED");
  }

  return null;
}




async function loadSwipeCardsFromFriends(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  userId: string,
  profile: UserProfile | null,
): Promise<SwipeCard[]> {
  // 1) Load recent "friend activity" events.
  const {
    data: events,
    error: eventsError,
  } = await supabase
    .from("activity_events")
    .select("title_id, event_type, created_at, payload")
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
      recencyFactor = 1 / (1 + days / 7);
    }

    const prev = perTitle.get(titleId) ?? { baseScore: 0 };
    prev.baseScore += 1 * recencyFactor;
    perTitle.set(titleId, prev);
  }

  if (!perTitle.size) {
    return [];
  }

  const candidateTitleIds = Array.from(perTitle.keys());

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

    score += Math.log10(1 + Math.max(0, popularity)) * 0.5;

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
  userId: string,
): Promise<SwipeCard[]> {
  // 1) Find people this user follows.
  const { data: followRows, error: followError } = await supabase
    .from("follows")
    .select("followed_id")
    .eq("follower_id", userId);

  if (followError) {
    console.warn(
      "[swipe-from-friends] follows query error:",
      followError.message,
    );
    return [];
  }

  const friendIds = (followRows ?? [])
    .map((row: any) => row.followed_id)
    .filter((id: string | null) => !!id);

  if (!friendIds.length) {
    // No friends yet → let caller fall back to a generic deck.
    return [];
  }

  // 2) Remove blocked relationships: skip users that are blocked by or have blocked the current user.
  const { data: blockedRows, error: blockedError } = await supabase
    .from("blocked_users")
    .select("blocker_id, blocked_id")
    .or(
      `blocker_id.eq.${userId},blocked_id.eq.${userId}`,
    );

  if (blockedError) {
    console.warn(
      "[swipe-from-friends] blocked_users query error:",
      blockedError.message,
    );
  }

  const blockedSet = new Set<string>();
  for (const row of blockedRows ?? []) {
    if (row.blocker_id === userId) {
      blockedSet.add(row.blocked_id);
    } else if (row.blocked_id === userId) {
      blockedSet.add(row.blocker_id);
    }
  }

  const visibleFriendIds = friendIds.filter((id) => !blockedSet.has(id));
  if (!visibleFriendIds.length) {
    return [];
  }

  // 3) Respect basic activity privacy: only include friends whose activity is not private.
  // We treat privacy_activity = 'public' or 'followers' as visible, everything else as hidden.
  const { data: settingsRows, error: settingsError } = await supabase
    .from("user_settings")
    .select("user_id, privacy_activity")
    .in("user_id", visibleFriendIds);

  if (settingsError) {
    console.warn(
      "[swipe-from-friends] user_settings query error:",
      settingsError.message,
    );
  }

  const allowedFriendIds = new Set<string>();
  for (const row of settingsRows ?? []) {
    const level = (row as any).privacy_activity as string | null;
    if (!level || level === "public") {
      allowedFriendIds.add(row.user_id);
    } else if (level === "followers") {
      // We're already in the 'follows' graph, so this user has visibility.
      allowedFriendIds.add(row.user_id);
    } else {
      // e.g. 'private' → skip
    }
  }

  const finalFriendIds = visibleFriendIds.filter((id) =>
    allowedFriendIds.has(id),
  );
  if (!finalFriendIds.length) {
    return [];
  }

  // 4) Pull recent activity_events for those friends, focusing on ratings.
  const { data: events, error: eventsError } = await supabase
    .from("activity_events")
    .select("title_id, user_id, created_at")
    .in("user_id", finalFriendIds)
    .eq("event_type", "rating_created")
    .not("title_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(200);

  if (eventsError) {
    console.warn(
      "[swipe-from-friends] activity_events query error:",
      eventsError.message,
    );
    return [];
  }

  // 5) Deduplicate titles by recency, preserving order.
  const seenTitleIds = new Set<string>();
  const orderedTitleIds: string[] = [];

  for (const ev of events ?? []) {
    const titleId = (ev as any).title_id as string | null;
    if (!titleId) continue;
    if (seenTitleIds.has(titleId)) continue;

    seenTitleIds.add(titleId);
    orderedTitleIds.push(titleId);

    if (orderedTitleIds.length >= 100) break;
  }

  if (!orderedTitleIds.length) {
    return [];
  }

  // 6) Fetch metadata for these titles.
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
        "tmdb_popularity",
        "deleted_at",
      ].join(","),
    )
    .in("title_id", orderedTitleIds)
    .is("deleted_at", null);

  if (titleError) {
    console.error(
      "[swipe-from-friends] titles for friends query error:",
      titleError.message,
    );
    return [];
  }

  const byId = new Map<string, any>();
  for (const row of titleRows ?? []) {
    byId.set((row as any).title_id, row);
  }

  const cards: SwipeCard[] = [];
  for (const titleId of orderedTitleIds) {
    const meta = byId.get(titleId);
    if (!meta) continue;

    cards.push({
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
    });

    if (cards.length >= 50) break;
  }

  return cards;
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
    .limit(50);

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