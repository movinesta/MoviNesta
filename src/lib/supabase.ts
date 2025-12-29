import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_OR_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("Supabase URL is required. Set VITE_SUPABASE_URL in your environment.");
}

if (!supabaseAnonKey) {
  throw new Error(
    "Supabase anonymous key is required. Set VITE_SUPABASE_ANON_KEY in your environment.",
  );
}

/**
 * Central Supabase client for the MoviNesta frontend.
 *
 * We explicitly enable:
 * - `persistSession`: keep the auth session in localStorage so it survives reloads
 * - `autoRefreshToken`: refresh the session token in the background
 *
 * This is important for making sure sessions feel stable and users stay logged in
 * while using the app.
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  db: {
    schema: "public",
  },
  realtime: {
    params: {
      // tune as needed
      eventsPerSecond: 10,
    },
  },
});

// Expose the client for quick dev-time inspection without leaking it in production builds.
if (import.meta.env.DEV && typeof window !== "undefined") {
  (window as typeof window & { supabase?: typeof supabase }).supabase = supabase;
}
