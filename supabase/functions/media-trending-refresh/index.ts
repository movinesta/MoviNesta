// supabase/functions/media-trending-refresh/index.ts
//
// Trending refresh entrypoint (v2).
//
// This version is aligned with pg_cron + pg_net calls that use:
//   Authorization: Bearer <anon_key>
// per Supabase docs for scheduling Edge Functions with Vault + pg_net.
//
// It does NOT require a custom INTERNAL_CRON_TOKEN header.
// Security model:
// - Keep verify_jwt = true (default) so Supabase validates the JWT-based anon key.
//   See docs: by default Edge Functions require a valid JWT in Authorization.
// - If you previously set verify_jwt=false for this function, remove that override.
//
// What it does:
// - Calls RPC: public.refresh_media_trending_scores(lookback_days, half_life_hours, completeness_min)

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

  // Defensive: require Authorization header to be present.
  // With verify_jwt=true (recommended), Supabase will validate it.
  const auth = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ") || auth.length < 20) {
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
