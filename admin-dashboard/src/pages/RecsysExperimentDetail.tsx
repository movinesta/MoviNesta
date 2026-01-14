import React, { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";
import { Card } from "../components/Card";
import { Table, Th, Td } from "../components/Table";
import { ErrorBox } from "../components/ErrorBox";
import { LoadingState } from "../components/LoadingState";
import { EmptyState } from "../components/EmptyState";
import { Button } from "../components/Button";
import { cn, fmtDateTime } from "../lib/ui";
import {
  getRecsysExperiments,
  getRecVariantMetrics,
  getRecsysExperimentAssignmentCounts,
  type RecVariantMetricRow,
  type RecsysExperimentAssignmentCountRow,
} from "../lib/api";

function Title(props: { children: React.ReactNode }) {
  return <div className="text-xl font-semibold tracking-tight">{props.children}</div>;
}

function fmtPct(x: number | null | undefined): string {
  if (x == null || !Number.isFinite(x)) return "—";
  return `${(x * 100).toFixed(2)}%`;
}

export default function RecsysExperimentDetail() {
  const { key } = useParams();
  const expKey = decodeURIComponent(key ?? "");
  const [days, setDays] = useState(30);

  const qExp = useQuery({
    queryKey: ["recsys_experiments"],
    queryFn: () => getRecsysExperiments(),
  });

  const qMetrics = useQuery({
    queryKey: ["rec_variant_metrics", days],
    queryFn: async () => getRecVariantMetrics({ days }),
    staleTime: 30_000,
  });

  const qCounts = useQuery({
    queryKey: ["recsys_experiment_assignment_counts"],
    queryFn: () => getRecsysExperimentAssignmentCounts(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  if (qExp.isLoading || qMetrics.isLoading || qCounts.isLoading) return <LoadingState />;
  if (qExp.error) return <ErrorBox error={qExp.error} />;
  if (qMetrics.error) return <ErrorBox error={qMetrics.error} />;
  if (qCounts.error) return <ErrorBox error={qCounts.error} />;

  const experiments = qExp.data?.rows ?? [];
  const experiment = experiments.find((row: any) => row.key === expKey);
  const rows = (qMetrics.data?.rows ?? []).filter((r: RecVariantMetricRow) => r.experiment_key === expKey);
  const counts = (qCounts.data?.rows ?? []) as RecsysExperimentAssignmentCountRow[];
  const assignmentCounts = counts.filter((row) => row.experiment_key === expKey);

  const chartData = useMemo(() => {
    const grouped = new Map<string, any>();
    for (const r of rows) {
      const day = r.day;
      if (!grouped.has(day)) grouped.set(day, { day });
      grouped.get(day)[r.variant] = r.like_rate ?? 0;
    }
    return Array.from(grouped.values()).sort((a, b) => String(a.day).localeCompare(String(b.day)));
  }, [rows]);

  if (!experiment) {
    return (
      <div className="space-y-4">
        <Title>Experiment not found</Title>
        <Link className="text-sm text-zinc-600 hover:text-zinc-900" to="/recsys/experiments">
          ← Back to Experiments
        </Link>
        <EmptyState title="Missing experiment" body="We could not locate this experiment key." />
      </div>
    );
  }

  const variants = Array.isArray(experiment.variants) ? experiment.variants : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Title>{experiment.key}</Title>
          <div className="text-sm text-zinc-600">{experiment.description ?? "No description."}</div>
        </div>
        <Link className="text-sm text-zinc-600 hover:text-zinc-900" to="/recsys/experiments">
          ← Back to Experiments
        </Link>
      </div>

      <Card title="Experiment details">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2 text-sm text-zinc-700">
            <div><span className="font-medium text-zinc-900">Status:</span> {experiment.status}</div>
            <div><span className="font-medium text-zinc-900">Started:</span> {fmtDateTime(experiment.started_at)}</div>
            <div><span className="font-medium text-zinc-900">Ended:</span> {fmtDateTime(experiment.ended_at)}</div>
            <div><span className="font-medium text-zinc-900">Updated:</span> {fmtDateTime(experiment.updated_at)}</div>
            <div><span className="font-medium text-zinc-900">Salt:</span> <span className="font-mono text-xs">{experiment.salt ?? "—"}</span></div>
            <div>
              <span className="font-medium text-zinc-900">Assignments:</span>{" "}
              {assignmentCounts.length
                ? assignmentCounts.map((row) => `${row.variant}: ${row.assignments}`).join(" · ")
                : "—"}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-zinc-600">Variants</div>
            <Table className="mt-2">
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th className="text-right">Weight</Th>
                </tr>
              </thead>
              <tbody>
                {variants.length ? (
                  variants.map((v: any, idx: number) => (
                    <tr key={`${v?.name ?? "variant"}-${idx}`}>
                      <Td>{v?.name ?? "—"}</Td>
                      <Td className="text-right">{Number(v?.weight ?? 0).toFixed(2)}</Td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <Td colSpan={2} className="text-center text-sm text-zinc-500">No variants recorded.</Td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
        </div>
      </Card>

      <Card title="Variant performance (like rate)">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-zinc-500">Showing last {days} days.</div>
          <div className="flex items-center gap-2">
            {[7, 14, 30, 60].map((d) => (
              <Button
                key={d}
                variant="ghost"
                className={cn(days === d && "bg-zinc-200")}
                onClick={() => setDays(d)}
              >
                {d}d
              </Button>
            ))}
          </div>
        </div>
        {rows.length ? (
          <div className="mt-4 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                <Tooltip formatter={(value: number) => fmtPct(value)} />
                <Legend />
                {Array.from(new Set(rows.map((r) => r.variant))).map((variant) => (
                  <Line
                    key={variant}
                    type="monotone"
                    dataKey={variant}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState title="No metrics yet" body="Impressions with experiment tags will appear here." />
        )}
      </Card>
    </div>
  );
}
