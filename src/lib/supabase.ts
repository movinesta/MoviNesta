import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_OR_ANON_KEY;

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
  global: {
    // Lightweight GET-only retry policy for transient network/edge issues.
    // This matches Supabase's recommended approach of providing a custom fetch with retries.
    // We avoid retrying non-idempotent methods (POST/PATCH/DELETE) to prevent duplicate writes.
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = String(init?.method ?? "GET").toUpperCase();
      const maxRetries = method === "GET" || method === "HEAD" ? 2 : 0;
      const baseDelayMs = 200;

      const shouldRetryStatus = (status: number) =>
        status === 408 || status === 425 || status === 429 || (status >= 500 && status <= 599);

      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const res = await fetch(input, init);
          if (res.ok) return res;
          if (attempt >= maxRetries || !shouldRetryStatus(res.status)) return res;
        } catch (e) {
          // Respect abort signals and avoid infinite loops.
          if (init?.signal?.aborted || attempt >= maxRetries) throw e;
        }

        // Exponential backoff with a small cap.
        const delay = Math.min(2000, Math.round(baseDelayMs * Math.pow(2, attempt)));
        await sleep(delay);
      }

      // Unreachable
      return fetch(input, init);
    },
  },
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
