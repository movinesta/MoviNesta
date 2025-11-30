// supabase/functions/sync-title-metadata/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { syncExternalRatingsForTitles } from "../_shared/externalRatings.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const TMDB_READ_TOKEN = Deno.env.get("TMDB_API_READ_ACCESS_TOKEN");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type AllowedRequestType = "movie" | "tv" | "series" | string | undefined;

function normalizeTmdbMediaType(type: AllowedRequestType): "movie" | "tv" {
  const normalized = typeof type === "string" ? type.toLowerCase() : "";
  return normalized === "tv" || normalized === "series" ? "tv" : "movie";
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
    type?: AllowedRequestType;
  };

  let { tmdbId, imdbId, type } = body;
  const tmdbMediaType = normalizeTmdbMediaType(type);

  if (!tmdbId && !imdbId) {
    return new Response("Missing tmdbId or imdbId", {
      status: 400,
      headers: corsHeaders,
    });
  }

  if (!tmdbId && imdbId) {
    const findPath = `/find/${encodeURIComponent(imdbId)}?external_source=imdb_id`;
    const found = await fetchTmdbJson(findPath);
    if (!found) {
      return new Response("TMDb find failed", {
        status: 502,
        headers: corsHeaders,
      });
    }
    const result =
      tmdbMediaType === "tv" ? found?.tv_results?.[0] : found?.movie_results?.[0];
    if (result?.id) tmdbId = result.id;
  }

  if (!tmdbId) {
    return new Response("Could not resolve TMDb ID", {
      status: 400,
      headers: corsHeaders,
    });
  }

  const tmdbPath = tmdbMediaType === "tv" ? `/tv/${tmdbId}` : `/movie/${tmdbId}`;
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
  const year = releaseDate ? Number(String(releaseDate).slice(0, 4)) : null;
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

  let titleId: string | null = null;

  if (tmdbId) {
    const { data: existingByTmdb } = await supabase
      .from("titles")
      .select("title_id")
      .eq("tmdb_id", tmdbId)
      .maybeSingle();

    if (existingByTmdb?.title_id) {
      titleId = existingByTmdb.title_id as string;
    }
  }

  if (!titleId && imdbId) {
    const { data: existingByImdb } = await supabase
      .from("titles")
      .select("title_id")
      .eq("omdb_imdb_id", imdbId)
      .maybeSingle();

    if (existingByImdb?.title_id) {
      titleId = existingByImdb.title_id as string;
    }
  }

  if (!titleId) {
    titleId = crypto.randomUUID();
  }

  const storedType = type ?? (tmdbMediaType === "tv" ? "series" : "movie");

  const genres = Array.isArray(tmdb.genres)
    ? tmdb.genres.map((g: any) => g.name).filter(Boolean)
    : [];

  const row = {
    title_id: titleId,
    content_type: storedType,
    primary_title: title,
    original_title: tmdb.original_title ?? tmdb.original_name ?? null,
    sort_title: title,
    release_year: year,
    release_date: releaseDate,
    runtime_minutes: runtimeMinutes,
    language: originalLanguage,
    poster_url: posterUrl,
    backdrop_url: backdropUrl,
    plot: overview,
    genres: genres.length ? genres : null,
    omdb_imdb_id: imdbId,
    tmdb_id: tmdbId,
    tmdb_title: tmdb.title ?? tmdb.name ?? null,
    tmdb_original_title: tmdb.original_title ?? tmdb.original_name ?? null,
    tmdb_original_language: tmdb.original_language ?? null,
    tmdb_popularity: tmdbPopularity,
    tmdb_vote_average: tmdbVoteAverage,
    tmdb_vote_count: tmdbVoteCount,
    tmdb_release_date: releaseDate,
    tmdb_poster_path: tmdb.poster_path ?? null,
    tmdb_backdrop_path: tmdb.backdrop_path ?? null,
    data_source: "tmdb",
    raw_payload: tmdb,
  } as const;

  const { data: upsertedTitle, error: upsertError } = await supabase
    .from("titles")
    .upsert(row, { onConflict: "title_id" })
    .select("title_id, omdb_imdb_id, content_type")
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

  await syncExternalRatingsForTitles(supabase, [
    {
      title_id: upsertedTitle.title_id as string,
      omdb_imdb_id: imdbId,
      tmdb_id: tmdbId ?? null,
      content_type: upsertedTitle.content_type as string,
      imdb_rating: null,
      omdb_rt_rating_pct: null,
      imdb_votes: null,
      last_synced_at: null,
    },
  ]);

  return new Response(
    JSON.stringify({ ok: true, titleId: upsertedTitle.title_id, imdbId: imdbId ?? null }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
