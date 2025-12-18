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

export default function Costs() {
  const [days, setDays] = useState(14);
  const q = useQuery({ queryKey: ["costs", { days }], queryFn: () => getCosts({ days }) });

  const hasBudget = Boolean(
    q.data?.today?.budget != null ||
      (q.data?.budgets?.by_provider_daily && Object.keys(q.data.budgets.by_provider_daily).length > 0)
  );

  const chartData = useMemo(() => {
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

  const providers = useMemo(() => {
    const s = new Set<string>();
    for (const r of q.data?.daily ?? []) s.add(r.provider);
    return Array.from(s.values()).sort();
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

      <Card title="Tokens by day (from job_run_log)">
        <div className="mb-3 flex items-center gap-3">
          <div className="w-28">
            <Input type="number" value={String(days)} min={3} max={60} onChange={(e) => setDays(Number(e.target.value))} />
          </div>
          <div className="text-xs text-zinc-500">Days</div>
        </div>

        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Legend />
              {providers.map((p) => (
                <Line key={p} type="monotone" dataKey={p} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 text-xs text-zinc-500">
          Note: This dashboard reads tokens logged by the embedding/rerank Edge Functions. If a provider doesn’t report tokens,
          its line may be empty.
        </div>

        <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/30 p-3 text-xs text-zinc-300">
          Total records: <span className="font-mono">{fmtInt(q.data!.daily.length)}</span>
        </div>
      </Card>
    </div>
  );
}
