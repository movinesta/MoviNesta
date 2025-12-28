// supabase/functions/catalog-search/index.ts
//
// Searches TMDB and merges in any locally cached `media_items`.
// Schema source of truth: schema_full_20251224_004751.sql

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

import type { Database } from "../../../src/types/supabase.ts";
import { getConfig } from "../_shared/config.ts";
import { handleOptions, jsonError, jsonResponse } from "../_shared/http.ts";
import { triggerCatalogSyncForTitle } from "../_shared/catalog-sync.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";

type MediaItemRow = Database["public"]["Tables"]["media_items"]["Row"];

type TmdbSearchItem = {
  id: number;
  media_type?: "movie" | "tv" | "person";
  title?: string;
  name?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  overview?: string;
};

type TmdbSearchResponse = {
  results: TmdbSearchItem[];
};

function tmdbMediaTypeToKind(type?: string): "movie" | "series" {
  return type === "tv" ? "series" : "movie";
}

export async function handler(req: Request) {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  if (req.method !== "POST") return jsonError("Method not allowed", 405);

  const rl = await enforceRateLimit(req, { action: "catalog_search", maxPerMinute: 60 });
  if (!rl.ok) return jsonError(rl.message, rl.status);

  const { supabaseUrl, supabaseAnonKey, tmdbApiReadAccessToken } = getConfig();
  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonError("Server misconfigured", 500, "SERVER_MISCONFIGURED");
  }

  if (!tmdbApiReadAccessToken) {
    return jsonError("TMDB API key not configured", 500, "MISSING_TMDB_KEY");
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: req.headers.get("Authorization") ?? "",
      },
    },
  });

  let query = "";
  try {
    const body = (await req.json()) as any;
    query = typeof body?.query === "string" ? body.query.trim() : "";
  } catch {
    // ignore
  }

  if (!query) {
    return jsonError("Missing query", 400, "MISSING_QUERY");
  }

  const url = new URL("https://api.themoviedb.org/3/search/multi");
  url.searchParams.set("query", query);
  url.searchParams.set("include_adult", "false");
  url.searchParams.set("language", "en-US");
  url.searchParams.set("page", "1");

  const tmdbRes = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${tmdbApiReadAccessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!tmdbRes.ok) {
    const txt = await tmdbRes.text().catch(() => "");
    return jsonError(`TMDB search failed: ${txt || tmdbRes.status}`, 502, "TMDB_SEARCH_FAILED");
  }

  const tmdbJson = (await tmdbRes.json()) as TmdbSearchResponse;
  const tmdbResults = (tmdbJson.results ?? []).filter(
    (r) => r.media_type === "movie" || r.media_type === "tv",
  );

  const tmdbIds = Array.from(new Set(tmdbResults.map((r) => r.id).filter(Boolean)));

  const localByKey = new Map<string, MediaItemRow>();
  if (tmdbIds.length) {
    const { data: localRows, error } = await supabase
      .from("media_items")
      .select(
        "id, kind, tmdb_id, tmdb_title, tmdb_name, tmdb_release_date, tmdb_first_air_date, tmdb_poster_path, tmdb_backdrop_path, omdb_title, omdb_year, omdb_poster, omdb_imdb_id, omdb_imdb_rating, omdb_rating_rotten_tomatoes",
      )
      .in("tmdb_id", tmdbIds);

    if (!error && localRows) {
      for (const row of localRows) {
        const key = `${row.kind}:${row.tmdb_id}`;
        localByKey.set(key, row);
      }
    }
  }

  // Opportunistically background-sync missing items.
  const missing = tmdbResults
    .filter((r) => !localByKey.has(`${tmdbMediaTypeToKind(r.media_type)}:${r.id}`))
    .slice(0, 10);

  if (missing.length) {
    // Fire-and-forget.
    triggerBackgroundSync(req, missing).catch(() => void 0);
  }

  const results = tmdbResults.map((tmdb) => {
    const kind = tmdbMediaTypeToKind(tmdb.media_type);
    const local = localByKey.get(`${kind}:${tmdb.id}`) ?? null;

    return {
      kind,
      tmdb,
      local,
    };
  });

  return jsonResponse({ ok: true, query, results });
}

serve(handler);

async function triggerBackgroundSync(req: Request, items: TmdbSearchItem[]) {
  // triggerCatalogSyncForTitle expects movie/series. Convert from TMDB's tv/movie.
  for (const item of items) {
    await triggerCatalogSyncForTitle(
      req,
      {
        tmdbId: item.id,
        imdbId: null,
        contentType: item.media_type === "tv" ? "series" : "movie",
      },
      { prefix: "[catalog-search]" },
    );
  }
}
