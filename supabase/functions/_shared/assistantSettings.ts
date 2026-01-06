import { getConfig } from "./config.ts";
import { getAdminClient } from "./supabase.ts";

export type AssistantSettingsRow = {
  id: number;
  openrouter_base_url?: string | null;
  model_fast?: string | null;
  model_creative?: string | null;
  model_planner?: string | null;
  model_maker?: string | null;
  model_critic?: string | null;
  fallback_models?: string[] | null;
  model_catalog?: string[] | null;
  default_instructions?: string | null;
  params?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type AssistantSettings = {
  id: number;
  openrouter_base_url?: string | null;
  model_fast?: string | null;
  model_creative?: string | null;
  model_planner?: string | null;
  model_maker?: string | null;
  model_critic?: string | null;
  fallback_models: string[];
  model_catalog: string[];
  default_instructions?: string | null;
  params: Record<string, unknown>;
  created_at?: string | null;
  updated_at?: string | null;
};

const DEFAULT_FALLBACK_MODELS = [
  "openai/gpt-4.1-mini",
  "openai/gpt-4o-mini",
  "google/gemini-2.5-flash-lite",
  "xiaomi/mimo-v2-flash:free",
  "mistralai/devstral-2512:free",
];

const DEFAULT_MAX_OUTPUT_TOKENS = (() => {
  const raw = (globalThis as any)?.Deno?.env?.get?.("OPENROUTER_MAX_COMPLETION_TOKENS") ?? "495";
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 495;
})();

const DEFAULT_PARAMS: Record<string, unknown> = {
  temperature: 0.1,
  top_p: 1,
  max_output_tokens: DEFAULT_MAX_OUTPUT_TOKENS,
  presence_penalty: 0,
  frequency_penalty: 0,
  seed: null,
  stop: null,
  logprobs: false,
  top_logprobs: null,
  parallel_tool_calls: null,
  stream: false,
  metadata: null,
  user: null,
  instructions: null,
  tools: null,
  tool_choice: null,
  response_format: null,
  plugins: null,
};

function uniqStrings(list: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  for (const item of list) {
    const v = String(item ?? "").trim();
    if (!v) continue;
    if (!out.includes(v)) out.push(v);
  }
  return out;
}

function normalizeParams(params?: Record<string, unknown> | null): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v === undefined) continue;
    if (v === null) {
      out[k] = null;
      continue;
    }
    if (typeof v === "string" && v.trim() === "") continue;
    out[k] = v;
  }
  return out;
}

export function getDefaultModelCatalog(): string[] {
  const cfg = getConfig();
  return uniqStrings([
    cfg.openrouterModelFast,
    cfg.openrouterModelCreative,
    cfg.openrouterModelPlanner,
    cfg.openrouterModelMaker,
    cfg.openrouterModelCritic,
    ...DEFAULT_FALLBACK_MODELS,
  ]);
}

export function getDefaultAssistantSettings(): AssistantSettings {
  const cfg = getConfig();
  return {
    id: 1,
    openrouter_base_url: cfg.openrouterBaseUrl ?? null,
    model_fast: cfg.openrouterModelFast ?? "openai/gpt-4.1-mini",
    model_creative: cfg.openrouterModelCreative ?? "openai/gpt-4o-mini",
    model_planner: cfg.openrouterModelPlanner ?? "openai/gpt-4.1-mini",
    model_maker: cfg.openrouterModelMaker ?? "openai/gpt-4o-mini",
    model_critic: cfg.openrouterModelCritic ?? "openai/gpt-4.1-mini",
    fallback_models: [...DEFAULT_FALLBACK_MODELS],
    model_catalog: getDefaultModelCatalog(),
    default_instructions: null,
    params: { ...DEFAULT_PARAMS },
    created_at: null,
    updated_at: null,
  };
}

export async function getAssistantSettings(svc?: any): Promise<AssistantSettings> {
  const client = svc ?? getAdminClient();
  const defaults = getDefaultAssistantSettings();
  const { data, error } = await client.from("assistant_settings").select("*").eq("id", 1).maybeSingle();

  if (error && String(error.message ?? "").includes("assistant_settings")) {
    throw error;
  }

  if (error || !data) {
    if (!data) {
      await client.from("assistant_settings").upsert({
        id: 1,
        openrouter_base_url: defaults.openrouter_base_url,
        model_fast: defaults.model_fast,
        model_creative: defaults.model_creative,
        model_planner: defaults.model_planner,
        model_maker: defaults.model_maker,
        model_critic: defaults.model_critic,
        fallback_models: defaults.fallback_models,
        model_catalog: defaults.model_catalog,
        default_instructions: defaults.default_instructions,
        params: defaults.params,
        updated_at: new Date().toISOString(),
      });
    }
    return defaults;
  }

  const row = data as AssistantSettingsRow;
  return {
    id: row.id,
    openrouter_base_url: row.openrouter_base_url ?? defaults.openrouter_base_url ?? null,
    model_fast: row.model_fast ?? defaults.model_fast ?? null,
    model_creative: row.model_creative ?? defaults.model_creative ?? null,
    model_planner: row.model_planner ?? defaults.model_planner ?? null,
    model_maker: row.model_maker ?? defaults.model_maker ?? null,
    model_critic: row.model_critic ?? defaults.model_critic ?? null,
    fallback_models: uniqStrings(row.fallback_models ?? defaults.fallback_models ?? []),
    model_catalog: uniqStrings(row.model_catalog ?? defaults.model_catalog ?? []),
    default_instructions: row.default_instructions ?? defaults.default_instructions ?? null,
    params: {
      ...DEFAULT_PARAMS,
      ...normalizeParams(defaults.params),
      ...normalizeParams(row.params),
    },
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}
