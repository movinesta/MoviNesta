import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getJobs, resetCursor, runCronNow, setCronActive, setCronSchedule } from "../lib/api";
import { Card } from "../components/Card";
import { Table, Th, Td } from "../components/Table";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { fmtDateTime, cn } from "../lib/ui";
import { ErrorBox } from "../components/ErrorBox";
import { LoadingState } from "../components/LoadingState";
import { EmptyState } from "../components/EmptyState";
import { CopyButton } from "../components/CopyButton";

function Title(props: { children: React.ReactNode }) {
  return <div className="mb-4 text-xl font-semibold tracking-tight">{props.children}</div>;
}

const DEFAULTS = {
  cursorSearch: "",
  cronSearch: "",
};

export default function Jobs() {
  const qc = useQueryClient();

  const [cursorSearch, setCursorSearch] = useState(DEFAULTS.cursorSearch);
  const [cronSearch, setCronSearch] = useState(DEFAULTS.cronSearch);
  const [scheduleDraft, setScheduleDraft] = useState<Record<string, string>>({});

  const q = useQuery({
    queryKey: ["jobs"],
    queryFn: () => getJobs(),
  });

  const mutReset = useMutation({
    mutationFn: (job_name: string) => resetCursor(job_name, null),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["jobs"] });
      await qc.invalidateQueries({ queryKey: ["overview"] });
    },
  });

  const mutCronActive = useMutation({
    mutationFn: (payload: { jobname: string; active: boolean }) => setCronActive(payload.jobname, payload.active),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["jobs"] });
      await qc.invalidateQueries({ queryKey: ["overview"] });
    },
  });

  const mutSchedule = useMutation({
    mutationFn: (payload: { jobname: string; schedule: string }) => setCronSchedule(payload.jobname, payload.schedule),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["jobs"] });
      await qc.invalidateQueries({ queryKey: ["overview"] });
    },
  });

  const mutRunNow = useMutation({
    mutationFn: (jobname: string) => runCronNow(jobname),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["jobs"] });
      await qc.invalidateQueries({ queryKey: ["logs"] });
      await qc.invalidateQueries({ queryKey: ["overview"] });
    },
  });

  const isBusy = mutReset.isPending || mutCronActive.isPending || mutSchedule.isPending || mutRunNow.isPending;

  const d = q.data;

  const filteredState = useMemo(() => {
    if (!d) return [];
    const s = cursorSearch.trim().toLowerCase();
    if (!s) return d.job_state;
    return d.job_state.filter((r) => r.job_name.toLowerCase().includes(s) || (r.cursor ?? "").toLowerCase().includes(s));
  }, [d, cursorSearch]);

  const filteredCron = useMemo(() => {
    if (!d) return [];
    const s = cronSearch.trim().toLowerCase();
    if (!s) return d.cron_jobs;
    return d.cron_jobs.filter((r) => r.jobname.toLowerCase().includes(s) || String(r.jobid).includes(s));
  }, [d, cronSearch]);

  if (q.isLoading) return <LoadingState />;
  if (q.error) return <ErrorBox error={q.error} />;

  const data = d!;

  const applied = [
    cursorSearch.trim() ? `cursors: "${cursorSearch.trim()}"` : null,
    cronSearch.trim() ? `cron: "${cronSearch.trim()}"` : null,
  ].filter(Boolean);

  function resetFilters() {
    setCursorSearch(DEFAULTS.cursorSearch);
    setCronSearch(DEFAULTS.cronSearch);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Title>Jobs</Title>
          {applied.length ? (
            <div className="text-xs text-zinc-500">
              Applied: <span className="font-mono">{applied.join(" • ")}</span>
            </div>
          ) : (
            <div className="text-xs text-zinc-500">No filters applied.</div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={resetFilters} disabled={isBusy}>
            Reset filters
          </Button>
        </div>
      </div>

      <Card title="Saved job cursors (media_job_state)">
        <div className="flex items-center justify-between gap-3">
          <div className="w-[360px] max-w-full">
            <Input
              value={cursorSearch}
              onChange={(e) => setCursorSearch(e.target.value)}
              placeholder="Filter by job name or cursor…"
            />
          </div>
          <div className="text-xs text-zinc-500">{filteredState.length} rows</div>
        </div>

        <div className="mt-3">
          <Table>
            <thead>
              <tr>
                <Th>Job</Th>
                <Th>Cursor</Th>
                <Th>Updated</Th>
                <Th className="text-right">Action</Th>
              </tr>
            </thead>
            <tbody>
              {filteredState.length ? (
                filteredState.map((r) => (
                  <tr key={r.job_name}>
                    <Td className="font-mono text-xs">
                      <div className="flex items-center gap-2">
                        <span>{r.job_name}</span>
                        <CopyButton text={String(r.job_name)} label="Copy" className="h-8 px-2 py-1 text-xs" />
                      </div>
                    </Td>
                    <Td className="font-mono text-xs">
                      <div className="flex items-center gap-2">
                        <span>{r.cursor ?? "—"}</span>
                        {r.cursor ? <CopyButton text={String(r.cursor)} label="Copy" className="h-8 px-2 py-1 text-xs" /> : null}
                      </div>
                    </Td>
                    <Td className="text-xs text-zinc-600">{r.updated_at ? fmtDateTime(r.updated_at) : "—"}</Td>
                    <Td className="text-right">
                      <Button
                        variant="ghost"
                        onClick={() => mutReset.mutate(r.job_name)}
                        disabled={mutReset.isPending}
                        title="Reset stored cursor to null"
                      >
                        Reset cursor
                      </Button>
                    </Td>
                  </tr>
                ))
              ) : (
                <tr>
                  <Td colSpan={4} className="p-6">
                    <EmptyState title="No saved cursors" message="No rows in media_job_state yet." className="border-0 bg-transparent p-0" />
                  </Td>
                </tr>
              )}
            </tbody>
          </Table>
          {mutReset.isError ? <ErrorBox error={mutReset.error} className="mt-2" /> : null}
        </div>
      </Card>

      <Card title="Cron jobs (pg_cron)">
        <div className="flex items-center justify-between gap-3">
          <div className="w-[360px] max-w-full">
            <Input value={cronSearch} onChange={(e) => setCronSearch(e.target.value)} placeholder="Filter cron jobs…" />
          </div>
          <div className="text-xs text-zinc-500">{filteredCron.length} rows</div>
        </div>

        {data.cron_error ? (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <div className="font-semibold">Cron error</div>
            <div className="mt-1 font-mono text-xs">{data.cron_error}</div>
          </div>
        ) : null}

        <div className="mt-3">
          <Table>
            <thead>
              <tr>
                <Th>ID</Th>
                <Th>Name</Th>
                <Th>Schedule</Th>
                <Th>Status</Th>
                <Th className="text-right">Action</Th>
              </tr>
            </thead>
            <tbody>
              {filteredCron.length ? (
                filteredCron.map((r) => (
                  <tr key={r.jobname}>
                    <Td className="font-mono text-xs">
                      <div className="flex items-center gap-2">
                        <span>{r.jobid ?? "—"}</span>
                        <CopyButton text={String(r.jobid ?? "")} label="Copy" className="h-8 px-2 py-1 text-xs" />
                      </div>
                    </Td>
                    <Td className="font-mono text-xs">
                      <div className="flex items-center gap-2">
                        <span>{r.jobname}</span>
                        <CopyButton text={String(r.jobname)} label="Copy" className="h-8 px-2 py-1 text-xs" />
                      </div>
                    </Td>
                    <Td className="font-mono text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="w-[220px]">
                          <Input
                            value={scheduleDraft[r.jobname] ?? (r.schedule ?? "")}
                            onChange={(e) => setScheduleDraft((s) => ({ ...s, [r.jobname]: e.target.value }))}
                            placeholder="* * * * *"
                            className="py-1"
                          />
                        </div>
                        <Button
                          variant="ghost"
                          onClick={() =>
                            mutSchedule.mutate({
                              jobname: r.jobname,
                              schedule: (scheduleDraft[r.jobname] ?? (r.schedule ?? "")).trim(),
                            })
                          }
                          disabled={mutSchedule.isPending || !(scheduleDraft[r.jobname] ?? (r.schedule ?? "")).trim()}
                        >
                          Save
                        </Button>
                      </div>
                    </Td>
                    <Td>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold",
                          r.active ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-zinc-200 bg-zinc-50 text-zinc-700",
                        )}
                      >
                        {r.active ? "Active" : "Paused"}
                      </span>
                    </Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          onClick={() => mutCronActive.mutate({ jobname: r.jobname, active: !r.active })}
                          disabled={mutCronActive.isPending}
                        >
                          {r.active ? "Pause" : "Activate"}
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => mutRunNow.mutate(r.jobname)}
                          disabled={mutRunNow.isPending}
                          title="Run this cron immediately"
                        >
                          Run now
                        </Button>
                      </div>
                    </Td>
                  </tr>
                ))
              ) : (
                <tr>
                  <Td colSpan={5} className="p-6">
                    <EmptyState title="No cron jobs" message="No cron jobs registered (or pg_cron not enabled)." className="border-0 bg-transparent p-0" />
                  </Td>
                </tr>
              )}
            </tbody>
          </Table>

          {mutCronActive.isError ? <ErrorBox error={mutCronActive.error} className="mt-2" /> : null}
          {mutSchedule.isError ? <ErrorBox error={mutSchedule.error} className="mt-2" /> : null}
          {mutRunNow.isError ? <ErrorBox error={mutRunNow.error} className="mt-2" /> : null}
        </div>
      </Card>
    </div>
  );
}
