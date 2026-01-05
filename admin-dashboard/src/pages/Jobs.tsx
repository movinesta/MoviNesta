import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getJobs, resetCursor, runCronNow, setCronActive, setCronSchedule } from "../lib/api";
import { Card } from "../components/Card";
import { Table, Th, Td } from "../components/Table";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { fmtDateTime } from "../lib/ui";

function Title(props: { children: React.ReactNode }) {
  return <div className="mb-4 text-xl font-semibold tracking-tight">{props.children}</div>;
}

export default function Jobs() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["jobs"], queryFn: getJobs });

  const [scheduleDraft, setScheduleDraft] = React.useState<Record<string, string>>({});

  const mutReset = useMutation({
    mutationFn: (job_name: string) => resetCursor(job_name),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["jobs"] });
      await qc.invalidateQueries({ queryKey: ["overview"] });
    },
  });

  const mutCron = useMutation({
    mutationFn: ({ jobname, active }: { jobname: string; active: boolean }) => setCronActive(jobname, active),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["jobs"] });
    },
  });

  const mutSchedule = useMutation({
    mutationFn: ({ jobname, schedule }: { jobname: string; schedule: string }) => setCronSchedule(jobname, schedule),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["jobs"] });
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

  if (q.isLoading) return <div className="text-sm text-zinc-500">Loading…</div>;
  if (q.error) return <div className="text-sm text-red-600">{(q.error as any).message}</div>;

  const d = q.data!;

  return (
    <div className="space-y-6">
      <Title>Jobs</Title>

      <Card title="Saved job cursors (media_job_state)">
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
            {d.job_state.map((r, i) => (
              <tr key={i}>
                <Td className="font-mono text-xs">{r.job_name}</Td>
                <Td className="font-mono text-xs">{r.cursor ?? "—"}</Td>
                <Td className="whitespace-nowrap text-xs text-zinc-600">{fmtDateTime(r.updated_at)}</Td>
                <Td className="text-right">
                  <Button variant="ghost" onClick={() => mutReset.mutate(r.job_name)} disabled={mutReset.isPending}>
                    Reset cursor
                  </Button>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
        {mutReset.isError ? <div className="mt-2 text-sm text-red-600">{(mutReset.error as any).message}</div> : null}
      </Card>

      <Card title="Cron jobs (pg_cron)">
        <div className="text-xs text-zinc-500">
          Note: This list comes from pg_cron. Disabling a job removes it from cron; enabling re-schedules it using the stored schedule.
          You can also edit the schedule (cron expression) and run a job immediately.
        </div>

        {d.cron_error ? (
          <div className="mt-2 text-xs text-red-600">
            Could not load cron jobs: <span className="font-mono">{d.cron_error}</span>
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
              {d.cron_jobs.length ? (
                d.cron_jobs.map((r) => (
                  <tr key={r.jobname}>
                    <Td className="font-mono text-xs">{r.jobid ?? "—"}</Td>
                    <Td className="font-mono text-xs">{r.jobname}</Td>
                    <Td className="font-mono text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-[220px]">
                          <Input
                            value={scheduleDraft[r.jobname] ?? r.schedule}
                            onChange={(e) => setScheduleDraft((s) => ({ ...s, [r.jobname]: e.target.value }))}
                            placeholder="* * * * *"
                            className="py-1"
                          />
                        </div>
                        <Button
                          variant="ghost"
                          onClick={() => mutSchedule.mutate({ jobname: r.jobname, schedule: (scheduleDraft[r.jobname] ?? r.schedule).trim() })}
                          disabled={mutSchedule.isPending || !(scheduleDraft[r.jobname] ?? r.schedule).trim()}
                        >
                          Save
                        </Button>
                      </div>
                    </Td>
                    <Td className={r.active ? "text-emerald-600" : "text-zinc-500"}>{r.active ? "active" : "disabled"}</Td>
                    <Td className="text-right">
                      <div className="inline-flex items-center gap-2">
                        <Button
                          variant="ghost"
                          onClick={() => mutRunNow.mutate(r.jobname)}
                          disabled={mutRunNow.isPending}
                        >
                          Run now
                        </Button>
                        {r.active ? (
                          <Button
                            variant="danger"
                            onClick={() => mutCron.mutate({ jobname: r.jobname, active: false })}
                            disabled={mutCron.isPending}
                          >
                            Disable
                          </Button>
                        ) : (
                          <Button
                            variant="primary"
                            onClick={() => mutCron.mutate({ jobname: r.jobname, active: true })}
                            disabled={mutCron.isPending}
                          >
                            Enable
                          </Button>
                        )}
                      </div>
                    </Td>
                  </tr>
                ))
              ) : (
                <tr>
                  <Td colSpan={5} className="text-zinc-500">
                    No cron jobs registered (or pg_cron not enabled).
                  </Td>
                </tr>
              )}
            </tbody>
          </Table>

          {mutCron.isError ? <div className="mt-2 text-sm text-red-600">{(mutCron.error as any).message}</div> : null}
          {mutSchedule.isError ? <div className="mt-2 text-sm text-red-600">{(mutSchedule.error as any).message}</div> : null}
          {mutRunNow.isError ? <div className="mt-2 text-sm text-red-600">{(mutRunNow.error as any).message}</div> : null}
        </div>
      </Card>
    </div>
  );
}
