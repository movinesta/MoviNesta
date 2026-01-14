import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { requireAdmin, json, handleCors, jsonError } from "../_shared/admin.ts";

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { svc } = await requireAdmin(req);

    const { data, error } = await svc
      .from("rec_experiment_assignment_counts_v1")
      .select("experiment_key,variant,assignments")
      .order("experiment_key", { ascending: true })
      .order("variant", { ascending: true });

    if (error) return json(req, 500, { ok: false, message: error.message });

    return json(req, 200, { ok: true, rows: data ?? [] });
  } catch (e) {
    return jsonError(req, e);
  }
});
