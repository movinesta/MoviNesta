
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const TMDB_READ_TOKEN = Deno.env.get("TMDB_API_READ_ACCESS_TOKEN");
const OMDB_API_KEY = Deno.env.get("OMDB_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

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

async function fetchTmdbJson(path: string): Promise<any> {
  const res = await fetch(`https://api.themoviedb.org/3${path}`, {
    headers: { Authorization: `Bearer ${TMDB_READ_TOKEN}` },
  });
  if (!res.ok) {
    console.warn("[sync-title-metadata] TMDb error:", res.status, path);
    return null;
  }
  return res.json();
}

async function fetchOmdbByImdbId(imdbId: string): Promise<any | null> {
  if (!OMDB_API_KEY || !imdbId) return null;
  const url = new URL("https://www.omdbapi.com/");
  url.searchParams.set("apikey", OMDB_API_KEY);
  url.searchParams.set("i", imdbId);
  url.searchParams.set("plot", "short");
  url.searchParams.set("tomatoes", "true");
  url.searchParams.set("r", "json");

  const res = await fetch(url.toString());
  if (!res.ok) {
    console.warn("[sync-title-metadata] OMDb error:", res.status);
    return null;
  }
  const data = await res.json();
  if (data.Response === "False") return null;
  return data;
}

async function createEmbedding(input: string): Promise<number[] | null> {
  if (!OPENAI_API_KEY) return null;

  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input,
    }),
  });

  if (!res.ok) {
    console.error("[sync-title-metadata] OpenAI error:", await res.text());
    return null;
  }

  const json = await res.json();
  const [item] = json.data ?? [];
  return item?.embedding ?? null;
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

  if (
    !SUPABASE_URL ||
    !SERVICE_ROLE_KEY ||
    !TMDB_READ_TOKEN ||
    !OMDB_API_KEY
  ) {
    console.error("[sync-title-metadata] Missing required env vars");
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

  type Body = {
    tmdbId?: number;
    imdbId?: string;
    type?: "movie" | "tv";
  };

  const body = (await req.json().catch(() => ({}))) as Body;
  let { tmdbId, imdbId, type } = body;

  if (!tmdbId && !imdbId) {
    return new Response("tmdbId or imdbId required", {
      status: 400,
      headers: corsHeaders,
    });
  }

  type = type ?? "movie";

  // 1. If we only have IMDb ID, use TMDb /find to get TMDb ID
  if (!tmdbId && imdbId) {
    const found = await fetchTmdbJson(
      `/find/${imdbId}?external_source=imdb_id`,
    );
    const result =
      type === "tv" ? found?.tv_results?.[0] : found?.movie_results?.[0];
    if (result?.id) tmdbId = result.id;
  }

  if (!tmdbId) {
    return new Response("Could not resolve TMDb ID", {
      status: 400,
      headers: corsHeaders,
    });
  }

  // 2. Fetch TMDb details
  const tmdbPath = type === "tv" ? `/tv/${tmdbId}` : `/movie/${tmdbId}`;
  const tmdb = await fetchTmdbJson(tmdbPath);
  if (!tmdb) {
    return new Response("TMDb fetch failed", {
      status: 502,
      headers: corsHeaders,
    });
  }

  const title = tmdb.title ?? tmdb.name ?? "Untitled";
  const overview = tmdb.overview ?? null;
  const releaseDate = tmdb.release_date ?? tmdb.first_air_date ?? null;
  const year = releaseDate ? Number(releaseDate.slice(0, 4)) : null;
  const runtimeMinutes =
    (tmdb.runtime as number | undefined) ??
    (Array.isArray(tmdb.episode_run_time) && tmdb.episode_run_time[0]) ??
    null;
  const originalLanguage = tmdb.original_language ?? null;
  const tmdbPopularity = tmdb.popularity ?? null;
  const tmdbVoteAverage = tmdb.vote_average ?? null;
  const tmdbVoteCount = tmdb.vote_count ?? null;
  imdbId = imdbId ?? tmdb.imdb_id ?? null;

  const posterUrl = tmdb.poster_path
    ? `https://image.tmdb.org/t/p/w500${tmdb.poster_path}`
    : null;
  const backdropUrl = tmdb.backdrop_path
    ? `https://image.tmdb.org/t/p/w780${tmdb.backdrop_path}`
    : null;

  const row = {
    title,
    type,
    year,
    synopsis: overview,
    runtime_minutes: runtimeMinutes,
    release_date: releaseDate,
    original_language: originalLanguage,
    imdb_id: imdbId,
    tmdb_id: tmdbId,
    poster_url: posterUrl,
    backdrop_url: backdropUrl,
    tmdb_popularity: tmdbPopularity,
    tmdb_vote_average: tmdbVoteAverage,
    tmdb_vote_count: tmdbVoteCount,
  };

  const { data: upsertedTitles, error: upsertError } = await supabase
    .from("titles")
    .upsert(row, { onConflict: "tmdb_id" })
    .select("id, imdb_id")
    .limit(1);

  if (upsertError || !upsertedTitles?.[0]) {
    console.error(
      "[sync-title-metadata] upsert titles error:",
      upsertError?.message,
    );
    return new Response("DB error", {
      status: 500,
      headers: corsHeaders,
    });
  }

  const { id: titleId, imdb_id: storedImdbId } = upsertedTitles[0];

  // 3. External ratings from OMDb
  if (storedImdbId) {
    const omdb = await fetchOmdbByImdbId(storedImdbId);
    if (omdb) {
      const imdbRating = omdb.imdbRating ? Number(omdb.imdbRating) : null;
      const imdbVotes = omdb.imdbVotes
        ? Number((omdb.imdbVotes as string).replace(/,/g, ""))
        : null;

      let rtMeter: number | null = null;
      let metacriticScore: number | null = null;

      const ratings = (omdb.Ratings ?? []) as Array<{
        Source: string;
        Value: string;
      }>;

      for (const r of ratings) {
        if (r.Source === "Rotten Tomatoes") {
          const pct = r.Value.endsWith("%")
            ? Number(r.Value.replace("%", ""))
            : null;
          rtMeter = pct;
        } else if (r.Source === "Metacritic") {
          const [scoreStr] = r.Value.split("/");
          metacriticScore = scoreStr ? Number(scoreStr) : null;
        }
      }

      const extRow = {
        title_id: titleId,
        imdb_rating: imdbRating,
        imdb_votes: imdbVotes,
        rt_tomato_meter: rtMeter,
        rt_tomato_rating: null,
        rt_tomato_user_meter: null,
        rt_tomato_user_rating: null,
        metacritic_score: metacriticScore,
        last_synced_at: new Date().toISOString(),
      };

      const { error: extError } = await supabase
        .from("external_ratings")
        .upsert(extRow, { onConflict: "title_id" });

      if (extError) {
        console.error(
          "[sync-title-metadata] upsert external_ratings error:",
          extError.message,
        );
      }
    }
  }

  // 4. Embedding generation (optional but recommended)
  try {
    const genres =
      tmdb.genres?.map((g: any) => g.name).join(", ") ?? "";
    const inputText = [
      `${title} (${year ?? ""})`,
      genres ? `Genres: ${genres}` : "",
      overview ?? "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const embedding = await createEmbedding(inputText);
    if (embedding) {
      const { error: embError } = await supabase
        .from("title_embeddings")
        .upsert(
          {
            title_id: titleId,
            embedding,
            source: "tmdb+omdb",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "title_id" },
        );

      if (embError) {
        console.error(
          "[sync-title-metadata] upsert title_embeddings error:",
          embError.message,
        );
      }
    }
  } catch (err) {
    console.error("[sync-title-metadata] embedding error:", err);
  }

  return new Response(
    JSON.stringify({ ok: true, titleId, imdbId: storedImdbId }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
