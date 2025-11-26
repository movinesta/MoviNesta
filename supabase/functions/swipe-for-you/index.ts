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

async function fetchTmdbJson(path: string): Promise<any> {
  const res = await fetch(`https://api.themoviedb.org/3${path}`, {
    headers: { Authorization: `Bearer ${TMDB_READ_TOKEN}` },
  });
  if (!res.ok) {
    console.warn("[swipe-for-you] TMDb error:", res.status, path);
    return { results: [] };
  }
  return res.json();
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
    console.error("[swipe-for-you] upsertTmdbTitles error:", error.message);
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
  const limit = body.limit && body.limit > 0 ? Math.min(body.limit, 60) : 40;

  const { data: liked, error: likedError } = await supabase
    .from("ratings")
    .select(
      `
      title_id,
      rating,
      titles!inner (
        tmdb_id,
        type
      )
    `,
    )
    .eq("user_id", user.id)
    .gte("rating", 3.5)
    .order("updated_at", { ascending: false })
    .limit(20);

  if (likedError) {
    console.error("[swipe-for-you] error loading liked ratings:", likedError);
  }

  const seeds =
    (liked ?? [])
      .map((row: any) => {
        const tmdb_id = row.titles?.tmdb_id as number | null;
        const type = row.titles?.type as string | null;
        if (!tmdb_id || !type) return null;
        return {
          tmdb_id,
          type: type === "series" ? "series" : "movie" as "series" | "movie",
        };
      })
      .filter(Boolean) as { tmdb_id: number; type: "movie" | "series" }[];

  let tmdbResults: TmdbTitle[] = [];

  if (seeds.length) {
    const uniqueSeeds = seeds.slice(0, 6);

    const similarPayloads = await Promise.all(
      uniqueSeeds.map((seed) => {
        const path =
          seed.type === "movie"
            ? `/movie/${seed.tmdb_id}/similar`
            : `/tv/${seed.tmdb_id}/similar`;
        return fetchTmdbJson(path);
      }),
    );

    tmdbResults = similarPayloads.flatMap((p) => (p?.results ?? []) as TmdbTitle[]);
  }

  if (!tmdbResults.length) {
    const [trendingMovies, trendingTv] = await Promise.all([
      fetchTmdbJson("/trending/movie/week"),
      fetchTmdbJson("/trending/tv/week"),
    ]);

    tmdbResults = [
      ...(trendingMovies.results ?? []).map((r: any) => ({
        ...(r as TmdbTitle),
        media_type: "movie",
      })),
      ...(trendingTv.results ?? []).map((r: any) => ({
        ...(r as TmdbTitle),
        media_type: "tv",
      })),
    ];
  }

  tmdbResults = tmdbResults.slice(0, 120);

  const upserted = await upsertTmdbTitles(supabase, tmdbResults);
  const tmdbIds = upserted.map((r: any) => r.tmdb_id);

  if (!tmdbIds.length) {
    return new Response(JSON.stringify({ cards: [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: rows, error: titlesError } = await supabase
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
        avg_rating,
        ratings_count,
        watch_count
      ),
      ratings (
        rating,
        user_id
      ),
      library_entries (
        status,
        user_id
      )
    `,
    )
    .in("tmdb_id", tmdbIds);

  if (titlesError) {
    console.error("[swipe-for-you] error loading titles:", titlesError);
    return new Response(JSON.stringify({ cards: [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const nowRows = (rows ?? []) as any[];

  const unseen = nowRows.filter((row) => {
    const ratingRow = (row.ratings ?? [])[0] as { rating: number } | undefined;
    const libraryRow = (row.library_entries ?? [])[0] as
      | { status: string }
      | undefined;

    const hasRating = !!ratingRow;
    const libStatus = libraryRow?.status ?? null;
    const isFinished =
      libStatus === "watched" || libStatus === "dropped" || libStatus === "watching";

    return !hasRating && !isFinished;
  });

  unseen.sort((a, b) => {
    const aStats = a.title_stats ?? {};
    const bStats = b.title_stats ?? {};
    const aWatch = (aStats.watch_count as number | null) ?? 0;
    const bWatch = (bStats.watch_count as number | null) ?? 0;
    const aAvg = Number((aStats.avg_rating as number | null) ?? 0);
    const bAvg = Number((bStats.avg_rating as number | null) ?? 0);
    return bWatch - aWatch || bAvg - aAvg;
  });

  const sliced = unseen.slice(0, limit);

  const cards: SwipeCardData[] = sliced.map((row) => {
    const ratingRow = (row.ratings ?? [])[0] as { rating?: number } | undefined;
    const libraryRow = (row.library_entries ?? [])[0] as
      | { status?: string }
      | undefined;

    const synopsis: string | null = row.synopsis ?? null;
    const shortTagline =
      synopsis && synopsis.length > 110
        ? synopsis.slice(0, 107) + "…"
        : synopsis;

    return {
      id: row.id as string,
      title: (row.title as string | null) ?? "Untitled",
      year: (row.year as number | null) ?? null,
      runtimeMinutes: (row.runtime_minutes as number | null) ?? null,
      tagline: shortTagline,
      mood: null,
      vibeTag: null,
      type: (row.type as string | null) ?? null,
      posterUrl: (row.poster_url as string | null) ?? null,
      friendLikesCount: null,
      topFriendName: null,
      topFriendInitials: null,
      topFriendReviewSnippet: null,
      initialRating: ratingRow?.rating ?? null,
      initiallyInWatchlist: libraryRow?.status === "want_to_watch",
    };
  });

  return new Response(JSON.stringify({ cards }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
