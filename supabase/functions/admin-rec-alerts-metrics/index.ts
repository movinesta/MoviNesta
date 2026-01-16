import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { requireAdmin, json, handleCors, jsonError } from "../_shared/admin.ts";

const BodySchema = z
  .object({
    days: z.number().int().min(1).max(365).nullish(),
  })
  .passthrough();

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { svc } = await requireAdmin(req);

    const raw = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) return jsonError(req, 400, "bad_request", "Invalid request body", parsed.error.flatten());

    const days = parsed.data.days ?? 30;
    const since = new Date();
    since.setDate(since.getDate() - days + 1);

    const sinceStr = isoDate(since);

    const [dailyRes, alertsRes] = await Promise.all([
      svc.from("rec_alerts_daily_metrics_v1").select("*").gte("day", sinceStr).order("day", { ascending: true }),
      svc.from("rec_active_alerts_v1").select("*").gte("day", sinceStr).order("day", { ascending: false }),
    ]);

    if (dailyRes.error) return jsonError(req, 500, "db_error", dailyRes.error.message, dailyRes.error);
    if (alertsRes.error) return jsonError(req, 500, "db_error", alertsRes.error.message, alertsRes.error);

    return json(req, 200, {
      ok: true,
      since: sinceStr,
      days,
      daily: dailyRes.data ?? [],
      alerts: alertsRes.data ?? [],
    });
  } catch (e) {
    return jsonError(req, 500, "internal_error", e instanceof Error ? e.message : String(e));
  }
});
