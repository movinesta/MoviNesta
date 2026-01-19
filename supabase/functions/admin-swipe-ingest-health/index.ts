import { serve } from "jsr:@std/http@0.224.0/server";
import { z } from "zod";
import { requireAdmin, json, handleCors } from "../_shared/admin.ts";

const BodySchema = z
  .object({
    hours: z.number().int().min(1).max(24 * 30).nullish(),
    top_n: z.number().int().min(1).max(50).nullish(),
  })
  .passthrough();

type HourlyRow = {
  bucket_start: string;
  requests: number;
  accepted_events: number;
  rejected_events: number;
  retry_events: number;
  rejection_rate: number | null;
  retry_rate: number | null;
  sample_rate: number;
  updated_at: string;
};

type IssueTotal = { code: string; count: number };

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { svc } = await requireAdmin(req);

    const raw = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) return json(req, 400, { ok: false, code: "BAD_INPUT" });

    const hours = parsed.data.hours ?? 72;
    const topN = parsed.data.top_n ?? 12;

    const since = new Date();
    since.setUTCHours(since.getUTCHours() - hours);
    const sinceIso = since.toISOString();

    const { data: hourly, error: hourlyErr } = await svc
      .from("swipe_ingest_hourly_health_v1")
      .select(
        "bucket_start,requests,accepted_events,rejected_events,retry_events,rejection_rate,retry_rate,sample_rate,updated_at",
      )
      .gte("bucket_start", sinceIso)
      .order("bucket_start", { ascending: false });

    if (hourlyErr) return json(req, 500, { ok: false, code: "QUERY_FAILED", message: hourlyErr.message });

    const { data: issueRows, error: issuesErr } = await svc
      .from("swipe_ingest_hourly_issue_counts")
      .select("bucket_start,code,count")
      .gte("bucket_start", sinceIso);

    if (issuesErr) return json(req, 500, { ok: false, code: "QUERY_FAILED", message: issuesErr.message });

    const totals = new Map<string, number>();
    for (const r of (issueRows ?? []) as any[]) {
      const code = String((r as any)?.code ?? "").trim();
      if (!code) continue;
      const n = Number((r as any)?.count ?? 0);
      totals.set(code, (totals.get(code) ?? 0) + (Number.isFinite(n) ? n : 0));
    }

    const issues: IssueTotal[] = Array.from(totals.entries())
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => Number(b.count ?? 0) - Number(a.count ?? 0))
      .slice(0, topN);

    return json(req, 200, {
      ok: true,
      since: sinceIso,
      hours,
      hourly: (hourly ?? []) as HourlyRow[],
      issues,
    });
  } catch (err) {
    return json(req, 500, {
      ok: false,
      code: "INTERNAL_ERROR",
      message: String((err as any)?.message ?? err),
    });
  }
});
