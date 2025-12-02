// supabase/functions/catalog-backfill/index.ts
//
// Background catalog backfill for `public.titles`.
// - Fetches trending movies & TV series from TMDb.
// - For each TMDb id, calls the existing `catalog-sync` edge function
//   in a special "system" mode (no user required).
//
// You can:
//   - Call this manually from the client (admin tools).
//   - Or schedule it via Supabase Edge Function cron so that `titles`
//     is always populated, even before any user searches.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const TMDB_TOKEN = Deno.env.get("TMDB_API_READ_ACCESS_TOKEN") ?? "";
const TMDB_BASE = "https://api.themoviedb.org/3";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-system-catalog-sync",
};

type MediaType = "movie" | "tv";

type BackfillRequestBody = {
  reason?: string;
  mediaTypes?: MediaType[];
  pagesPerType?: number;
  maxPerType?: number;
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("[catalog-backfill] Missing SUPABASE_URL or SUPABASE_ANON_KEY");
    return jsonError("Server misconfigured", 500);
  }

  if (!TMDB_TOKEN) {
    console.error("[catalog-backfill] Missing TMDB_API_READ_ACCESS_TOKEN");
    return jsonError("TMDb not configured", 500);
  }

  let body: BackfillRequestBody = {};
  if (req.method === "POST") {
    body = (await req.json().catch(() => ({}))) as BackfillRequestBody;
  } else {
    // GET → allow simple ?reason=... but otherwise use defaults.
    const url = new URL(req.url);
    body.reason = url.searchParams.get("reason") ?? undefined;
  }

  const mediaTypes: MediaType[] =
    Array.isArray(body.mediaTypes) && body.mediaTypes.length > 0
      ? (body.mediaTypes as MediaType[])
      : ["movie", "tv"];

  const pagesPerTypeRaw = Number(body.pagesPerType ?? 3);
  const pagesPerType =
    Number.isFinite(pagesPerTypeRaw) && pagesPerTypeRaw > 0
      ? Math.min(10, Math.max(1, pagesPerTypeRaw))
      : 3;

  const maxPerTypeRaw = Number(body.maxPerType ?? 0);
  const maxPerType =
    Number.isFinite(maxPerTypeRaw) && maxPerTypeRaw > 0
      ? Math.floor(maxPerTypeRaw)
      : 0;

  const stats: Record<MediaType, { attempted: number; scheduled: number }> = {
    movie: { attempted: 0, scheduled: 0 },
    tv: { attempted: 0, scheduled: 0 },
  };

  for (const mediaType of mediaTypes) {
    let scheduledForThisType = 0;

    outer: for (let page = 1; page <= pagesPerType; page++) {
      const data = await tmdbTrending(mediaType, page);
      if (!data) {
        break;
      }

      const results = Array.isArray(data.results) ? data.results : [];
      for (const item of results) {
        const tmdbId = typeof item?.id === "number" ? (item.id as number) : null;
        if (!tmdbId) continue;

        stats[mediaType].attempted += 1;

        await callCatalogSyncForTmdbId(tmdbId, mediaType);

        scheduledForThisType += 1;
        stats[mediaType].scheduled += 1;

        if (maxPerType && scheduledForThisType >= maxPerType) {
          break outer;
        }
      }
    }
  }

  return jsonOk(
    {
      ok: true,
      reason: body.reason ?? null,
      mediaTypes,
      pagesPerType,
      maxPerType,
      stats,
    },
    200,
  );
});

async function tmdbTrending(mediaType: MediaType, page: number) {
  const path = `/trending/${mediaType}/day`;
  const url = new URL(TMDB_BASE + path);
  url.searchParams.set("page", String(page));

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${TMDB_TOKEN}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    console.error(
      "[catalog-backfill] TMDb trending failed",
      mediaType,
      page,
      res.status,
      await res.text(),
    );
    return null;
  }

  return await res.json();
}

async function callCatalogSyncForTmdbId(
  tmdbId: number,
  mediaType: MediaType,
): Promise<void> {
  const payload = {
    external: {
      tmdbId,
      imdbId: undefined,
      // TMDb media_type
      type: mediaType,
    },
    options: {
      syncOmdb: true,
      forceRefresh: false,
    },
  };

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/catalog-sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        // Mark this as a system request so catalog-sync can bypass user auth.
        "x-system-catalog-sync": "true",
        // Any non-empty Authorization header is fine; catalog-sync will ignore
        // auth errors for system requests.
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text().catch(() => "");
    if (!res.ok) {
      console.warn(
        "[catalog-backfill] catalog-sync failed",
        tmdbId,
        mediaType,
        res.status,
        text,
      );
    } else {
      console.log(
        "[catalog-backfill] catalog-sync ok",
        tmdbId,
        mediaType,
        res.status,
      );
    }
  } catch (err) {
    console.warn(
      "[catalog-backfill] catalog-sync request error",
      tmdbId,
      mediaType,
      err,
    );
  }
}

function jsonOk(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function jsonError(message: string, status: number): Response {
  return jsonOk({ ok: false, error: message }, status);
}
