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
