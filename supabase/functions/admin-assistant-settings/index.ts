import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { requireAdmin, json, handleCors, jsonError } from "../_shared/admin.ts";
import {
  getAssistantSettings,
  getDefaultAssistantSettings,
  getDefaultModelCatalog,
} from "../_shared/assistantSettings.ts";

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

const BodySchema = z
  .object({
    action: z.enum(["get", "set"]).default("get"),
    settings: z
      .object({
        openrouter_base_url: z.string().url().nullable().optional(),
        model_fast: z.string().min(1).nullable().optional(),
        model_creative: z.string().min(1).nullable().optional(),
        model_planner: z.string().min(1).nullable().optional(),
        model_maker: z.string().min(1).nullable().optional(),
        model_critic: z.string().min(1).nullable().optional(),
        fallback_models: z.array(z.string().min(1)).nullable().optional(),
        model_catalog: z.array(z.string().min(1)).nullable().optional(),
        default_instructions: z.string().nullable().optional(),
        params: ParamsSchema.nullable().optional(),
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
      const fallback_models = uniqStrings(incoming.fallback_models ?? defaults.fallback_models ?? []);
      const model_catalog = uniqStrings(incoming.model_catalog ?? defaults.model_catalog ?? []);

      const payload = {
        id: 1,
        openrouter_base_url: incoming.openrouter_base_url ?? defaults.openrouter_base_url,
        model_fast: incoming.model_fast ?? defaults.model_fast,
        model_creative: incoming.model_creative ?? defaults.model_creative,
        model_planner: incoming.model_planner ?? defaults.model_planner,
        model_maker: incoming.model_maker ?? defaults.model_maker,
        model_critic: incoming.model_critic ?? defaults.model_critic,
        fallback_models,
        model_catalog,
        default_instructions: incoming.default_instructions ?? defaults.default_instructions,
        params: incoming.params ?? defaults.params,
        updated_at: new Date().toISOString(),
      };

      const { error } = await svc.from("assistant_settings").upsert(payload);
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

    return json(req, 400, { ok: false, message: `Unknown action: ${action}` });
  } catch (e) {
    return jsonError(req, e);
  }
});
