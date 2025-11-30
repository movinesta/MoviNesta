import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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
  imdbRating?: number | null;
  rtTomatoMeter?: number | null;
  scores: {
    quality: number;
    popularity: number;
    finalScore: number;
  };
};

function normalizeRating(rating: number | null | undefined): number {
  if (!rating || rating <= 0) return 0;
  return Math.max(0, Math.min(1, rating / 10));
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
  const limit = body.limit && body.limit > 0 && body.limit <= 100 ? body.limit : 100;

  const { data: ratings, error: ratingsError } = await supabase
    .from("ratings")
    .select("title_id, rating")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (ratingsError) {
    console.error(
      "[recommend-for-you] ratings error:",
      ratingsError.message,
    );
  }

  const positiveRatings = (ratings ?? []).filter((r) => Number(r.rating ?? 0) >= 3.5);
  if (positiveRatings.length === 0) {
    return new Response(
      JSON.stringify({ cards: [], reason: "cold_start" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const ratedIds = Array.from(new Set(positiveRatings.map((r) => r.title_id as string)));

  const { data: ratedTitles } = await supabase
    .from("titles")
    .select("title_id, genres")
    .in("title_id", ratedIds);

  const genreCounts = new Map<string, number>();
  for (const row of ratedTitles ?? []) {
    for (const g of (row.genres as string[] | null) ?? []) {
      genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1);
    }
  }

  const topGenres = Array.from(genreCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([g]) => g);

  let query = supabase
    .from("titles")
    .select(
      `title_id, primary_title, release_year, runtime_minutes, content_type, poster_url, backdrop_url, tmdb_popularity, imdb_rating, omdb_rt_rating_pct`,
    )
    .not(
      "title_id",
      "in",
      `(${ratedIds.map((id) => `"${id}"`).join(",")})`,
    );

  if (topGenres.length) {
    query = query.overlaps("genres", topGenres);
  }

  const { data: candidates, error: candidateError } = await query
    .order("tmdb_popularity", { ascending: false, nullsFirst: false })
    .limit(limit * 3);

  if (candidateError) {
    console.error("[recommend-for-you] titles error:", candidateError.message);
  }

  const cards: RecommendationCard[] = (candidates ?? []).map((meta) => {
    const imdbRating = Number(meta.imdb_rating ?? 0) || 0;
    const rtMeter = Number(meta.omdb_rt_rating_pct ?? 0) || 0;
    const popularity = Number(meta.tmdb_popularity ?? 0) || 0;

    const qualityScore = (normalizeRating(imdbRating * 2) + normalizeRating(rtMeter / 2)) / 2;
    const popNorm = popularity > 0 ? Math.min(1, popularity / 1000) : 0;
    const finalScore = 0.6 * qualityScore + 0.4 * popNorm;

    let reason = "A strong match for your favorite genres.";
    if (!topGenres.length) {
      reason = "Popular picks you haven’t rated yet.";
    }

    return {
      id: meta.title_id as string,
      title: (meta.primary_title as string | null) ?? "Untitled",
      year: (meta.release_year as number | null) ?? null,
      runtimeMinutes: (meta.runtime_minutes as number | null) ?? null,
      type: (meta.content_type as string | null) ?? null,
      posterUrl:
        (meta.poster_url as string | null) ?? (meta.backdrop_url as string | null) ?? null,
      reason,
      imdbRating: imdbRating || null,
      rtTomatoMeter: rtMeter || null,
      scores: {
        quality: qualityScore,
        popularity: popNorm,
        finalScore,
      },
    };
  });

  cards.sort((a, b) => b.scores.finalScore - a.scores.finalScore);

  return new Response(
    JSON.stringify({ cards: cards.slice(0, limit), reason: "ok" }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
