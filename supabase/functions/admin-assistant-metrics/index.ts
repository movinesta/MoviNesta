import { serve } from "jsr:@std/http@0.224.0/server";
import { z } from "zod";
import { requireAdmin, json, handleCors, jsonError } from "../_shared/admin.ts";

const BodySchema = z
  .object({
    days: z.number().int().min(1).max(90).optional(),
  })
  .optional();

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { svc } = await requireAdmin(req);

    const body = BodySchema.parse(await req.json().catch(() => ({})));
    const days = body?.days ?? 14;

    const start = new Date();
    start.setUTCDate(start.getUTCDate() - (days - 1));
    const startIso = isoDate(start);

    const [{ data: metrics, error: mErr }, { data: fires, error: fErr }, { data: triggers, error: tErr }] =
      await Promise.all([
        svc
          .from("assistant_metrics_daily")
          .select("day, surface, kind, created_count, shown_count, accepted_count, dismissed_count, unique_users, total_tokens")
          .gte("day", startIso)
          .order("day", { ascending: true }),
        svc
          .from("assistant_trigger_fires")
          .select("trigger_id, fired_day, surface, user_id")
          .gte("fired_day", startIso),
        svc.from("assistant_triggers").select("id, name").eq("enabled", true),
      ]);

    if (mErr) return json(req, 500, { ok: false, code: "DB_ERROR", message: mErr.message });
    if (fErr) return json(req, 500, { ok: false, code: "DB_ERROR", message: fErr.message });
    if (tErr) return json(req, 500, { ok: false, code: "DB_ERROR", message: tErr.message });

    const triggerNameById = new Map<string, string>((triggers ?? []).map((t: any) => [t.id, t.name]));

    // Totals
    let created = 0,
      shown = 0,
      accepted = 0,
      dismissed = 0,
      tokens = 0;
    const usersByDay = new Map<string, Set<string>>();
    const seriesByDay = new Map<string, { day: string; created: number; accepted: number; dismissed: number; tokens: number }>();

    for (const r of metrics ?? []) {
      created += Number((r as any).created_count ?? 0);
      shown += Number((r as any).shown_count ?? 0);
      accepted += Number((r as any).accepted_count ?? 0);
      dismissed += Number((r as any).dismissed_count ?? 0);
      tokens += Number((r as any).total_tokens ?? 0);

      const day = String((r as any).day);
      const existing = seriesByDay.get(day) ?? { day, created: 0, accepted: 0, dismissed: 0, tokens: 0 };
      existing.created += Number((r as any).created_count ?? 0);
      existing.accepted += Number((r as any).accepted_count ?? 0);
      existing.dismissed += Number((r as any).dismissed_count ?? 0);
      existing.tokens += Number((r as any).total_tokens ?? 0);
      seriesByDay.set(day, existing);
    }

    // Trigger stats
    const firesByTrigger = new Map<string, { trigger_id: string; name: string; fires: number; users: Set<string> }>();
    const firesSeries = new Map<string, { day: string; fires: number }>();

    for (const r of fires ?? []) {
      const triggerId = String((r as any).trigger_id);
      const userId = String((r as any).user_id ?? "");
      const day = String((r as any).fired_day);

      const item =
        firesByTrigger.get(triggerId) ??
        { trigger_id: triggerId, name: triggerNameById.get(triggerId) ?? triggerId, fires: 0, users: new Set<string>() };
      item.fires += 1;
      if (userId) item.users.add(userId);
      firesByTrigger.set(triggerId, item);

      const s = firesSeries.get(day) ?? { day, fires: 0 };
      s.fires += 1;
      firesSeries.set(day, s);
    }

    const acceptRate = created > 0 ? accepted / created : 0;
    const dismissRate = created > 0 ? dismissed / created : 0;

    return json(req, 200, {
      ok: true,
      range: { days, start: startIso },
      totals: { created, shown, accepted, dismissed, acceptRate, dismissRate, tokens },
      series: Array.from(seriesByDay.values()).sort((a, b) => a.day.localeCompare(b.day)),
      by_surface_kind: metrics ?? [],
      triggers: Array.from(firesByTrigger.values())
        .map((x) => ({ ...x, unique_users: x.users.size }))
        .sort((a, b) => b.fires - a.fires)
        .slice(0, 20),
      trigger_series: Array.from(firesSeries.values()).sort((a, b) => a.day.localeCompare(b.day)),
    });
  } catch (e) {
    return jsonError(req, e);
  }
});
