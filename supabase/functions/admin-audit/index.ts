// supabase/functions/admin-audit/index.ts
//
// Returns recent rows from public.admin_audit_log (admin-only).
// Supports simple cursor-based pagination.

import { handleCors, json, requireAdmin } from "../_shared/admin.ts";

type ReqBody = {
  limit?: number;
  before?: string | null; // ISO timestamp (created_at) cursor
  search?: string | null;
};

function clampInt(n: unknown, def: number, min: number, max: number) {
  const v = Number(n);
  if (!Number.isFinite(v)) return def;
  return Math.max(min, Math.min(max, Math.trunc(v)));
}

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  if (req.method !== "POST") return json(405, { ok: false, code: "METHOD_NOT_ALLOWED" });

  try {
    const { svc, userId } = await requireAdmin(req);

    let body: ReqBody = {};
    try {
      body = (await req.json()) as ReqBody;
    } catch {
      body = {};
    }

    const limit = clampInt(body.limit, 100, 1, 200);
    const before = typeof body.before === "string" && body.before.trim() ? body.before.trim() : null;
    const search = typeof body.search === "string" && body.search.trim() ? body.search.trim() : null;

    let q = svc
      .from("admin_audit_log")
      .select("id, created_at, actor_id, action, target, details")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (before) q = q.lt("created_at", before);
    if (search) {
      // Basic OR search across a few useful columns.
      const s = search.replace(/%/g, "\\%").replace(/_/g, "\\_");
      q = q.or(`action.ilike.%${s}%,target.ilike.%${s}%,details::text.ilike.%${s}%`);
    }

    const { data, error } = await q;
    if (error) throw new Error(error.message);

    const rows = (data ?? []).map((r) => ({
      id: r.id,
      created_at: r.created_at,
      actor_id: r.actor_id,
      action: r.action,
      target: r.target,
      details: r.details,
    }));

    const next_before = rows.length === limit ? rows[rows.length - 1]?.created_at ?? null : null;

    return json(200, { ok: true, rows, next_before, meta: { requested_by: userId, limit } });
  } catch (e) {
    return json(200, {
      ok: false,
      code: "ADMIN_AUDIT_FAILED",
      message: e instanceof Error ? e.message : String(e),
    });
  }
});
