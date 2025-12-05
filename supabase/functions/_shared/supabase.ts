import {
  createClient,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

function requireEnv(key: string, value: string | null): string {
  if (!value) {
    throw new Error(`Missing ${key} environment variable`);
  }
  return value;
}

/**
 * User-scoped client.
 *
 * Uses:
 *  - anon key as the API key
 *  - the caller's Authorization header as the JWT (if present)
 *
 * This is what you should use when you want to act as the logged-in user
 * and respect RLS.
 */
export const getUserClient = (req: Request): SupabaseClient => {
  const supabaseUrl = requireEnv("SUPABASE_URL", SUPABASE_URL);
  const anonKey = requireEnv("SUPABASE_ANON_KEY", SUPABASE_ANON_KEY);

  const authHeader = req.headers.get("Authorization") ?? "";

  const headers: Record<string, string> = {
    apikey: anonKey,
  };

  // IMPORTANT: only set Authorization if there is actually a token.
  // Sending an empty string here causes PostgREST / GoTrue to attempt
  // to parse an invalid JWT and throw errors like:
  //   "Expected 3 parts in JWT; got 1"
  //   "invalid claim: missing sub claim"
  if (authHeader) {
    headers.Authorization = authHeader;
  }

  return createClient(supabaseUrl, anonKey, {
    global: { headers },
  });
};

/**
 * Admin client using the service role key.
 *
 * This bypasses RLS and should only be used for operations that are
 * explicitly allowed to run as `service_role`. Do NOT use this client
 * with `supabase.auth.getUser()`.
 */
export const getAdminClient = (_req?: Request): SupabaseClient => {
  const supabaseUrl = requireEnv("SUPABASE_URL", SUPABASE_URL);
  const serviceRoleKey = requireEnv(
    "SUPABASE_SERVICE_ROLE_KEY",
    SUPABASE_SERVICE_ROLE_KEY,
  );

  return createClient(supabaseUrl, serviceRoleKey, {
    global: {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    },
  });
};
