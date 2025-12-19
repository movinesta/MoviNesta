import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCosts } from "../lib/api";
import { Card } from "../components/Card";
import { Input } from "../components/Input";
import { fmtInt } from "../lib/ui";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

function Title(props: { children: React.ReactNode }) {
  return <div className="mb-4 text-xl font-semibold tracking-tight">{props.children}</div>;
}

function fmtPct(x: number) {
  if (!Number.isFinite(x)) return "0%";
  return `${Math.round(x * 1000) / 10}%`;
}

function safeNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function parseBudgetMapJson(v: string): Record<string, number> | null {
  const s = (v ?? "").trim();
  if (!s) return null;
  try {
    const obj = JSON.parse(s);
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
    const out: Record<string, number> = {};
    for (const [k, val] of Object.entries(obj)) out[String(k)] = safeNum(val);
    return out;
  } catch {
    return null;
  }
}

export default function Costs() {
  const [days, setDays] = useState(14);

  // Provider filter UI
  const [providerFilterMode, setProviderFilterMode] = useState<"all" | "some">("all");
  const [selectedProviders, setSelectedProviders] = useState<Record<string, boolean>>({});

  // Optional local budgets (UI) – used only if backend doesn’t provide budgets
  const [budgetTotalDailyOverride, setBudgetTotalDailyOverride] = useState<string>("");
  const [budgetByProviderOverride, setBudgetByProviderOverride] = useState<string>("");

  const q = useQuery({ queryKey: ["costs", { days }], queryFn: () => getCosts({ days }) });

  const rawDaily = useMemo(() => {
    const raw: any = (q.data as any)?.daily;
    return Array.isArray(raw) ? raw : [];
  }, [q.data]);

  // Data quality metrics (before coercion)
  const dataQuality = useMemo(() => {
    const total = rawDaily.length;
    let badRow = 0;
    let missingTokens = 0;
    let missingProvider = 0;
    let missingDay = 0;

    for (const r of rawDaily) {
      if (!r || typeof r !== "object") {
        badRow++;
        continue;
      }
      if (typeof r.day !== "string") missingDay++;
      if (typeof r.provider !== "string") missingProvider++;
      if (!Number.isFinite(Number(r.tokens))) missingTokens++;
    }
    return { total, badRow, missingTokens, missingProvider, missingDay };
  }, [rawDaily]);

  const dailyRows = useMemo(() => {
    // Defensive: network/proxy errors or partial responses can yield null/undefined rows.
    return rawDaily
      .filter(Boolean)
      .filter((r: any) => typeof r.day === "string" && typeof r.provider === "string")
      .map((r: any) => ({
        day: r.day,
        provider: r.provider,
        tokens: Number.isFinite(Number(r.tokens)) ? Number(r.tokens) : 0,
      }));
  }, [rawDaily]);

  const providers = useMemo(() => {
    const s = new Set<string>();
    for (const r of dailyRows) s.add(r.provider);
    return Array.from(s.values()).sort();
  }, [dailyRows]);

  // Ensure selectedProviders includes all providers when list changes
  const providerSelection = useMemo(() => {
    const base: Record<string, boolean> = { ...selectedProviders };
    for (const p of providers) if (typeof base[p] !== "boolean") base[p] = true;
    return base;
  }, [providers, selectedProviders]);

  const effectiveSelectedProviders = useMemo(() => {
    if (providerFilterMode === "all") return new Set(providers);
    const s = new Set<string>();
    for (const p of providers) if (providerSelection[p]) s.add(p);
    return s;
  }, [providerFilterMode, providers, providerSelection]);

  const filteredDailyRows = useMemo(() => {
    if (providerFilterMode === "all") return dailyRows;
    return dailyRows.filter((r) => effectiveSelectedProviders.has(r.provider));
  }, [dailyRows, providerFilterMode, effectiveSelectedProviders]);

  // Budgets: prefer backend, fallback to UI overrides
  const budgets = useMemo(() => {
    const b: any = (q.data as any)?.budgets;

    const backendTotalDaily = b && Number.isFinite(Number(b.total_daily)) ? Number(b.total_daily) : null;
    const backendByProviderDaily =
      b && b.by_provider_daily && typeof b.by_provider_daily === "object" && !Array.isArray(b.by_provider_daily)
        ? (Object.fromEntries(Object.entries(b.by_provider_daily).map(([k, v]) => [k, safeNum(v)])) as Record<string, number>)
        : null;

    const overrideTotalDaily = budgetTotalDailyOverride.trim() ? safeNum(budgetTotalDailyOverride) : null;
    const overrideByProvider = parseBudgetMapJson(budgetByProviderOverride);

    return {
      total_daily: backendTotalDaily ?? overrideTotalDaily,
      by_provider_daily: backendByProviderDaily ?? overrideByProvider ?? null,
      source:
        backendTotalDaily != null || backendByProviderDaily != null
          ? "backend"
          : overrideTotalDaily != null || overrideByProvider != null
          ? "override"
          : "none",
    };
  }, [q.data, budgetTotalDailyOverride, budgetByProviderOverride]);

  const chartData = useMemo(() => {
    if (!filteredDailyRows.length) return [];

    // pivot by day/provider for recharts
    const byDay: Record<string, any> = {};
    for (const r of filteredDailyRows) {
      byDay[r.day] = byDay[r.day] ?? { day: r.day, total: 0 };
      byDay[r.day][r.provider] = (byDay[r.day][r.provider] ?? 0) + r.tokens;
      byDay[r.day].total += r.tokens;
    }

    const rows = Object.values(byDay).sort((a: any, b: any) => String(a.day).localeCompare(String(b.day)));

    // Add budget/remaining lines (if we have a total daily budget)
    const totalBudget = budgets.total_daily;
    if (totalBudget != null && Number.isFinite(totalBudget) && totalBudget > 0) {
      for (const r of rows as any[]) {
        r.budget_total = totalBudget;
        r.remaining_total = Math.max(0, totalBudget - safeNum(r.total));
      }
    }

    // Add per-provider budgets/remaining (optional)
    const byProv = budgets.by_provider_daily;
    if (byProv && typeof byProv === "object") {
      for (const r of rows as any[]) {
        for (const [p, b] of Object.entries(byProv)) {
          const used = safeNum(r[p]);
          r[`budget_${p}`] = b;
          r[`remaining_${p}`] = Math.max(0, b - used);
        }
      }
    }

    return rows;
  }, [filteredDailyRows, budgets.total_daily, budgets.by_provider_daily]);

  const daysInChart = useMemo(() => {
    const s = new Set<string>();
    for (const r of filteredDailyRows) s.add(r.day);
    return Array.from(s).sort();
  }, [filteredDailyRows]);

  const latestDay = useMemo(() => (daysInChart.length ? daysInChart[daysInChart.length - 1] : null), [daysInChart]);

  const totals = useMemo(() => {
    // totals in the filtered selection
    const byProv: Record<string, number> = {};
    const byDay: Record<string, number> = {};
    let totalTokens = 0;

    for (const r of filteredDailyRows) {
      byProv[r.provider] = (byProv[r.provider] ?? 0) + r.tokens;
      byDay[r.day] = (byDay[r.day] ?? 0) + r.tokens;
      totalTokens += r.tokens;
    }

    const todayTokens = latestDay ? safeNum(byDay[latestDay]) : 0;

    // last 7 days within the *displayed* range
    const sortedDays = Object.keys(byDay).sort();
    const last7 = sortedDays.slice(-7);
    const last7Tokens = last7.reduce((acc, d) => acc + safeNum(byDay[d]), 0);

    const avgPerDay = sortedDays.length ? totalTokens / sortedDays.length : 0;

    let topProvider: { provider: string; tokens: number } | null = null;
    for (const [p, t] of Object.entries(byProv)) {
      if (!topProvider || t > topProvider.tokens) topProvider = { provider: p, tokens: t };
    }

    return { totalTokens, todayTokens, last7Tokens, avgPerDay, byProv, byDay, topProvider };
  }, [filteredDailyRows, latestDay]);

  const providerTable = useMemo(() => {
    const rows = providers
      .filter((p) => (providerFilterMode === "all" ? true : effectiveSelectedProviders.has(p)))
      .map((p) => {
        const used = safeNum(totals.byProv[p]);
        const share = totals.totalTokens > 0 ? used / totals.totalTokens : 0;
        const budget = budgets.by_provider_daily ? safeNum((budgets.by_provider_daily as any)[p]) : null;
        const remaining = budget != null && budget > 0 ? Math.max(0, budget - used) : null;
        return { provider: p, used, share, budget, remaining };
      })
      .sort((a, b) => b.used - a.used);

    return rows;
  }, [providers, providerFilterMode, effectiveSelectedProviders, totals.byProv, totals.totalTokens, budgets.by_provider_daily]);

  const emptyHint = useMemo(() => {
    if (!filteredDailyRows.length) return "No token logs found for this range. Run embedding/rerank/search jobs (or widen the date range).";
    if (daysInChart.length <= 1)
      return "Only 1 day of token logs found. Run jobs across multiple days (or widen the date range) to see trends.";
    if (daysInChart.length < 3)
      return "Only a few days of token logs found. More days will make trends clearer (try 14–30 days).";
    return null;
  }, [filteredDailyRows.length, daysInChart.length]);

  const showBudgetLines = useMemo(() => budgets.total_daily != null && budgets.total_daily > 0, [budgets.total_daily]);

  if (q.isLoading) return <div className="text-sm text-zinc-400">Loading…</div>;
  if (q.error) return <div className="text-sm text-red-400">{(q.error as any).message}</div>;

  const budgetTotal = budgets.total_daily ?? null;
  const remainingToday =
    budgetTotal != null && latestDay ? Math.max(0, budgetTotal - safeNum(totals.byDay[latestDay])) : null;

  return (
    <div className="space-y-6">
      <Title>Costs</Title>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <Card title="Today (latest day)">
          <div className="text-xs text-zinc-500">{latestDay ?? "—"}</div>
          <div className="mt-1 text-2xl font-semibold">{fmtInt(totals.todayTokens)}</div>
          <div className="mt-1 text-xs text-zinc-500">tokens</div>
        </Card>

        <Card title="Last 7 days (in range)">
          <div className="mt-1 text-2xl font-semibold">{fmtInt(totals.last7Tokens)}</div>
          <div className="mt-1 text-xs text-zinc-500">tokens</div>
        </Card>

        <Card title={`Average / day (${daysInChart.length || 0} days)`}>
          <div className="mt-1 text-2xl font-semibold">{fmtInt(Math.round(totals.avgPerDay))}</div>
          <div className="mt-1 text-xs text-zinc-500">tokens per day</div>
        </Card>

        <Card title="Top provider (in range)">
          <div className="mt-1 text-lg font-semibold">{totals.topProvider?.provider ?? "—"}</div>
          <div className="mt-1 text-sm text-zinc-300">{fmtInt(totals.topProvider?.tokens ?? 0)} tokens</div>
        </Card>
      </div>

      {/* Filters */}
      <Card title="Filters">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <div className="mb-1 text-xs text-zinc-500">Range (days)</div>
            <div className="flex items-center gap-2">
              <div className="w-28">
                <Input
                  type="number"
                  value={String(days)}
                  min={3}
                  max={60}
                  onChange={(e) => setDays(Math.max(3, Math.min(60, Number(e.target.value) || 14)))}
                />
              </div>
              <div className="flex items-center gap-1">
                {[7, 14, 30, 60].map((d) => (
                  <button
                    key={d}
                    className={`rounded-lg border px-2 py-1 text-xs ${
                      days === d ? "border-zinc-600 bg-zinc-800 text-zinc-100" : "border-zinc-800 bg-zinc-900/30 text-zinc-300"
                    }`}
                    onClick={() => setDays(d)}
                    type="button"
                  >
                    {d}d
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className="mb-1 text-xs text-zinc-500">Providers</div>
            <div className="flex items-center gap-2">
              <button
                className={`rounded-lg border px-2 py-1 text-xs ${
                  providerFilterMode === "all"
                    ? "border-zinc-600 bg-zinc-800 text-zinc-100"
                    : "border-zinc-800 bg-zinc-900/30 text-zinc-300"
                }`}
                onClick={() => setProviderFilterMode("all")}
                type="button"
              >
                All
              </button>
              <button
                className={`rounded-lg border px-2 py-1 text-xs ${
                  providerFilterMode === "some"
                    ? "border-zinc-600 bg-zinc-800 text-zinc-100"
                    : "border-zinc-800 bg-zinc-900/30 text-zinc-300"
                }`}
                onClick={() => setProviderFilterMode("some")}
                type="button"
              >
                Select…
              </button>
            </div>
          </div>

          {/* Optional budgets */}
          <div className="min-w-[260px] flex-1">
            <div className="mb-1 text-xs text-zinc-500">
              Budgets (optional){" "}
              <span className="text-[11px] text-zinc-600">
                — source: <span className="font-mono">{budgets.source}</span>
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <Input
                placeholder="Total daily budget (e.g., 2000000)"
                value={budgetTotalDailyOverride}
                onChange={(e) => setBudgetTotalDailyOverride(e.target.value)}
              />
              <Input
                placeholder='By-provider JSON (e.g., {"jina":1500000,"voyage":300000})'
                value={budgetByProviderOverride}
                onChange={(e) => setBudgetByProviderOverride(e.target.value)}
              />
            </div>
            {budgetTotal != null && latestDay ? (
              <div className="mt-2 text-xs text-zinc-400">
                Remaining today: <span className="font-mono">{fmtInt(remainingToday ?? 0)}</span>{" "}
                <span className="text-zinc-600">(budget {fmtInt(budgetTotal)})</span>
              </div>
            ) : (
              <div className="mt-2 text-xs text-zinc-500">
                Tip: add a total daily budget to show “used vs remaining” lines.
              </div>
            )}
          </div>
        </div>

        {providerFilterMode === "some" && (
          <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/30 p-3">
            <div className="mb-2 text-xs text-zinc-500">Select providers</div>
            <div className="flex flex-wrap gap-2">
              {providers.map((p) => {
                const checked = !!providerSelection[p];
                return (
                  <label key={p} className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/30 px-2 py-1 text-xs">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        setSelectedProviders((prev) => ({ ...prev, [p]: e.target.checked }));
                      }}
                    />
                    <span className="font-mono">{p}</span>
                  </label>
                );
              })}
              {!providers.length && <div className="text-xs text-zinc-500">No providers found.</div>}
            </div>
          </div>
        )}
      </Card>

      {/* Chart */}
      <Card title="Tokens by day (from job_run_log)">
        {emptyHint && (
          <div className="mb-3 rounded-xl border border-zinc-800 bg-zinc-900/30 p-3 text-xs text-zinc-300">
            {emptyHint}
          </div>
        )}

        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Legend />

              {/* Total line */}
              <Line type="monotone" dataKey="total" name="total" dot={false} />

              {/* Provider lines */}
              {providers
                .filter((p) => (providerFilterMode === "all" ? true : effectiveSelectedProviders.has(p)))
                .map((p) => (
                  <Line key={p} type="monotone" dataKey={p} name={p} dot={false} />
                ))}

              {/* Budget / remaining */}
              {showBudgetLines && (
                <>
                  <Line type="monotone" dataKey="budget_total" name="budget_total" dot={false} />
                  <Line type="monotone" dataKey="remaining_total" name="remaining_total" dot={false} />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 text-xs text-zinc-500">
          Note: This dashboard reads tokens logged by the embedding/rerank/search Edge Functions. If a provider doesn’t report tokens, its line may be
          empty (or near zero).
        </div>
      </Card>

      {/* Provider breakdown */}
      <Card title="Provider breakdown (in selected range)">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zinc-500">
                <th className="py-2 pr-3">Provider</th>
                <th className="py-2 pr-3">Tokens</th>
                <th className="py-2 pr-3">Share</th>
                <th className="py-2 pr-3">Budget/day</th>
                <th className="py-2 pr-3">Remaining/day</th>
              </tr>
            </thead>
            <tbody className="text-zinc-200">
              {providerTable.map((r) => (
                <tr key={r.provider} className="border-t border-zinc-900/60">
                  <td className="py-2 pr-3 font-mono">{r.provider}</td>
                  <td className="py-2 pr-3 font-mono">{fmtInt(r.used)}</td>
                  <td className="py-2 pr-3">{fmtPct(r.share)}</td>
                  <td className="py-2 pr-3 font-mono">{r.budget != null && r.budget > 0 ? fmtInt(r.budget) : "—"}</td>
                  <td className="py-2 pr-3 font-mono">{r.remaining != null && r.remaining >= 0 ? fmtInt(r.remaining) : "—"}</td>
                </tr>
              ))}
              {!providerTable.length && (
                <tr>
                  <td className="py-3 text-sm text-zinc-500" colSpan={5}>
                    No providers to display.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/30 p-3 text-xs text-zinc-300">
          Total tokens (filtered): <span className="font-mono">{fmtInt(totals.totalTokens)}</span>
        </div>
      </Card>

      {/* Data quality / diagnostics */}
      <Card title="Data quality & diagnostics">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-3">
            <div className="text-xs text-zinc-500">Raw rows</div>
            <div className="mt-1 font-mono text-lg">{fmtInt(dataQuality.total)}</div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-3">
            <div className="text-xs text-zinc-500">Bad rows</div>
            <div className="mt-1 font-mono text-lg">{fmtInt(dataQuality.badRow)}</div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-3">
            <div className="text-xs text-zinc-500">Missing/invalid tokens</div>
            <div className="mt-1 font-mono text-lg">{fmtInt(dataQuality.missingTokens)}</div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-3">
            <div className="text-xs text-zinc-500">Distinct days</div>
            <div className="mt-1 font-mono text-lg">{fmtInt(daysInChart.length)}</div>
          </div>
        </div>

        <div className="mt-4 text-xs text-zinc-500">
          If you see a lot of “missing/invalid tokens”, update the Edge Functions to always log token usage (some providers don’t return token counts by
          default).
        </div>
      </Card>
    </div>
  );
}
