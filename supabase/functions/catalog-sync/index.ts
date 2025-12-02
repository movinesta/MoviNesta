// supabase/functions/catalog-sync/index.ts

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TMDB_API_READ_ACCESS_TOKEN = Deno.env.get("TMDB_API_READ_ACCESS_TOKEN")!;

type ContentType = "movie" | "series";

interface ExternalInput {
  tmdbId?: number;
  imdbId?: string;
  type?: "movie" | "series" | "tv";
}

interface OptionsInput {
  syncOmdb?: boolean;
  forceRefresh?: boolean;
  reason?: string;
}

// This is the main shape expected from callers like backfill and _shared/catalog-sync.ts:
// {
//   external: { tmdbId, imdbId, type },
//   options:  { syncOmdb, forceRefresh, reason }
// }
//
// But we also gracefully support flat bodies:
// { tmdbId, imdbId, contentType, options }

interface CatalogSyncRequestBody {
  external?: ExternalInput;
  options?: OptionsInput;
  tmdbId?: number;
  imdbId?: string;
  contentType?: string;
  type?: string;
}

function getAdminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
    },
  });
}

function normalizeExternal(body: CatalogSyncRequestBody) {
  let external: ExternalInput | undefined = body.external;
  const options: OptionsInput = body.options ?? {};

  if (!external) {
    external = {
      tmdbId: body.tmdbId,
      imdbId: body.imdbId,
      type: (body.contentType as any) ?? (body.type as any),
    };
  }

  if (!external) {
    throw new Error("Missing external input");
  }

  const tmdbId =
    typeof external.tmdbId === "number"
      ? external.tmdbId
      : body.tmdbId && typeof body.tmdbId === "number"
      ? body.tmdbId
      : undefined;

  const imdbId =
    typeof external.imdbId === "string" && external.imdbId.trim().length > 0
      ? external.imdbId.trim()
      : typeof body.imdbId === "string"
      ? body.imdbId.trim()
      : undefined;

  let type: ContentType;
  const rawType: string | undefined =
    (external.type as string | undefined) ??
    (body.contentType as string | undefined) ??
    (body.type as string | undefined);

  if (rawType === "tv" || rawType === "series") {
    type = "series";
  } else {
    // Default to movie if unknown
    type = "movie";
  }

  if (!tmdbId && !imdbId) {
    throw new Error("At least one of tmdbId or imdbId must be provided");
  }

  return { tmdbId, imdbId, type, options };
}

async function fetchTmdbDetails(tmdbId: number, type: ContentType) {
  if (!TMDB_API_READ_ACCESS_TOKEN) {
    throw new Error("TMDB_API_READ_ACCESS_TOKEN is not configured");
  }

  const url =
    type === "movie"
      ? `https://api.themoviedb.org/3/movie/${tmdbId}`
      : `https://api.themoviedb.org/3/tv/${tmdbId}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${TMDB_API_READ_ACCESS_TOKEN}`,
      "Content-Type": "application/json;charset=utf-8",
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(
      "[catalog-sync] TMDb fetch error",
      type,
      tmdbId,
      res.status,
      text,
    );
    throw new Error(
      `TMDb fetch error for ${type} ${tmdbId}: ${res.status}`,
    );
  }

  const json = await res.json();
  return json as any;
}

async function upsertTitleAndDetails(params: {
  supabase: ReturnType<typeof getAdminClient>;
  type: ContentType;
  tmdbId?: number;
  imdbId?: string;
  tmdbRaw: any;
  options: OptionsInput;
}) {
  const { supabase, type, tmdbId, imdbId, tmdbRaw } = params;

  const now = new Date().toISOString();

  // Basic mapping from TMDb payload into your titles schema
  const isMovie = type === "movie";

  const genres =
    Array.isArray(tmdbRaw.genres) && tmdbRaw.genres.length
      ? tmdbRaw.genres.map((g: any) => g.name).filter(Boolean)
      : null;

  const payload: Record<string, any> = {
    content_type: isMovie ? "movie" : "series",
    tmdb_id: tmdbId ?? null,
    omdb_imdb_id: imdbId ?? tmdbRaw.imdb_id ?? null,
    primary_title: isMovie ? tmdbRaw.title ?? null : tmdbRaw.name ?? null,
    original_title: isMovie
      ? tmdbRaw.original_title ?? null
      : tmdbRaw.original_name ?? null,
    sort_title: isMovie ? tmdbRaw.title ?? null : tmdbRaw.name ?? null,
    release_year: isMovie
      ? (tmdbRaw.release_date
          ? Number(String(tmdbRaw.release_date).slice(0, 4))
          : null)
      : tmdbRaw.first_air_date
      ? Number(String(tmdbRaw.first_air_date).slice(0, 4))
      : null,
    release_date: isMovie ? tmdbRaw.release_date ?? null : null,
    tmdb_first_air_date: !isMovie ? tmdbRaw.first_air_date ?? null : null,
    runtime_minutes: isMovie
      ? tmdbRaw.runtime ?? null
      : Array.isArray(tmdbRaw.episode_run_time) &&
        tmdbRaw.episode_run_time.length
      ? tmdbRaw.episode_run_time[0]
      : null,
    poster_url: tmdbRaw.poster_path
      ? `https://image.tmdb.org/t/p/w500${tmdbRaw.poster_path}`
      : null,
    backdrop_url: tmdbRaw.backdrop_path
      ? `https://image.tmdb.org/t/p/w780${tmdbRaw.backdrop_path}`
      : null,
    plot: tmdbRaw.overview ?? null,
    language: tmdbRaw.original_language ?? null,
    tmdb_media_type: isMovie ? "movie" : "tv",
    tmdb_original_language: tmdbRaw.original_language ?? null,
    tmdb_title: tmdbRaw.title ?? tmdbRaw.name ?? null,
    tmdb_original_title:
      tmdbRaw.original_title ?? tmdbRaw.original_name ?? null,
    tmdb_overview: tmdbRaw.overview ?? null,
    tmdb_popularity: tmdbRaw.popularity ?? null,
    tmdb_vote_average: tmdbRaw.vote_average ?? null,
    tmdb_vote_count: tmdbRaw.vote_count ?? null,
    tmdb_release_date: isMovie ? tmdbRaw.release_date ?? null : null,
    tmdb_episode_run_time: !isMovie ? tmdbRaw.episode_run_time ?? null : null,
    tmdb_genre_names: genres,
    tmdb_raw: tmdbRaw,
    data_source: "tmdb",
    last_synced_at: now,
    updated_at: now,
  };

  // Check existing by tmdb_id or imdb_id
  let existing: any = null;

  if (tmdbId) {
    const { data, error } = await supabase
      .from("titles")
      .select("*")
      .eq("tmdb_id", tmdbId)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      console.warn("[catalog-sync] existing by tmdb_id error:", error.message);
    } else {
      existing = data;
    }
  }

  if (!existing && imdbId) {
    const { data, error } = await supabase
      .from("titles")
      .select("*")
      .eq("omdb_imdb_id", imdbId)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      console.warn("[catalog-sync] existing by imdb_id error:", error.message);
    } else if (data) {
      existing = data;
    }
  }

  const lastSynced =
    existing && existing.last_synced_at
      ? new Date(existing.last_synced_at)
      : null;

  const forceRefresh = params.options.forceRefresh ?? false;

  if (existing && lastSynced && !forceRefresh) {
    const ageMs = Date.now() - lastSynced.getTime();
    const ageHours = ageMs / (1000 * 60 * 60);
    if (ageHours < 24) {
      console.log(
        "[catalog-sync] skipping refresh, existing title is fresh (",
        ageHours.toFixed(1),
        "h old )",
        existing.title_id,
      );
      return { titleId: existing.title_id, contentType: existing.content_type };
    }
  }

  const upsertPayload = existing
    ? { ...existing, ...payload, title_id: existing.title_id }
    : payload;

  const { data: upserted, error: upsertError } = await supabase
    .from("titles")
    .upsert(upsertPayload, { onConflict: "tmdb_id" })
    .select("title_id, content_type")
    .maybeSingle();

  if (upsertError) {
    console.error("[catalog-sync] upsert titles error:", upsertError.message);
    throw new Error("Failed to upsert titles");
  }

  const titleId = upserted?.title_id as string | undefined;

  if (!titleId) {
    console.warn("[catalog-sync] no title_id returned from upsert");
    return { titleId: null, contentType: upserted?.content_type ?? null };
  }

  // Upsert into movies/series detail table
  if (type === "movie") {
    const { error: movieError } = await supabase.from("movies").upsert(
      {
        title_id: titleId,
        box_office: null,
        budget: null,
        dvd_release: null,
        blu_ray_release: null,
        streaming_release: null,
        created_at: existing?.created_at ?? new Date().toISOString(),
        updated_at: now,
      },
      { onConflict: "title_id" },
    );

    if (movieError) {
      console.warn("[catalog-sync] upsert movies error:", movieError.message);
    }
  } else {
    const { error: seriesError } = await supabase.from("series").upsert(
      {
        title_id: titleId,
        total_seasons: tmdbRaw.number_of_seasons ?? null,
        total_episodes: tmdbRaw.number_of_episodes ?? null,
        in_production: tmdbRaw.in_production ?? null,
        first_air_date: tmdbRaw.first_air_date ?? null,
        last_air_date: tmdbRaw.last_air_date ?? null,
        created_at: existing?.created_at ?? new Date().toISOString(),
        updated_at: now,
      },
      { onConflict: "title_id" },
    );

    if (seriesError) {
      console.warn("[catalog-sync] upsert series error:", seriesError.message);
    }
  }

  return { titleId, contentType: type };
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json" } },
    );
  }

  let body: CatalogSyncRequestBody;

  try {
    body = (await req.json()) as CatalogSyncRequestBody;
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const supabase = getAdminClient();

  try {
    const { tmdbId, imdbId, type, options } = normalizeExternal(body);

    console.log("[catalog-sync] request", { tmdbId, imdbId, type, options });

    if (!tmdbId && !imdbId) {
      return new Response(
        JSON.stringify({ error: "Missing tmdbId and imdbId" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    let tmdbDetails: any = null;

    if (tmdbId) {
      tmdbDetails = await fetchTmdbDetails(tmdbId, type);
    } else {
      // If only imdbId is provided, you could add OMDb logic here.
      // For now we require a tmdbId for TMDb sync.
      return new Response(
        JSON.stringify({ error: "tmdbId is required for now" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const result = await upsertTitleAndDetails({
      supabase,
      type,
      tmdbId: tmdbId ?? undefined,
      imdbId: imdbId ?? undefined,
      tmdbRaw: tmdbDetails,
      options,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        titleId: result.titleId,
        contentType: result.contentType,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[catalog-sync] unexpected error:", err);

    return new Response(
      JSON.stringify({
        ok: false,
        error: "catalog-sync failed",
        details: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
