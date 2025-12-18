import React from "react";
import { useQuery } from "@tanstack/react-query";
import { getOverview } from "../lib/api";
import { StatCard } from "../components/StatCard";
import { Card } from "../components/Card";
import { Table, Th, Td } from "../components/Table";
import { fmtDateTime, fmtInt } from "../lib/ui";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

function Title(props: { children: React.ReactNode }) {
  return <div className="mb-4 text-xl font-semibold tracking-tight">{props.children}</div>;
}

export default function Overview() {
  const q = useQuery({ queryKey: ["overview"], queryFn: getOverview });

  if (q.isLoading) return <div className="text-sm text-zinc-400">Loading…</div>;
  if (q.error) return <div className="text-sm text-red-400">{(q.error as any).message}</div>;
  const d = q.data!;

  const active = d.active_profile
    ? `${d.active_profile.provider} / ${d.active_profile.model} (${d.active_profile.dimensions})`
    : "—";

  const covChart = d.coverage.map((r) => ({ name: `${r.provider}`, count: r.count }));

  return (
    <div className="space-y-6">
      <Title>Overview</Title>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard title="Active embeddings" value={active} subtitle={d.active_profile ? `task=${d.active_profile.task}` : undefined} />
        <StatCard title="Providers stored" value={d.coverage.length} subtitle="Distinct provider/model pairs" />
        <StatCard title="Job cursors" value={d.job_state.length} subtitle="Saved pagination states" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Embedding coverage">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={covChart}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4">
            <Table>
              <thead>
                <tr>
                  <Th>Provider</Th>
                  <Th>Model</Th>
                  <Th className="text-right">Count</Th>
                </tr>
              </thead>
              <tbody>
                {d.coverage.map((r, i) => (
                  <tr key={i}>
                    <Td>{r.provider}</Td>
                    <Td className="font-mono text-xs">{r.model}</Td>
                    <Td className="text-right">{fmtInt(r.count)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>

        <Card title="Recent errors (last 24h)">
          <Table>
            <thead>
              <tr>
                <Th>At</Th>
                <Th>Code</Th>
                <Th>Message</Th>
              </tr>
            </thead>
            <tbody>
              {d.recent_errors.length ? (
                d.recent_errors.map((r: any) => (
                  <tr key={r.id}>
                    <Td className="whitespace-nowrap text-xs text-zinc-400">{fmtDateTime(r.created_at)}</Td>
                    <Td className="font-mono text-xs">{r.error_code ?? "—"}</Td>
                    <Td className="max-w-[28rem] truncate text-sm">{r.error_message ?? "—"}</Td>
                  </tr>
                ))
              ) : (
                <tr>
                  <Td colSpan={3} className="text-zinc-500">
                    No recent errors.
                  </Td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Job cursors">
          <Table>
            <thead>
              <tr>
                <Th>Job</Th>
                <Th>Cursor</Th>
                <Th>Updated</Th>
              </tr>
            </thead>
            <tbody>
              {d.job_state.map((r, i) => (
                <tr key={i}>
                  <Td className="font-mono text-xs">{r.job_name}</Td>
                  <Td className="font-mono text-xs">{r.cursor ?? "—"}</Td>
                  <Td className="whitespace-nowrap text-xs text-zinc-400">{fmtDateTime(r.updated_at)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>

        <Card title="Last job runs">
          <Table>
            <thead>
              <tr>
                <Th>At</Th>
                <Th>Job</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {d.last_job_runs.length ? (
                d.last_job_runs.map((r: any) => (
                  <tr key={r.id}>
                    <Td className="whitespace-nowrap text-xs text-zinc-400">{fmtDateTime(r.started_at)}</Td>
                    <Td className="font-mono text-xs">{r.job_name}</Td>
                    <Td className={r.ok ? "text-emerald-300" : "text-red-300"}>{r.ok ? "OK" : "FAIL"}</Td>
                  </tr>
                ))
              ) : (
                <tr>
                  <Td colSpan={3} className="text-zinc-500">
                    No job runs logged yet.
                  </Td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
