import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Input } from "../components/Input";
import { Table, Th, Td } from "../components/Table";
import { ErrorBox } from "../components/ErrorBox";
import { LoadingState } from "../components/LoadingState";
import { EmptyState } from "../components/EmptyState";
import { useToast } from "../components/ToastProvider";
import { fmtDateTime } from "../lib/ui";
import {
  getRecsysExperiments,
  getRecsysExperimentAssignmentCounts,
  upsertRecsysExperiment,
  activateRecsysExperiment,
  endRecsysExperiment,
  type RecsysExperimentRow,
  type RecsysExperimentAssignmentCountRow,
} from "../lib/api";

type ExperimentDraft = {
  key: string;
  description: string;
  status: "draft" | "active" | "ended";
  started_at: string;
  ended_at: string;
  variants: string;
  salt: string;
};

const emptyDraft: ExperimentDraft = {
  key: "",
  description: "",
  status: "draft",
  started_at: "",
  ended_at: "",
  variants: JSON.stringify([{ name: "control", weight: 0.5 }, { name: "treatment", weight: 0.5 }], null, 2),
  salt: "",
};

function Title(props: { children: React.ReactNode }) {
  return <div className="text-xl font-semibold tracking-tight">{props.children}</div>;
}

function formatVariantsSummary(variants: unknown): string {
  if (!Array.isArray(variants)) return "—";
  const parts = variants
    .map((v: any) => {
      const name = String(v?.name ?? "").trim();
      const weight = Number(v?.weight);
      if (!name || !Number.isFinite(weight)) return null;
      return `${name} ${(weight * 100).toFixed(0)}%`;
    })
    .filter(Boolean);
  return parts.length ? parts.join(" · ") : "—";
}

function parseVariantsJson(raw: string): { value: Array<{ name: string; weight: number }> | null; error?: string } {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return { value: null, error: "Variants must be a JSON array." };
    const cleaned = parsed.map((v) => ({
      name: String(v?.name ?? "").trim(),
      weight: Number(v?.weight ?? 0),
    }));
    if (cleaned.some((v) => !v.name || !Number.isFinite(v.weight) || v.weight <= 0)) {
      return { value: null, error: "Each variant needs a name and a positive weight." };
    }
    const total = cleaned.reduce((acc, v) => acc + v.weight, 0);
    if (!Number.isFinite(total) || total <= 0) {
      return { value: null, error: "Weights must sum to a positive number." };
    }
    return { value: cleaned };
  } catch (err: any) {
    return { value: null, error: err?.message ?? "Invalid JSON." };
  }
}

export default function RecsysExperiments() {
  const toast = useToast();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<ExperimentDraft>({ ...emptyDraft });

  const q = useQuery({
    queryKey: ["recsys_experiments"],
    queryFn: () => getRecsysExperiments(),
  });

  const qCounts = useQuery({
    queryKey: ["recsys_experiment_assignment_counts"],
    queryFn: () => getRecsysExperimentAssignmentCounts(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const mutUpsert = useMutation({
    mutationFn: (payload: ExperimentDraft) => {
      const parsed = parseVariantsJson(payload.variants);
      if (!parsed.value) throw new Error(parsed.error ?? "Invalid variants JSON.");
      return upsertRecsysExperiment({
        key: payload.key.trim(),
        description: payload.description.trim() || null,
        status: payload.status,
        started_at: payload.started_at || null,
        ended_at: payload.ended_at || null,
        variants: parsed.value,
        salt: payload.salt.trim() || null,
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["recsys_experiments"] });
      toast.push({ title: "Experiment saved", message: "Experiment details updated.", variant: "success" });
      setDraft({ ...emptyDraft });
    },
  });

  const mutActivate = useMutation({
    mutationFn: (key: string) => activateRecsysExperiment({ key }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["recsys_experiments"] });
      toast.push({ title: "Experiment activated", message: "Experiment status set to active.", variant: "success" });
    },
  });

  const mutEnd = useMutation({
    mutationFn: (key: string) => endRecsysExperiment({ key }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["recsys_experiments"] });
      toast.push({ title: "Experiment ended", message: "Experiment status set to ended.", variant: "success" });
    },
  });

  const rows = (q.data?.rows ?? []) as RecsysExperimentRow[];
  const counts = (qCounts.data?.rows ?? []) as RecsysExperimentAssignmentCountRow[];
  const variantsError = useMemo(() => parseVariantsJson(draft.variants).error, [draft.variants]);
  const countsByKey = useMemo(() => {
    const map = new Map<string, RecsysExperimentAssignmentCountRow[]>();
    for (const row of counts) {
      const list = map.get(row.experiment_key) ?? [];
      list.push(row);
      map.set(row.experiment_key, list);
    }
    return map;
  }, [counts]);

  if (q.isLoading) return <LoadingState />;
  if (q.error) return <ErrorBox error={q.error} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Title>Recsys Experiments</Title>
        <Link className="text-sm text-zinc-600 hover:text-zinc-900" to="/recsys">
          ← Back to Recsys
        </Link>
      </div>

      <Card title="Create / Edit">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-zinc-600">Key</label>
              <Input
                value={draft.key}
                onChange={(e) => setDraft((prev) => ({ ...prev, key: e.target.value }))}
                placeholder="swipe_blend_test"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-600">Description</label>
              <Input
                value={draft.description}
                onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Short summary of the experiment"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-zinc-600">Status</label>
                <select
                  className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                  value={draft.status}
                  onChange={(e) => setDraft((prev) => ({ ...prev, status: e.target.value as ExperimentDraft["status"] }))}
                >
                  <option value="draft">draft</option>
                  <option value="active">active</option>
                  <option value="ended">ended</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-600">Salt (optional)</label>
                <Input
                  value={draft.salt}
                  onChange={(e) => setDraft((prev) => ({ ...prev, salt: e.target.value }))}
                  placeholder="leave blank for default"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-zinc-600">Started at</label>
                <Input
                  type="datetime-local"
                  value={draft.started_at}
                  onChange={(e) => setDraft((prev) => ({ ...prev, started_at: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-600">Ended at</label>
                <Input
                  type="datetime-local"
                  value={draft.ended_at}
                  onChange={(e) => setDraft((prev) => ({ ...prev, ended_at: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-zinc-600">Variants JSON</label>
              <textarea
                className="mt-1 h-40 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-300"
                value={draft.variants}
                onChange={(e) => setDraft((prev) => ({ ...prev, variants: e.target.value }))}
              />
              {variantsError ? <div className="mt-1 text-xs text-rose-600">{variantsError}</div> : null}
              <div className="mt-1 text-xs text-zinc-500">Weights should sum to ~1.0.</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                onClick={() => mutUpsert.mutate(draft)}
                disabled={!draft.key.trim() || Boolean(variantsError) || mutUpsert.isPending}
              >
                {mutUpsert.isPending ? "Saving..." : "Save experiment"}
              </Button>
              <Button variant="ghost" onClick={() => setDraft({ ...emptyDraft })}>
                Clear
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Card title="Experiments">
        {qCounts.isError ? <ErrorBox title="Failed to load assignment counts" error={qCounts.error as any} /> : null}
        {rows.length === 0 ? (
          <EmptyState
            title="No experiments yet"
            body="Create a recsys experiment to start collecting variant metrics."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Key</Th>
                <Th>Status</Th>
                <Th>Started</Th>
                <Th>Ended</Th>
                <Th>Last updated</Th>
                <Th>Split</Th>
                <Th>Assignments</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id ?? row.key}>
                  <Td className="font-mono text-xs text-zinc-700">{row.key}</Td>
                  <Td className="text-xs">{row.status}</Td>
                  <Td className="text-xs text-zinc-600">{fmtDateTime(row.started_at)}</Td>
                  <Td className="text-xs text-zinc-600">{fmtDateTime(row.ended_at)}</Td>
                  <Td className="text-xs text-zinc-600">{fmtDateTime(row.updated_at)}</Td>
                  <Td className="text-xs text-zinc-600">{formatVariantsSummary(row.variants)}</Td>
                  <Td className="text-xs text-zinc-600">
                    {countsByKey.get(row.key)?.length
                      ? countsByKey.get(row.key)?.map((item) => `${item.variant}: ${item.assignments}`).join(" · ")
                      : "—"}
                  </Td>
                  <Td className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        variant="ghost"
                        onClick={() =>
                          setDraft({
                            key: row.key,
                            description: row.description ?? "",
                            status: (row.status as ExperimentDraft["status"]) ?? "draft",
                            started_at: row.started_at ? row.started_at.slice(0, 16) : "",
                            ended_at: row.ended_at ? row.ended_at.slice(0, 16) : "",
                            variants: JSON.stringify(row.variants ?? [], null, 2),
                            salt: row.salt ?? "",
                          })
                        }
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() =>
                          setDraft({
                            key: `${row.key}_copy`,
                            description: row.description ?? "",
                            status: "draft",
                            started_at: "",
                            ended_at: "",
                            variants: JSON.stringify(row.variants ?? [], null, 2),
                            salt: "",
                          })
                        }
                      >
                        Duplicate
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => mutActivate.mutate(row.key)}
                        disabled={row.status === "active" || mutActivate.isPending}
                      >
                        Activate
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => mutEnd.mutate(row.key)}
                        disabled={row.status === "ended" || mutEnd.isPending}
                      >
                        End
                      </Button>
                      <Link
                        to={`/recsys/experiments/${encodeURIComponent(row.key)}`}
                        className="rounded-xl border border-zinc-200 px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-100"
                      >
                        Details
                      </Link>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
