import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
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
 * Admin-only endpoint to list OpenRouter request logs (routing decisions).
 *
 * Contract:
 *   POST body: { limit?: number, before?: string|null, request_id?: string|null, fn?: string|null }
 *   response:  { ok: true, rows: OpenRouterRequestLogRow[], next_before: string|null }
 */
serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { svc } = await requireAdmin(req);

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const limit = clamp(Number(body.limit ?? 100), 10, 200);

    const beforeRaw = asString(body.before);
    const before = beforeRaw && isValidIsoDate(beforeRaw) ? beforeRaw : null;
    const requestId = asString(body.request_id);
    const fn = asString(body.fn);

    const pageSize = clamp(limit + 1, 10, 201);

    let q = svc
      .from("openrouter_request_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(pageSize);

    if (before) q = q.lt("created_at", before);
    if (requestId) q = q.eq("request_id", requestId);
    if (fn) q = q.eq("fn", fn);

    const { data, error } = await q;

    if (error) return json(req, 500, { ok: false, message: error.message });

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    let next_before: string | null = null;
    if (rows.length > limit) {
      const extra = rows.pop() as any;
      next_before = String(extra?.created_at ?? "") || null;
    }

    return json(req, 200, { ok: true, rows, next_before });
  } catch (e) {
    return jsonError(req, e);
  }
});
