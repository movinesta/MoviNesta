
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
  const limit =
    body.limit && body.limit > 0 && body.limit <= 50 ? body.limit : 16;

  if (!titleId) {
    return new Response("titleId required", {
      status: 400,
      headers: corsHeaders,
    });
  }

  const { data: embRow, error: embError } = await supabase
    .from("title_embeddings")
    .select("embedding")
    .eq("title_id", titleId)
    .maybeSingle();

  if (embError) {
    console.error("[similar-titles] embedding error:", embError.message);
  }
  if (!embRow?.embedding) {
    return new Response(
      JSON.stringify({ items: [], reason: "no_embedding" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const queryEmbedding = embRow.embedding as number[];

  const { data: matches, error: matchError } = await supabase.rpc(
    "match_titles",
    {
      query_embedding: queryEmbedding,
      match_threshold: 1.0,
      match_count: limit * 4,
    },
  );

  if (matchError) {
    console.error(
      "[similar-titles] match_titles error:",
      matchError.message,
    );
    return new Response("Internal error", {
      status: 500,
      headers: corsHeaders,
    });
  }

  const candidates = (matches ?? []).filter(
    (m: any) => m.title_id !== titleId,
  );

  const ids = candidates.slice(0, limit * 2).map((m: any) => m.title_id);

  if (!ids.length) {
    return new Response(
      JSON.stringify({ items: [], reason: "no_candidates" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

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
    .in("id", ids);

  if (titleError) {
    console.error("[similar-titles] titles error:", titleError.message);
  }

  const metaById = new Map<string, any>();
  for (const t of titleRows ?? []) {
    metaById.set(t.id, t);
  }

  let maxPopularity = 0;
  for (const c of candidates) {
    const meta = metaById.get(c.title_id);
    if (!meta) continue;
    const pop = Number(meta.tmdb_popularity ?? 0) || 0;
    if (pop > maxPopularity) maxPopularity = pop;
  }
  if (maxPopularity <= 0) maxPopularity = 1;

  const items = candidates
    .map((m: any) => {
      const meta = metaById.get(m.title_id);
      if (!meta) return null;
      const ts = meta.title_stats ?? {};
      const er = meta.external_ratings ?? {};

      const similarity = Number(m.similarity ?? 0);
      const appRating = Number(ts.avg_rating ?? 0) || 0;
      const imdbRating = Number(er.imdb_rating ?? 0) || 0;
      const rtMeter = Number(er.rt_tomato_meter ?? 0) || 0;
      const popularity = Number(meta.tmdb_popularity ?? 0) || 0;

      const appScore = appRating > 0 ? Math.min(1, appRating / 5) : 0;
      const imdbScore =
        imdbRating > 0 ? Math.min(1, imdbRating / 10) : 0;
      const rtScore = rtMeter > 0 ? Math.min(1, rtMeter / 100) : 0;
      const popNorm =
        popularity > 0 ? Math.min(1, popularity / maxPopularity) : 0;

      const qualityScore = (appScore + imdbScore) / 2;

      const finalScore =
        0.65 * similarity +
        0.15 * popNorm +
        0.1 * rtScore +
        0.1 * qualityScore;

      return {
        id: meta.id as string,
        title: (meta.title as string | null) ?? "Untitled",
        year: (meta.year as number | null) ?? null,
        runtimeMinutes: (meta.runtime_minutes as number | null) ?? null,
        type: (meta.type as string | null) ?? null,
        posterUrl:
          (meta.poster_url as string | null) ?? (meta.backdrop_url as string | null) ?? null,
        scores: {
          similarity,
          quality: qualityScore,
          popularity: popNorm,
          finalScore,
        },
      };
    })
    .filter(Boolean) as any[];

  items.sort((a, b) => b.scores.finalScore - a.scores.finalScore);

  return new Response(
    JSON.stringify({ items: items.slice(0, limit) }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
