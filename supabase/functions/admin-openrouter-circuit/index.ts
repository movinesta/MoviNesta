import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { handleCors, json, jsonError, requireAdmin } from "../_shared/admin.ts";

type Body = {
  action?: "reset" | "reset_all" | "cleanup" | "list";
  model?: string | null;
  keep_days?: number | null;
  limit?: number | null;
};

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
      const keep_days = Number.isFinite(keepDaysRaw) ? Math.max(1, Math.min(365, Math.trunc(keepDaysRaw))) : 14;
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
      .select("model,is_open,open_until,failure_streak,last_status,last_error,updated_at")
      .order("is_open", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return json(req, 200, { ok: true, action: "list", rows: data ?? [] });
  } catch (err) {
    return jsonError(req, err);
  }
});
