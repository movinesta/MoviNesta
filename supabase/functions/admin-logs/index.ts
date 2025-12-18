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
    const before = typeof body.before === "string" && body.before.trim() ? body.before.trim() : null;

    let q = svc
      .from("job_run_log")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(limit);

    if (before) q = q.lt("started_at", before);

    const { data, error } = await q;
    if (error) throw new HttpError(500, error.message, "supabase_error");

    const rows = data ?? [];
    const last = rows.length ? rows[rows.length - 1] : null;
    const next_before = rows.length === limit ? (last?.started_at ?? null) : null;

    return json(req, 200, { ok: true, rows, next_before });
  } catch (e) {
    return jsonError(req, e);
  }
});
