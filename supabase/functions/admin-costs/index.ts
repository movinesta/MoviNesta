import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { requireAdmin, json, jsonError, handleCors, HttpError } from "../_shared/admin.ts";

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

function readNumberEnv(name: string): number | null {
  const raw = Deno.env.get(name);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function readJsonBudgetEnv(name: string): Record<string, number> | null {
  const raw = Deno.env.get(name);
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return null;
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(obj)) {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) out[String(k)] = n;
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { svc } = await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const days = clamp(Number(body.days ?? 14), 3, 60);

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await svc
      .from("job_run_log")
      .select("started_at, provider, total_tokens")
      .gte("started_at", since)
      .order("started_at", { ascending: true });

    if (error) throw new HttpError(500, error.message, "supabase_error");

    const agg = new Map<string, number>();
    for (const r of data ?? []) {
      const provider = String((r as any).provider ?? "unknown");
      const tokens = Number((r as any).total_tokens ?? 0);
      if (!tokens) continue;
      const day = dayKey(String((r as any).started_at));
      const k = `${day}|${provider}`;
      agg.set(k, (agg.get(k) ?? 0) + tokens);
    }

    const daily = Array.from(agg.entries()).map(([k, tokens]) => {
      const [day, provider] = k.split("|");
      return { day, provider, tokens };
    });

    const today = dayKey(new Date().toISOString());
    const usedByProvider = new Map<string, number>();
    for (const [k, tokens] of agg.entries()) {
      const [day, provider] = k.split("|");
      if (day !== today) continue;
      usedByProvider.set(provider, (usedByProvider.get(provider) ?? 0) + tokens);
    }

    const totalBudget = readNumberEnv("ADMIN_DAILY_TOKEN_BUDGET");
    const budgetByProvider = readJsonBudgetEnv("ADMIN_DAILY_TOKEN_BUDGET_BY_PROVIDER");

    // Union of providers seen today + providers that have a budget configured
    const providerSet = new Set<string>();
    for (const p of usedByProvider.keys()) providerSet.add(p);
    for (const p of Object.keys(budgetByProvider ?? {})) providerSet.add(p);

    const today_by_provider = Array.from(providerSet.values())
      .sort()
      .map((provider) => {
        const used = usedByProvider.get(provider) ?? 0;
        const budget = budgetByProvider?.[provider] ?? null;
        const remaining = budget == null ? null : Math.max(0, budget - used);
        return { provider, used, budget, remaining };
      });

    const today_used_total = Array.from(usedByProvider.values()).reduce((a, b) => a + b, 0);
    const today_budget_total = totalBudget;
    const today_remaining_total = totalBudget == null ? null : Math.max(0, totalBudget - today_used_total);

    return json(req, 200, {
      ok: true,
      daily,
      today: {
        day: today,
        used: today_used_total,
        budget: today_budget_total,
        remaining: today_remaining_total,
      },
      today_by_provider,
      budgets: {
        total_daily: totalBudget,
        by_provider_daily: budgetByProvider ?? {},
      },
    });
  } catch (e) {
    return jsonError(req, e);
  }
});
