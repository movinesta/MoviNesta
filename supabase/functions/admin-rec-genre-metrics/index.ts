import { serve } from "jsr:@std/http@0.224.0/server";
import { z } from "zod";
import { requireAdmin, json, handleCors } from "../_shared/admin.ts";

const BodySchema = z
  .object({
    days: z.number().int().min(1).max(365).nullish(),
    genre_slug: z.string().min(1).max(64).nullish(),
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
      .from("rec_genre_daily_metrics_v1")
      .select("day,genre_slug,impressions,users,share_day,share_catalog,muted_impressions")
      .gte("day", isoDate(since))
      .order("day", { ascending: false })
      .order("impressions", { ascending: false });

    if (parsed.data.genre_slug) q = q.eq("genre_slug", parsed.data.genre_slug);

    const { data, error } = await q;
    if (error) return json(req, 500, { ok: false, code: "QUERY_FAILED", message: error.message });

    return json(req, 200, { ok: true, since: isoDate(since), days, rows: data ?? [] });
  } catch (err) {
    return json(req, 500, { ok: false, code: "INTERNAL_ERROR", message: String((err as any)?.message ?? err) });
  }
});
