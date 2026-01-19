import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getOverview, resolveAllOpsAlerts, resolveOpsAlert } from "../lib/api";
import { StatCard } from "../components/StatCard";
import { Card } from "../components/Card";
import { Table, Th, Td } from "../components/Table";
import { fmtDateTime, fmtInt } from "../lib/ui";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { ErrorBox } from "../components/ErrorBox";
import { LoadingState } from "../components/LoadingState";
import { Button } from "../components/Button";
import { ConfirmDialog } from "../components/ConfirmDialog";

function severityPill(sev: string) {
  const s = (sev || "warn").toLowerCase();
  const cls =
    s === "critical"
      ? "bg-red-100 text-red-700"
      : s === "info"
        ? "bg-blue-100 text-blue-700"
        : "bg-amber-100 text-amber-800";
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{s}</span>;
}

function Title(props: { children: React.ReactNode }) {
  return <div className="mb-4 text-xl font-semibold tracking-tight">{props.children}</div>;
}

export default function Overview() {
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState<null | { mode: "all" } | { mode: "one"; id: number }>(null);

  const resolveOne = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) => resolveOpsAlert(id, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["overview"] }),
  });

  const resolveAll = useMutation({
    mutationFn: ({ reason }: { reason?: string }) => resolveAllOpsAlerts(reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["overview"] }),
  });

  const q = useQuery({ queryKey: ["overview"], queryFn: getOverview });
  const data = q.data;

  if (q.isLoading) return <LoadingState />;
  if (q.error) return <ErrorBox error={q.error} />;
  const d = data!;

  const active = d.active_profile
    ? `${d.active_profile.provider} / ${d.active_profile.model} (${d.active_profile.dimensions})`
    : "—";
  const zdr = d.zdr_coverage;
  const zdrRate = zdr ? `${Math.round((zdr.coverage_rate ?? 0) * 100)}%` : "—";

  // Coverage rows are distinct provider/model pairs; include the model in the chart label to avoid collisions.
  const covChart = d.coverage.map((r) => ({ name: `${r.provider} / ${r.model}`, count: r.count }));

  return (
    <div className="space-y-6">
      <Title>Overview</Title>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.mode === "all" ? "Resolve all alerts?" : "Resolve this alert?"}
        message={
          confirm?.mode === "all"
            ? "This will mark all active alerts as resolved."
            : "This will mark the alert as resolved."
        }
        confirmText={
          confirm?.mode === "all"
            ? (resolveAll.isPending ? "Resolving…" : "Resolve all")
            : (resolveOne.isPending ? "Resolving…" : "Resolve")
        }
        confirmDisabled={
          confirm?.mode === "all"
            ? resolveAll.isPending || !(d.ops_alerts?.length)
            : resolveOne.isPending
        }
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const mode = confirm?.mode;
          const id = confirm && "id" in confirm ? confirm.id : null;
          setConfirm(null);
          if (mode === "all") {
            resolveAll.mutate({ reason: "Resolved from admin dashboard" });
          } else if (mode === "one" && id !== null) {
            resolveOne.mutate({ id, reason: "Resolved from admin dashboard" });
          }
        }}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard title="Active embeddings" value={active} subtitle={d.active_profile ? `task=${d.active_profile.task}` : undefined} />
        <StatCard title="Providers stored" value={d.coverage.length} subtitle="Distinct provider/model pairs" />
        <StatCard title="Job cursors" value={d.job_state.length} subtitle="Saved pagination states" />
        <StatCard
          title="ZDR coverage (24h)"
          value={zdrRate}
          subtitle={zdr ? `${fmtInt(zdr.used)} used / ${fmtInt(zdr.requested)} requested` : "No routing logs yet"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Embedding coverage">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={covChart}>
                <XAxis
                  dataKey="name"
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={60}
                  tickFormatter={(v) => (typeof v === "string" && v.length > 22 ? `${v.slice(0, 22)}…` : v)}
                />
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
                d.recent_errors.map((r) => (
                  <tr key={r.id}>
                    <Td className="whitespace-nowrap text-xs text-zinc-600">{fmtDateTime(r.created_at)}</Td>
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
        <Card title="Ops Alerts">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm text-zinc-600">Active operational alerts raised by scheduled health checks.</div>
            <Button
              variant="secondary"
              disabled={resolveAll.isPending || !(d.ops_alerts?.length)}
              onClick={() => setConfirm({ mode: "all" })}
            >
              Resolve all
            </Button>
          </div>

          <Table>
            <thead>
              <tr>
                <Th>Severity</Th>
                <Th>Title</Th>
                <Th>Updated</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {d.ops_alerts?.length ? (
                d.ops_alerts.map((a) => (
                  <tr key={a.id}>
                    <Td>{severityPill(a.severity)}</Td>
                    <Td>
                      <div className="font-medium">{a.title}</div>
                      {a.detail ? <div className="mt-1 text-xs text-zinc-600">{a.detail}</div> : null}
                      <div className="mt-1 text-xs text-zinc-500">{a.kind}</div>
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-zinc-600">{fmtDateTime(a.updated_at)}</Td>
                    <Td className="text-right">
                      <Button
                        variant="secondary"
                        disabled={resolveOne.isPending}
                        onClick={() => setConfirm({ mode: "one", id: a.id })}
                      >
                        Resolve
                      </Button>
                    </Td>
                  </tr>
                ))
              ) : (
                <tr>
                  <Td colSpan={4} className="text-zinc-500">
                    No active ops alerts.
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
                  <Td className="whitespace-nowrap text-xs text-zinc-600">{fmtDateTime(r.updated_at)}</Td>
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
                d.last_job_runs.map((r) => (
                  <tr key={r.id}>
                    <Td className="whitespace-nowrap text-xs text-zinc-600">{fmtDateTime(r.started_at)}</Td>
                    <Td className="font-mono text-xs">{r.job_name}</Td>
                    <Td className={r.ok ? "text-emerald-600" : "text-red-600"}>{r.ok ? "OK" : "FAIL"}</Td>
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
