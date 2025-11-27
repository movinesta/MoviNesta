// supabase/functions/sync-title-metadata/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const TMDB_READ_TOKEN = Deno.env.get("TMDB_API_READ_ACCESS_TOKEN");
const OMDB_API_KEY = Deno.env.get("OMDB_API_KEY");

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

async function fetchTmdbJson(path: string) {
  if (!TMDB_READ_TOKEN) {
    console.error("[sync-title-metadata] Missing TMDB_READ_TOKEN");
    return null;
  }

  const res = await fetch(`https://api.themoviedb.org/3${path}`, {
    headers: {
      Authorization: `Bearer ${TMDB_READ_TOKEN}`,
      "Content-Type": "application/json;charset=utf-8",
    },
  });

  if (!res.ok) {
    console.error(
      "[sync-title-metadata] TMDb error",
      res.status,
      await res.text(),
    );
    return null;
  }

  return await res.json();
}

async function fetchOmdbByImdbId(imdbId: string) {
  if (!OMDB_API_KEY) {
    console.error("[sync-title-metadata] Missing OMDB_API_KEY");
    return null;
  }

  const url = new URL("https://www.omdbapi.com/");
  url.searchParams.set("apikey", OMDB_API_KEY);
  url.searchParams.set("i", imdbId);
  url.searchParams.set("plot", "short");

  const res = await fetch(url.toString());
  if (!res.ok) {
    console.error(
      "[sync-title-metadata] OMDb error",
      res.status,
      await res.text(),
    );
    return null;
  }

  const json = await res.json();
  if (json.Response === "False") {
    console.warn(
      "[sync-title-metadata] OMDb returned failure:",
      json.Error,
    );
    return null;
  }

  return json;
}

// Embeddings DISABLED: this is a no-op.
// We always return null so nothing is written into title_embeddings.
async function createEmbedding(input: string): Promise<number[] | null> {
  // Embeddings disabled: skip OpenAI completely.
  return null;
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
    console.error("[sync-title-metadata] SUPABASE env missing");
    return new Response("Server misconfigured", {
      status: 500,
      headers: corsHeaders,
    });
  }

  const supabase = buildSupabaseClient(req);

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return new Response("Unauthorized", {
      status: 401,
      headers: corsHeaders,
    });
  }

  const body = (await req.json().catch(() => ({}))) as {
    tmdbId?: number;
    imdbId?: string;
    type?: "movie" | "tv";
  };

  let { tmdbId, imdbId, type } = body;
  if (!type) type = "movie";

  if (!tmdbId && !imdbId) {
    return new Response("Missing tmdbId or imdbId", {
      status: 400,
      headers: corsHeaders,
    });
  }

  // 1. If we only have IMDb ID, resolve to TMDb via /find
  if (!tmdbId && imdbId) {
    const findPath = `/find/${encodeURIComponent(
      imdbId,
    )}?external_source=imdb_id`;
    const found = await fetchTmdbJson(findPath);
    if (!found) {
      return new Response("TMDb find failed", {
        status: 502,
        headers: corsHeaders,
      });
    }
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

  // 2b. Ensure we always have a non-null title id
  // Try to find an existing title row by tmdb_id or imdb_id, otherwise generate a new id.
  let titleId: string | null = null;

  if (tmdbId) {
    const { data: existingByTmdb } = await supabase
      .from("titles")
      .select("id")
      .eq("tmdb_id", tmdbId)
      .maybeSingle();

    if (existingByTmdb?.id) {
      titleId = existingByTmdb.id as string;
    }
  }

  if (!titleId && imdbId) {
    const { data: existingByImdb } = await supabase
      .from("titles")
      .select("id")
      .eq("imdb_id", imdbId)
      .maybeSingle();

    if (existingByImdb?.id) {
      titleId = existingByImdb.id as string;
    }
  }

  if (!titleId) {
    titleId = crypto.randomUUID();
  }

  const row = {
    id: titleId,
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

  const { data: upsertedTitle, error: upsertError } = await supabase
    .from("titles")
    .upsert(row, { onConflict: "id" })
    .select("id, imdb_id")
    .single();

  if (upsertError || !upsertedTitle) {
    console.error(
      "[sync-title-metadata] upsert titles error:",
      upsertError?.message,
    );
    return new Response("DB error", {
      status: 500,
      headers: corsHeaders,
    });
  }

  const { id: titleIdFinal, imdb_id: storedImdbId } = upsertedTitle;

  // 3. External ratings from OMDb
  if (storedImdbId) {
    const omdb = await fetchOmdbByImdbId(storedImdbId);
    if (omdb) {
      const imdbRating =
        omdb.imdbRating && omdb.imdbRating !== "N/A"
          ? Number(omdb.imdbRating)
          : null;
      const imdbVotes =
        omdb.imdbVotes && omdb.imdbVotes !== "N/A"
          ? Number(omdb.imdbVotes.replace(/,/g, ""))
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
          const score = Number(scoreStr);
          if (!Number.isNaN(score)) {
            metacriticScore = score;
          }
        }
      }

      const extRow = {
        title_id: titleIdFinal,
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

  // 4. Embedding (disabled – createEmbedding always returns null)
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
            title_id: titleIdFinal,
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
    JSON.stringify({ ok: true, titleId: titleIdFinal, imdbId: storedImdbId }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
