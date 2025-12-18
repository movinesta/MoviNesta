import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { requireAdmin, json, handleCors } from "../_shared/admin.ts";

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(n, b));
}

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { svc, userId } = await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "get");

    if (action === "get") {
      const { data: settings } = await svc.from("embedding_settings").select("*").eq("id", 1).maybeSingle();
      const { data: coverage } = await svc.from("media_embeddings").select("provider, model, count:id").group("provider, model");
      return json(200, {
        ok: true,
        embedding_settings: settings ?? null,
        coverage: (coverage ?? []).map((r: any) => ({ provider: r.provider, model: r.model, count: Number(r.count) })),
      });
    }

    if (action === "set_active_profile") {
      const provider = String(body.provider ?? "");
      const model = String(body.model ?? "");
      const dimensions = clamp(Number(body.dimensions ?? 1024), 8, 8192);
      const task = String(body.task ?? "swipe");

      if (!provider || !model) return json(400, { ok: false, message: "provider and model are required" });

      const { error } = await svc
        .from("embedding_settings")
        .update({
          active_provider: provider,
          active_model: model,
          active_dimensions: dimensions,
          active_task: task,
          updated_at: new Date().toISOString(),
        })
        .eq("id", 1);

      if (error) return json(500, { ok: false, message: error.message });

      await svc.from("admin_audit_log").insert({
        admin_user_id: userId,
        action: "set_active_profile",
        target: "embedding_settings",
        details: { provider, model, dimensions, task },
      });

      return json(200, { ok: true });
    }

    if (action === "set_rerank") {
      const swipe_enabled = Boolean(body.swipe_enabled);
      const search_enabled = Boolean(body.search_enabled);
      const top_k = clamp(Number(body.top_k ?? 50), 5, 200);

      const { error } = await svc
        .from("embedding_settings")
        .update({
          rerank_swipe_enabled: swipe_enabled,
          rerank_search_enabled: search_enabled,
          rerank_top_k: top_k,
          updated_at: new Date().toISOString(),
        })
        .eq("id", 1);

      if (error) return json(500, { ok: false, message: error.message });

      await svc.from("admin_audit_log").insert({
        admin_user_id: userId,
        action: "set_rerank",
        target: "embedding_settings",
        details: { swipe_enabled, search_enabled, top_k },
      });

      return json(200, { ok: true });
    }

    return json(400, { ok: false, message: `Unknown action: ${action}` });
  } catch (e) {
    return json(400, { ok: false, message: (e as any)?.message ?? String(e) });
  }
});
