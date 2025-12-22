/// <reference path="../_shared/deno.d.ts" />
// Supabase Edge Function: admin-whoami
//
// Returns the current user identity + admin status.

import { handleCors, json, getUserIdFromRequest, getSupabaseServiceClient } from "../_shared/admin.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { userId, email } = await getUserIdFromRequest(req);
    const svc = getSupabaseServiceClient();

    const { data, error } = await svc.from("app_admins").select("user_id").eq("user_id", userId).maybeSingle();
    if (error) return json(req, 500, { ok: false, code: "DB_ERROR", error: error.message });

    return json(req, 200, { ok: true, userId, email, isAdmin: !!data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = msg === "Invalid session" ? 401 : 500;
    return json(req, status, { ok: false, error: msg });
  }
});
