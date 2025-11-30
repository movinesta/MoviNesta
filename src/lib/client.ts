import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/supabase";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_OR_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("Supabase URL is required. Set VITE_SUPABASE_URL in your environment.");
}

if (!supabaseKey) {
  throw new Error(
    "Supabase anonymous or publishable key is required. Set VITE_SUPABASE_PUBLISHABLE_OR_ANON_KEY or VITE_SUPABASE_ANON_KEY.",
  );
}

let cachedClient: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (cachedClient) return cachedClient;

  cachedClient = createBrowserClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });

  return cachedClient;
}
