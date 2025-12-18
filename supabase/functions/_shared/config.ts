// supabase/functions/_shared/config.ts
//
// Centralized environment config for Edge Functions.
//
// IMPORTANT:
// - Keep existing getConfig() API because many functions import it.
// - Provider-specific keys (Jina/OpenAI/Voyage) are optional at import-time.
//   Each provider validates its own key at call-time.

export interface AppConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  tmdbApiReadAccessToken: string;
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
// Jina (Embeddings)
// -----------------------------------------------------------------------------
export const JINA_EMBEDDINGS_URL =
  Deno.env.get("JINA_EMBEDDINGS_URL") ?? "https://api.jina.ai/v1/embeddings";

export const JINA_API_KEY = Deno.env.get("JINA_API_KEY") ?? "";
export const JINA_MODEL = Deno.env.get("JINA_MODEL") ?? "jina-embeddings-v3";
export const JINA_DIM = Number(Deno.env.get("JINA_DIM") ?? "1024");

// -----------------------------------------------------------------------------
// OpenAI (Embeddings)
// -----------------------------------------------------------------------------
export const OPENAI_EMBEDDINGS_URL =
  Deno.env.get("OPENAI_EMBEDDINGS_URL") ?? "https://api.openai.com/v1/embeddings";

export const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
export const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") ?? "text-embedding-3-small";
export const OPENAI_DIM = Number(Deno.env.get("OPENAI_DIM") ?? "1024");

// -----------------------------------------------------------------------------
// VoyageAI (Embeddings + Rerank)
// -----------------------------------------------------------------------------
export const VOYAGE_EMBEDDINGS_URL =
  Deno.env.get("VOYAGE_EMBEDDINGS_URL") ?? "https://api.voyageai.com/v1/embeddings";

export const VOYAGE_RERANK_URL =
  Deno.env.get("VOYAGE_RERANK_URL") ?? "https://api.voyageai.com/v1/rerank";

export const VOYAGE_API_KEY = Deno.env.get("VOYAGE_API_KEY") ?? "";

// Defaults you can override per-request in your Edge Functions.
export const VOYAGE_EMBED_MODEL = Deno.env.get("VOYAGE_EMBED_MODEL") ?? "voyage-3-large";
export const VOYAGE_RERANK_MODEL = Deno.env.get("VOYAGE_RERANK_MODEL") ?? "rerank-2.5";
export const VOYAGE_DIM = Number(Deno.env.get("VOYAGE_DIM") ?? "1024");
