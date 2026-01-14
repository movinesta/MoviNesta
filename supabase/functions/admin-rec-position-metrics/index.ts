import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { createAdminClient, requireAdmin, json, handleCors, jsonError } from "../_shared/admin.ts";

const QuerySchema = z
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
    const admin = await requireAdmin(req);
    if (!admin.ok) return admin.res;

    const url = new URL(req.url);
    const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
    if (!parsed.success) return jsonError(req, 400, { ok: false, error: "bad_request", details: parsed.error.flatten() });

    const days = parsed.data.days ?? 30;
    const maxPosition = parsed.data.max_position ?? 50;

    const since = new Date();
    since.setUTCDate(since.getUTCDate() - (days - 1));
    const sinceIso = isoDate(since);

    const supabase = createAdminClient(req);

    const { data, error } = await supabase
      .from("rec_position_daily_metrics_v1")
      .select("*")
      .gte("day", sinceIso)
      .lt("position", maxPosition)
      .order("day", { ascending: true })
      .order("position", { ascending: true });

    if (error) return jsonError(req, 500, { ok: false, error: "query_failed", message: error.message });

    return json(req, 200, { ok: true, since: sinceIso, days, max_position: maxPosition, rows: data ?? [] });
  } catch (err) {
    return jsonError(req, 500, { ok: false, error: "internal_error", message: String((err as any)?.message ?? err) });
  }
});
