import { serve } from "jsr:@std/http@0.224.0/server";
import { requireAdmin, json, handleCors, jsonError } from "../_shared/admin.ts";

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { svc } = await requireAdmin(req);

    const { data, error } = await svc
      .from("rec_experiments")
      .select("id,key,description,status,variants,salt,started_at,ended_at,created_at,updated_at")
      .order("updated_at", { ascending: false });

    if (error) return json(req, 500, { ok: false, message: error.message });

    return json(req, 200, { ok: true, rows: data ?? [] });
  } catch (e) {
    return jsonError(req, e);
  }
});
