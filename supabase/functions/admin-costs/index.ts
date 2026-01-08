import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { requireAdmin, json, handleCors, jsonError } from "../_shared/admin.ts";

type CostsSettingsRow = {
  id: number;
  total_daily_budget: number | null;
  by_provider_budget: Record<string, number> | null;
  updated_at: string;
};

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

function normalizeProvider(p: unknown): string {
  const raw = String(p ?? "").trim();
  if (!raw) return "unknown";

  // Normalize to a stable, low-risk key for grouping in the dashboard.
  // Examples: "OpenRouter" -> "openrouter", "openai.com" -> "openai.com"
  const s = raw.toLowerCase();

  // Keep only characters that are safe as object keys and UI labels.
  const cleaned = s.replace(/[^a-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");

  return cleaned ? cleaned.slice(0, 64) : "unknown";
}

function sanitizeBudgets(input: unknown): { total_daily_budget: number | null; by_provider_budget: Record<string, number> } {
  const total = asNum((input as any)?.total_daily_budget);
  const total_daily_budget = total === null ? null : Math.max(0, Math.floor(total));

  const out: Record<string, number> = {};
  const raw = (input as any)?.by_provider_budget;
  if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const n = asNum(v);
      if (n === null) continue;
      out[String(k)] = Math.max(0, Math.floor(n));
    }
  }

  return { total_daily_budget, by_provider_budget: out };
}

async function readSettings(svc: any): Promise<{ total_daily_budget: number | null; by_provider_budget: Record<string, number> }> {
  // If the table doesn't exist yet, fall back to disabled budgets.
  const { data, error } = await svc
    .from("admin_costs_settings")
    .select("id,total_daily_budget,by_provider_budget,updated_at")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    // PostgREST returns 42P01 when relation is missing.
    return { total_daily_budget: null, by_provider_budget: {} };
  }

  const row = data as CostsSettingsRow | null;
  const total = asNum(row?.total_daily_budget);
  const by = (row?.by_provider_budget && typeof row.by_provider_budget === "object")
    ? (row.by_provider_budget as Record<string, number>)
    : {};
  return { total_daily_budget: total === null ? null : Math.max(0, Math.floor(total)), by_provider_budget: by };
}

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { svc } = await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const action = String((body as any)?.action ?? "get");

    // Budgets are stored in DB (public.admin_costs_settings). No ENV-based budgets.
    if (action === "set_budgets") {
      const next = sanitizeBudgets(body);
      const { error } = await svc
        .from("admin_costs_settings")
        .upsert({
          id: 1,
          total_daily_budget: next.total_daily_budget,
          by_provider_budget: next.by_provider_budget,
          updated_at: new Date().toISOString(),
        }, { onConflict: "id" });
      if (error) return json(req, 500, { ok: false, message: error.message });
    }

    const settings = await readSettings(svc);

    const days = clamp(Number(body.days ?? 14), 3, 60);
    const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const todayDay = dayKey(new Date().toISOString());

    const { data: rows, error: rowsErr } = await svc
      .from("job_run_log")
      .select("started_at, provider, total_tokens, ok, job_name")
      .gte("started_at", sinceIso)
      .order("started_at", { ascending: true });

    if (rowsErr) return json(req, 500, { ok: false, message: rowsErr.message });

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
      const provider = normalizeProvider((r as any).provider);
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

    const totalBudget = settings.total_daily_budget;
    const totalRemaining = totalBudget === null ? null : Math.max(0, Math.floor(totalBudget - todayTotal));

    const budgetByProvider: Record<string, number | null> = {};
    const remainingByProvider: Record<string, number | null> = {};
    const providerKeys = new Set<string>([...Object.keys(todayByProvider), ...Object.keys(settings.by_provider_budget)]);
    for (const p of providerKeys) {
      const b = asNum(settings.by_provider_budget[p]);
      budgetByProvider[p] = b === null ? null : Math.max(0, Math.floor(b));
      const used = Number(todayByProvider[p] ?? 0);
      remainingByProvider[p] = budgetByProvider[p] === null ? null : Math.max(0, Math.floor((budgetByProvider[p] as number) - used));
    }

    return json(req, 200, {
      ok: true,
      days,
      since: sinceIso,
      budgets: settings,
      today: {
        day: todayDay,
        total_tokens: todayTotal,
        by_provider: todayByProvider,
        total_budget: totalBudget,
        total_remaining: totalRemaining,
        budget_by_provider: budgetByProvider,
        remaining_by_provider: remainingByProvider,
      },
      data_quality: { rows: rowsTotal, rows_with_tokens: rowsWithTokens, rows_missing_tokens: rowsMissingTokens },
      daily,
      daily_jobs,
      jobs,
    });
  } catch (e) {
    return jsonError(req, e);
  }
});
