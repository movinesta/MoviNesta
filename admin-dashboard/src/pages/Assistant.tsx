import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAssistantMetrics, getAssistantHealthSnapshot } from "../lib/api";
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
  const [tab, setTab] = useState<"metrics" | "diagnostics">("metrics");
  const [days, setDays] = useState<number>(14);

  const metricsQ = useQuery({
    queryKey: ["assistant-metrics", days],
    queryFn: () => getAssistantMetrics({ days }),
    enabled: tab === "metrics",
  });

  const healthQ = useQuery({
    queryKey: ["assistant-health"],
    queryFn: () => getAssistantHealthSnapshot(),
    enabled: tab === "diagnostics",
    refetchInterval: 15000,
  });

  const data = metricsQ.data as any;

  const series = useMemo(() => (data?.series ?? []).map((r: any) => ({ ...r, day: String(r.day).slice(5) })), [data]);
  const triggerSeries = useMemo(
    () => (data?.trigger_series ?? []).map((r: any) => ({ ...r, day: String(r.day).slice(5) })),
    [data],
  );

  const bySurfaceKind = data?.by_surface_kind ?? [];
  const triggers = data?.triggers ?? [];

  const health = healthQ.data as any;

  function fmtSec(s: number) {
    const sec = Math.max(0, Math.floor(Number(s) || 0));
    const m = Math.floor(sec / 60);
    const r = sec % 60;
    if (m <= 0) return `${r}s`;
    const h = Math.floor(m / 60);
    const mm = m % 60;
    if (h <= 0) return `${m}m ${r}s`;
    return `${h}h ${mm}m`;
  }

  function fmtTs(ts?: string | null) {
    if (!ts) return "";
    // Keep it compact: YYYY-MM-DD HH:MM
    const d = new Date(ts);
    if (!isFinite(d.getTime())) return String(ts);
    return d.toISOString().replace("T", " ").slice(0, 16);
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <Title>Assistant</Title>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setTab("metrics")}
            className={`rounded-xl px-3 py-2 text-sm ${tab === "metrics" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-800"}`}
          >
            Metrics
          </button>
          <button
            onClick={() => setTab("diagnostics")}
            className={`rounded-xl px-3 py-2 text-sm ${tab === "diagnostics" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-800"}`}
          >
            Diagnostics
          </button>

          {tab === "metrics" ? (
            <div className="ml-2 flex items-center gap-2">
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
          ) : (
            <button
              onClick={() => healthQ.refetch()}
              className="ml-2 rounded-xl bg-zinc-100 px-3 py-2 text-sm text-zinc-800"
            >
              Refresh
            </button>
          )}
        </div>
      </div>

      {tab === "metrics" ? (
        metricsQ.isLoading ? (
          <div className="text-sm text-zinc-600">Loading…</div>
        ) : metricsQ.isError ? (
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
        )
      ) : healthQ.isLoading ? (
        <div className="text-sm text-zinc-600">Loading…</div>
      ) : healthQ.isError ? (
        <div className="text-sm text-red-600">Failed to load.</div>
      ) : (
        <>
          <div className="mt-2 text-xs text-zinc-500">Snapshot: {fmtTs(health?.ts)}</div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
            <StatCard label="Pending" value={fmtInt(Number(health?.counts?.pending ?? 0))} />
            <StatCard label="Processing" value={fmtInt(Number(health?.counts?.processing ?? 0))} />
            <StatCard label="Failed" value={fmtInt(Number(health?.counts?.failed ?? 0))} />
            <StatCard label="Done" value={fmtInt(Number(health?.counts?.done ?? 0))} />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <div className="mb-2 text-sm font-semibold">Queue age</div>
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Oldest pending" value={fmtSec(Number(health?.oldestPendingSec ?? 0))} />
                <StatCard label="Oldest processing" value={fmtSec(Number(health?.oldestProcessingSec ?? 0))} />
              </div>
              <div className="mt-2 text-xs text-zinc-500">
                If queue age keeps growing, check runner health and rate limits.
              </div>
            </Card>

            <Card>
              <div className="mb-2 text-sm font-semibold">Last 24h</div>
              <div className="grid grid-cols-3 gap-3">
                <StatCard label="Created" value={fmtInt(Number(health?.last24h?.created ?? 0))} />
                <StatCard label="Done" value={fmtInt(Number(health?.last24h?.done ?? 0))} />
                <StatCard label="Failed" value={fmtInt(Number(health?.last24h?.failed ?? 0))} />
              </div>
            </Card>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <div className="mb-2 text-sm font-semibold">Jobs by kind</div>
              <Table>
                <thead>
                  <tr>
                    <Th>Kind</Th>
                    <Th className="text-right">Pending</Th>
                    <Th className="text-right">Processing</Th>
                    <Th className="text-right">Failed</Th>
                    <Th className="text-right">Done</Th>
                    <Th className="text-right">Total</Th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(health?.byKind ?? {}).map(([kind, v]: any) => (
                    <tr key={kind} className="border-t border-zinc-100">
                      <Td>{kind}</Td>
                      <Td className="text-right">{fmtInt(Number(v?.pending ?? 0))}</Td>
                      <Td className="text-right">{fmtInt(Number(v?.processing ?? 0))}</Td>
                      <Td className="text-right">{fmtInt(Number(v?.failed ?? 0))}</Td>
                      <Td className="text-right">{fmtInt(Number(v?.done ?? 0))}</Td>
                      <Td className="text-right">{fmtInt(Number(v?.total ?? 0))}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>

            <Card>
              <div className="mb-2 text-sm font-semibold">Recent cron invocations</div>
              <Table>
                <thead>
                  <tr>
                    <Th>When</Th>
                    <Th>Job</Th>
                    <Th>Request ID</Th>
                  </tr>
                </thead>
                <tbody>
                  {(health?.recentCron ?? []).map((r: any) => (
                    <tr key={r.id} className="border-t border-zinc-100">
                      <Td>{fmtTs(r.createdAt)}</Td>
                      <Td>{r.job}</Td>
                      <Td className="font-mono text-xs">{r.requestId ?? ""}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          </div>

          <div className="mt-6">
            <Card>
              <div className="mb-2 text-sm font-semibold">Recent failures</div>
              <Table>
                <thead>
                  <tr>
                    <Th>When</Th>
                    <Th>Kind</Th>
                    <Th>Conversation</Th>
                    <Th className="text-right">Attempts</Th>
                    <Th>Error</Th>
                  </tr>
                </thead>
                <tbody>
                  {(health?.recentFailures ?? []).map((r: any) => (
                    <tr key={r.id} className="border-t border-zinc-100">
                      <Td>{fmtTs(r.updatedAt)}</Td>
                      <Td>{r.jobKind}</Td>
                      <Td className="font-mono text-xs">{r.conversationId}</Td>
                      <Td className="text-right">{fmtInt(Number(r.attempts ?? 0))}</Td>
                      <Td className="max-w-[520px] truncate" title={r.lastError}>{r.lastError}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              {(health?.recentFailures ?? []).length === 0 ? (
                <div className="mt-2 text-xs text-zinc-500">No recent failures.</div>
              ) : null}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
