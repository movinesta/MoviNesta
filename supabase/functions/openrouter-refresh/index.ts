import { serve } from "jsr:@std/http@0.224.0/server";
import { z } from "zod";

import { handleOptions, jsonError, jsonResponse, validateRequest } from "../_shared/http.ts";
import { getConfig } from "../_shared/config.ts";
import { getAdminClient } from "../_shared/supabase.ts";
import { safeInsertJobRunLog } from "../_shared/joblog.ts";
import { fetchJsonWithTimeout } from "../_shared/fetch.ts";
import { normalizeOpenRouterBaseUrl, resolveOpenRouterBaseUrl, writeOpenRouterCache, writeOpenRouterParametersCache } from "../_shared/openrouterCache.ts";

const FN_NAME = "openrouter-refresh";

const RequestSchema = z.object({
  base_url: z.string().optional(),
  timeout_ms: z.number().int().min(1000).max(20000).optional(),
  refresh_parameters: z.boolean().optional(),
  max_models: z.number().int().min(1).max(50).optional(),
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
  attribution: { http_referer: string; x_title: string },
  timeoutMs: number,
): Promise<unknown> {
  return await fetchJsonWithTimeout(
    `${baseUrl}${path}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        // Optional but recommended by OpenRouter for attribution/analytics.
        "HTTP-Referer": attribution.http_referer,
        "X-Title": attribution.x_title,
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
  const hasInternalToken = internalToken && jobHeader === internalToken;

  if (!hasInternalToken) {
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
    // Deno/TS doesn't narrow optional object properties reliably across async/closures.
    // Copy to a stable local const to keep type-checking happy.
    const apiKey = String(cfg.openrouterApiKey ?? "").trim();
    if (!apiKey) {
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

    const referer = String(cfg.openrouterHttpReferer ?? "https://movinesta.app/").trim() || "https://movinesta.app/";
    const titleBase = String(cfg.openrouterXTitle ?? "MoviNesta").trim() || "MoviNesta";
    const attribution = { http_referer: referer, x_title: titleBase };


    const results = await Promise.allSettled([
      fetchOpenRouterPayload(baseUrl, "/models", apiKey, attribution, timeoutMs),
      fetchOpenRouterPayload(baseUrl, "/credits", apiKey, attribution, timeoutMs),
      fetchOpenRouterPayload(baseUrl, "/usage", apiKey, attribution, timeoutMs),
      // NOTE: historically, OpenRouter exposed a top-level /endpoints route. Newer docs primarily document
      // per-model endpoints at /models/:author/:slug/endpoints. We keep this fast path and add a fallback below.
      fetchOpenRouterPayload(baseUrl, "/endpoints", apiKey, attribution, timeoutMs),
      fetchOpenRouterPayload(baseUrl, "/key", apiKey, attribution, timeoutMs),
    ]);

    const keys = ["models", "credits", "usage", "endpoints", "key"] as const;
    const errors: Record<string, string> = {};
    const refreshed: Record<string, boolean> = {};

    for (let i = 0; i < results.length; i++) {
      const key = keys[i];
      const result = results[i];
      if (result.status === "fulfilled") {
        const payload = result.value;
        const category = key as any; // Cast to OpenRouterCacheCategory
        await writeOpenRouterCache(admin, category, baseUrl, payload, fetchedAt);
        refreshed[key] = true;
      } else {
        const err = result.reason as any;
        const msg = err?.message ?? String(err ?? "Unknown error");
        errors[key] = msg;
        refreshed[key] = false;
      }
    }

    // Fallback: if the top-level /endpoints route fails, build an endpoints cache by querying the
    // documented per-model endpoints list for the models configured in assistant_settings.
    if (!refreshed.endpoints) {
      try {
        const maxModels = Math.max(1, Math.min(25, Number(body.max_models ?? 10)));

        const { data: settings } = await admin
          .from("assistant_settings")
          .select("model_fast,model_creative,model_planner,model_maker,model_critic,fallback_models,model_catalog")
          .eq("id", 1)
          .maybeSingle();

        const collected: string[] = [];
        const pushModel = (v: unknown) => {
          const s = String(v ?? "").trim();
          if (s) collected.push(s);
        };

        if (settings) {
          pushModel((settings as any).model_fast);
          pushModel((settings as any).model_creative);
          pushModel((settings as any).model_planner);
          pushModel((settings as any).model_maker);
          pushModel((settings as any).model_critic);

          const fallback = (settings as any).fallback_models;
          if (Array.isArray(fallback)) fallback.forEach(pushModel);

          const catalog = (settings as any).model_catalog;
          if (Array.isArray(catalog)) catalog.forEach(pushModel);
        }

        const uniqueModels = Array.from(new Set(collected)).slice(0, maxModels);

        const fetchEndpoints = async (modelId: string) => {
          const [author, ...rest] = modelId.split("/");
          const slug = rest.join("/");
          if (!author || !slug) throw new Error(`Invalid model id: ${modelId}`);
          const path = `/models/${encodeURIComponent(author)}/${encodeURIComponent(slug)}/endpoints`;
          return await fetchOpenRouterPayload(baseUrl, path, apiKey, attribution, timeoutMs);
        };

        const aggregated: any[] = [];
        const concurrency = 3;
        for (let i = 0; i < uniqueModels.length; i += concurrency) {
          const batch = uniqueModels.slice(i, i + concurrency);
          await Promise.all(
            batch.map(async (modelId) => {
              try {
                const payload = await fetchEndpoints(modelId);
                const list = Array.isArray((payload as any)?.data)
                  ? (payload as any).data
                  : Array.isArray(payload)
                    ? payload
                    : Array.isArray((payload as any)?.data?.endpoints)
                      ? (payload as any).data.endpoints
                      : Array.isArray((payload as any)?.endpoints)
                        ? (payload as any).endpoints
                        : [];
                for (const ep of list) {
                  aggregated.push({ ...(ep ?? {}), model: modelId, model_id: modelId });
                }
                refreshed[`endpoints:${modelId}`] = true;
              } catch (e) {
                errors[`endpoints:${modelId}`] = (e as any)?.message ?? String(e);
                refreshed[`endpoints:${modelId}`] = false;
              }
            }),
          );
        }

        await writeOpenRouterCache(
          admin,
          "endpoints",
          baseUrl,
          { aggregated: true, models: uniqueModels, data: aggregated },
          fetchedAt,
        );
        refreshed.endpoints = true;
        delete errors.endpoints;
      } catch (e) {
        // Keep original /endpoints error (if any) and also surface fallback failures.
        errors.endpoints_fallback = (e as any)?.message ?? String(e);
      }
    }

    // Optionally refresh per-model supported parameters cache for models configured in assistant_settings.
    const refreshParameters = body.refresh_parameters ?? true;
    if (refreshParameters) {
      try {
        const maxModels = Math.max(1, Math.min(50, Number(body.max_models ?? 25)));

        const { data: settings } = await admin
          .from("assistant_settings")
          .select("model_fast,model_creative,model_planner,model_maker,model_critic,fallback_models,model_catalog")
          .eq("id", 1)
          .maybeSingle();

        const collected: string[] = [];
        const pushModel = (v: unknown) => {
          const s = String(v ?? "").trim();
          if (s) collected.push(s);
        };

        if (settings) {
          pushModel((settings as any).model_fast);
          pushModel((settings as any).model_creative);
          pushModel((settings as any).model_planner);
          pushModel((settings as any).model_maker);
          pushModel((settings as any).model_critic);

          const fallback = (settings as any).fallback_models;
          if (Array.isArray(fallback)) fallback.forEach(pushModel);

          const catalog = (settings as any).model_catalog;
          if (Array.isArray(catalog)) catalog.forEach(pushModel);
        }

        const uniqueModels = Array.from(new Set(collected)).slice(0, maxModels);

        const fetchParameters = async (modelId: string) => {
          const [author, ...rest] = modelId.split("/");
          const slug = rest.join("/");
          if (!author || !slug) throw new Error(`Invalid model id: ${modelId}`);
          const path = `/parameters/${encodeURIComponent(author)}/${encodeURIComponent(slug)}`;
          return await fetchOpenRouterPayload(baseUrl, path, apiKey, attribution, timeoutMs);
        };

        const concurrency = 4;
        for (let i = 0; i < uniqueModels.length; i += concurrency) {
          const batch = uniqueModels.slice(i, i + concurrency);
          await Promise.all(
            batch.map(async (modelId) => {
              try {
                const payload = await fetchParameters(modelId);
                await writeOpenRouterParametersCache(admin, baseUrl, modelId, null, payload, fetchedAt);
                refreshed[`parameters:${modelId}`] = true;
              } catch (e) {
                errors[`parameters:${modelId}`] = (e as any)?.message ?? String(e);
                refreshed[`parameters:${modelId}`] = false;
              }
            }),
          );
        }
      } catch (e) {
        errors.parameters = (e as any)?.message ?? String(e);
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
