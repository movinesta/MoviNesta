import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

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
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
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

// 👇 ADD THIS (no DEV guard)
if (typeof window !== "undefined") {
  (window as typeof window & { supabase?: typeof supabase }).supabase = supabase;
  // Optional: tiny debug log so you can see it fired
  // console.log("window.supabase attached", window.supabase);
}
