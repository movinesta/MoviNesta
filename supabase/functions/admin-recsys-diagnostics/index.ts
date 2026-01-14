import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { requireAdmin, json, handleCors, jsonError } from "../_shared/admin.ts";

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { svc } = await requireAdmin(req);

    const { data, error } = await svc
      .from("rec_experiment_diagnostics_v1")
      .select("window_start,total_impressions,missing_experiments,missing_ratio,outcomes_without_impression")
      .maybeSingle();

    if (error) return json(req, 500, { ok: false, message: error.message });

    return json(req, 200, { ok: true, row: data ?? null });
  } catch (e) {
    return jsonError(req, e);
  }
});
