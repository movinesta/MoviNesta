import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

import { handleOptions, jsonError, jsonResponse, validateRequest } from "../_shared/http.ts";
import { getConfig } from "../_shared/config.ts";
import { getAdminClient } from "../_shared/supabase.ts";
import { safeInsertJobRunLog } from "../_shared/joblog.ts";
import { fetchJsonWithTimeout } from "../_shared/fetch.ts";
import { normalizeOpenRouterBaseUrl, resolveOpenRouterBaseUrl, writeOpenRouterCache } from "../_shared/openrouterCache.ts";

const FN_NAME = "openrouter-refresh";

const RequestSchema = z.object({
  base_url: z.string().optional(),
  timeout_ms: z.number().int().min(1000).max(20000).optional(),
});

type RequestPayload = z.infer<typeof RequestSchema>;

type RefreshResult = {
  ok: boolean;
  base_url: string;
  fetched_at: string;
  errors: Record<string, string>;
  refreshed: Record<string, boolean>;
};

async function fetchOpenRouterPayload(
  baseUrl: string,
  path: string,
  apiKey: string,
  timeoutMs: number,
): Promise<unknown> {
  return await fetchJsonWithTimeout(
    `${baseUrl}${path}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    },
    timeoutMs,
  );
}

serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const internalToken = Deno.env.get("INTERNAL_JOB_TOKEN") ?? "";
  const jobHeader = req.headers.get("x-job-token") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const authHeader = req.headers.get("Authorization") ?? "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const apiKeyHeader = req.headers.get("apikey") ?? "";

  const hasInternalToken = internalToken && jobHeader === internalToken;
  const hasAnonKey = anonKey && (bearerToken === anonKey || apiKeyHeader === anonKey);

  if (!hasInternalToken && !hasAnonKey) {
    return jsonError("Unauthorized", 401, "INVALID_JOB_TOKEN", req);
  }

  const startedAt = new Date().toISOString();
  const admin = getAdminClient();

  const respondWithLog = async (payload: RefreshResult, status: number) => {
    await safeInsertJobRunLog(admin, {
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      job_name: FN_NAME,
      provider: "openrouter",
      model: null,
      ok: payload.ok,
      error_code: payload.ok ? null : "OPENROUTER_REFRESH_FAILED",
      error_message: payload.ok ? null : JSON.stringify(payload.errors).slice(0, 500),
      meta: { base_url: payload.base_url, refreshed: payload.refreshed },
    });

    return status >= 400
      ? jsonError(payload.ok ? "Error" : "Refresh failed", status, "OPENROUTER_REFRESH_FAILED", req, {
          errors: payload.errors,
        })
      : jsonResponse(payload, status, undefined, req);
  };

  try {
    const { data: body, errorResponse } = await validateRequest<RequestPayload>(
      req,
      (raw) => RequestSchema.parse(raw ?? {}),
      { logPrefix: `[${FN_NAME}]`, requireJson: false },
    );
    if (errorResponse || !body) return errorResponse!;

    const cfg = getConfig();
    if (!cfg.openrouterApiKey) {
      return await respondWithLog(
        {
          ok: false,
          base_url: normalizeOpenRouterBaseUrl(body.base_url),
          fetched_at: new Date().toISOString(),
          errors: { auth: "Missing OPENROUTER_API_KEY" },
          refreshed: {},
        },
        500,
      );
    }

    const baseUrl = await resolveOpenRouterBaseUrl(admin, body.base_url ?? null);
    const timeoutMs = Number(body.timeout_ms ?? 8000);
    const fetchedAt = new Date().toISOString();

    const results = await Promise.allSettled([
      fetchOpenRouterPayload(baseUrl, "/models", cfg.openrouterApiKey, timeoutMs),
      fetchOpenRouterPayload(baseUrl, "/credits", cfg.openrouterApiKey, timeoutMs),
      fetchOpenRouterPayload(baseUrl, "/usage", cfg.openrouterApiKey, timeoutMs),
      fetchOpenRouterPayload(baseUrl, "/endpoints", cfg.openrouterApiKey, timeoutMs),
    ]);

    const keys = ["models", "credits", "usage", "endpoints"] as const;
    const errors: Record<string, string> = {};
    const refreshed: Record<string, boolean> = {};

    for (let i = 0; i < results.length; i++) {
      const key = keys[i];
      const result = results[i];
      if (result.status === "fulfilled") {
        const payload = result.value;
        const table = `openrouter_${key}_cache` as const;
        await writeOpenRouterCache(admin, table, baseUrl, payload, fetchedAt);
        refreshed[key] = true;
      } else {
        const err = result.reason as any;
        const msg = err?.message ?? String(err ?? "Unknown error");
        errors[key] = msg;
        refreshed[key] = false;
      }
    }

    const ok = Object.keys(errors).length === 0;

    return await respondWithLog(
      {
        ok,
        base_url: baseUrl,
        fetched_at: fetchedAt,
        errors,
        refreshed,
      },
      ok ? 200 : 502,
    );
  } catch (err) {
    return await respondWithLog(
      {
        ok: false,
        base_url: normalizeOpenRouterBaseUrl(undefined),
        fetched_at: new Date().toISOString(),
        errors: { exception: (err as any)?.message ?? String(err) },
        refreshed: {},
      },
      500,
    );
  }
});
