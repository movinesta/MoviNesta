import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { requireAdmin, json, handleCors, jsonError } from "../_shared/admin.ts";

const BodySchema = z.object({
  key: z.string().min(1).max(128),
});

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { svc } = await requireAdmin(req);
    const raw = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) return json(req, 400, { ok: false, code: "BAD_INPUT" });

    const now = new Date().toISOString();

    const { data, error } = await svc
      .from("rec_experiments")
      .update({ status: "ended", ended_at: now })
      .eq("key", parsed.data.key)
      .select("id")
      .maybeSingle();

    if (error) return json(req, 500, { ok: false, message: error.message });
    if (!data?.id) return json(req, 404, { ok: false, message: "Experiment not found" });

    return json(req, 200, { ok: true });
  } catch (e) {
    return jsonError(req, e);
  }
});
