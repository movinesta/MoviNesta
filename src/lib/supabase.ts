import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Supabase environment variables are missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env (or .env.local) file. Falling back to a dummy client so offline features keep working.",
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
export const supabase = createClient(
  supabaseUrl ?? "https://example.supabase.co",
  supabaseAnonKey ?? "public-anon-key",
  {
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
  },
);

// 👇 ADD THIS (no DEV guard)
if (typeof window !== "undefined") {
  (window as typeof window & { supabase?: typeof supabase }).supabase = supabase;
  // Optional: tiny debug log so you can see it fired
  // console.log("window.supabase attached", window.supabase);
}
