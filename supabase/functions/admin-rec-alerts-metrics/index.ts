import { serve } from "jsr:@std/http@0.224.0/server";
import { z } from "zod";
import { requireAdmin, json, handleCors } from "../_shared/admin.ts";

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
    if (!parsed.success) {
      return json(req, 400, {
        ok: false,
        code: "bad_request",
        message: "Invalid request body",
        details: parsed.error.flatten(),
      });
    }

    const days = parsed.data.days ?? 30;
    const since = new Date();
    since.setDate(since.getDate() - days + 1);

    const sinceStr = isoDate(since);

    const [dailyRes, alertsRes] = await Promise.all([
      svc.from("rec_alerts_daily_metrics_v1").select("*").gte("day", sinceStr).order("day", { ascending: true }),
      svc.from("rec_active_alerts_v1").select("*").gte("day", sinceStr).order("day", { ascending: false }),
    ]);

    if (dailyRes.error) {
      return json(req, 500, { ok: false, code: "db_error", message: dailyRes.error.message, details: dailyRes.error });
    }
    if (alertsRes.error) {
      return json(req, 500, { ok: false, code: "db_error", message: alertsRes.error.message, details: alertsRes.error });
    }

    return json(req, 200, {
      ok: true,
      since: sinceStr,
      days,
      daily: dailyRes.data ?? [],
      alerts: alertsRes.data ?? [],
    });
  } catch (e) {
    return json(req, 500, { ok: false, code: "internal_error", message: e instanceof Error ? e.message : String(e) });
  }
});
