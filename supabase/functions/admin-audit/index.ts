/// <reference path="../_shared/deno.d.ts" />
// Supabase Edge Function: admin-audit
//
// Admin-only endpoint to list recent admin audit log rows.
// Uses strict CORS allowlist via `_shared/cors.ts`.

import { handleCors, json, requireAdmin } from "../_shared/admin.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { svc } = await requireAdmin(req);

    const url = new URL(req.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "50"), 1), 200);

    const { data, error } = await svc
      .from("admin_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return json(req, 500, { ok: false, code: "DB_ERROR", error: error.message });
    return json(req, 200, { ok: true, data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = msg === "forbidden" ? 403 : msg === "unauthenticated" ? 401 : 500;
    return json(req, status, { ok: false, error: msg });
  }
});
