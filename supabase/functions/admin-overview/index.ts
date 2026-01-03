import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { requireAdmin, json, handleCors, jsonError } from "../_shared/admin.ts";

function since24hIso() {
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return d.toISOString();
}

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { svc } = await requireAdmin(req);

    const [{ data: settings }, { data: coverage }, { data: jobState }] = await Promise.all([
      svc.from("embedding_settings").select("*").eq("id", 1).maybeSingle(),
      // `media_embeddings` has no `id` column in the schema; count media_item_id instead.
      svc.from("media_embeddings").select("provider, model, count:media_item_id"),
      svc.from("media_job_state").select("job_name, cursor, updated_at").order("job_name"),
    ]);

    const { data: recentErrors } = await svc
      .from("job_run_log")
      .select("id, created_at, started_at, job_name, error_code, error_message")
      .eq("ok", false)
      .gte("started_at", since24hIso())
      .order("started_at", { ascending: false })
      .limit(50);

    const { data: lastRuns } = await svc
      .from("job_run_log")
      .select("id, started_at, finished_at, job_name, ok")
      .order("started_at", { ascending: false })
      .limit(20);

    const active_profile = settings
      ? {
          provider: settings.active_provider,
          model: settings.active_model,
          dimensions: settings.active_dimensions,
          task: settings.active_task,
        }
      : null;

    return json(req, 200, {
      ok: true,
      active_profile,
      coverage: (coverage ?? []).map((r: any) => ({ provider: r.provider, model: r.model, count: Number(r.count) })),
      job_state: jobState ?? [],
      recent_errors: recentErrors ?? [],
      last_job_runs: lastRuns ?? [],
    });
  } catch (e) {
    return jsonError(req, e);
  }
});
