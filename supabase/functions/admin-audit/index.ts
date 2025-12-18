import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { requireAdmin, json, jsonError, handleCors, HttpError } from "../_shared/admin.ts";

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(n, b));
}

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { svc } = await requireAdmin(req);
    const body = await req.json().catch(() => ({}));

    const limit = clamp(Number(body.limit ?? 100), 10, 500);
    const search = String(body.search ?? "").trim();
    const before = typeof body.before === "string" && body.before.trim() ? body.before.trim() : null;

    let q = svc
      .from("admin_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (search) {
      // Best-effort search across action + target.
      // (We intentionally don't try to join auth.users here.)
      q = q.or(`action.ilike.%${search}%,target.ilike.%${search}%`);
    }

    if (before) q = q.lt("created_at", before);

    const { data, error } = await q;
    if (error) throw new HttpError(500, error.message, "supabase_error");

    const rows = data ?? [];
    const last = rows.length ? rows[rows.length - 1] : null;
    const next_before = rows.length === limit ? (last?.created_at ?? null) : null;

    const ids = Array.from(new Set(rows.map((r: any) => String(r.admin_user_id ?? "")).filter(Boolean)));

    // Fetch admin emails for display. Avoid unbounded calls.
    const emailById = new Map<string, string | null>();
    await Promise.all(
      ids.slice(0, 50).map(async (id) => {
        try {
          const { data: u } = await svc.auth.admin.getUserById(id);
          emailById.set(id, u.user?.email ?? null);
        } catch {
          emailById.set(id, null);
        }
      }),
    );

    const enriched = rows.map((r: any) => ({
      ...r,
      admin_email: emailById.get(String(r.admin_user_id ?? "")) ?? null,
    }));

    return json(req, 200, { ok: true, rows: enriched, next_before });
  } catch (e) {
    return jsonError(req, e);
  }
});
