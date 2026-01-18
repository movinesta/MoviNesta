import { serve } from "jsr:@std/http@0.224.0/server";
import { z } from "zod";
import { requireAdmin, json, handleCors, jsonError } from "../_shared/admin.ts";

const BodySchema = z.object({
  experiment_key: z.string().min(1).max(128),
  user_id: z.string().uuid(),
});

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { svc } = await requireAdmin(req);
    const raw = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) return json(req, 400, { ok: false, code: "BAD_INPUT" });

    const { data: exp, error: expErr } = await svc
      .from("rec_experiments")
      .select("id")
      .eq("key", parsed.data.experiment_key)
      .maybeSingle();

    if (expErr) return json(req, 500, { ok: false, message: expErr.message });
    if (!exp?.id) return json(req, 404, { ok: false, message: "Experiment not found" });

    const { error } = await svc
      .from("rec_user_experiment_assignments")
      .delete()
      .eq("experiment_id", exp.id)
      .eq("user_id", parsed.data.user_id);

    if (error) return json(req, 500, { ok: false, message: error.message });

    return json(req, 200, { ok: true });
  } catch (e) {
    return jsonError(req, e);
  }
});
