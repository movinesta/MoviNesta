import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { requireAdmin, json, handleCors } from "../_shared/admin.ts";

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(n, b));
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

function asNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { svc } = await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    // Note: budgets/env-based limits intentionally removed. This endpoint only reports usage.

    const days = clamp(Number(body.days ?? 14), 3, 60);
    const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const todayDay = dayKey(new Date().toISOString());

    const { data: rows, error: rowsErr } = await svc
      .from("job_run_log")
      .select("started_at, provider, total_tokens, ok, job_name")
      .gte("started_at", sinceIso)
      .order("started_at", { ascending: true });

    if (rowsErr) return json(500, { ok: false, message: rowsErr.message });

    const dailyAgg = new Map<string, { tokens: number; runs: number; errors: number }>();
    const dailyJobAgg = new Map<string, { tokens: number; runs: number; errors: number }>();
    const jobAgg = new Map<string, { tokens: number; runs: number; errors: number; last_started_at: string | null }>();

    const todayByProvider: Record<string, number> = {};
    let todayTotal = 0;

    let rowsTotal = 0;
    let rowsWithTokens = 0;
    let rowsMissingTokens = 0;

    for (const r of rows ?? []) {
      rowsTotal += 1;
      const provider = String((r as any).provider ?? "unknown");
      const jobName = String((r as any).job_name ?? "unknown");
      const startedAt = String((r as any).started_at ?? "");
      const day = dayKey(startedAt);
      const ok = Boolean((r as any).ok);

      const tokRaw = (r as any).total_tokens;
      const tok = asNum(tokRaw) ?? 0;
      if (tokRaw === null || tokRaw === undefined) rowsMissingTokens += 1;
      else rowsWithTokens += 1;

      const dailyKey = `${day}|${provider}`;
      const d0 = dailyAgg.get(dailyKey) ?? { tokens: 0, runs: 0, errors: 0 };
      d0.tokens += tok;
      d0.runs += 1;
      if (!ok) d0.errors += 1;
      dailyAgg.set(dailyKey, d0);

      const dailyJobKey = `${day}|${jobName}|${provider}`;
      const dj0 = dailyJobAgg.get(dailyJobKey) ?? { tokens: 0, runs: 0, errors: 0 };
      dj0.tokens += tok;
      dj0.runs += 1;
      if (!ok) dj0.errors += 1;
      dailyJobAgg.set(dailyJobKey, dj0);

      const jobKey = `${jobName}|${provider}`;
      const j0 = jobAgg.get(jobKey) ?? { tokens: 0, runs: 0, errors: 0, last_started_at: null };
      j0.tokens += tok;
      j0.runs += 1;
      if (!ok) j0.errors += 1;
      if (!j0.last_started_at || String(startedAt).localeCompare(j0.last_started_at) > 0) {
        j0.last_started_at = startedAt;
      }
      jobAgg.set(jobKey, j0);

      if (day === todayDay) {
        todayByProvider[provider] = (todayByProvider[provider] ?? 0) + tok;
        todayTotal += tok;
      }
    }

    const daily = Array.from(dailyAgg.entries()).map(([k, v]) => {
      const [day, provider] = k.split("|");
      return { day, provider, tokens: v.tokens, runs: v.runs, errors: v.errors };
    });

    const daily_jobs = Array.from(dailyJobAgg.entries()).map(([k, v]) => {
      const [day, job_name, provider] = k.split("|");
      return { day, job_name, provider, tokens: v.tokens, runs: v.runs, errors: v.errors };
    });

    const jobs = Array.from(jobAgg.entries()).map(([k, v]) => {
      const [job_name, provider] = k.split("|");
      return { job_name, provider, tokens: v.tokens, runs: v.runs, errors: v.errors, last_started_at: v.last_started_at };
    }).sort((a, b) => b.tokens - a.tokens);

    return json(200, {
      ok: true,
      days,
      since: sinceIso,
      today: { day: todayDay, total_tokens: todayTotal, by_provider: todayByProvider },
      data_quality: { rows: rowsTotal, rows_with_tokens: rowsWithTokens, rows_missing_tokens: rowsMissingTokens },
      daily,
      daily_jobs,
      jobs,
    });
  } catch (e) {
    return json(400, { ok: false, message: (e as any)?.message ?? String(e) });
  }
});
