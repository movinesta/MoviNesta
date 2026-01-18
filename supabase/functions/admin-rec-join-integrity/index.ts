import { serve } from "jsr:@std/http@0.224.0/server";
import { z } from "zod";
import { requireAdmin, json, handleCors } from "../_shared/admin.ts";

const BodySchema = z
  .object({
    days: z.number().int().min(1).max(365).nullish(),
    // Optional: when true, return the by_event breakdown.
    include_by_event: z.boolean().nullish(),
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
    if (!parsed.success) return json(req, 400, { ok: false, code: "BAD_INPUT" });

    const days = parsed.data.days ?? 30;
    const includeByEvent = parsed.data.include_by_event ?? true;

    const since = new Date();
    since.setUTCDate(since.getUTCDate() - days + 1);

    const { data: daily, error: dailyErr } = await svc
      .from("rec_join_integrity_report_v1")
      .select(
        "day,impressions,impressions_invalid_dedupe_key,impressions_with_event_same_day,events,events_missing_served_dedupe_key,events_invalid_served_dedupe_key,events_invalid_dedupe_key,events_missing_rec_request_id,events_missing_deck_id,events_missing_position,events_joined_to_impression,events_without_impression,event_unjoinable_rate",
      )
      .gte("day", isoDate(since))
      .order("day", { ascending: false });

    if (dailyErr) return json(req, 500, { ok: false, code: "QUERY_FAILED", message: dailyErr.message });

    let by_event: any[] = [];
    if (includeByEvent) {
      const { data: rows, error: byErr } = await svc
        .from("rec_join_integrity_by_event_v1")
        .select(
          "day,event_type,source,events,events_missing_served_dedupe_key,events_invalid_served_dedupe_key,events_invalid_dedupe_key,events_missing_rec_request_id,events_missing_deck_id,events_missing_position,events_joined_to_impression,events_without_impression,event_unjoinable_rate",
        )
        .gte("day", isoDate(since))
        .order("day", { ascending: false })
        .order("events_without_impression", { ascending: false });

      if (byErr) return json(req, 500, { ok: false, code: "QUERY_FAILED", message: byErr.message });
      by_event = rows ?? [];
    }

    return json(req, 200, {
      ok: true,
      since: isoDate(since),
      days,
      daily: daily ?? [],
      by_event,
    });
  } catch (err) {
    return json(req, 500, { ok: false, code: "INTERNAL_ERROR", message: String((err as any)?.message ?? err) });
  }
});
