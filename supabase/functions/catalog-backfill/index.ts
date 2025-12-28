// supabase/functions/catalog-backfill/index.ts
//
// Seeds/refreshes `public.titles` using TMDb trending + discover APIs
// by calling the `catalog-sync` function for each discovered TMDb id.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
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
import { log } from "../_shared/logger.ts";
import { getAdminClient } from "../_shared/supabase.ts";
import { safeInsertJobRunLog } from "../_shared/joblog.ts";
import { requireInternalJob } from "../_shared/internal.ts";

const FN_NAME = "catalog-backfill";

type MediaType = TmdbMediaType;

interface BackfillRequestBody {
  reason?: string;
  mediaTypes?: MediaType[];
  pagesPerType?: number;
  maxPerType?: number;
}

interface BackfillResult {
  discovered: number;
  enqueued: number;
}

// How many pages of trending to fetch per media type
const TRENDING_PAGES = 9;

// Basic type validation for the request body.
function parseRequestBody(body: unknown): BackfillRequestBody {
  if (typeof body !== "object" || body === null) {
    throw new Error("Invalid request body: expected an object");
  }

  const { reason, mediaTypes, pagesPerType, maxPerType } = body as Record<
    string,
    unknown
  >;

  if (reason !== undefined && typeof reason !== "string") {
    throw new Error("Invalid 'reason': must be a string");
  }
  if (pagesPerType !== undefined && typeof pagesPerType !== "number") {
    throw new Error("Invalid 'pagesPerType': must be a number");
  }
  if (maxPerType !== undefined && typeof maxPerType !== "number") {
    throw new Error("Invalid 'maxPerType': must be a number");
  }
  if (
    mediaTypes !== undefined &&
    (!Array.isArray(mediaTypes) ||
      !mediaTypes.every((mt) => mt === "movie" || mt === "tv"))
  ) {
    throw new Error("Invalid 'mediaTypes': must be an array of 'movie' or 'tv'");
  }

  return { reason, mediaTypes, pagesPerType, maxPerType };
}

export async function handler(req: Request) {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  if (req.method !== "POST") {
    return jsonError("Method not allowed", 405);
  }

  const internalGuard = requireInternalJob(req);
  if (internalGuard) return internalGuard;

  const startedAt = new Date().toISOString();
  const admin = getAdminClient();

  const { data, errorResponse } = await validateRequest<BackfillRequestBody>(
    req,
    parseRequestBody,
    { logPrefix: `[${FN_NAME}]` },
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

  log({ fn: FN_NAME }, "Starting catalog backfill", {
    reason,
    mediaTypes,
    pagesPerType,
    maxPerType,
  });

  try {
    const results: Record<string, BackfillResult> = {};

    for (const mt of mediaTypes) {
      const idSet = new Set<number>();
      const logCtx = { fn: FN_NAME, mediaType: mt };

      // 1) Trending - fetch multiple pages (default 9)
      try {
        for (let page = 1; page <= TRENDING_PAGES; page++) {
          const trending = await fetchTmdbTrending(mt, "day", page);
          for (const item of trending.results ?? []) {
            if (typeof item.id === "number") {
              idSet.add(item.id);
            }
          }
        }
      } catch (err: any) {
        log(logCtx, "fetchTmdbTrending error", { error: err.message });
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
        } catch (err: any) {
          log(logCtx, "fetchTmdbDiscover error", { page, error: err.message });
          break; // Stop fetching pages for this type on error
        }
      }

      const allIds = Array.from(idSet);
      const limitedIds = allIds.slice(0, maxPerType);

      // Fire-and-forget catalog-sync for each TMDb id.
      const prefix = `[${FN_NAME}:${mt}]`;
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
          )
        ),
      );

      results[mt] = {
        discovered: allIds.length,
        enqueued: limitedIds.length,
      };
      log(logCtx, "Backfill pass complete", results[mt]);
    }

    const payload = {
      ok: true,
      reason,
      results,
    };

    await safeInsertJobRunLog(admin, {
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      job_name: FN_NAME,
      provider: null,
      model: null,
      ok: true,
      scanned: Object.values(results).reduce((a: number, r: any) => a + (r?.discovered ?? 0), 0),
      embedded: Object.values(results).reduce((a: number, r: any) => a + (r?.enqueued ?? 0), 0),
      skipped_existing: null,
      total_tokens: null,
      error_code: null,
      error_message: null,
      meta: { reason, mediaTypes, pagesPerType, maxPerType, results },
    });

    return jsonResponse(payload);
  } catch (err: any) {
    log({ fn: FN_NAME }, "Unexpected error during backfill", {
      error: err.message,
      stack: err.stack,
    });

    await safeInsertJobRunLog(admin, {
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      job_name: FN_NAME,
      provider: null,
      model: null,
      ok: false,
      scanned: null,
      embedded: null,
      skipped_existing: null,
      total_tokens: null,
      error_code: "CATALOG_BACKFILL_ERROR",
      error_message: err?.message ?? String(err),
      meta: { reason, mediaTypes, pagesPerType, maxPerType },
    });

    return jsonError(
      "catalog-backfill failed",
      500,
      "CATALOG_BACKFILL_ERROR",
    );
  }
}

serve(handler);
