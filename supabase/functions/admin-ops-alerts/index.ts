import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { requireAdmin, json, jsonError, handleCors } from "../_shared/admin.ts";

type Body =
  | { action: "list"; limit?: number | null }
  | { action: "resolve"; id: number; reason?: string | null }
  | { action: "resolve_all"; reason?: string | null };

serve(async (req) => {
  try {
    const cors = handleCors(req);
    if (cors) return cors;

    const { userId, email, svc } = await requireAdmin(req);

    const body = (await req.json().catch(() => ({}))) as Partial<Body>;
    const action = (body as any)?.action;

    if (action === "list") {
      const limit = Number((body as any)?.limit ?? 50);
      const { data, error } = await svc.rpc("ops_alert_list_active_v1", { p_limit: limit });
      if (error) throw error;
      return json(req, 200, { ok: true, alerts: data ?? [] });
    }

    if (action === "resolve") {
      const id = Number((body as any)?.id);
      if (!Number.isFinite(id)) return json(req, 400, { ok: false, error: "Missing id" });
      const reason = (body as any)?.reason ?? null;

      const { data, error } = await svc.rpc("ops_alert_resolve_v1", {
        p_id: id,
        p_resolved_by: email ?? userId,
        p_reason: reason,
      });
      if (error) throw error;
      return json(req, 200, { ok: true, resolved: Boolean(data) });
    }

    if (action === "resolve_all") {
      const reason = (body as any)?.reason ?? null;
      const { data, error } = await svc.rpc("ops_alert_resolve_all_v1", {
        p_resolved_by: email ?? userId,
        p_reason: reason,
      });
      if (error) throw error;
      return json(req, 200, { ok: true, resolved_count: data ?? 0 });
    }

    return json(req, 400, { ok: false, error: "Invalid action" });
  } catch (e) {
    return jsonError(req, e);
  }
});
