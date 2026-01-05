// supabase/functions/catalog-sync-batch/index.ts
//
// Invokes the `catalog-sync` function for a batch of titles in parallel.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { handleOptions, jsonError, jsonResponse, validateRequest } from "../_shared/http.ts";
import { log } from "../_shared/logger.ts";
import { getConfig } from "../_shared/config.ts";

const FN_NAME = "catalog-sync-batch";

// ============================================================================
// Type Definitions
// ============================================================================

interface SyncBatchItem {
  tmdbId?: number | null;
  imdbId?: string | null;
  contentType?: "movie" | "series" | null;
}

interface SyncBatchRequest {
  items: SyncBatchItem[];
  options?: {
    syncOmdb?: boolean;
    forceRefresh?: boolean;
  };
}

interface SyncBatchResult {
  tmdbId: number | null;
  imdbId: string | null;
  mediaItemId: string | null;
  status: "fulfilled" | "rejected";
  error?: string;
}

// ============================================================================
// Request Handler
// ============================================================================

export async function handler(req: Request){
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  const logCtx = { fn: FN_NAME };

  if (req.method !== "POST") {
    return jsonError("Method not allowed", 405);
  }

  const { supabaseUrl, supabaseAnonKey } = getConfig();
  if (!supabaseUrl || !supabaseAnonKey) {
    log(logCtx, "Server is missing SUPABASE_URL or SUPABASE_ANON_KEY");
    return jsonError("Server misconfigured", 500, "SERVER_MISCONFIGURED");
  }

  const { data, errorResponse } = await validateRequest<SyncBatchRequest>(req, parseRequestBody, {
    logPrefix: `[${FN_NAME}]`,
    requireJson: true,
  });
  if (errorResponse) return errorResponse;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonError("Missing Authorization header", 401, "MISSING_AUTH");
  }

  const { items, options } = data;
  log(logCtx, "Processing batch", { itemCount: items.length });

  const syncPromises = items.map((item) =>
    triggerSingleSync(item, options ?? {}, authHeader)
  );
  const settledResults = await Promise.allSettled(syncPromises);

  const results: SyncBatchResult[] = settledResults.map((result, i) => {
    const inputItem = items[i];
    if (result.status === "fulfilled") {
      return {
        ...inputItem,
        mediaItemId: result.value.mediaItemId,
        status: "fulfilled",
      };
    } else {
      return {
        ...inputItem,
        mediaItemId: null,
        status: "rejected",
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      };
    }
  });

  return jsonResponse({ ok: true, results });
}

serve(handler);

// ============================================================================
// Helper Functions
// ============================================================================

function parseRequestBody(body: unknown): SyncBatchRequest {
  if (typeof body !== "object" || body === null) {
    throw new Error("Request body must be an object.");
  }

  const { items, options } = body as Record<string, unknown>;

  if (!Array.isArray(items)) {
    throw new Error("'items' must be an array.");
  }

  const validItems: SyncBatchItem[] = [];
  for (const item of items) {
    if (typeof item !== "object" || item === null) continue;
    const { tmdbId, imdbId, contentType } = item as Record<string, unknown>;
    if (
      (tmdbId === undefined || tmdbId === null) &&
      (imdbId === undefined || imdbId === null)
    ) {
      continue;
    }
    // Further validation could be added here for each item's properties.
    validItems.push({
      tmdbId: tmdbId as number | null,
      imdbId: imdbId as string | null,
      contentType: contentType as "movie" | "series" | null,
    });
  }

  if (validItems.length === 0) {
    throw new Error("No valid items found in the 'items' array.");
  }

  return { items: validItems, options: options as SyncBatchRequest["options"] };
}

async function triggerSingleSync(
  item: SyncBatchItem,
  options: SyncBatchRequest["options"],
  authHeader: string,
): Promise<{ mediaItemId: string | null }> {
  const { supabaseUrl, supabaseAnonKey } = getConfig();
  const payload = {
    tmdbId: item.tmdbId,
    imdbId: item.imdbId,
    contentType: item.contentType,
    options,
  };

  const res = await fetch(`${supabaseUrl}/functions/v1/catalog-sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": supabaseAnonKey,
      "Authorization": authHeader,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => `catalog-sync returned status ${res.status}`);
    throw new Error(errorText);
  }

  const json = await res.json();
  return { mediaItemId: json.media_item_id ?? json.title_id ?? null };
}
