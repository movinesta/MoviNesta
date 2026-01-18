import { serve } from "jsr:@std/http@0.224.0/server";
import { requireAdmin, json, handleCors, jsonError } from "../_shared/admin.ts";

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
        .select("provider, model, count:media_item_id.count()");
      return json(req, 200, {
        ok: true,
        embedding_settings: settings ?? null,
        coverage: (coverage ?? []).map((r: any) => ({
          provider: r.provider,
          model: r.model,
          count: Number.isFinite(Number(r.count)) ? Number(r.count) : 0,
        })),
      });
    }

    if (action === "set_active_profile") {
      // Admin-controlled profile (Option A): allow changing the embedding model.
      // NOTE: dimensions are effectively locked by the DB vector column; we do NOT allow changing
      // dimensions through this endpoint unless they match the current active_dimensions.
      const { data: current, error: curErr } = await svc
        .from("embedding_settings")
        .select("active_provider, active_model, active_dimensions, active_task")
        .eq("id", 1)
        .maybeSingle();

      if (curErr) return json(req, 500, { ok: false, message: curErr.message });

      const provider = String(body.provider ?? current?.active_provider ?? "voyage").trim();
      if (provider !== "voyage") {
        return json(req, 400, { ok: false, message: "Only provider 'voyage' is supported in this build." });
      }

      const model = String(body.model ?? current?.active_model ?? "voyage-3-large").trim();
      if (!model) return json(req, 400, { ok: false, message: "Missing model" });

      const task = String(body.task ?? current?.active_task ?? "swipe").trim() || "swipe";

      const currentDim = Number(current?.active_dimensions ?? 1024);
      const requestedDim = body.dimensions == null ? currentDim : Number(body.dimensions);
      if (!Number.isFinite(requestedDim) || requestedDim <= 0) {
        return json(req, 400, { ok: false, message: "Invalid dimensions" });
      }
      if (requestedDim !== currentDim) {
        return json(req, 400, {
          ok: false,
          message: `Dimensions are locked to the current schema (${currentDim}). Run a DB migration to change vector dimensions first.`,
        });
      }

      const { error } = await svc
        .from("embedding_settings")
        .update({
          active_provider: provider,
          active_model: model,
          active_dimensions: currentDim,
          active_task: task,
          updated_at: new Date().toISOString(),
        })
        .eq("id", 1);

      if (error) return json(req, 500, { ok: false, message: error.message });

      await svc.from("admin_audit_log").insert({
        admin_user_id: userId,
        action: "set_active_profile",
        target: "embedding_settings",
        details: { provider, model, dimensions: currentDim, task },
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
