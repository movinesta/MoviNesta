import { serve } from "jsr:@std/http@0.224.0/server";
import { z } from "zod";
import { requireAdmin, json, handleCors } from "../_shared/admin.ts";

const BodySchema = z
  .object({
    days: z.number().int().min(1).max(365).nullish(),
    // Optional filters (UI can send them later without breaking the API)
    mode: z.string().min(1).max(64).nullish(),
    source: z.string().min(1).max(64).nullish(),
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
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - days + 1);

    let q = svc
      .from("rec_source_daily_metrics_v1")
      .select(
        "day,mode,source,impressions,users,detail_opens,likes,dislikes,watchlist_adds,ratings,like_rate,watchlist_add_rate",
      )
      .gte("day", isoDate(since))
      .order("day", { ascending: false })
      .order("mode", { ascending: true })
      .order("source", { ascending: true });

    if (parsed.data.mode) q = q.eq("mode", parsed.data.mode);
    if (parsed.data.source) q = q.eq("source", parsed.data.source);

    const { data, error } = await q;
    if (error) return json(req, 500, { ok: false, code: "QUERY_FAILED", message: error.message });

    return json(req, 200, { ok: true, since: isoDate(since), days, rows: data ?? [] });
  } catch (err) {
    return json(req, 500, { ok: false, code: "INTERNAL_ERROR", message: String((err as any)?.message ?? err) });
  }
});
