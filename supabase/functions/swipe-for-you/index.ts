
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type SwipeCardData = {
  id: string;
  title: string;
  year?: number | null;
  runtimeMinutes?: number | null;
  tagline?: string | null;
  mood?: string | null;
  vibeTag?: string | null;
  type?: string | null;
  posterUrl?: string | null;
  friendLikesCount?: number | null;
  topFriendName?: string | null;
  topFriendInitials?: string | null;
  topFriendReviewSnippet?: string | null;
  initialRating?: number | null;
  initiallyInWatchlist?: boolean;
  imdbRating?: number | null;
  rtTomatoMeter?: number | null;
};

type SwipeDeckResponse = {
  cards: SwipeCardData[];
};

type RequestBody = {
  limit?: number;
};

function buildSupabaseClient(req: Request) {
  return createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
    global: {
      headers: {
        Authorization: req.headers.get("Authorization") ?? "",
      },
    },
  });
}

function normalizeRating(rating: number | null | undefined): number {
  if (!rating || rating <= 0) return 0;
  return Math.max(0, Math.min(1, rating / 5));
}

async function buildTrendingFallback(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  limit: number,
): Promise<SwipeCardData[]> {
  // Take popular titles we already have in our DB as a safe fallback.
  const { data: popularTitles, error: popularError } = await supabase
    .from("titles")
    .select(
      `
      id,
      title,
      year,
      type,
      runtime_minutes,
      poster_url,
      backdrop_url,
      tmdb_popularity,
      synopsis
    `,
    )
    .order("tmdb_popularity", { ascending: false, nullsLast: true })
    .limit(limit * 3);

  if (popularError || !popularTitles?.length) {
    console.warn("[swipe-for-you] trending fallback titles error:", popularError?.message);
    return [];
  }

  // Exclude titles the user has rated already.
  const { data: userRatings } = await supabase
    .from("ratings")
    .select("title_id, rating")
    .eq("user_id", userId);

  const ratedSet = new Set((userRatings ?? []).map((r: any) => r.title_id as string));

  // Library entries for watchlist info.
  const { data: libraryRows } = await supabase
    .from("library_entries")
    .select("title_id, status")
    .eq("user_id", userId);

  const libraryByTitle = new Map<string, any>();
  for (const row of libraryRows ?? []) {
    libraryByTitle.set(row.title_id as string, row);
  }

  const cards: SwipeCardData[] = [];

  for (const row of popularTitles) {
    const id = row.id as string;
    if (ratedSet.has(id)) continue;

    const synopsis = (row.synopsis as string | null) ?? "";
    const tagline =
      synopsis.length > 0 ? synopsis.slice(0, 120).trimEnd() + (synopsis.length > 120 ? "…" : "") : null;

    const libraryRow = libraryByTitle.get(id);

    cards.push({
      id,
      title: (row.title as string | null) ?? "Untitled",
      year: (row.year as number | null) ?? null,
      runtimeMinutes: (row.runtime_minutes as number | null) ?? null,
      tagline,
      mood: null,
      vibeTag: null,
      type: (row.type as string | null) ?? null,
      posterUrl: (row.poster_url as string | null) ?? (row.backdrop_url as string | null) ?? null,
      friendLikesCount: null,
      topFriendName: null,
      topFriendInitials: null,
      topFriendReviewSnippet: null,
      initialRating: null,
      initiallyInWatchlist: libraryRow?.status === "want_to_watch",
    });

    if (cards.length >= limit) break;
  }

  return cards;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("[swipe-for-you] missing SUPABASE env");
    return new Response("Server misconfigured", {
      status: 500,
      headers: corsHeaders,
    });
  }

  const supabase = buildSupabaseClient(req);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return new Response("Unauthorized", {
      status: 401,
      headers: corsHeaders,
    });
  }

  const body = (await req.json().catch(() => ({}))) as RequestBody;
  const limit = body.limit && body.limit > 0 ? Math.min(body.limit, 100) : 100;

  // 1) Load user ratings
  const { data: ratings, error: ratingsError } = await supabase
    .from("ratings")
    .select("title_id, rating, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (ratingsError) {
    console.error("[swipe-for-you] ratings error:", ratingsError.message);
  }

  const positiveRatings = (ratings ?? []).filter((r) => {
    const rating = Number(r.rating ?? 0);
    return rating >= 3.5;
  });

  // If we really have nothing to go on, fall back to popular titles.
  if (positiveRatings.length === 0) {
    const cards = await buildTrendingFallback(supabase, user.id, limit);
    const response: SwipeDeckResponse = { cards };
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const ratedIds = Array.from(new Set(positiveRatings.map((r) => r.title_id as string)));

  // 2) Fetch embeddings for these titles
  const { data: embedRows, error: embedsError } = await supabase
    .from("title_embeddings")
    .select("title_id, embedding")
    .in("title_id", ratedIds);

  if (embedsError) {
    console.error("[swipe-for-you] embeddings error:", embedsError.message);
  }

  const embedById = new Map<string, number[]>();
  for (const row of embedRows ?? []) {
    embedById.set(row.title_id as string, row.embedding as unknown as number[]);
  }

  const firstEmbedding = embedRows?.[0]?.embedding as number[] | undefined;
  if (!firstEmbedding || !Array.isArray(firstEmbedding) || firstEmbedding.length === 0) {
    const cards = await buildTrendingFallback(supabase, user.id, limit);
    const response: SwipeDeckResponse = { cards };
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const dims = firstEmbedding.length;
  const now = Date.now();
  const userEmbedding = new Array(dims).fill(0) as number[];
  let weightSum = 0;

  for (const r of positiveRatings) {
    const emb = embedById.get(r.title_id as string);
    if (!emb) continue;

    const rating = Number(r.rating ?? 0);
    const score = (rating - 2.5) / 2.5; // [-1, 1]
    if (score <= 0) continue;

    const createdAt = r.created_at ? new Date(r.created_at as string).getTime() : now;
    const daysAgo = (now - createdAt) / (1000 * 60 * 60 * 24);
    const recency = Math.exp(-daysAgo / 180); // ~6 months half-life

    const weight = score * recency;
    weightSum += weight;

    for (let i = 0; i < dims; i++) {
      userEmbedding[i] += emb[i] * weight;
    }
  }

  if (weightSum <= 0) {
    const cards = await buildTrendingFallback(supabase, user.id, limit);
    const response: SwipeDeckResponse = { cards };
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  for (let i = 0; i < dims; i++) {
    userEmbedding[i] /= weightSum;
  }

  // 3) Use match_titles RPC to get candidate IDs
  const { data: matches, error: matchError } = await supabase.rpc("match_titles", {
    query_embedding: userEmbedding,
    match_threshold: 1.0,
    match_count: limit * 6,
  });

  if (matchError) {
    console.error("[swipe-for-you] match_titles error:", matchError.message);
    const cards = await buildTrendingFallback(supabase, user.id, limit);
    const response: SwipeDeckResponse = { cards };
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const ratedSet = new Set((ratings ?? []).map((r) => r.title_id as string));
  const candidateMatches = (matches ?? []).filter(
    (m: any) => !ratedSet.has(m.title_id as string),
  );

  const candidateIds = candidateMatches.slice(0, limit * 4).map((m: any) => m.title_id as string);

  if (candidateIds.length === 0) {
    const cards = await buildTrendingFallback(supabase, user.id, limit);
    const response: SwipeDeckResponse = { cards };
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 4) Load title metadata + ratings + external ratings
  const { data: titleRows, error: titleError } = await supabase
    .from("titles")
    .select(
      `
      id,
      title,
      year,
      type,
      runtime_minutes,
      poster_url,
      backdrop_url,
      synopsis,
      tmdb_popularity,
      title_stats (
        avg_rating,
        ratings_count
      ),
      external_ratings (
        imdb_rating,
        rt_tomato_meter
      )
    `,
    )
    .in("id", candidateIds);

  if (titleError) {
    console.error("[swipe-for-you] titles error:", titleError.message);
  }

  const metaById = new Map<string, any>();
  for (const t of titleRows ?? []) {
    metaById.set(t.id as string, t);
  }

  // 5) Collaborative filtering via friends' likes
  const { data: follows, error: followsError } = await supabase
    .from("follows")
    .select("followed_id")
    .eq("follower_id", user.id);

  if (followsError) {
    console.error("[swipe-for-you] follows error:", followsError.message);
  }

  const friendIds = (follows ?? []).map((f) => f.followed_id as string);
  const friendLikesByTitle = new Map<string, number>();

  if (friendIds.length > 0) {
    const { data: friendRatings, error: frError } = await supabase
      .from("ratings")
      .select("title_id, user_id, rating")
      .in("title_id", candidateIds)
      .in("user_id", friendIds)
      .gte("rating", 4.0);

    if (frError) {
      console.error("[swipe-for-you] friend ratings error:", frError.message);
    } else {
      for (const r of friendRatings ?? []) {
        const key = r.title_id as string;
        friendLikesByTitle.set(key, (friendLikesByTitle.get(key) ?? 0) + 1);
      }
    }
  }

  const maxFriendLikes =
    Array.from(friendLikesByTitle.values()).reduce((max, v) => Math.max(max, v), 0) || 1;

  // Library entries for watchlist info.
  const { data: libraryRows, error: libraryError } = await supabase
    .from("library_entries")
    .select("title_id, status")
    .eq("user_id", user.id)
    .in("title_id", candidateIds);

  if (libraryError) {
    console.error("[swipe-for-you] library error:", libraryError.message);
  }

  const libraryByTitle = new Map<string, any>();
  for (const row of libraryRows ?? []) {
    libraryByTitle.set(row.title_id as string, row);
  }

  // 6) Compute scores and shape SwipeCardData[]
  let maxPopularity = 0;

  for (const m of candidateMatches) {
    const meta = metaById.get(m.title_id as string);
    if (!meta) continue;
    const popularity = Number(meta.tmdb_popularity ?? 0) || 0;
    if (popularity > maxPopularity) maxPopularity = popularity;
  }
  if (maxPopularity <= 0) maxPopularity = 1;

  type InternalCard = {
    id: string;
    similarity: number;
    appRating: number;
    imdbRating: number;
    rtMeter: number;
    friendLikesCount: number;
    popularity: number;
  };

  const internal: InternalCard[] = [];

  for (const m of candidateMatches) {
    const id = m.title_id as string;
    const meta = metaById.get(id);
    if (!meta) continue;

    const similarity = Number(m.similarity ?? 0);
    const ts = meta.title_stats ?? {};
    const er = meta.external_ratings ?? {};

    const appRating = Number(ts.avg_rating ?? 0) || 0;
    const imdbRating = Number(er.imdb_rating ?? 0) || 0;
    const rtMeter = Number(er.rt_tomato_meter ?? 0) || 0;
    const popularity = Number(meta.tmdb_popularity ?? 0) || 0;
    const friendLikes = friendLikesByTitle.get(id) ?? 0;

    internal.push({
      id,
      similarity,
      appRating,
      imdbRating,
      rtMeter,
      friendLikesCount: friendLikes,
      popularity,
    });
  }

  if (!internal.length) {
    const cards = await buildTrendingFallback(supabase, user.id, limit);
    const response: SwipeDeckResponse = { cards };
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const cardsScored = internal.map((c) => {
    const contentSim = c.similarity;

    const cfScore = Math.log1p(c.friendLikesCount) / Math.log1p(maxFriendLikes);

    const appScore = normalizeRating(c.appRating);
    const imdbScore = c.imdbRating > 0 ? Math.min(1, c.imdbRating / 10) : 0;
    const rtScore = c.rtMeter > 0 ? Math.min(1, c.rtMeter / 100) : 0;

    const popNorm = c.popularity > 0 ? Math.min(1, c.popularity / maxPopularity) : 0;

    const qualityScore = (appScore + imdbScore) / 2;

    const finalScore =
      0.5 * contentSim +
      0.15 * cfScore +
      0.15 * qualityScore +
      0.1 * rtScore +
      0.1 * popNorm;

    return { ...c, finalScore };
  });

  cardsScored.sort((a, b) => b.finalScore - a.finalScore);

  const topIds = cardsScored.slice(0, limit).map((c) => c.id);

  const cards: SwipeCardData[] = topIds.map((id) => {
    const meta = metaById.get(id);
    const lib = libraryByTitle.get(id);
    const scored = cardsScored.find((c) => c.id === id);

    const synopsis = (meta.synopsis as string | null) ?? "";
    const tagline =
      synopsis.length > 0 ? synopsis.slice(0, 140).trimEnd() + (synopsis.length > 140 ? "…" : "") : null;

    return {
      id,
      title: (meta.title as string | null) ?? "Untitled",
      year: (meta.year as number | null) ?? null,
      runtimeMinutes: (meta.runtime_minutes as number | null) ?? null,
      tagline,
      mood: null,
      vibeTag: null,
      type: (meta.type as string | null) ?? null,
      posterUrl:
        (meta.poster_url as string | null) ?? (meta.backdrop_url as string | null) ?? null,
      friendLikesCount: friendLikesByTitle.get(id) ?? null,
      topFriendName: null,
      topFriendInitials: null,
      topFriendReviewSnippet: null,
      initialRating: null,
      initiallyInWatchlist: lib?.status === "want_to_watch",
      imdbRating: scored?.imdbRating ?? null,
      rtTomatoMeter: scored?.rtMeter ?? null,
    };
  });

  const response: SwipeDeckResponse = { cards };

  return new Response(JSON.stringify(response), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
