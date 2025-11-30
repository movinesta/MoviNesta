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

  const { data: ratings } = await supabase
    .from("ratings")
    .select("title_id, rating")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200);

  const positiveRatings = (ratings ?? []).filter((r) => Number(r.rating ?? 0) >= 3.5);
  if (positiveRatings.length === 0) return respond([]);

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
      `title_id, primary_title, release_year, runtime_minutes, content_type, poster_url, backdrop_url, plot, imdb_rating, omdb_rt_rating_pct, tmdb_popularity`,
    )
    .not(
      "title_id",
      "in",
      `(${ratedIds.map((id) => `"${id}"`).join(",")})`,
    );

  if (topGenres.length) {
    query = query.overlaps("genres", topGenres);
  }

  const { data: candidates } = await query
    .order("tmdb_popularity", { ascending: false, nullsFirst: false })
    .limit(limit * 2);

  const candidateIds = (candidates ?? []).map((c) => c.title_id as string);

  const { data: libraryRows } = await supabase
    .from("library_entries")
    .select("title_id, status")
    .eq("user_id", user.id)
    .in("title_id", candidateIds);

  const libraryByTitle = new Map<string, any>();
  for (const row of libraryRows ?? []) {
    libraryByTitle.set(row.title_id as string, row);
  }

  const cards: SwipeCardData[] = (candidates ?? []).slice(0, limit).map((meta) => {
    const synopsis = (meta.plot as string | null) ?? "";
    const tagline = synopsis
      ? synopsis.slice(0, 140).trimEnd() + (synopsis.length > 140 ? "…" : "")
      : null;

    return {
      id: meta.title_id as string,
      title: (meta.primary_title as string | null) ?? "Untitled",
      year: (meta.release_year as number | null) ?? null,
      runtimeMinutes: (meta.runtime_minutes as number | null) ?? null,
      tagline,
      mood: null,
      vibeTag: null,
      type: (meta.content_type as string | null) ?? null,
      posterUrl:
        (meta.poster_url as string | null) ?? (meta.backdrop_url as string | null) ?? null,
      friendLikesCount: null,
      topFriendName: null,
      topFriendInitials: null,
      topFriendReviewSnippet: null,
      initialRating: null,
      initiallyInWatchlist: libraryByTitle.get(meta.title_id)?.status === "want_to_watch",
      imdbRating: (meta.imdb_rating as number | null) ?? null,
      rtTomatoMeter: (meta.omdb_rt_rating_pct as number | null) ?? null,
    };
  });

  return respond(cards);
});
