import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAssistantMetrics } from "../lib/api";
import { StatCard } from "../components/StatCard";
import { Card } from "../components/Card";
import { Table, Th, Td } from "../components/Table";
import { fmtInt } from "../lib/ui";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

function Title(props: { children: React.ReactNode }) {
  return <div className="mb-4 text-xl font-semibold tracking-tight">{props.children}</div>;
}

function pct(x: number) {
  if (!isFinite(x)) return "0%";
  return `${Math.round(x * 100)}%`;
}

export default function Assistant() {
  const [days, setDays] = useState<number>(14);

  const q = useQuery({
    queryKey: ["assistant-metrics", days],
    queryFn: () => getAssistantMetrics({ days }),
  });

  const data = q.data as any;

  const series = useMemo(() => (data?.series ?? []).map((r: any) => ({ ...r, day: String(r.day).slice(5) })), [data]);
  const triggerSeries = useMemo(
    () => (data?.trigger_series ?? []).map((r: any) => ({ ...r, day: String(r.day).slice(5) })),
    [data],
  );

  const bySurfaceKind = data?.by_surface_kind ?? [];
  const triggers = data?.triggers ?? [];

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <Title>Assistant</Title>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setDays(7)}
            className={`rounded-xl px-3 py-2 text-sm ${days === 7 ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-800"}`}
          >
            7d
          </button>
          <button
            onClick={() => setDays(14)}
            className={`rounded-xl px-3 py-2 text-sm ${days === 14 ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-800"}`}
          >
            14d
          </button>
          <button
            onClick={() => setDays(30)}
            className={`rounded-xl px-3 py-2 text-sm ${days === 30 ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-800"}`}
          >
            30d
          </button>
        </div>
      </div>

      {q.isLoading ? (
        <div className="text-sm text-zinc-600">Loading…</div>
      ) : q.isError ? (
        <div className="text-sm text-red-600">Failed to load.</div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <StatCard label="Suggestions (created)" value={fmtInt(data?.totals?.created ?? 0)} />
            <StatCard label="Accepted" value={fmtInt(data?.totals?.accepted ?? 0)} />
            <StatCard label="Accept rate" value={pct(Number(data?.totals?.acceptRate ?? 0))} />
            <StatCard label="Tokens (est.)" value={fmtInt(data?.totals?.tokens ?? 0)} />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <div className="mb-2 text-sm font-semibold">Suggestions over time</div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={series}>
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="created" />
                    <Bar dataKey="accepted" />
                    <Bar dataKey="dismissed" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 text-xs text-zinc-500">
                If this chart stays empty, run the rollup once: call edge function <code>assistant-metrics-rollup</code>.
              </div>
            </Card>

            <Card>
              <div className="mb-2 text-sm font-semibold">Trigger fires over time</div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={triggerSeries}>
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Line dataKey="fires" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 text-xs text-zinc-500">Top triggers are shown below.</div>
            </Card>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <div className="mb-2 text-sm font-semibold">By surface + kind</div>
              <Table>
                <thead>
                  <tr>
                    <Th>Day</Th>
                    <Th>Surface</Th>
                    <Th>Kind</Th>
                    <Th className="text-right">Created</Th>
                    <Th className="text-right">Accepted</Th>
                    <Th className="text-right">Dismissed</Th>
                    <Th className="text-right">Rate</Th>
                  </tr>
                </thead>
                <tbody>
                  {bySurfaceKind.slice(0, 150).map((r: any, idx: number) => {
                    const created = Number(r.created_count ?? 0);
                    const accepted = Number(r.accepted_count ?? 0);
                    const rate = created ? accepted / created : 0;
                    return (
                      <tr key={idx} className="border-t border-zinc-100">
                        <Td>{String(r.day).slice(5)}</Td>
                        <Td>{r.surface}</Td>
                        <Td>{r.kind}</Td>
                        <Td className="text-right">{fmtInt(created)}</Td>
                        <Td className="text-right">{fmtInt(accepted)}</Td>
                        <Td className="text-right">{fmtInt(Number(r.dismissed_count ?? 0))}</Td>
                        <Td className="text-right">{pct(rate)}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </Card>

            <Card>
              <div className="mb-2 text-sm font-semibold">Top triggers</div>
              <Table>
                <thead>
                  <tr>
                    <Th>Trigger</Th>
                    <Th className="text-right">Fires</Th>
                    <Th className="text-right">Users</Th>
                  </tr>
                </thead>
                <tbody>
                  {triggers.map((r: any, idx: number) => (
                    <tr key={idx} className="border-t border-zinc-100">
                      <Td>{r.name}</Td>
                      <Td className="text-right">{fmtInt(Number(r.fires ?? 0))}</Td>
                      <Td className="text-right">{fmtInt(Number(r.unique_users ?? 0))}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>

              <div className="mt-3 text-xs text-zinc-500">
                Tip: You can disable noisy triggers by setting <code>assistant_triggers.enabled = false</code>.
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
