// supabase/functions/debug-env/index.ts
//
// Lightweight health/debug endpoint for edge functions.
// Does NOT expose raw secrets, only flags indicating presence.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

import {
  corsHeaders,
  handleOptions,
  jsonError,
  jsonResponse,
} from "../_shared/http.ts";

serve((req: Request) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  const isEnabled =
    (Deno.env.get("DEBUG_ENV_ENABLED") ?? "").toLowerCase() === "true";

  if (!isEnabled) {
    return jsonError("Not found", 404, "NOT_FOUND");
  }

  if (req.method !== "GET") {
    return jsonError("Method not allowed", 405, "METHOD_NOT_ALLOWED");
  }

  const body = {
    ok: true,
    env: {
      hasSupabaseUrl: Boolean(Deno.env.get("SUPABASE_URL")),
      hasAnonKey: Boolean(Deno.env.get("SUPABASE_ANON_KEY")),
      hasServiceRoleKey: Boolean(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")),
    },
    runtime: {
      deno: Deno.version.deno,
      v8: Deno.version.v8,
      typescript: Deno.version.typescript,
    },
  };

  return jsonResponse(body);
});
