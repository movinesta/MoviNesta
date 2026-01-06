import { getAdminClient } from "./supabase.ts";
import { getConfig } from "./config.ts";

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
  params?: unknown | null;
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

const DEFAULT_PARAMS: Record<string, unknown> = {};

// Safe, free default that keeps the assistant usable even if the admin settings row is empty.
// You can override via assistant_settings.* or OPENROUTER_MODEL_* env vars.
const DEFAULT_OPENROUTER_MODEL = "xiaomi/mimo-v2-flash:free";
const DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

function uniqStrings(list: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  for (const item of list) {
    const v = String(item ?? "").trim();
    if (!v) continue;
    if (!out.includes(v)) out.push(v);
  }
  return out;
}

function coerceParams(params?: unknown | null): Record<string, unknown> {
  if (!params) return {};
  if (typeof params === "string") {
    try {
      const parsed = JSON.parse(params) as unknown;
      return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  if (typeof params === "object" && !Array.isArray(params)) {
    return params as Record<string, unknown>;
  }
  return {};
}

function normalizeParams(params?: unknown | null): Record<string, unknown> {
  const raw = coerceParams(params);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
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
  ]);
}

export function getDefaultAssistantSettings(): AssistantSettings {
  const cfg = getConfig();
  const baseUrl = String(cfg.openrouterBaseUrl ?? DEFAULT_OPENROUTER_BASE_URL).trim() || DEFAULT_OPENROUTER_BASE_URL;

  // Prefer env-provided models, otherwise fall back to a stable free model so the assistant still works out-of-the-box.
  const modelFast = String(cfg.openrouterModelFast ?? "").trim() || DEFAULT_OPENROUTER_MODEL;
  const modelCreative = String(cfg.openrouterModelCreative ?? "").trim() || modelFast;
  const modelPlanner = String(cfg.openrouterModelPlanner ?? "").trim() || modelFast;
  const modelMaker = String(cfg.openrouterModelMaker ?? "").trim() || modelCreative;
  const modelCritic = String(cfg.openrouterModelCritic ?? "").trim() || modelFast;

  return {
    id: 1,
    openrouter_base_url: baseUrl,
    model_fast: modelFast,
    model_creative: modelCreative,
    model_planner: modelPlanner,
    model_maker: modelMaker,
    model_critic: modelCritic,
    fallback_models: [],
    model_catalog: uniqStrings([modelFast, modelCreative, modelPlanner, modelMaker, modelCritic, ...getDefaultModelCatalog()]),
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
        openrouter_base_url: defaults.openrouter_base_url ?? null,
        model_fast: defaults.model_fast ?? null,
        model_creative: defaults.model_creative ?? null,
        model_planner: defaults.model_planner ?? null,
        model_maker: defaults.model_maker ?? null,
        model_critic: defaults.model_critic ?? null,
        fallback_models: defaults.fallback_models ?? [],
        model_catalog: defaults.model_catalog ?? [],
        default_instructions: defaults.default_instructions ?? null,
        params: defaults.params ?? {},
        updated_at: new Date().toISOString(),
      });
    }
    return defaults;
  }

  const row = data as AssistantSettingsRow;
  return {
    id: row.id,
    openrouter_base_url: String(row.openrouter_base_url ?? "").trim() || String(defaults.openrouter_base_url ?? "").trim() || null,
    model_fast: String(row.model_fast ?? "").trim() || String(defaults.model_fast ?? "").trim() || null,
    model_creative: String(row.model_creative ?? "").trim() || String(defaults.model_creative ?? "").trim() || null,
    model_planner: String(row.model_planner ?? "").trim() || String(defaults.model_planner ?? "").trim() || null,
    model_maker: String(row.model_maker ?? "").trim() || String(defaults.model_maker ?? "").trim() || null,
    model_critic: String(row.model_critic ?? "").trim() || String(defaults.model_critic ?? "").trim() || null,
    fallback_models: uniqStrings([...(row.fallback_models ?? []), ...(defaults.fallback_models ?? [])]),
    model_catalog: uniqStrings([...(row.model_catalog ?? []), ...(defaults.model_catalog ?? [])]),
    default_instructions: row.default_instructions ?? null,
    params: {
      ...normalizeParams(row.params),
    },
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}
