import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { requireAdmin, json, handleCors, jsonError } from "../_shared/admin.ts";
import {
  getAssistantSettings,
  getDefaultAssistantSettings,
  getDefaultModelCatalog,
} from "../_shared/assistantSettings.ts";
import { openrouterChatWithFallback, type OpenRouterMessage } from "../_shared/openrouter.ts";
import { classifyOpenRouterError, type AiCulprit } from "../_shared/aiErrors.ts";
import { safeInsertOpenRouterUsageLog } from "../_shared/openrouterUsageLog.ts";

const ParamsSchema = z
  .preprocess((val) => {
    if (typeof val !== "string") return val;
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  }, z.object({
    temperature: z.number().min(0).max(2).nullable().optional(),
    top_p: z.number().min(0).max(1).nullable().optional(),
    max_output_tokens: z.number().int().min(1).max(32768).nullable().optional(),
    timeout_ms: z.number().int().min(1000).max(120000).nullable().optional(),
    presence_penalty: z.number().min(-2).max(2).nullable().optional(),
    frequency_penalty: z.number().min(-2).max(2).nullable().optional(),
    seed: z.number().int().min(0).max(2_000_000_000).nullable().optional(),
    stop: z.union([z.string(), z.array(z.string())]).nullable().optional(),
    logprobs: z.boolean().nullable().optional(),
    top_logprobs: z.number().int().min(0).max(20).nullable().optional(),
    parallel_tool_calls: z.boolean().nullable().optional(),
    stream: z.boolean().nullable().optional(),
    metadata: z.record(z.any()).nullable().optional(),
    user: z.string().nullable().optional(),
    instructions: z.string().nullable().optional(),
    tools: z.array(z.any()).nullable().optional(),
    tool_choice: z.any().nullable().optional(),
    response_format: z.any().nullable().optional(),
    plugins: z.array(z.any()).nullable().optional(),
  }).strict());

const BehaviorSchema = z
  .preprocess((val) => {
    if (typeof val !== "string") return val;
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  }, z.record(z.any()));

function extractUpstreamRequestId(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate =
    (raw as any).id ??
    (raw as any).request_id ??
    (raw as any).requestId ??
    null;
  return typeof candidate === "string" && candidate.trim() ? candidate : null;
}

const NullableUrlSchema = z.preprocess((val) => {
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed) return null;
    return trimmed;
  }
  return val;
}, z.string().url().nullable());

const BodySchema = z
  .object({
    action: z.enum(["get", "set", "test_provider", "test_routing"]).default("get"),
    settings: z
      .object({
        openrouter_base_url: NullableUrlSchema.optional(),
        model_fast: z.string().min(1).nullable().optional(),
        model_creative: z.string().min(1).nullable().optional(),
        model_planner: z.string().min(1).nullable().optional(),
        model_maker: z.string().min(1).nullable().optional(),
        model_critic: z.string().min(1).nullable().optional(),
        fallback_models: z.array(z.string().min(1)).nullable().optional(),
        model_catalog: z.array(z.string().min(1)).nullable().optional(),
        default_instructions: z.string().nullable().optional(),
        params: ParamsSchema.nullable().optional(),
        behavior: BehaviorSchema.nullable().optional(),
      })
      .optional(),
    test: z
      .object({
        prompt: z.string().min(1).max(4000).optional(),
        model_key: z.enum(["fast", "creative", "planner", "maker", "critic"]).optional(),
        model: z.string().min(1).optional(),
      })
      .optional(),
    routing_test: z
      .object({
        prompt: z.string().min(1).max(4000).optional(),
        mode: z.enum(["current", "auto", "fallback"]).optional(),
        simulate_advanced_params: z.boolean().optional(),
      })
      .optional(),
  })
  .optional();

function uniqStrings(list: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  for (const item of list) {
    const v = String(item ?? "").trim();
    if (!v) continue;
    if (!out.includes(v)) out.push(v);
  }
  return out;
}

function hasProviderRoutingConfig(provider?: Record<string, unknown> | null): boolean {
  if (!provider) return false;
  const lists = [
    (provider as any).order,
    (provider as any).only,
    (provider as any).require, // legacy
    (provider as any).allow, // legacy
    (provider as any).ignore,
    (provider as any).quantizations,
  ];
  if (lists.some((arr) => Array.isArray(arr) && arr.length > 0)) return true;

  // Only treat values that differ from OpenRouter defaults as "configured".
  // Defaults: allow_fallbacks=true, require_parameters=false, zdr=false, data_collection="allow".
  if (typeof (provider as any).allow_fallbacks === "boolean" && (provider as any).allow_fallbacks === false) return true;
  if ((provider as any).require_parameters === true) return true;
  if ((provider as any).data_collection === "deny") return true;
  if ((provider as any).zdr === true) return true;

  const sort = (provider as any).sort;
  if (sort) return true; // string or object

  if ((provider as any).preferred_min_throughput !== undefined) return true;
  if ((provider as any).preferred_max_latency !== undefined) return true;
  if ((provider as any).enforce_distillable_text === true) return true;
  const mp = (provider as any).max_price;
  if (mp && typeof mp === "object") {
    if (["prompt", "completion", "request", "image"].some((k) => Number.isFinite(Number((mp as any)?.[k])))) return true;
  }

  return false;
}

function extractRoutingProvider(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = (raw as any).provider ?? (raw as any).provider_name ?? (raw as any).providerName ?? null;
  if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  if (candidate && typeof candidate === "object") {
    const name = (candidate as any).name ?? (candidate as any).id ?? (candidate as any).provider ?? null;
    if (typeof name === "string" && name.trim()) return name.trim();
  }
  const metaCandidate = (raw as any)?.metadata?.provider ?? (raw as any)?.meta?.provider ?? null;
  if (typeof metaCandidate === "string" && metaCandidate.trim()) return metaCandidate.trim();
  return null;
}

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { svc, userId } = await requireAdmin(req);
    const body = BodySchema.parse(await req.json().catch(() => ({})));
    const action = body?.action ?? "get";

    if (action === "get") {
      let settings;
      try {
        settings = await getAssistantSettings(svc);
      } catch (err: any) {
        const msg = String(err?.message ?? err ?? "");
        return json(req, 503, {
          ok: false,
          message: msg.includes("assistant_settings")
            ? "assistant_settings table is missing. Apply the migration before using this endpoint."
            : "Failed to load assistant settings.",
        });
      }
      return json(req, 200, {
        ok: true,
        assistant_settings: settings,
        defaults: {
          model_catalog: getDefaultModelCatalog(),
          settings: getDefaultAssistantSettings(),
        },
      });
    }

    if (action === "set") {
      const defaults = getDefaultAssistantSettings();
      const incoming = body?.settings ?? {};
      const openrouterBaseUrl = typeof incoming.openrouter_base_url === "string" && !incoming.openrouter_base_url.trim()
        ? null
        : incoming.openrouter_base_url;
      const fallback_models = uniqStrings(incoming.fallback_models ?? defaults.fallback_models ?? []);
      const model_catalog = uniqStrings(incoming.model_catalog ?? defaults.model_catalog ?? []);

      const payload = {
        id: 1,
        openrouter_base_url: openrouterBaseUrl ?? defaults.openrouter_base_url,
        model_fast: incoming.model_fast ?? defaults.model_fast,
        model_creative: incoming.model_creative ?? defaults.model_creative,
        model_planner: incoming.model_planner ?? defaults.model_planner,
        model_maker: incoming.model_maker ?? defaults.model_maker,
        model_critic: incoming.model_critic ?? defaults.model_critic,
        fallback_models,
        model_catalog,
        default_instructions: incoming.default_instructions ?? defaults.default_instructions,
        params: incoming.params ?? defaults.params,
        behavior: incoming.behavior ?? (defaults as any).behavior ?? null,
        updated_at: new Date().toISOString(),
      };

      // Backwards compatibility: if DB schema doesn't have behavior yet.
      let { error } = await svc.from("assistant_settings").upsert(payload);
      if (error && /behavior/i.test(String(error.message ?? ""))) {
        const { behavior: _ignore, ...fallback } = payload as any;
        ({ error } = await svc.from("assistant_settings").upsert(fallback));
      }
      if (error) return json(req, 500, { ok: false, message: error.message });

      await svc.from("admin_audit_log").insert({
        admin_user_id: userId,
        action: "assistant_settings_update",
        target: "assistant_settings",
        details: payload,
      });

      const settings = await getAssistantSettings(svc);
      return json(req, 200, { ok: true, assistant_settings: settings });
    }

    if (action === "test_provider") {
      const requestId = (req.headers.get("x-request-id") ?? req.headers.get("x-correlation-id") ?? "").trim() ||
        (() => {
          try {
            return crypto.randomUUID();
          } catch {
            return `req_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
          }
        })();

      let settings;
      try {
        settings = await getAssistantSettings(svc);
      } catch (err: any) {
        const msg = String(err?.message ?? err ?? "");
        return json(req, 503, {
          ok: false,
          message: msg.includes("assistant_settings")
            ? "assistant_settings table is missing. Apply the migration before using this endpoint."
            : "Failed to load assistant settings.",
        }, { "x-request-id": requestId });
      }

      const test = body?.test ?? {};
      const prompt = String(test.prompt ?? "Reply with exactly: OK").trim();
      const modelKey = (String(test.model_key ?? "fast").trim().toLowerCase() || "fast") as
        "fast" | "creative" | "planner" | "maker" | "critic";
      const explicitModel = typeof test.model === "string" ? test.model.trim() : "";

      const modelKeyMap: Record<string, keyof typeof settings> = {
        fast: "model_fast",
        creative: "model_creative",
        planner: "model_planner",
        maker: "model_maker",
        critic: "model_critic",
      };

      const selectedModel = (explicitModel || (settings as any)[modelKeyMap[modelKey]] || settings.model_fast || "").trim();
      const models = uniqStrings([selectedModel, ...(settings.fallback_models ?? [])]);

      const baseUrl = (settings.openrouter_base_url ?? "").trim() || null;
      const timeoutMs = Number((settings as any)?.params?.timeout_ms ?? 12_000);

      const diagnostics = ((settings as any)?.behavior?.diagnostics ?? {}) as any;
      const userFacing = {
        mode: diagnostics?.user_error_detail ?? "friendly",
        showCulpritVar: diagnostics?.user_error_show_culprit_var,
        showCulpritValue: diagnostics?.user_error_show_culprit_value,
        showStatusModel: diagnostics?.user_error_show_status_model,
        showTraceIds: diagnostics?.user_error_show_trace_ids,
      };

      const t0 = Date.now();
      try {
        if (!models.length) {
          throw new Error("No model selected (assistant_settings.* is empty)");
        }

        const messages: OpenRouterMessage[] = [
          { role: "system", content: "You are an API connectivity test. Reply very briefly." },
          { role: "user", content: prompt },
        ];

        const attribution = (settings as any)?.behavior?.router?.attribution ?? undefined;

        const res = await openrouterChatWithFallback({
          models,
          messages,
          base_url: baseUrl ?? undefined,
          timeout_ms: Number.isFinite(timeoutMs) ? timeoutMs : 12_000,
          max_output_tokens: 32,
          temperature: 0,
          stream: false,
          attribution,
        });
        void safeInsertOpenRouterUsageLog(svc, {
          fn: "admin-assistant-settings",
          request_id: requestId,
          user_id: userId,
          conversation_id: null,
          provider: "openrouter",
          model: res?.model ?? null,
          base_url: baseUrl ?? null,
          usage: res?.usage ?? null,
          upstream_request_id: extractUpstreamRequestId((res as any)?.raw),
          variant: (res as any)?.variant ?? null,
          meta: { stage: "provider_test" },
        });

        const durationMs = Date.now() - t0;
        return json(req, 200, {
          ok: true,
          requestId,
          test: {
            ok: true,
            durationMs,
            baseUrl,
            usedModel: res?.model ?? null,
            contentPreview: typeof res?.content === "string" ? res.content.slice(0, 200) : null,
          },
        }, { "x-request-id": requestId });
      } catch (e: any) {
        const durationMs = Date.now() - t0;
        const attemptedModel: string | null =
          (e as any)?.attemptedModel ?? (e as any)?.openrouter?.model ?? (selectedModel || null);
        const payloadVariant: string | null = (e as any)?.openrouter?.variant ?? null;
        const upstreamRequestId: string | null =
          (e as any)?.upstreamRequestId ?? (e as any)?.openrouter?.upstreamRequestId ?? null;
        const modelsTried = (e as any)?.modelsTried ?? undefined;

        const baseUrlCulprit: AiCulprit = {
          var: "assistant_settings.openrouter_base_url",
          source: "assistant_settings",
          value_preview: baseUrl ?? null,
        };

        const modelVarForKey: Record<string, string> = {
          fast: "assistant_settings.model_fast",
          creative: "assistant_settings.model_creative",
          planner: "assistant_settings.model_planner",
          maker: "assistant_settings.model_maker",
          critic: "assistant_settings.model_critic",
        };

        const status = Number((e as any)?.status ?? 0);
        const msg = e instanceof Error ? e.message : String(e ?? "OpenRouter error");
        const lower = msg.toLowerCase();

        let culprit: AiCulprit = baseUrlCulprit;
        if (status === 401 || status === 403 || lower.includes("api key") || lower.includes("unauthorized")) {
          culprit = { var: "env.OPENROUTER_API_KEY", source: "env", value_preview: null };
        } else if (lower.includes("no model") || lower.includes("no models") || lower.includes("model is required")) {
          culprit = explicitModel
            ? { var: "admin_test.model", source: "request", value_preview: explicitModel }
            : { var: modelVarForKey[modelKey] ?? "assistant_settings.model_fast", source: "assistant_settings", value_preview: attemptedModel };
        } else if (status === 404 || lower.includes("not found")) {
          culprit = baseUrlCulprit;
        }

        const classified = classifyOpenRouterError({
          userFacing,
          err: e,
          requestId,
          runnerJobId: null,
          baseUrl,
          timeoutMs,
          attemptedModel,
          payloadVariant,
          upstreamRequestId,
          modelsTried,
          culprit,
        });

        return json(req, 200, {
          ok: true,
          requestId,
          test: {
            ok: false,
            durationMs,
            baseUrl,
            usedModel: attemptedModel,
            userMessage: classified.userMessage,
            envelope: classified.envelope,
            culprit,
          },
        }, { "x-request-id": requestId });
      }
    }

    if (action === "test_routing") {
      const requestId = (req.headers.get("x-request-id") ?? req.headers.get("x-correlation-id") ?? "").trim() ||
        (() => {
          try {
            return crypto.randomUUID();
          } catch {
            return `req_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
          }
        })();

      let settings;
      try {
        settings = await getAssistantSettings(svc);
      } catch (err: any) {
        const msg = String(err?.message ?? err ?? "");
        return json(req, 503, {
          ok: false,
          message: msg.includes("assistant_settings")
            ? "assistant_settings table is missing. Apply the migration before using this endpoint."
            : "Failed to load assistant settings.",
        }, { "x-request-id": requestId });
      }

      const routingTest = body?.routing_test ?? {};
      const prompt = String(routingTest.prompt ?? "Reply with exactly: OK").trim();
      const modeOverride = String(routingTest.mode ?? "current").trim().toLowerCase();

      const simulateAdvanced = !!(routingTest as any).simulate_advanced_params;

      const behavior = (settings as any)?.behavior ?? {};
      const routingPolicy = (behavior as any)?.router?.policy ?? {};
      const defaultMode = String(routingPolicy?.mode ?? "").trim().toLowerCase() === "auto" ? "auto" : "fallback";
      const effectiveMode = modeOverride === "auto" || modeOverride === "fallback" ? modeOverride : defaultMode;
      const policyAutoModel = String(routingPolicy?.auto_model ?? "").trim() || null;
      const policyFallbacks = Array.isArray(routingPolicy?.fallback_models) ? routingPolicy.fallback_models : [];
      const policyVariants =
        Array.isArray(routingPolicy?.variants) && routingPolicy.variants.length ? routingPolicy.variants : null;
      const providerRaw = routingPolicy?.provider ?? null;
      const toStrArray = (v: unknown): string[] =>
        Array.isArray(v) ? v.map((x) => String(x ?? "").trim()).filter(Boolean) : [];
      const uniq = (arr: string[]) => Array.from(new Set(arr));

      const policyProvider = hasProviderRoutingConfig(providerRaw)
        ? (() => {
          const pr: any = providerRaw ?? {};
          const order = toStrArray(pr.order);
          const ignore = toStrArray(pr.ignore);
          const only = uniq([
            ...toStrArray(pr.only),
            // Legacy aliases (still supported)
            ...toStrArray(pr.require),
            ...toStrArray(pr.allow),
          ]);
          const allow_fallbacks = typeof pr.allow_fallbacks === "boolean" ? pr.allow_fallbacks : undefined;
          const require_parameters = typeof pr.require_parameters === "boolean" ? pr.require_parameters : undefined;
          const data_collection =
            pr.data_collection === "allow" || pr.data_collection === "deny" ? pr.data_collection : undefined;
          const zdr = typeof pr.zdr === "boolean" ? pr.zdr : undefined;
          const quantizations = toStrArray(pr.quantizations);
          const sort = pr.sort === "price" || pr.sort === "throughput" || pr.sort === "latency" ? pr.sort : undefined;

          const out: any = {};
          if (order.length) out.order = order;
          if (only.length) out.only = only;
          if (ignore.length) out.ignore = ignore;
          if (typeof allow_fallbacks === "boolean") out.allow_fallbacks = allow_fallbacks;
          if (typeof require_parameters === "boolean") out.require_parameters = require_parameters;
          if (data_collection) out.data_collection = data_collection;
          if (typeof zdr === "boolean") out.zdr = zdr;
          if (quantizations.length) out.quantizations = quantizations;
          if (sort) out.sort = sort;

          return Object.keys(out).length ? out : null;
        })()
        : null;

      const baseModels = uniqStrings([
        settings.model_fast ?? null,
        settings.model_creative ?? null,
        settings.model_planner ?? null,
        settings.model_maker ?? null,
        settings.model_critic ?? null,
        ...(settings.fallback_models ?? []),
        ...(settings.model_catalog ?? []),
      ]);

      const models = uniqStrings([
        ...(effectiveMode === "auto" && policyAutoModel ? [policyAutoModel] : []),
        ...baseModels,
        ...policyFallbacks,
      ]);

      const baseUrl = (settings.openrouter_base_url ?? "").trim() || null;
      const timeoutMs = Number((settings as any)?.params?.timeout_ms ?? 12_000);

      const diagnostics = ((settings as any)?.behavior?.diagnostics ?? {}) as any;
      const userFacing = {
        mode: diagnostics?.user_error_detail ?? "friendly",
        showCulpritVar: diagnostics?.user_error_show_culprit_var,
        showCulpritValue: diagnostics?.user_error_show_culprit_value,
        showStatusModel: diagnostics?.user_error_show_status_model,
        showTraceIds: diagnostics?.user_error_show_trace_ids,
      };

      const t0 = Date.now();
      try {
        if (!models.length) {
          throw new Error("No models selected (assistant_settings.* is empty)");
        }

        const messages: OpenRouterMessage[] = [
          { role: "system", content: "You are an API routing test. Reply very briefly." },
          { role: "user", content: prompt },
        ];

        const attribution = (behavior as any)?.router?.attribution ?? undefined;

        const res = await openrouterChatWithFallback({
          models,
          messages,
          base_url: baseUrl ?? undefined,
          timeout_ms: Number.isFinite(timeoutMs) ? timeoutMs : 12_000,
          max_output_tokens: 64,
          temperature: 0,
          stream: false,
          // Optional toggle: simulate tools/tool_choice to validate provider.require_parameters behavior.
          ...(simulateAdvanced ? {
            tools: [
              {
                type: "function",
                function: {
                  name: "noop",
                  description: "No-op routing test tool. Never call it.",
                  parameters: { type: "object", properties: {}, additionalProperties: false },
                },
              },
            ],
            tool_choice: "none",
            parallel_tool_calls: false,
          } : {}),
          attribution,
          provider: policyProvider ?? undefined,
          payload_variants: policyVariants ?? undefined,
        });

        const resolvedProvider = extractRoutingProvider((res as any)?.raw ?? null);
        const durationMs = Date.now() - t0;
        void safeInsertOpenRouterUsageLog(svc, {
          fn: "admin-assistant-settings",
          request_id: requestId,
          user_id: userId,
          conversation_id: null,
          provider: resolvedProvider ?? "openrouter",
          model: res?.model ?? null,
          base_url: baseUrl ?? null,
          usage: res?.usage ?? null,
          upstream_request_id: extractUpstreamRequestId((res as any)?.raw),
          variant: (res as any)?.variant ?? null,
          meta: {
            stage: "routing_test",
            routing: {
              policy: {
                mode: effectiveMode,
                auto_model: policyAutoModel,
                fallback_models: policyFallbacks,
                provider: policyProvider,
                variants: policyVariants ?? [],
              },
              model_candidates: models,
            },
            decision: {
              provider: resolvedProvider,
              model: res?.model ?? null,
              variant: (res as any)?.variant ?? null,
              require_parameters: (typeof (policyProvider as any)?.require_parameters === "boolean") ? (policyProvider as any).require_parameters : (simulateAdvanced && ((res as any)?.variant !== "drop_tools" && (res as any)?.variant !== "bare") ? true : null),
              require_parameters_source: (typeof (policyProvider as any)?.require_parameters === "boolean") ? "policy" : (simulateAdvanced && ((res as any)?.variant !== "drop_tools" && (res as any)?.variant !== "bare") ? "auto" : "none"),
            },
          },
        });

        return json(req, 200, {
          ok: true,
          requestId,
          test: {
            ok: true,
            durationMs,
            baseUrl,
            usedModel: res?.model ?? null,
            usedVariant: (res as any)?.variant ?? null,
            usedProvider: resolvedProvider,
            policyMode: effectiveMode,
            requireParameters: (typeof (policyProvider as any)?.require_parameters === "boolean") ? (policyProvider as any).require_parameters : (simulateAdvanced && ((res as any)?.variant !== "drop_tools" && (res as any)?.variant !== "bare") ? true : null),
            requireParametersSource: (typeof (policyProvider as any)?.require_parameters === "boolean") ? "policy" : (simulateAdvanced && ((res as any)?.variant !== "drop_tools" && (res as any)?.variant !== "bare") ? "auto" : "none"),
            contentPreview: typeof res?.content === "string" ? res.content.slice(0, 200) : null,
            modelCandidates: models,
            routing: {
              policy: {
                mode: effectiveMode,
                auto_model: policyAutoModel,
                fallback_models: policyFallbacks,
                provider: policyProvider,
                variants: policyVariants ?? [],
              },
            },
          },
        }, { "x-request-id": requestId });
      } catch (e: any) {
        const durationMs = Date.now() - t0;
        const attemptedModel: string | null =
          (e as any)?.attemptedModel ?? (e as any)?.openrouter?.model ?? (models[0] || null);
        const payloadVariant: string | null = (e as any)?.openrouter?.variant ?? null;
        const upstreamRequestId: string | null =
          (e as any)?.upstreamRequestId ?? (e as any)?.openrouter?.upstreamRequestId ?? null;
        const modelsTried = (e as any)?.modelsTried ?? undefined;

        const baseUrlCulprit: AiCulprit = {
          var: "assistant_settings.openrouter_base_url",
          source: "assistant_settings",
          value_preview: baseUrl ?? null,
        };

        const status = Number((e as any)?.status ?? 0);
        const msg = e instanceof Error ? e.message : String(e ?? "OpenRouter error");
        const lower = msg.toLowerCase();

        let culprit: AiCulprit = baseUrlCulprit;
        if (status === 401 || status === 403 || lower.includes("api key") || lower.includes("unauthorized")) {
          culprit = { var: "env.OPENROUTER_API_KEY", source: "env", value_preview: null };
        } else if (lower.includes("no model") || lower.includes("no models") || lower.includes("model is required")) {
          culprit = { var: "assistant_settings.model_fast", source: "assistant_settings", value_preview: attemptedModel };
        } else if (status === 404 || lower.includes("not found")) {
          culprit = baseUrlCulprit;
        }

        const classified = classifyOpenRouterError({
          userFacing,
          err: e,
          requestId,
          runnerJobId: null,
          baseUrl,
          timeoutMs,
          attemptedModel,
          payloadVariant,
          upstreamRequestId,
          modelsTried,
          culprit,
        });

        return json(req, 200, {
          ok: true,
          requestId,
          test: {
            ok: false,
            durationMs,
            baseUrl,
            usedModel: attemptedModel,
            userMessage: classified.userMessage,
            envelope: classified.envelope,
            culprit,
          },
        }, { "x-request-id": requestId });
      }
    }

    return json(req, 400, { ok: false, message: `Unknown action: ${action}` });
  } catch (e) {
    return jsonError(req, e);
  }
});
