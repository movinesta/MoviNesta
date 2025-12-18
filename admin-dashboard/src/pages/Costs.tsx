import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCosts } from "../lib/api";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { fmtInt } from "../lib/ui";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

type Granularity = "daily" | "weekly";

function weekStartKeyFromDay(day: string): string {
  // day is YYYY-MM-DD (UTC day key). Compute Monday-start week label as YYYY-MM-DD.
  const [y, m, d] = day.split("-").map((x) => Number(x));
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  const dow = dt.getUTCDay(); // 0..6, Sunday=0
  const delta = (dow + 6) % 7; // Monday=0
  dt.setUTCDate(dt.getUTCDate() - delta);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function Title(props: { children: React.ReactNode }) {
  return <div className="mb-4 text-xl font-semibold tracking-tight">{props.children}</div>;
}

export default function Costs() {
  const [days, setDays] = useState(14);
  const [granularity, setGranularity] = useState<Granularity>("daily");
  const q = useQuery({ queryKey: ["costs", { days }], queryFn: () => getCosts({ days }) });

  const hasBudget = Boolean(
    q.data?.today?.budget != null ||
      (q.data?.budgets?.by_provider_daily && Object.keys(q.data.budgets.by_provider_daily).length > 0)
  );

  const hasTotalBudget = q.data?.budgets.total_daily != null;

  const dailyProviderChartData = useMemo(() => {
    if (!q.data?.daily) return [];
    // pivot by day/provider for recharts
    type ChartRow = { day: string } & Record<string, number | string>;
    const byDay: Record<string, ChartRow> = {};
    for (const r of q.data.daily) {
      byDay[r.day] = byDay[r.day] ?? { day: r.day };
      byDay[r.day][r.provider] = r.tokens;
    }
    return Object.values(byDay).sort((a, b) => String(a.day).localeCompare(String(b.day)));
  }, [q.data]);

  const weeklyProviderChartData = useMemo(() => {
    if (!q.data?.daily) return [];
    type ChartRow = { week: string } & Record<string, number | string>;
    const agg = new Map<string, number>();
    for (const r of q.data.daily) {
      const week = weekStartKeyFromDay(r.day);
      const k = `${week}|${r.provider}`;
      agg.set(k, (agg.get(k) ?? 0) + r.tokens);
    }
    const byWeek: Record<string, ChartRow> = {};
    for (const [k, tokens] of agg.entries()) {
      const [week, provider] = k.split("|");
      byWeek[week] = byWeek[week] ?? { week };
      byWeek[week][provider] = tokens;
    }
    return Object.values(byWeek).sort((a, b) => String(a.week).localeCompare(String(b.week)));
  }, [q.data]);

  const providers = useMemo(() => {
    const s = new Set<string>();
    for (const r of q.data?.daily ?? []) s.add(r.provider);
    return Array.from(s.values()).sort();
  }, [q.data]);

  const dailyTotalChartData = useMemo(() => {
    if (!q.data?.daily) return [];
    const byDay = new Map<string, number>();
    for (const r of q.data.daily) byDay.set(r.day, (byDay.get(r.day) ?? 0) + r.tokens);
    const budget = q.data.budgets.total_daily;
    return Array.from(byDay.entries())
      .map(([day, used]) => ({ day, used, budget: budget ?? undefined }))
      .sort((a, b) => String(a.day).localeCompare(String(b.day)));
  }, [q.data]);

  const weeklyTotalChartData = useMemo(() => {
    if (!q.data?.daily) return [];
    const byWeek = new Map<string, number>();
    for (const r of q.data.daily) {
      const week = weekStartKeyFromDay(r.day);
      byWeek.set(week, (byWeek.get(week) ?? 0) + r.tokens);
    }
    const budgetDaily = q.data.budgets.total_daily;
    const budgetWeekly = budgetDaily == null ? null : budgetDaily * 7;
    return Array.from(byWeek.entries())
      .map(([week, used]) => ({ week, used, budget: budgetWeekly ?? undefined }))
      .sort((a, b) => String(a.week).localeCompare(String(b.week)));
  }, [q.data]);

  if (q.isLoading) return <div className="text-sm text-zinc-400">Loading…</div>;
  if (q.error) return <div className="text-sm text-red-400">{(q.error as any).message}</div>;

  return (
    <div className="space-y-6">
      <Title>Costs</Title>

      <Card title="Today's token usage">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-3">
            <div className="text-xs text-zinc-500">Used today ({q.data!.today.day})</div>
            <div className="mt-1 font-mono text-lg">{fmtInt(q.data!.today.used)}</div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-3">
            <div className="text-xs text-zinc-500">Daily budget</div>
            <div className="mt-1 font-mono text-lg">{q.data!.today.budget == null ? "—" : fmtInt(q.data!.today.budget)}</div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-3">
            <div className="text-xs text-zinc-500">Remaining</div>
            <div className="mt-1 font-mono text-lg">
              {q.data!.today.remaining == null ? "—" : fmtInt(q.data!.today.remaining)}
            </div>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900/50 text-xs text-zinc-400">
              <tr>
                <th className="px-3 py-2 text-left">Provider</th>
                <th className="px-3 py-2 text-right">Used</th>
                <th className="px-3 py-2 text-right">Budget</th>
                <th className="px-3 py-2 text-right">Remaining</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {q.data!.today_by_provider.map((r) => (
                <tr key={r.provider} className="bg-zinc-950/20">
                  <td className="px-3 py-2 font-medium text-zinc-200">{r.provider}</td>
                  <td className="px-3 py-2 text-right font-mono text-zinc-200">{fmtInt(r.used)}</td>
                  <td className="px-3 py-2 text-right font-mono text-zinc-200">{r.budget == null ? "—" : fmtInt(r.budget)}</td>
                  <td className="px-3 py-2 text-right font-mono text-zinc-200">
                    {r.remaining == null ? "—" : fmtInt(r.remaining)}
                  </td>
                </tr>
              ))}
              {q.data!.today_by_provider.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-sm text-zinc-500">
                    No token logs for today yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="mt-3 text-xs text-zinc-500">
          {hasBudget ? (
            <>Remaining uses server-side env budgets.</>
          ) : (
            <>
              To show remaining tokens, set <span className="font-mono">ADMIN_DAILY_TOKEN_BUDGET</span> (number) and/or{" "}
              <span className="font-mono">ADMIN_DAILY_TOKEN_BUDGET_BY_PROVIDER</span> (JSON map like{" "}
              <span className="font-mono">{'{"openai":1000000}'}</span>) on your Supabase Edge Functions.
            </>
          )}
        </div>
      </Card>

      <Card title="Token usage trends">
        <div className="mb-3 flex items-center gap-3">
          <div className="w-28">
            <Input type="number" value={String(days)} min={3} max={60} onChange={(e) => setDays(Number(e.target.value))} />
          </div>
          <div className="text-xs text-zinc-500">Days</div>

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant={granularity === "daily" ? "primary" : "ghost"}
              className="h-8 rounded-lg px-3 py-1 text-xs"
              onClick={() => setGranularity("daily")}
            >
              Daily
            </Button>
            <Button
              variant={granularity === "weekly" ? "primary" : "ghost"}
              className="h-8 rounded-lg px-3 py-1 text-xs"
              onClick={() => setGranularity("weekly")}
            >
              Weekly
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <div className="mb-2 text-xs text-zinc-500">Total tokens (used vs budget)</div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={granularity === "daily" ? dailyTotalChartData : weeklyTotalChartData}>
                  <XAxis dataKey={granularity === "daily" ? "day" : "week"} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="used" name="used" dot={false} />
                  {hasTotalBudget ? <Line type="monotone" dataKey="budget" name="budget" dot={false} /> : null}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs text-zinc-500">By provider</div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={granularity === "daily" ? dailyProviderChartData : weeklyProviderChartData}>
                  <XAxis dataKey={granularity === "daily" ? "day" : "week"} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {providers.map((p) => (
                    <Line key={p} type="monotone" dataKey={p} dot={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="mt-4 text-xs text-zinc-500">
          Note: Weekly uses Monday-start weeks (labelled by week start date). This dashboard reads tokens logged by the embedding/rerank
          Edge Functions. If a provider doesn’t report tokens, its line may be empty.
        </div>

        <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/30 p-3 text-xs text-zinc-300">
          Total records: <span className="font-mono">{fmtInt(q.data!.daily.length)}</span>
        </div>
      </Card>
    </div>
  );
}
