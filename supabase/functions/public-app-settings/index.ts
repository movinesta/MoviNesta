// supabase/functions/public-app-settings/index.ts
//
// Public (non-secret) app settings for the frontend.
//
// Security model:
// - verify_jwt = false
// - Returns ONLY scope='public' settings.
// - Values are validated and defaults are always applied.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

import { handleOptions, jsonError, jsonResponse } from "../_shared/http.ts";
import { getUserClient } from "../_shared/supabase.ts";
import { loadPublicAppSettings } from "../_shared/appSettings.ts";

const FN_NAME = "public-app-settings";

export async function handler(req: Request): Promise<Response> {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  try {
    const client = getUserClient(req);
    const envelope = await loadPublicAppSettings(client, { cacheTtlMs: 30_000 });

    return jsonResponse(req, envelope, 200, {
      headers: {
        // Short cache for rapid iteration, with SWR for smooth UX.
        "Cache-Control": "public, max-age=30, stale-while-revalidate=300",
        "x-function": FN_NAME,
      },
    });
  } catch (err: any) {
    return jsonError(req, err?.message ?? "Failed to load settings", 500, "SETTINGS_LOAD_FAILED");
  }
}

serve(handler);
