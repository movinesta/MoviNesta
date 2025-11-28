import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, errorResponse } from "./http.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

export function assertServiceEnv(): { url: string; key: string } | Response {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("[functions] Missing Supabase service env vars");
    return errorResponse("Server misconfigured", 500);
  }
  return { url: SUPABASE_URL, key: SERVICE_ROLE_KEY };
}

export function createServiceSupabase(req: Request): SupabaseClient | Response {
  const env = assertServiceEnv();
  if (env instanceof Response) return env;

  return createClient(env.url, env.key, {
    global: {
      headers: {
        Authorization: req.headers.get("Authorization") ?? "",
      },
    },
  });
}

export { corsHeaders } from "./http.ts";
