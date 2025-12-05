// supabase/functions/catalog-backfill/index.ts
//
// Seeds/refreshes `public.titles` using TMDb trending + discover APIs
// by calling the `catalog-sync` function for each discovered TMDb id.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  corsHeaders,
  handleOptions,
  jsonError,
  jsonResponse,
  validateRequest,
} from "../_shared/http.ts";
import {
  fetchTmdbDiscover,
  fetchTmdbTrending,
  type TmdbMediaType,
} from "../_shared/tmdb.ts";
import { triggerCatalogSyncForTitle } from "../_shared/catalog-sync.ts";

type MediaType = TmdbMediaType;

interface BackfillRequestBody {
  reason?: string;
  mediaTypes?: MediaType[];
  pagesPerType?: number;
  maxPerType?: number;
}

serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  if (req.method !== "POST") {
    return jsonError("Method not allowed", 405);
  }

  const { data, errorResponse } = await validateRequest<BackfillRequestBody>(
    req,
    (raw) => raw as BackfillRequestBody,
    { prefix: "[catalog-backfill]" },
  );
  if (errorResponse) return errorResponse;

  const body = data ?? {};

  const mediaTypes: MediaType[] =
    body.mediaTypes && body.mediaTypes.length
      ? body.mediaTypes
      : ["movie", "tv"];
  const pagesPerType = body.pagesPerType ?? 1;
  const maxPerType = body.maxPerType ?? 200;
  const reason = body.reason ?? "backfill";

  try {
    const results: Record<string, any> = {};

    for (const mt of mediaTypes) {
      const idSet = new Set<number>();

      // 1) Trending
      try {
        const trending = await fetchTmdbTrending(mt, "day");
        for (const item of trending.results ?? []) {
          if (typeof item.id === "number") {
            idSet.add(item.id);
          }
        }
      } catch (err) {
        console.warn("[catalog-backfill] fetchTmdbTrending error:", err);
      }

      // 2) Discover pages
      for (let page = 1; page <= pagesPerType; page++) {
        try {
          const discover = await fetchTmdbDiscover(mt, page);
          for (const item of discover.results ?? []) {
            if (typeof item.id === "number") {
              idSet.add(item.id);
            }
          }
        } catch (err) {
          console.warn("[catalog-backfill] fetchTmdbDiscover error:", err);
          break;
        }
      }

      const allIds = Array.from(idSet);
      const limitedIds = allIds.slice(0, maxPerType);

      // Fire-and-forget catalog-sync for each TMDb id.
      const prefix = `[catalog-backfill:${mt}]`;
      await Promise.allSettled(
        limitedIds.map((tmdbId) =>
          triggerCatalogSyncForTitle(
            req,
            {
              tmdbId,
              imdbId: null,
              contentType: mt === "movie" ? "movie" : "series",
            },
            { prefix },
          ),
        ),
      );

      results[mt] = {
        discovered: allIds.length,
        enqueued: limitedIds.length,
      };
    }

    return jsonResponse({
      ok: true,
      reason,
      results,
    });
  } catch (err) {
    console.error("[catalog-backfill] unexpected error:", err);

    return jsonError(
      "catalog-backfill failed",
      500,
      "CATALOG_BACKFILL_ERROR",
    );
  }
});
