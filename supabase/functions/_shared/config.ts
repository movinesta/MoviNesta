// supabase/functions/_shared/config.ts
//
// Centralized environment config for Edge Functions.
//
// IMPORTANT:
// - Keep existing getConfig() API because many functions import it.
// - This project standardizes on Voyage for embeddings + rerank.

export interface AppConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  tmdbApiReadAccessToken: string;
  omdbApiKey: string;
  tastediveApiKey: string;
  internalJobToken: string;

  // OpenRouter (Assistant)
  openrouterApiKey?: string;
  openrouterBaseUrl?: string;
  openrouterModelFast?: string;
  openrouterModelCreative?: string;
  openrouterModelPlanner?: string;
  openrouterModelMaker?: string;
  openrouterModelCritic?: string;

  // Assistant identity (for DM/chat and attribution)
  assistantUserId?: string;
  assistantUsername?: string;
}

const getRequiredEnv = (key: string): string => {
  const value = Deno.env.get(key);
  if (!value) {
    // This will only happen in the Deno runtime if the env var is missing.
    // In Vitest/Node, we'll provide the config directly.
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

// This function is intended to be called in the Deno runtime.
export const getConfigFromEnv = (): AppConfig => {
  return {
    supabaseUrl: getRequiredEnv("SUPABASE_URL"),
    supabaseAnonKey: getRequiredEnv("SUPABASE_ANON_KEY"),
    supabaseServiceRoleKey: getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    tmdbApiReadAccessToken: getRequiredEnv("TMDB_API_READ_ACCESS_TOKEN"),
    omdbApiKey: Deno.env.get("OMDB_API_KEY") ?? "",
    tastediveApiKey: Deno.env.get("TASTEDIVE_API_KEY") ?? "",
    internalJobToken: Deno.env.get("INTERNAL_JOB_TOKEN") ?? "",

    openrouterApiKey: Deno.env.get("OPENROUTER_API_KEY") ?? undefined,
    openrouterBaseUrl: Deno.env.get("OPENROUTER_BASE_URL") ?? undefined,
    openrouterModelFast: Deno.env.get("OPENROUTER_MODEL_FAST") ?? undefined,
    openrouterModelCreative: Deno.env.get("OPENROUTER_MODEL_CREATIVE") ?? undefined,
    openrouterModelPlanner: Deno.env.get("OPENROUTER_MODEL_PLANNER") ?? undefined,
    openrouterModelMaker: Deno.env.get("OPENROUTER_MODEL_MAKER") ?? undefined,
    openrouterModelCritic: Deno.env.get("OPENROUTER_MODEL_CRITIC") ?? undefined,

    assistantUserId: Deno.env.get("ASSISTANT_USER_ID") ?? Deno.env.get("MOVINESTA_ASSISTANT_USER_ID") ?? undefined,
    assistantUsername: Deno.env.get("ASSISTANT_USERNAME") ?? "movinesta",
  };
};

// A singleton instance for the functions to use.
// We can overwrite this in tests.
let appConfig: AppConfig | null = null;

export const getConfig = (): AppConfig => {
  if (!appConfig) {
    try {
      // This will work in Deno.
      appConfig = getConfigFromEnv();
    } catch (error) {
      // This will fail in Node/Vitest, which is expected.
      // We'll handle this by setting the config manually in test setup.
      console.warn(
        "Failed to get config from env. This is expected in test environments.",
        (error as any).message,
      );
      // Provide a dummy config to avoid crashing the module import.
      appConfig = {
        supabaseUrl: "mock_url",
        supabaseAnonKey: "mock_key",
        supabaseServiceRoleKey: "mock_service_key",
        tmdbApiReadAccessToken: "mock_tmdb_token",
        omdbApiKey: "",
        tastediveApiKey: "",
        internalJobToken: "",

        openrouterApiKey: undefined,
        openrouterBaseUrl: undefined,
        openrouterModelFast: undefined,
        openrouterModelCreative: undefined,
        openrouterModelPlanner: undefined,
        openrouterModelMaker: undefined,
        openrouterModelCritic: undefined,

        assistantUserId: undefined,
        assistantUsername: "movinesta",
      };
    }
  }
  return appConfig;
};

/**
 * For testing purposes only. Allows overwriting the config.
 * @private
 */
export const __setConfigForTesting = (config: AppConfig) => {
  appConfig = config;
};

// -----------------------------------------------------------------------------
// VoyageAI (Embeddings + Rerank)
// -----------------------------------------------------------------------------
export const VOYAGE_EMBEDDINGS_URL =
  Deno.env.get("VOYAGE_EMBEDDINGS_URL") ?? "https://api.voyageai.com/v1/embeddings";

export const VOYAGE_RERANK_URL =
  Deno.env.get("VOYAGE_RERANK_URL") ?? "https://api.voyageai.com/v1/rerank";

export const VOYAGE_API_KEY = Deno.env.get("VOYAGE_API_KEY") ?? "";

// Locked models (project standard): keep everything on Voyage.
// NOTE: We intentionally do NOT allow switching providers or models.
export const VOYAGE_EMBED_MODEL = "voyage-3-large";
export const VOYAGE_RERANK_MODEL = "rerank-2.5";
export const VOYAGE_DIM = 1024;
