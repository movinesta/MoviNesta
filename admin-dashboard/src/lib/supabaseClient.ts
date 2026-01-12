import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = (import.meta.env.VITE_SUPABASE_ANON_KEY ??
  (import.meta.env as any).VITE_SUPABASE_PUBLISHABLE_OR_ANON_KEY) as string | undefined;

/**
 * IMPORTANT:
 * Do NOT throw during module initialization.
 * If env is missing we render a dedicated "Not configured" screen instead.
 */
export const isSupabaseConfigured = Boolean(url && anon);

export const supabase: SupabaseClient =
  isSupabaseConfigured
    ? createClient(url as string, anon as string, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : (null as any);

export function assertSupabaseConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY for admin-dashboard. " +
        "Copy .env.example to .env and set values, then restart the dev server.",
    );
  }
}
