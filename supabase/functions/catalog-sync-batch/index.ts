import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  corsHeaders,
  handleOptions,
  jsonError,
  jsonResponse,
  validateRequest,
} from "../_shared/http.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

interface CatalogSyncBatchItem {
  tmdbId?: number;
  imdbId?: string;
  mediaType?: "movie" | "tv";
}

interface CatalogSyncBatchBody {
  items: CatalogSyncBatchItem[];
  options?: {
    syncOmdb?: boolean;
    syncYoutube?: boolean;
    forceRefresh?: boolean;
  };
}

type CatalogSyncBatchResult = {
  tmdbId: number | null;
  imdbId: string | null;
  titleId: string | null;
  error?: string;
};

serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  if (req.method !== "POST") {
    return jsonError("Method not allowed", 405);
  }

  const validation = await validateRequest<CatalogSyncBatchBody>(req, (raw) => {
    const body = raw as CatalogSyncBatchBody;
    if (!body || !Array.isArray(body.items)) {
      throw new Error("items array is required");
    }
    const filtered = body.items.filter((item) => item && (item.tmdbId || item.imdbId));
    if (!filtered.length) {
      throw new Error("items array must include at least one tmdbId or imdbId");
    }
    return { items: filtered, options: body.options };
  });

  if (validation.errorResponse) return validation.errorResponse;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return jsonError("Server misconfigured", 500);
  }

  const body = validation.data;
  const isSystemCall = req.headers.get("x-system-catalog-sync") === "true";
  const authHeader =
    req.headers.get("Authorization") ?? (isSystemCall ? `Bearer ${SUPABASE_ANON_KEY}` : "");

  if (!authHeader) {
    return jsonError("Missing Authorization header", 401, "MISSING_AUTH");
  }

  const results: CatalogSyncBatchResult[] = [];

  for (const item of body.items) {
    const payload = {
      external: {
        tmdbId: item.tmdbId,
        imdbId: item.imdbId,
        type: item.mediaType ?? "movie",
      },
      options: {
        syncOmdb: body.options?.syncOmdb ?? true,
        syncYoutube: body.options?.syncYoutube ?? true,
        forceRefresh: body.options?.forceRefresh ?? false,
      },
    };

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/catalog-sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: authHeader,
          ...corsHeaders,
        },
        body: JSON.stringify(payload),
      });

      const text = await res.text().catch(() => "");
      let parsed: { titleId?: string } | null = null;
      try {
        parsed = text ? (JSON.parse(text) as { titleId?: string }) : null;
      } catch (_err) {
        parsed = null;
      }

      if (!res.ok) {
        results.push({
          tmdbId: item.tmdbId ?? null,
          imdbId: item.imdbId ?? null,
          titleId: null,
          error: parsed?.titleId ? undefined : text || `catalog-sync status ${res.status}`,
        });
        continue;
      }

      results.push({
        tmdbId: item.tmdbId ?? null,
        imdbId: item.imdbId ?? null,
        titleId: parsed?.titleId ?? null,
      });
    } catch (err) {
      console.warn("[catalog-sync-batch] catalog-sync fetch error", err);
      results.push({
        tmdbId: item.tmdbId ?? null,
        imdbId: item.imdbId ?? null,
        titleId: null,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return jsonResponse({ ok: true, results });
});
