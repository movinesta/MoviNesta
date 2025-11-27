
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

type RecommendationCard = {
  id: string;
  title: string;
  year: number | null;
  runtimeMinutes: number | null;
  type: string | null;
  posterUrl: string | null;
  reason: string;
  scores: {
    contentSimilarity: number;
    collaborative: number;
    quality: number;
    popularity: number;
    finalScore: number;
  };
};

function normalizeRating(rating: number | null | undefined): number {
  if (!rating || rating <= 0) return 0;
  return Math.max(0, Math.min(1, rating / 5));
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
    console.error("[recommend-for-you] missing env");
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

  const body = (await req.json().catch(() => ({}))) as {
    limit?: number;
  };
  const limit =
    body.limit && body.limit > 0 && body.limit <= 100 ? body.limit : 40;

  // 1. Load recent ratings
  const { data: ratings, error: ratingsError } = await supabase
    .from("ratings")
    .select("title_id, rating, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (ratingsError) {
    console.error(
      "[recommend-for-you] ratings error:",
      ratingsError.message,
    );
  }

  const positiveRatings = (ratings ?? []).filter((r) => {
    const rating = Number(r.rating ?? 0);
    return rating > 3.0;
  });

  if (positiveRatings.length < 3) {
    // Cold start: front-end can fall back to existing "friends trending" + "trending" rows
    return new Response(
      JSON.stringify({ cards: [], reason: "cold_start" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const ratedIds = Array.from(new Set(positiveRatings.map((r) => r.title_id)));

  // 2. Fetch embeddings for these titles
  const { data: embedRows, error: embedsError } = await supabase
    .from("title_embeddings")
    .select("title_id, embedding")
    .in("title_id", ratedIds);

  if (embedsError) {
    console.error(
      "[recommend-for-you] embeddings error:",
      embedsError.message,
    );
  }

  const embedById = new Map<string, number[]>();
  for (const row of embedRows ?? []) {
    embedById.set(row.title_id, row.embedding as unknown as number[]);
  }

  const now = Date.now();
  let dims = 0;
  const firstEmbedding = embedRows?.[0]?.embedding as number[] | undefined;
  if (firstEmbedding && Array.isArray(firstEmbedding)) {
    dims = firstEmbedding.length;
  } else {
    return new Response(
      JSON.stringify({ cards: [], reason: "no_embeddings" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const userEmbedding = new Array(dims).fill(0) as number[];
  let weightSum = 0;

  for (const r of positiveRatings) {
    const emb = embedById.get(r.title_id);
    if (!emb) continue;

    const rating = Number(r.rating ?? 0);
    const score = (rating - 2.5) / 2.5; // [-1, 1]
    if (score <= 0) continue;

    const createdAt = r.created_at
      ? new Date(r.created_at).getTime()
      : now;
    const daysAgo = (now - createdAt) / (1000 * 60 * 60 * 24);
    const recency = Math.exp(-daysAgo / 180); // ~6 months half-life

    const weight = score * recency;
    weightSum += weight;

    for (let i = 0; i < dims; i++) {
      userEmbedding[i] += emb[i] * weight;
    }
  }

  if (weightSum <= 0) {
    return new Response(
      JSON.stringify({ cards: [], reason: "no_positive_weights" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  for (let i = 0; i < dims; i++) {
    userEmbedding[i] /= weightSum;
  }

  // 3. Use match_titles RPC to get candidate IDs
  const { data: matches, error: matchError } = await supabase.rpc(
    "match_titles",
    {
      query_embedding: userEmbedding,
      match_threshold: 1.0, // no strict threshold
      match_count: limit * 5,
    },
  );

  if (matchError) {
    console.error(
      "[recommend-for-you] match_titles error:",
      matchError.message,
    );
    return new Response("Internal error", {
      status: 500,
      headers: corsHeaders,
    });
  }

  // Remove titles the user has already rated
  const ratedSet = new Set(ratings?.map((r) => r.title_id));
  const candidateMatches = (matches ?? []).filter(
    (m: any) => !ratedSet.has(m.title_id),
  );

  const candidateIds = candidateMatches
    .slice(0, limit * 4)
    .map((m: any) => m.title_id);

  if (candidateIds.length === 0) {
    return new Response(
      JSON.stringify({ cards: [], reason: "no_candidates" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // 4. Load titles + stats + external ratings
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
    console.error("[recommend-for-you] titles error:", titleError.message);
  }

  const metaById = new Map<string, any>();
  for (const t of titleRows ?? []) {
    metaById.set(t.id, t);
  }

  // 5. Collaborative filtering via friends' likes
  const { data: follows, error: followsError } = await supabase
    .from("follows")
    .select("followed_id")
    .eq("follower_id", user.id);

  if (followsError) {
    console.error(
      "[recommend-for-you] follows error:",
      followsError.message,
    );
  }

  const friendIds = (follows ?? []).map((f) => f.followed_id);
  const friendLikesByTitle = new Map<string, number>();

  if (friendIds.length > 0) {
    const { data: friendRatings, error: frError } = await supabase
      .from("ratings")
      .select("title_id, user_id, rating")
      .in("title_id", candidateIds)
      .in("user_id", friendIds)
      .gte("rating", 4.0);

    if (frError) {
      console.error(
        "[recommend-for-you] friend ratings error:",
        frError.message,
      );
    } else {
      for (const r of friendRatings ?? []) {
        const key = r.title_id;
        friendLikesByTitle.set(
          key,
          (friendLikesByTitle.get(key) ?? 0) + 1,
        );
      }
    }
  }

  const maxFriendLikes =
    Array.from(friendLikesByTitle.values()).reduce(
      (max, v) => Math.max(max, v),
      0,
    ) || 1;

  // 6. Compute scores
  let maxPopularity = 0;
  const baseCards: (RecommendationCard & {
    similarity: number;
    appRating: number;
    imdbRating: number;
    rtMeter: number;
    friendLikesCount: number;
    popularity: number;
  })[] = [];

  // Precompute popularity max
  for (const m of candidateMatches) {
    const meta = metaById.get(m.title_id);
    if (!meta) continue;
    const popularity = Number(meta.tmdb_popularity ?? 0) || 0;
    if (popularity > maxPopularity) maxPopularity = popularity;
  }
  if (maxPopularity <= 0) maxPopularity = 1;

  for (const m of candidateMatches) {
    const meta = metaById.get(m.title_id);
    if (!meta) continue;

    const similarity = Number(m.similarity ?? 0);
    const ts = meta.title_stats ?? {};
    const er = meta.external_ratings ?? {};

    const appRating = Number(ts.avg_rating ?? 0) || 0;
    const imdbRating = Number(er.imdb_rating ?? 0) || 0;
    const rtMeter = Number(er.rt_tomato_meter ?? 0) || 0;
    const popularity = Number(meta.tmdb_popularity ?? 0) || 0;
    const friendLikes = friendLikesByTitle.get(meta.id) ?? 0;

    baseCards.push({
      id: meta.id,
      title: meta.title ?? "Untitled",
      year: meta.year ?? null,
      runtimeMinutes: meta.runtime_minutes ?? null,
      type: meta.type ?? null,
      posterUrl: meta.poster_url ?? null,
      reason: "",
      similarity,
      appRating,
      imdbRating,
      rtMeter,
      friendLikesCount: friendLikes,
      popularity,
      scores: {
        contentSimilarity: 0,
        collaborative: 0,
        quality: 0,
        popularity: 0,
        finalScore: 0,
      },
    });
  }

  if (baseCards.length === 0) {
    return new Response(
      JSON.stringify({ cards: [], reason: "no_meta" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const cardsWithScores = baseCards.map((c) => {
    const contentSim = c.similarity; // already [0, 1]

    const cfScore =
      Math.log1p(c.friendLikesCount) / Math.log1p(maxFriendLikes);

    const appScore = normalizeRating(c.appRating);
    const imdbScore =
      c.imdbRating > 0 ? Math.min(1, c.imdbRating / 10) : 0;
    const rtScore =
      c.rtMeter > 0 ? Math.min(1, c.rtMeter / 100) : 0;

    const popNorm =
      c.popularity > 0 ? Math.min(1, c.popularity / maxPopularity) : 0;

    const qualityScore = (appScore + imdbScore) / 2;

    const finalScore =
      0.5 * contentSim +
      0.15 * cfScore +
      0.15 * qualityScore +
      0.1 * rtScore +
      0.1 * popNorm;

    let reason = "A strong match for your taste.";
    if (cfScore > 0.5) {
      reason = "Loved by your friends and a close match to what you like.";
    } else if (contentSim > 0.7) {
      reason = "Very similar to things you’ve rated highly.";
    } else if (rtScore > 0.7 || imdbScore > 0.8) {
      reason = "Critically acclaimed and aligns with your taste.";
    }

    return {
      ...c,
      reason,
      scores: {
        contentSimilarity: contentSim,
        collaborative: cfScore,
        quality: qualityScore,
        popularity: popNorm,
        finalScore,
      },
    };
  });

  cardsWithScores.sort(
    (a, b) => b.scores.finalScore - a.scores.finalScore,
  );

  const sliced = cardsWithScores.slice(0, limit);

  return new Response(
    JSON.stringify({ cards: sliced, reason: "ok" }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
