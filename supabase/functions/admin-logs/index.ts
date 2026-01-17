import { serve } from "jsr:@std/http@0.224.0/server";
import { requireAdmin, json, handleCors, jsonError } from "../_shared/admin.ts";

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(n, b));
}

function asString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function isValidIsoDate(s: string): boolean {
  const t = Date.parse(s);
  return Number.isFinite(t);
}

/**
 * Admin-only endpoint to list background job run logs.
 *
 * Contract:
 *   POST body: { limit?: number, before?: string|null }
 *   response:  { ok: true, rows: JobRunLogRow[], next_before: string|null }
 */
serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { svc } = await requireAdmin(req);

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const limit = clamp(Number(body.limit ?? 100), 10, 500);

    const beforeRaw = asString(body.before);
    const before = beforeRaw && isValidIsoDate(beforeRaw) ? beforeRaw : null;

    const pageSize = clamp(limit + 1, 10, 501);

    let q = svc
      .from("job_run_log")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(pageSize);

    if (before) q = q.lt("started_at", before);

    const { data, error } = await q;

    if (error) return json(req, 500, { ok: false, message: error.message });

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    let next_before: string | null = null;
    if (rows.length > limit) {
      const extra = rows.pop() as any;
      next_before = String(extra?.started_at ?? "") || null;
    }

    return json(req, 200, { ok: true, rows, next_before });
  } catch (e) {
    return jsonError(req, e);
  }
});
