import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TMDB_READ_TOKEN = Deno.env.get("TMDB_API_READ_ACCESS_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
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
};

type TmdbTitle = {
  id: number;
  media_type?: "movie" | "tv";
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string;
  backdrop_path?: string;
  release_date?: string;
  first_air_date?: string;
  original_language?: string;
};

interface RequestBody {
  limit?: number;
}

function buildSupabaseClient(req: Request) {
  return createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
    global: {
      headers: {
        Authorization: req.headers.get("Authorization") ?? "",
      },
    },
  });
}

async function fetchTmdbJson(path: string): Promise<any> {
  const res = await fetch(`https://api.themoviedb.org/3${path}`, {
    headers: { Authorization: `Bearer ${TMDB_READ_TOKEN}` },
  });
  if (!res.ok) {
    console.warn("[swipe-trending] TMDb error:", res.status, path);
    return { results: [] };
  }
  return res.json();
}

async function upsertTmdbTitles(
  supabase: ReturnType<typeof createClient>,
  results: TmdbTitle[],
) {
  if (!results.length) return [];

  const rows = results.map((t) => {
    const mediaType: "movie" | "series" =
      t.media_type === "tv" ? "series" : "movie";

    const releaseDate = t.release_date || t.first_air_date || null;
    const year = releaseDate ? Number(releaseDate.slice(0, 4)) : null;

    return {
      id: `${mediaType}_${t.id}`,
      tmdb_id: t.id,
      type: mediaType,
      title: t.title ?? t.name ?? "Untitled",
      synopsis: t.overview ?? null,
      poster_url: t.poster_path
        ? `https://image.tmdb.org/t/p/w500${t.poster_path}`
        : null,
      backdrop_url: t.backdrop_path
        ? `https://image.tmdb.org/t/p/w780${t.backdrop_path}`
        : null,
      release_date: releaseDate,
      year,
      original_language: t.original_language ?? null,
    };
  });

  const { data, error } = await supabase
    .from("titles")
    .upsert(rows, { onConflict: "tmdb_id" })
    .select("id, tmdb_id");

  if (error) {
    console.error("[swipe-trending] upsertTmdbTitles error:", error.message);
    return [];
  }
  return data ?? [];
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

  if (!TMDB_READ_TOKEN || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error(
      "Missing required env vars: TMDB_API_READ_ACCESS_TOKEN, SUPABASE_URL, SERVICE_ROLE_KEY",
    );
    return new Response(JSON.stringify({ cards: [] }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = buildSupabaseClient(req);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const body = (await req.json().catch(() => ({}))) as RequestBody;
  const limit = body.limit && body.limit > 0 ? Math.min(body.limit, 60) : 40;

  const [trendingMovies, trendingTv] = await Promise.all([
    fetchTmdbJson("/trending/movie/week"),
    fetchTmdbJson("/trending/tv/week"),
  ]);

  let tmdbResults: TmdbTitle[] = [
    ...(trendingMovies.results ?? []).map((r: any) => ({
      ...(r as TmdbTitle),
      media_type: "movie",
    })),
    ...(trendingTv.results ?? []).map((r: any) => ({
      ...(r as TmdbTitle),
      media_type: "tv",
    })),
  ];

  tmdbResults = tmdbResults.slice(0, 120);

  const upserted = await upsertTmdbTitles(supabase, tmdbResults);
  const tmdbIds = upserted.map((r: any) => r.tmdb_id);

  if (!tmdbIds.length) {
    return new Response(JSON.stringify({ cards: [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: titles, error: titlesError } = await supabase
    .from("titles")
    .select(
      `
      id,
      title,
      year,
      type,
      poster_url,
      runtime_minutes,
      synopsis,
      title_stats (
        watch_count,
        ratings_count,
        avg_rating
      )
    `,
    )
    .in("tmdb_id", tmdbIds);

  if (titlesError) {
    console.error("[swipe-trending] titles error:", titlesError.message);
    return new Response(JSON.stringify({ cards: [] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const titleRows = (titles ?? []) as any[];
  const titleIds = titleRows.map((t) => t.id as string);

  const seenTitleIds = new Set<string>();

  if (user && titleIds.length) {
    const [{ data: userRatings }, { data: userLib }] = await Promise.all([
      supabase
        .from("ratings")
        .select("title_id")
        .eq("user_id", user.id)
        .in("title_id", titleIds),
      supabase
        .from("library_entries")
        .select("title_id, status")
        .eq("user_id", user.id)
        .in("title_id", titleIds),
    ]);

    for (const r of (userRatings ?? []) as any[]) {
      seenTitleIds.add(r.title_id as string);
    }

    for (const le of (userLib ?? []) as any[]) {
      const status = le.status as string;
      if (status === "watched" || status === "dropped") {
        seenTitleIds.add(le.title_id as string);
      }
    }
  }

  const cardsRaw: SwipeCardData[] = [];

  for (const t of titleRows) {
    const tId = t.id as string;

    if (user && seenTitleIds.has(tId)) continue;

    const synopsis: string | null = t.synopsis ?? null;
    const shortTagline =
      synopsis && synopsis.length > 110
        ? synopsis.slice(0, 107) + "…"
        : synopsis;

    const watchCount = (t.title_stats?.watch_count as number | null) ?? 0;

    cardsRaw.push({
      id: tId,
      title: (t.title as string | null) ?? "Untitled",
      year: (t.year as number | null) ?? null,
      runtimeMinutes: (t.runtime_minutes as number | null) ?? null,
      tagline: shortTagline,
      mood: null,
      vibeTag: null,
      type: (t.type as string | null) ?? null,
      posterUrl: (t.poster_url as string | null) ?? null,
      friendLikesCount: watchCount,
      topFriendName: null,
      topFriendInitials: null,
      topFriendReviewSnippet: null,
      initialRating: null,
      initiallyInWatchlist: false,
    });
  }

  cardsRaw.sort((a, b) => {
    const aPop = a.friendLikesCount ?? 0;
    const bPop = b.friendLikesCount ?? 0;
    if (bPop !== aPop) return bPop - aPop;

    const tA = titleRows.find((t) => t.id === a.id);
    const tB = titleRows.find((t) => t.id === b.id);
    const aRatings = (tA?.title_stats?.ratings_count as number | null) ?? 0;
    const bRatings = (tB?.title_stats?.ratings_count as number | null) ?? 0;
    return bRatings - aRatings;
  });

  const sliced = cardsRaw.slice(0, limit);

  return new Response(JSON.stringify({ cards: sliced }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
