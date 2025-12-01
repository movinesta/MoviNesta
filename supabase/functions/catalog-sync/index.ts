// supabase/functions/catalog-sync/index.ts

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const TMDB_TOKEN = Deno.env.get("TMDB_API_READ_ACCESS_TOKEN") ?? "";
const OMDB_API_KEY = Deno.env.get("OMDB_API_KEY") ?? "";
const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY") ?? "";

const TMDB_BASE = "https://api.themoviedb.org/3";
const OMDB_BASE = "https://www.omdbapi.com/";
const YT_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type CatalogSyncMode = "title" | "genres";

type TitleModePayload = {
  mode?: "title";
  external: {
    tmdbId?: number;
    imdbId?: string;
    type?: "movie" | "tv";
  };
  options?: {
    syncOmdb?: boolean;
    syncYoutube?: boolean;
    forceRefresh?: boolean;
  };
};

type GenresModePayload = {
  mode: "genres";
};

type CatalogSyncPayload = TitleModePayload | GenresModePayload;

function getSupabaseAdminClient(req: Request) {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    global: {
      headers: {
        Authorization: req.headers.get("Authorization") ?? "",
      },
    },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      console.error("[catalog-sync] Missing SUPABASE_URL or SERVICE_ROLE_KEY");
      return jsonError("Server misconfigured", 500);
    }

    const supabase = getSupabaseAdminClient(req);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("[catalog-sync] auth error:", authError.message);
      return jsonError("Unauthorized", 401);
    }

    if (!user) {
      return jsonError("Unauthorized", 401);
    }

    const body = (await req.json().catch(() => ({}))) as CatalogSyncPayload;
    const mode: CatalogSyncMode = body.mode ?? "title";

    switch (mode) {
      case "title":
        return await handleTitleMode(supabase, body as TitleModePayload);
      case "genres":
        return await handleGenresMode(supabase);
      default:
        return jsonError(`Unsupported mode: ${String(mode)}`, 400);
    }
  } catch (err) {
    console.error("[catalog-sync] unhandled error:", err);
    return jsonError("Internal server error", 500);
  }
});

async function handleTitleMode(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  payload: TitleModePayload,
): Promise<Response> {
  if (!TMDB_TOKEN) {
    console.error("[catalog-sync:title] Missing TMDB_API_READ_ACCESS_TOKEN");
    return jsonError("TMDb not configured", 500);
  }

  const { external, options } = payload;
  const { tmdbId: tmdbIdRaw, imdbId: imdbIdRaw, type: typeRaw } = external ?? {};

  if (!tmdbIdRaw && !imdbIdRaw) {
    return jsonError("Either external.tmdbId or external.imdbId is required", 400);
  }

  let tmdbId: number | null = tmdbIdRaw ?? null;
  let imdbId: string | null = imdbIdRaw ?? null;
  let contentType: "movie" | "tv" = typeRaw ?? "movie";

  if (!tmdbId && imdbId) {
    const resolved = await tmdbFindByImdbId(imdbId);
    if (!resolved) {
      return jsonError("Could not resolve TMDb id from IMDb id", 502);
    }
    tmdbId = resolved.id;
    contentType = resolved.media_type === "tv" ? "tv" : "movie";
  }

  if (!tmdbId) {
    return jsonError("Could not determine TMDb id", 500);
  }

  const tmdbDetails = await tmdbGetDetails(tmdbId, contentType);
  if (!tmdbDetails) {
    return jsonError("TMDb details fetch failed", 502);
  }

  if (!imdbId && tmdbDetails.imdb_id) {
    imdbId = String(tmdbDetails.imdb_id);
  }

  const tmdbBlock = buildTmdbBlock(tmdbDetails, contentType);

  let omdbBlock: OmdbBlock | null = null;
  if ((options?.syncOmdb ?? true) && OMDB_API_KEY && imdbId) {
    omdbBlock = await fetchOmdbBlock(imdbId);
  }

  let youtubeBlock: YoutubeBlock | null = null;
  if (options?.syncYoutube ?? true) {
    const titleForYoutube =
      omdbBlock?.omdb_title ??
      tmdbDetails.title ??
      tmdbDetails.name ??
      "";
    const yearForYoutube =
      omdbBlock?.omdb_year ??
      extractYear(tmdbDetails.release_date ?? tmdbDetails.first_air_date);

    youtubeBlock = await fetchYoutubeTrailerBlock(titleForYoutube, yearForYoutube);
  }

  const { data: existing, error: existingError } = await supabase
    .from("titles")
    .select(
      "title_id, tmdb_id, omdb_imdb_id, omdb_last_synced_at, youtube_last_synced_at",
    )
    .or(
      [
        tmdbId ? `tmdb_id.eq.${tmdbId}` : "",
        imdbId ? `omdb_imdb_id.eq.${imdbId}` : "",
      ]
        .filter(Boolean)
        .join(","),
    )
    .limit(1)
    .maybeSingle();

  if (existingError) {
    console.error("[catalog-sync:title] select existing error:", existingError.message);
    return jsonError("Database error", 500);
  }

  const now = new Date().toISOString();
  const titleId = existing?.title_id ?? crypto.randomUUID();

  const normalized = buildNormalizedFields({
    contentType,
    tmdb: tmdbBlock,
    omdb: omdbBlock,
    youtube: youtubeBlock,
  });

  const row: Record<string, any> = {
    title_id: titleId,
    content_type: contentType,
    ...normalized,
    ...tmdbBlock,
    ...omdbBlock,
    ...youtubeBlock,
    tmdb_last_synced_at: now,
    omdb_last_synced_at: omdbBlock ? now : existing?.omdb_last_synced_at ?? null,
    youtube_last_synced_at: youtubeBlock
      ? now
      : existing?.youtube_last_synced_at ?? null,
    updated_at: now,
  };

  const { data: upserted, error: upsertError } = await supabase
    .from("titles")
    .upsert(row, {
      onConflict: "tmdb_id,omdb_imdb_id",
    })
    .select("title_id, tmdb_id, omdb_imdb_id")
    .single();

  if (upsertError) {
    console.error("[catalog-sync:title] upsert error:", upsertError.message);
    return jsonError("Failed to upsert title", 500);
  }

  return jsonOk({
    ok: true,
    mode: "title",
    titleId: upserted.title_id,
    tmdbId: upserted.tmdb_id,
    imdbId,
  });
}

async function handleGenresMode(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
): Promise<Response> {
  if (!TMDB_TOKEN) {
    console.error("[catalog-sync:genres] Missing TMDB_API_READ_ACCESS_TOKEN");
    return jsonError("TMDb not configured", 500);
  }

  const [movieGenres, tvGenres] = await Promise.all([
    tmdbGetGenres("movie"),
    tmdbGetGenres("tv"),
  ]);

  if (!movieGenres && !tvGenres) {
    return jsonError("Failed to fetch genres from TMDb", 502);
  }

  const now = new Date().toISOString();

  const rows = [
    ...(movieGenres ?? []).map((g) => ({
      tmdb_id: g.id,
      name: g.name,
      kind: "movie",
      updated_at: now,
    })),
    ...(tvGenres ?? []).map((g) => ({
      tmdb_id: g.id,
      name: g.name,
      kind: "tv",
      updated_at: now,
    })),
  ];

  if (!rows.length) {
    return jsonOk({ ok: true, mode: "genres", updated: 0 });
  }

  const { error } = await supabase
    .from("genres")
    .upsert(rows, { onConflict: "tmdb_id,kind" });

  if (error) {
    console.error("[catalog-sync:genres] upsert error:", error.message);
    return jsonError("Failed to upsert genres", 500);
  }

  return jsonOk({ ok: true, mode: "genres", updated: rows.length });
}

async function tmdbRequest(path: string, params: Record<string, string> = {}) {
  const url = new URL(TMDB_BASE + path);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${TMDB_TOKEN}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    console.error("[TMDb] request failed", res.status, await res.text());
    return null;
  }
  return await res.json();
}

async function tmdbFindByImdbId(imdbId: string): Promise<
  | {
      id: number;
      media_type: "movie" | "tv";
    }
  | null
> {
  const data = await tmdbRequest(`/find/${encodeURIComponent(imdbId)}`, {
    external_source: "imdb_id",
  });
  if (!data) return null;

  if (Array.isArray(data.movie_results) && data.movie_results.length > 0) {
    return { id: data.movie_results[0].id, media_type: "movie" };
  }
  if (Array.isArray(data.tv_results) && data.tv_results.length > 0) {
    return { id: data.tv_results[0].id, media_type: "tv" };
  }
  return null;
}

async function tmdbGetDetails(
  tmdbId: number,
  type: "movie" | "tv",
): Promise<any | null> {
  const path = type === "tv" ? `/tv/${tmdbId}` : `/movie/${tmdbId}`;
  return await tmdbRequest(path, {
    append_to_response: "credits,release_dates",
  });
}

async function tmdbGetGenres(
  type: "movie" | "tv",
): Promise<{ id: number; name: string }[] | null> {
  const path = type === "movie" ? "/genre/movie/list" : "/genre/tv/list";
  const data = await tmdbRequest(path, { language: "en-US" });
  if (!data || !Array.isArray(data.genres)) return null;
  return data.genres;
}

type TmdbBlock = Record<string, any>;

function buildTmdbBlock(details: any, type: "movie" | "tv"): TmdbBlock {
  if (!details) return {};

  const posterPath = details.poster_path ?? null;
  const backdropPath = details.backdrop_path ?? null;

  const genresArray: string[] =
    Array.isArray(details.genres) && details.genres.length
      ? details.genres.map((g: any) => String(g.name))
      : [];

  return {
    tmdb_id: details.id ?? null,
    tmdb_media_type: type,
    tmdb_original_title:
      details.original_title ?? details.original_name ?? null,
    tmdb_poster_path: posterPath,
    tmdb_backdrop_path: backdropPath,
    tmdb_popularity: details.popularity ?? null,
    tmdb_vote_average: details.vote_average ?? null,
    tmdb_vote_count: details.vote_count ?? null,
    tmdb_release_date: details.release_date ?? null,
    tmdb_first_air_date: details.first_air_date ?? null,
    tmdb_runtime: details.runtime ?? null,
    tmdb_episode_run_time: details.episode_run_time ?? null,
    tmdb_overview: details.overview ?? null,
    tmdb_raw: details,
    tmdb_title: details.title ?? details.name ?? null,
    tmdb_genre_names: genresArray,
  };
}

type OmdbBlock = Record<string, any>;

async function fetchOmdbBlock(imdbId: string): Promise<OmdbBlock | null> {
  if (!OMDB_API_KEY) return null;

  const url = new URL(OMDB_BASE);
  url.searchParams.set("apikey", OMDB_API_KEY);
  url.searchParams.set("i", imdbId);
  url.searchParams.set("plot", "full");

  const res = await fetch(url.toString());
  if (!res.ok) {
    console.error("[OMDb] request failed", res.status, await res.text());
    return null;
  }
  const data = await res.json();
  if (data.Response === "False") {
    console.warn("[OMDb] Response false:", data.Error);
    return null;
  }

  const imdbRating = parseFloatSafe(data.imdbRating);
  const imdbVotes = parseIntSafe(data.imdbVotes);
  const rtPct = extractRottenTomatoesPct(data.Ratings);
  const metascore = parseIntSafe(data.Metascore);

  const runtimeMinutes = parseIntSafe(
    typeof data.Runtime === "string" ? data.Runtime.replace(" min", "") : "",
  );

  const genresArray: string[] =
    typeof data.Genre === "string" && data.Genre.length
      ? data.Genre.split(",").map((g: string) => g.trim())
      : [];

  return {
    omdb_imdb_id: data.imdbID ?? imdbId,
    omdb_title: data.Title ?? null,
    omdb_year: parseIntSafe(data.Year),
    omdb_runtime_minutes: runtimeMinutes,
    omdb_plot: data.Plot ?? null,
    omdb_poster_url: data.Poster && data.Poster !== "N/A" ? data.Poster : null,
    omdb_imdb_rating: imdbRating,
    omdb_imdb_votes: imdbVotes,
    omdb_rt_rating_pct: rtPct,
    omdb_metacritic_score: metascore,
    omdb_genre_names: genresArray,
    omdb_raw: data,
  };
}

function extractRottenTomatoesPct(ratings: any): number | null {
  if (!Array.isArray(ratings)) return null;
  const rt = ratings.find(
    (r: any) => r.Source === "Rotten Tomatoes" && typeof r.Value === "string",
  );
  if (!rt) return null;
  const match = (rt.Value as string).match(/(\d+)%/);
  return match ? parseIntSafe(match[1]) : null;
}

type YoutubeBlock = Record<string, any>;

async function fetchYoutubeTrailerBlock(
  title: string,
  year: number | null,
): Promise<YoutubeBlock | null> {
  if (!YOUTUBE_API_KEY || !title) return null;

  const query = year
    ? `${title} official trailer ${year}`
    : `${title} official trailer`;

  const url = new URL(YT_SEARCH_URL);
  url.searchParams.set("key", YOUTUBE_API_KEY);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("maxResults", "1");
  url.searchParams.set("q", query);

  const res = await fetch(url.toString());
  if (!res.ok) {
    console.error("[YouTube] request failed", res.status, await res.text());
    return null;
  }
  const data = await res.json();

  const item =
    Array.isArray(data.items) && data.items.length ? data.items[0] : null;

  if (!item?.id?.videoId) return null;

  const videoId = item.id.videoId;
  const urlFull = `https://www.youtube.com/watch?v=${videoId}`;

  return {
    youtube_trailer_video_id: videoId,
    youtube_trailer_url: urlFull,
    youtube_trailer_query: query,
    youtube_raw: item,
  };
}

function buildNormalizedFields({
  contentType,
  tmdb,
  omdb,
  youtube,
}: {
  contentType: "movie" | "tv";
  tmdb: TmdbBlock;
  omdb: OmdbBlock | null;
  youtube?: YoutubeBlock | null;
}) {
  const primary_title =
    omdb?.omdb_title ??
    tmdb.tmdb_title ??
    tmdb.tmdb_original_title ??
    null;

  const original_title = tmdb.tmdb_original_title ?? omdb?.omdb_title ?? null;

  const release_year =
    omdb?.omdb_year ??
    extractYear(
      tmdb.tmdb_release_date ??
        (contentType === "tv" ? tmdb.tmdb_first_air_date : null),
    );

  const runtime_minutes =
    omdb?.omdb_runtime_minutes ??
    (typeof tmdb.tmdb_runtime === "number"
      ? tmdb.tmdb_runtime
      : Array.isArray(tmdb.tmdb_episode_run_time) &&
          tmdb.tmdb_episode_run_time.length
        ? tmdb.tmdb_episode_run_time[0]
        : null);

  const plot = omdb?.omdb_plot ?? tmdb.tmdb_overview ?? null;

  const poster_url =
    omdb?.omdb_poster_url ??
    (tmdb.tmdb_poster_path
      ? `https://image.tmdb.org/t/p/w500${tmdb.tmdb_poster_path}`
      : null);

  const backdrop_url =
    tmdb.tmdb_backdrop_path
      ? `https://image.tmdb.org/t/p/w780${tmdb.tmdb_backdrop_path}`
      : null;

  const imdb_rating = omdb?.omdb_imdb_rating ?? null;
  const imdb_votes = omdb?.omdb_imdb_votes ?? null;
  const rt_tomato_pct = omdb?.omdb_rt_rating_pct ?? null;
  const metascore = omdb?.omdb_metacritic_score ?? null;

  const genresSet = new Set<string>();
  if (Array.isArray(omdb?.omdb_genre_names)) {
    for (const g of omdb!.omdb_genre_names) genresSet.add(g);
  }
  if (Array.isArray(tmdb.tmdb_genre_names)) {
    for (const g of tmdb.tmdb_genre_names) genresSet.add(g);
  }
  const genres = Array.from(genresSet);

  return {
    primary_title,
    original_title,
    release_year,
    runtime_minutes,
    plot,
    poster_url,
    backdrop_url,
    imdb_rating,
    imdb_votes,
    rt_tomato_pct,
    metascore,
    genres,
  };
}

function parseFloatSafe(value: any): number | null {
  const n = parseFloat(String(value).replace(",", ""));
  return Number.isFinite(n) ? n : null;
}

function parseIntSafe(value: any): number | null {
  const n = parseInt(String(value).replace(/,/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

function extractYear(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const match = dateStr.match(/^(\d{4})/);
  return match ? parseIntSafe(match[1]) : null;
}

function jsonOk(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function jsonError(message: string, status = 400): Response {
  return jsonOk({ ok: false, error: message }, status);
}
