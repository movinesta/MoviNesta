import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { requireAdmin, json, handleCors, jsonError } from "../_shared/admin.ts";
import { VOYAGE_DIM, VOYAGE_EMBED_MODEL } from "../_shared/config.ts";

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
      // `media_embeddings` has no `id` column in the schema; count media_item_id instead.
      const { data: coverage } = await svc
        .from("media_embeddings")
        .select("provider, model, count:media_item_id");
      return json(req, 200, {
        ok: true,
        embedding_settings: settings ?? null,
        coverage: (coverage ?? []).map((r: any) => ({ provider: r.provider, model: r.model, count: Number(r.count) })),
      });
    }

    if (action === "set_active_profile") {
      // Locked profile (Voyage-only). We keep the API endpoint for compatibility,
      // but ignore any provider/model passed by the client.
      const provider = "voyage";
      const model = VOYAGE_EMBED_MODEL;
      const dimensions = VOYAGE_DIM;
      const task = String(body.task ?? "swipe");

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

      if (error) return json(req, 500, { ok: false, message: error.message });

      await svc.from("admin_audit_log").insert({
        admin_user_id: userId,
        action: "set_active_profile",
        target: "embedding_settings",
        details: { provider, model, dimensions, task },
      });

      return json(req, 200, { ok: true });
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

      if (error) return json(req, 500, { ok: false, message: error.message });

      await svc.from("admin_audit_log").insert({
        admin_user_id: userId,
        action: "set_rerank",
        target: "embedding_settings",
        details: { swipe_enabled, search_enabled, top_k },
      });

      return json(req, 200, { ok: true });
    }

    return json(req, 400, { ok: false, message: `Unknown action: ${action}` });
  } catch (e) {
    return jsonError(req, e);
  }
});
