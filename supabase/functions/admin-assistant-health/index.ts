import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

import { requireAdmin, getUserIdFromRequest, getSupabaseUserClient, handleCors, json, jsonError } from "../_shared/admin.ts";

// Admin-only assistant health snapshot.
//
// Why this exists:
// - The admin-dashboard app already uses admin-* edge functions.
// - The DB has an admin-gated RPC: public.assistant_health_snapshot_v1().
// - This function bridges the two so the admin dashboard can load diagnostics.

const BodySchema = z
  .object({
    // reserved for future use (e.g. includeFailures: boolean)
  })
  .optional();

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    // Validate admin first (service role check against app_admins)
    await requireAdmin(req);

    // Parse/consume body for consistent behavior (some clients always POST)
    await BodySchema.parseAsync(await req.json().catch(() => ({})));

    // Call the DB RPC using the *user* JWT so auth.uid() is set for assert_admin().
    const { jwt } = await getUserIdFromRequest(req);
    const userClient = getSupabaseUserClient(jwt);

    const { data, error } = await userClient.rpc("assistant_health_snapshot_v1");
    if (error) {
      return json(req, 500, { ok: false, code: "DB_ERROR", message: error.message });
    }

    return json(req, 200, data ?? { ok: true });
  } catch (e) {
    return jsonError(req, e);
  }
});
