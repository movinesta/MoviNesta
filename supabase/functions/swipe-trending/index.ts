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
  type?: string | null;
  posterUrl?: string | null;
  initialRating?: number | null;
  initiallyInWatchlist?: boolean;
  imdbRating?: number | null;
  rtTomatoMeter?: number | null;
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

function respond(cards: SwipeCardData[]): Response {
  return new Response(JSON.stringify({ cards }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
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
    console.error("[swipe-trending] missing env");
    return new Response("Server misconfigured", {
      status: 500,
      headers: corsHeaders,
    });
  }

  const supabase = buildSupabaseClient(req);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const body = (await req.json().catch(() => ({}))) as { limit?: number };
  const limit = body.limit && body.limit > 0 ? Math.min(body.limit, 100) : 100;

  const { data: trending, error } = await supabase
    .from("titles")
    .select(
      `title_id, primary_title, release_year, runtime_minutes, content_type, poster_url, backdrop_url, plot, imdb_rating, omdb_rt_rating_pct, tmdb_popularity`,
    )
    .order("tmdb_popularity", { ascending: false, nullsFirst: false })
    .limit(limit * 2);

  if (error) {
    console.error("[swipe-trending] titles error:", error.message);
    return respond([]);
  }

  const titleIds = (trending ?? []).map((t) => t.title_id as string);
  let libraryByTitle = new Map<string, any>();

  if (user && titleIds.length) {
    const { data: libraryRows } = await supabase
      .from("library_entries")
      .select("title_id, status")
      .eq("user_id", user.id)
      .in("title_id", titleIds);

    libraryByTitle = new Map<string, any>();
    for (const row of libraryRows ?? []) {
      libraryByTitle.set(row.title_id as string, row);
    }
  }

  const cards: SwipeCardData[] = (trending ?? []).slice(0, limit).map((t) => {
    const synopsis = (t.plot as string | null) ?? "";
    const tagline = synopsis
      ? synopsis.slice(0, 140).trimEnd() + (synopsis.length > 140 ? "…" : "")
      : null;

    return {
      id: t.title_id as string,
      title: (t.primary_title as string | null) ?? "Untitled",
      year: (t.release_year as number | null) ?? null,
      runtimeMinutes: (t.runtime_minutes as number | null) ?? null,
      tagline,
      type: (t.content_type as string | null) ?? null,
      posterUrl: (t.poster_url as string | null) ?? (t.backdrop_url as string | null) ?? null,
      initialRating: null,
      initiallyInWatchlist: libraryByTitle.get(t.title_id)?.status === "want_to_watch",
      imdbRating: (t.imdb_rating as number | null) ?? null,
      rtTomatoMeter: (t.omdb_rt_rating_pct as number | null) ?? null,
    };
  });

  return respond(cards);
});
