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
    console.error("[similar-titles] missing env");
    return new Response("Server misconfigured", {
      status: 500,
      headers: corsHeaders,
    });
  }

  const supabase = buildSupabaseClient(req);

  const { data: authUser, error: authError } = await supabase.auth.getUser();
  if (authError || !authUser?.user) {
    return new Response("Unauthorized", {
      status: 401,
      headers: corsHeaders,
    });
  }

  const body = (await req.json().catch(() => ({}))) as {
    titleId?: string;
    limit?: number;
  };

  const titleId = body.titleId;
  const limit = body.limit && body.limit > 0 && body.limit <= 50 ? body.limit : 16;

  if (!titleId) {
    return new Response("titleId required", {
      status: 400,
      headers: corsHeaders,
    });
  }

  const { data: target, error: targetError } = await supabase
    .from("titles")
    .select("title_id, genres, content_type")
    .eq("title_id", titleId)
    .maybeSingle();

  if (targetError) {
    console.error("[similar-titles] target fetch error:", targetError.message);
  }

  if (!target) {
    return new Response(
      JSON.stringify({ items: [], reason: "not_found" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const genres = (target.genres as string[] | null) ?? [];
  const hasGenres = Array.isArray(genres) && genres.length > 0;

  let query = supabase
    .from("titles")
    .select(
      `title_id, primary_title, release_year, runtime_minutes, content_type, poster_url, backdrop_url, tmdb_popularity, imdb_rating, omdb_rt_rating_pct`,
    )
    .neq("title_id", titleId)
    .eq("content_type", target.content_type);

  if (hasGenres) {
    query = query.overlaps("genres", genres);
  }

  const { data: candidates, error: matchError } = await query
    .order("tmdb_popularity", { ascending: false, nullsFirst: false })
    .limit(limit * 3);

  if (matchError) {
    console.error("[similar-titles] titles error:", matchError.message);
  }

  const items = (candidates ?? [])
    .map((meta) => {
      const popularity = Number(meta.tmdb_popularity ?? 0) || 0;
      const imdbRating = Number(meta.imdb_rating ?? 0) || 0;
      const rtMeter = Number(meta.omdb_rt_rating_pct ?? 0) || 0;

      const qualityScore = imdbRating > 0 ? Math.min(1, imdbRating / 10) : 0;
      const criticScore = rtMeter > 0 ? Math.min(1, rtMeter / 100) : 0;
      const finalScore = 0.7 * qualityScore + 0.3 * criticScore + popularity / 1000;

      return {
        id: meta.title_id as string,
        title: (meta.primary_title as string | null) ?? "Untitled",
        year: (meta.release_year as number | null) ?? null,
        runtimeMinutes: (meta.runtime_minutes as number | null) ?? null,
        type: (meta.content_type as string | null) ?? null,
        posterUrl:
          (meta.poster_url as string | null) ?? (meta.backdrop_url as string | null) ?? null,
        scores: {
          similarity: hasGenres ? 1 : 0,
          quality: qualityScore,
          popularity: popularity,
          finalScore,
        },
      };
    })
    .sort((a, b) => b.scores.finalScore - a.scores.finalScore)
    .slice(0, limit);

  return new Response(
    JSON.stringify({ items }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
