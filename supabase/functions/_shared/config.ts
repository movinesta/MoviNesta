// supabase/functions/_shared/config.ts

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
      console.warn("Failed to get config from env. This is expected in test environments.", error.message);
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
