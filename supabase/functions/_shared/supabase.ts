import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const requireEnv = (key: string, value: string | null) => {
  if (!value) {
    throw new Error(`Missing ${key} environment variable`);
  }
  return value;
};

/**
 * Auth-scoped client (uses the caller's JWT from the Authorization header).
 * This is what you want for "acting as the user" with RLS enabled.
 */
export const getUserClient = (req: Request) => {
  const supabaseUrl = requireEnv("SUPABASE_URL", SUPABASE_URL);
  const anonKey = requireEnv("SUPABASE_ANON_KEY", SUPABASE_ANON_KEY);

  // Always send the anon key
  const headers: Record<string, string> = {
    apikey: anonKey,
  };

  // ❗ IMPORTANT:
  // Only set Authorization if the header actually exists.
  // Sending an empty string here makes PostgREST try to parse an invalid JWT
  // and results in "Expected 3 parts in JWT; got 1".
  const authHeader = req.headers.get("Authorization");
  if (authHeader) {
    headers.Authorization = authHeader;
  }

  return createClient(supabaseUrl, anonKey, {
    global: { headers },
  });
};

/**
 * Admin client using the service role key (bypasses RLS).
 * We **do not** forward the incoming Authorization header here.
 */
export const getAdminClient = (_req?: Request) => {
  const supabaseUrl = requireEnv("SUPABASE_URL", SUPABASE_URL);
  const serviceRoleKey = requireEnv(
    "SUPABASE_SERVICE_ROLE_KEY",
    SUPABASE_SERVICE_ROLE_KEY,
  );

  // Use the service role key as the API key and JWT.
  return createClient(supabaseUrl, serviceRoleKey, {
    global: {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    },
  });
};
