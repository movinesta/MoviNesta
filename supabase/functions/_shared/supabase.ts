import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getConfig } from "./config.ts";

/**
 * User-scoped client.
 *
 * Uses:
 *  - anon key as the Supabase key
 *  - the caller's Authorization header as the JWT (if present)
 *
 * This is what you should use when you want to act as the logged-in user
 * and respect RLS + auth.
 */
export const getUserClient = (req: Request) => {
  const { supabaseUrl, supabaseAnonKey } = getConfig();

  const headers: Record<string, string> = {
    apikey: supabaseAnonKey,
  };

  const authHeader = req.headers.get("Authorization");
  // IMPORTANT: only set Authorization if there is actually a token.
  if (authHeader) {
    headers.Authorization = authHeader;
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers },
  });
};

/**
 * Admin client using the service role key.
 *
 * This bypasses RLS and should only be used for operations that are
 * explicitly allowed to run as `service_role`. Do NOT call
 * `supabase.auth.getUser()` on this client.
 */
export const getAdminClient = (_req?: Request) => {
  const { supabaseUrl, supabaseServiceRoleKey } = getConfig();

  const headers: Record<string, string> = {
    apikey: supabaseServiceRoleKey,
    Authorization: `Bearer ${supabaseServiceRoleKey}`,
  };

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    global: { headers },
  });
};
