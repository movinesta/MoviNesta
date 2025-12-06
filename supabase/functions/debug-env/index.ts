// supabase/functions/debug-env/index.ts
//
// Lightweight health/debug endpoint for edge functions.
// Does NOT expose raw secrets, only flags indicating presence.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { handleOptions, jsonError, jsonResponse } from "../_shared/http.ts";
import { log } from "../_shared/logger.ts";

const FN_NAME = "debug-env";

serve((req: Request) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  const logCtx = { fn: FN_NAME };

  const isEnabled = (Deno.env.get("DEBUG_ENV_ENABLED") ?? "").toLowerCase() === "true";
  if (!isEnabled) {
    log(logCtx, "Debug endpoint is disabled");
    return jsonError("Not found", 404, "NOT_FOUND");
  }

  if (req.method !== "GET") {
    return jsonError("Method not allowed", 405, "METHOD_NOT_ALLOWED");
  }

  log(logCtx, "Debug endpoint accessed");

  const body = {
    ok: true,
    env: {
      hasSupabaseUrl: !!Deno.env.get("SUPABASE_URL"),
      hasAnonKey: !!Deno.env.get("SUPABASE_ANON_KEY"),
      hasServiceRoleKey: !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
      hasTmdbToken: !!Deno.env.get("TMDB_API_READ_ACCESS_TOKEN"),
      hasOmdbKey: !!Deno.env.get("OMDB_API_KEY"),
    },
    runtime: Deno.version,
  };

  return jsonResponse(body);
});
