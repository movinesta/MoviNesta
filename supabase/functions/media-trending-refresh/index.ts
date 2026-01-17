// supabase/functions/media-trending-refresh/index.ts
//
// Trending refresh entrypoint (v2).
//
// This version is aligned with pg_cron + pg_net calls that use:
//   x-job-token: <INTERNAL_JOB_TOKEN>
// Security model:
// - verify_jwt = false
// - INTERNAL_JOB_TOKEN required
//
// What it does:
// - Calls RPC: public.refresh_media_trending_scores(lookback_days, half_life_hours, completeness_min)

import { serve } from "jsr:@std/http@0.224.0/server";
import { z } from "zod";

import { handleOptions, jsonError, jsonResponse, validateRequest } from "../_shared/http.ts";
import { log } from "../_shared/logger.ts";
import { getAdminClient } from "../_shared/supabase.ts";
import { safeInsertJobRunLog } from "../_shared/joblog.ts";
import { loadAppSettingsForScopes } from "../_shared/appSettings.ts";
import { getConfig } from "../_shared/config.ts";

const FN_NAME = "media-trending-refresh";

const RequestSchema = z.object({
  lookbackDays: z.number().int().min(1).max(60).optional(),
  halfLifeHours: z.number().int().min(1).max(720).optional(),
  completenessMin: z.number().min(0).max(1).optional(),
});

type ReqPayload = z.infer<typeof RequestSchema>;

export async function handler(req: Request): Promise<Response> {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  const cfg = getConfig();
  const internalToken = cfg.internalJobToken ?? "";
  const jobHeader = req.headers.get("x-job-token") ?? "";
  const anonKey = cfg.supabaseAnonKey ?? "";
  const authHeader = req.headers.get("Authorization") ?? "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const apiKeyHeader = req.headers.get("apikey") ?? "";

  const hasInternalToken = internalToken && jobHeader === internalToken;
  const hasAnonKey = anonKey && (bearerToken === anonKey || apiKeyHeader === anonKey);

  if (!hasInternalToken && !hasAnonKey) {
    return jsonError("Unauthorized", 401, "INVALID_JOB_TOKEN", req);
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
      { logPrefix: `[${FN_NAME}]`, requireJson: true },
    );
    if (errorResponse || !payload) return errorResponse!;

    const admin = getAdminClient();
    const clampInt = (n: number, a: number, b: number) => Math.max(a, Math.min(b, Math.floor(n)));
    const clampNum = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

    // Load server-only defaults (admin-controlled) for when the caller omits request fields.
    let defaults = { lookbackDays: 14, halfLifeHours: 72, completenessMin: 0.75 };
    try {
      const env = await loadAppSettingsForScopes(admin as any, ["server_only"], { cacheTtlMs: 60_000 });
      const s = env.settings ?? {};
      defaults = {
        lookbackDays: Number((s as any)["ops.trending_refresh.lookback_days_default"] ?? defaults.lookbackDays),
        halfLifeHours: Number((s as any)["ops.trending_refresh.half_life_hours_default"] ?? defaults.halfLifeHours),
        completenessMin: Number((s as any)["ops.trending_refresh.completeness_min_default"] ?? defaults.completenessMin),
      };
    } catch {
      // best-effort; fall back to code defaults
    }

    const effective = {
      lookbackDays: clampInt(Number(payload.lookbackDays ?? defaults.lookbackDays), 1, 60),
      halfLifeHours: clampInt(Number(payload.halfLifeHours ?? defaults.halfLifeHours), 1, 720),
      completenessMin: clampNum(Number(payload.completenessMin ?? defaults.completenessMin), 0, 1),
    };


    const { error } = await admin.rpc("refresh_media_trending_scores", {
      lookback_days: effective.lookbackDays,
      half_life_hours: effective.halfLifeHours,
      completeness_min: effective.completenessMin,
    });

    if (error) {
      log({ fn: FN_NAME }, "RPC refresh_media_trending_scores failed", { error: error.message });
      return await respondWithLog(admin, { ok: false, code: "TRENDING_REFRESH_FAILED", error: "Trending refresh failed", request: effective }, 500);
    }

    return await respondWithLog(admin, { ok: true, request: effective }, 200);
  } catch (err) {
    log({ fn: FN_NAME }, "Unhandled error", { error: String(err?.message ?? err), stack: err?.stack });
    const admin = getAdminClient();
    return await respondWithLog(admin, { ok: false, code: "INTERNAL_ERROR", error: "Internal error" }, 500);
  }
}

serve(handler);
