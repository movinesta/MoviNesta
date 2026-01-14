import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { requireAdmin, json, handleCors, jsonError } from "../_shared/admin.ts";

const BodySchema = z.object({
  experiment_key: z.string().min(1).max(128),
  user_id: z.string().uuid(),
  variant: z.string().min(1).max(64),
});

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { svc, userId } = await requireAdmin(req);
    const raw = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) return json(req, 400, { ok: false, code: "BAD_INPUT" });

    const { error } = await svc.rpc("rec_set_user_variant", {
      experiment_key: parsed.data.experiment_key,
      user_id: parsed.data.user_id,
      variant: parsed.data.variant,
      admin_id: userId,
    });

    if (error) return json(req, 500, { ok: false, message: error.message });

    return json(req, 200, { ok: true });
  } catch (e) {
    return jsonError(req, e);
  }
});
