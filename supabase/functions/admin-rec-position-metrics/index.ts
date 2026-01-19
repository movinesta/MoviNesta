import { serve } from "jsr:@std/http@0.224.0/server";
import { z } from "zod";
import { requireAdmin, json, handleCors } from "../_shared/admin.ts";

const ParamsSchema = z
  .object({
    days: z.coerce.number().int().min(1).max(365).optional(),
    max_position: z.coerce.number().int().min(1).max(200).optional(),
  })
  .passthrough();

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { svc } = await requireAdmin(req);

    const url = new URL(req.url);
    const body = req.method === "GET" ? {} : await req.json().catch(() => ({}));
    const parsed = ParamsSchema.safeParse({
      ...Object.fromEntries(url.searchParams.entries()),
      ...(body && typeof body === "object" ? body : {}),
    });
    if (!parsed.success) {
      return json(req, 400, { ok: false, error: "bad_request", details: parsed.error.flatten() });
    }

    const days = parsed.data.days ?? 30;
    const maxPosition = parsed.data.max_position ?? 50;

    const since = new Date();
    since.setUTCDate(since.getUTCDate() - (days - 1));
    const sinceIso = isoDate(since);

    const { data, error } = await svc
      .from("rec_position_daily_metrics_v1")
      .select("*")
      .gte("day", sinceIso)
      .lt("position", maxPosition)
      .order("day", { ascending: true })
      .order("position", { ascending: true });

    if (error) return json(req, 500, { ok: false, error: "query_failed", message: error.message });

    return json(req, 200, { ok: true, since: sinceIso, days, max_position: maxPosition, rows: data ?? [] });
  } catch (err) {
    return json(req, 500, { ok: false, error: "internal_error", message: String((err as any)?.message ?? err) });
  }
});
