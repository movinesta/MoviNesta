// supabase/functions/media-trending-refresh/index.ts
//
// Refresh global app-local trending scores with exponential time decay.
//
// This function requires an internal token header:
//   x-internal-token: <INTERNAL_CRON_TOKEN>
//
// It calls the SQL function:
//   public.refresh_media_trending_scores(lookback_days int, half_life_hours int, completeness_min numeric)
//
// Recommended usage:
// - run every 30–60 minutes via scheduler (Supabase cron / external cron)
// - half-life = 72 hours (your chosen setting)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

import { handleOptions, jsonError, jsonResponse, validateRequest } from "../_shared/http.ts";
import { log } from "../_shared/logger.ts";
import { getAdminClient } from "../_shared/supabase.ts";

const FN_NAME = "media-trending-refresh";

const RequestSchema = z.object({
  lookbackDays: z.number().int().min(1).max(60).optional().default(14),
  halfLifeHours: z.number().int().min(1).max(720).optional().default(72),
  completenessMin: z.number().min(0).max(1).optional().default(0.75),
});

type ReqPayload = z.infer<typeof RequestSchema>;

export async function handler(req: Request): Promise<Response> {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  const token = req.headers.get("x-internal-token") ?? "";
  const expected = Deno.env.get("INTERNAL_CRON_TOKEN") ?? "";

  if (!expected || token !== expected) {
    return jsonError("Unauthorized", 401, "UNAUTHORIZED");
  }

  try {
    const { data: payload, errorResponse } = await validateRequest<ReqPayload>(
      req,
      (raw) => RequestSchema.parse(raw ?? {}),
      { logPrefix: `[${FN_NAME}]` },
    );
    if (errorResponse || !payload) return errorResponse!;

    const admin = getAdminClient();

    const { error } = await admin.rpc("refresh_media_trending_scores", {
      lookback_days: payload.lookbackDays,
      half_life_hours: payload.halfLifeHours,
      completeness_min: payload.completenessMin,
    });

    if (error) {
      log({ fn: FN_NAME }, "RPC refresh_media_trending_scores failed", { error: error.message });
      return jsonError("Trending refresh failed", 500, "TRENDING_REFRESH_FAILED");
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    log({ fn: FN_NAME }, "Unhandled error", { error: String(err?.message ?? err), stack: err?.stack });
    return jsonError("Internal error", 500, "INTERNAL_ERROR");
  }
}

serve(handler);
