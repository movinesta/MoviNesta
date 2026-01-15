import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { requireAdmin, json, handleCors, jsonError } from "../_shared/admin.ts";

const VariantSchema = z.object({
  name: z.string().min(1).max(64),
  weight: z.number().positive(),
});

const BodySchema = z.object({
  key: z.string().min(1).max(128),
  description: z.string().max(500).nullable().optional(),
  status: z.enum(["draft", "active", "ended"]),
  started_at: z.string().min(1).nullable().optional(),
  ended_at: z.string().min(1).nullable().optional(),
  variants: z.array(VariantSchema).min(1),
  salt: z.string().max(128).nullable().optional(),
});

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { svc, userId } = await requireAdmin(req);
    const raw = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) return json(req, 400, { ok: false, code: "BAD_INPUT" });

    const payload = parsed.data;

    const { error } = await svc
      .from("rec_experiments")
      .upsert(
        {
          key: payload.key,
          description: payload.description ?? null,
          status: payload.status,
          started_at: payload.started_at ?? null,
          ended_at: payload.ended_at ?? null,
          variants: payload.variants,
          salt: payload.salt ?? null,
          created_by: userId,
        },
        { onConflict: "key" },
      );

    if (error) return json(req, 500, { ok: false, message: error.message });

    return json(req, 200, { ok: true });
  } catch (e) {
    return jsonError(req, e);
  }
});
