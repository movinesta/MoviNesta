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
import { safeInsertJobRunLog } from "../_shared/joblog.ts";

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

  const startedAt = new Date().toISOString();

  const respondWithLog = async (admin: any, payload: any, status: number) => {
    try {
      await safeInsertJobRunLog(admin, {
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        job_name: FN_NAME,
        provider: null,
        model: null,
        ok: Boolean(payload?.ok),
        scanned: null,
        embedded: null,
        skipped_existing: null,
        total_tokens: null,
        error_code: payload?.code ?? null,
        error_message: payload?.error ?? payload?.message ?? null,
        meta: { request: payload?.request ?? null },
      });
    } catch {
      // best-effort
    }
    return status >= 400 ? jsonError(payload?.error ?? payload?.message ?? "Error", status, payload?.code) : jsonResponse(payload, status);
  };

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
      return await respondWithLog(admin, { ok: false, code: "TRENDING_REFRESH_FAILED", error: "Trending refresh failed", request: payload }, 500);
    }

    return await respondWithLog(admin, { ok: true, request: payload }, 200);
  } catch (err) {
    log({ fn: FN_NAME }, "Unhandled error", { error: String(err?.message ?? err), stack: err?.stack });
    const admin = getAdminClient();
    return await respondWithLog(admin, { ok: false, code: "INTERNAL_ERROR", error: "Internal error" }, 500);
  }
}

serve(handler);
