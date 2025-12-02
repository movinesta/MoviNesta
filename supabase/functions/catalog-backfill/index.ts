// supabase/functions/catalog-backfill/index.ts

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const TMDB_API_READ_ACCESS_TOKEN = Deno.env.get("TMDB_API_READ_ACCESS_TOKEN")!;

type MediaType = "movie" | "tv";

interface BackfillRequestBody {
  reason?: string;
  mediaTypes?: MediaType[];
  pagesPerType?: number;
  maxPerType?: number;
}

interface TmdbTrendingResult {
  page: number;
  total_pages: number;
  total_results: number;
  results: Array<{
    id: number;
    media_type?: string;
    title?: string;
    name?: string;
  }>;
}

function getDefaultConfig(body: BackfillRequestBody | null): Required<BackfillRequestBody> {
  const mediaTypes =
    body?.mediaTypes && body.mediaTypes.length
      ? (body.mediaTypes as MediaType[])
      : (["movie", "tv"] as MediaType[]);

  let pagesPerType = body?.pagesPerType ?? 3;
  if (!Number.isFinite(pagesPerType) || pagesPerType < 1) pagesPerType = 1;
  if (pagesPerType > 10) pagesPerType = 10;

  let maxPerType = body?.maxPerType ?? 0;
  if (!Number.isFinite(maxPerType) || maxPerType < 0) maxPerType = 0;

  return {
    reason: body?.reason ?? "catalog-backfill",
    mediaTypes,
    pagesPerType,
    maxPerType,
  };
}

async function fetchTmdbTrending(
  mediaType: MediaType,
  page: number,
): Promise<TmdbTrendingResult> {
  if (!TMDB_API_READ_ACCESS_TOKEN) {
    throw new Error("TMDB_API_READ_ACCESS_TOKEN is not configured");
  }

  const url = new URL(
    `https://api.themoviedb.org/3/trending/${mediaType}/day`,
  );
  url.searchParams.set("page", String(page));

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${TMDB_API_READ_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(
      "[catalog-backfill] TMDb trending error",
      mediaType,
      page,
      res.status,
      text,
    );
    throw new Error(
      `TMDb trending error for ${mediaType} page ${page}: ${res.status}`,
    );
  }

  const json = (await res.json()) as TmdbTrendingResult;
  return json;
}

async function triggerCatalogSyncForTmdbItem(
  mediaType: MediaType,
  tmdbId: number,
  reasonPrefix: string,
): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn(
      "[catalog-backfill] missing SUPABASE_URL or SUPABASE_ANON_KEY, cannot call catalog-sync",
    );
    return;
  }

  // Call catalog-sync as a system job. The function itself should
  // recognize this as a system request and skip user auth checks.
  const res = await fetch(`${SUPABASE_URL}/functions/v1/catalog-sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      // Mark this as a system call so catalog-sync does not expect a user JWT.
      "x-system-catalog-sync": "true",
      // Authorization header is optional here; catalog-sync should ignore user auth in system mode.
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      external: {
        tmdbId,
        imdbId: undefined,
        type: mediaType,
      },
      options: {
        syncOmdb: true,
        forceRefresh: false,
        reason: reasonPrefix,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.warn(
      "[catalog-backfill] catalog-sync error",
      mediaType,
      tmdbId,
      res.status,
      text,
    );
  }
}

serve(async (req) => {
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json" } },
    );
  }

  // IMPORTANT: This function is intentionally unauthenticated from the user
  // perspective. It runs as a system/cron job and uses the anon key to call
  // other functions (catalog-sync). DO NOT call auth.getUser() here.

  let body: BackfillRequestBody | null = null;

  if (req.method === "POST") {
    try {
      body = (await req.json()) as BackfillRequestBody;
    } catch {
      body = null;
    }
  }

  const cfg = getDefaultConfig(body);
  const { reason, mediaTypes, pagesPerType, maxPerType } = cfg;

  const stats: Record<
    MediaType,
    {
      attempted: number;
      scheduled: number;
      pagesFetched: number;
    }
  > = {
    movie: { attempted: 0, scheduled: 0, pagesFetched: 0 },
    tv: { attempted: 0, scheduled: 0, pagesFetched: 0 },
  };

  try {
    for (const mediaType of mediaTypes) {
      let scheduledForType = 0;

      for (let page = 1; page <= pagesPerType; page++) {
        const trending = await fetchTmdbTrending(mediaType, page);
        stats[mediaType].pagesFetched += 1;

        const results = trending.results ?? [];
        stats[mediaType].attempted += results.length;

        for (const item of results) {
          if (!item || typeof item.id !== "number") continue;

          // Hard cap per type if configured
          if (maxPerType > 0 && scheduledForType >= maxPerType) {
            break;
          }

          scheduledForType += 1;
          stats[mediaType].scheduled = scheduledForType;

          // Fire-and-forget, but we still await inside this loop to avoid totally unbounded concurrency.
          await triggerCatalogSyncForTmdbItem(
            mediaType,
            item.id,
            `[catalog-backfill:${reason}]`,
          );
        }

        if (maxPerType > 0 && scheduledForType >= maxPerType) {
          break;
        }
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        reason,
        mediaTypes,
        pagesPerType,
        maxPerType,
        stats,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[catalog-backfill] unexpected error:", err);

    return new Response(
      JSON.stringify({
        ok: false,
        error: "catalog-backfill failed",
        details: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
