import { serve } from "jsr:@std/http@0.224.0/server";
import { handleCors, json, jsonError, requireAdmin } from "../_shared/admin.ts";

type Body = {
  action?: "reset" | "reset_all" | "cleanup" | "list";
  model?: string | null;
  keep_days?: number | null;
  limit?: number | null;
};

function asStatus(code: unknown): number | null {
  if (code === null || code === undefined) return null;
  const s = String(code).trim();
  if (!s) return null;
  if (!/^[0-9]{3}$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function isOpen(openUntil: unknown, nowMs: number): boolean {
  if (openUntil === null || openUntil === undefined) return false;
  const t = Date.parse(String(openUntil));
  return Number.isFinite(t) ? t > nowMs : false;
}

serve(async (req) => {
  try {
    const cors = handleCors(req);
    if (cors) return cors;

    const { svc } = await requireAdmin(req);

    const body: Body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = (body.action ?? "list") as Body["action"];

    if (action === "reset" || action === "reset_all") {
      const model = typeof body.model === "string" ? body.model.trim() : "";
      const { data, error } = await svc.rpc("openrouter_circuit_reset_v1", {
        p_model: action === "reset" ? (model || null) : null,
      });
      if (error) throw error;
      return json(req, 200, { ok: true, action, affected: Number(data ?? 0) });
    }

    if (action === "cleanup") {
      const keepDaysRaw = Number(body.keep_days ?? 14);
      const keep_days = Number.isFinite(keepDaysRaw)
        ? Math.max(1, Math.min(365, Math.trunc(keepDaysRaw)))
        : 14;
      const { data, error } = await svc.rpc("openrouter_circuit_cleanup_v1", { p_keep_days: keep_days });
      if (error) throw error;
      return json(req, 200, { ok: true, action, keep_days, deleted: Number(data ?? 0) });
    }

    // list
    const limitRaw = Number(body.limit ?? 200);
    const limit = Number.isFinite(limitRaw) ? Math.max(10, Math.min(500, Math.trunc(limitRaw))) : 200;

    const { data, error } = await svc
      .schema("public")
      .from("openrouter_circuit_breakers")
      .select("model,failure_count,open_until,last_error_code,last_error_message,updated_at")
      .limit(limit);

    if (error) throw error;

    const nowMs = Date.now();
    const rows = (Array.isArray(data) ? data : [])
      .map((r: any) => {
        const model = String(r?.model ?? "").trim();
        if (!model) return null;
        const openUntil = r?.open_until ?? null;
        const failureCount = Number(r?.failure_count ?? 0);
        return {
          model,
          is_open: isOpen(openUntil, nowMs),
          open_until: openUntil,
          failure_streak: Number.isFinite(failureCount) ? Math.trunc(failureCount) : 0,
          last_status: asStatus(r?.last_error_code),
          last_error: (r?.last_error_message ?? null) as string | null,
          updated_at: r?.updated_at ?? null,
        };
      })
      .filter(Boolean) as any[];

    rows.sort((a, b) => {
      const ao = a.is_open ? 1 : 0;
      const bo = b.is_open ? 1 : 0;
      if (ao !== bo) return bo - ao;
      const at = Date.parse(String(a.updated_at ?? "")) || 0;
      const bt = Date.parse(String(b.updated_at ?? "")) || 0;
      return bt - at;
    });

    return json(req, 200, { ok: true, action: "list", rows });
  } catch (err) {
    return jsonError(req, err);
  }
});
