import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getJobs, resetCursor, setCronActive } from "../lib/api";
import { Card } from "../components/Card";
import { Table, Th, Td } from "../components/Table";
import { Button } from "../components/Button";
import { fmtDateTime } from "../lib/ui";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useToast } from "../components/ToastProvider";

function Title(props: { children: React.ReactNode }) {
  return <div className="mb-4 text-xl font-semibold tracking-tight">{props.children}</div>;
}

type ConfirmState = {
  title: string;
  message: string;
  confirmText?: string;
  danger?: boolean;
  disabled?: boolean;
  onConfirm: () => void;
} | null;

export default function Jobs() {
  const qc = useQueryClient();
  const toast = useToast();
  const [confirm, setConfirm] = useState<ConfirmState>(null);

  const q = useQuery({ queryKey: ["jobs"], queryFn: getJobs });

  const mutReset = useMutation({
    mutationFn: (job_name: string) => resetCursor(job_name),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["jobs"] });
      await qc.invalidateQueries({ queryKey: ["overview"] });
      toast.push({ title: "Cursor reset", message: "Job cursor was cleared.", variant: "success" });
    },
  });

  const mutCron = useMutation({
    mutationFn: ({ jobname, active }: { jobname: string; active: boolean }) => setCronActive(jobname, active),
    onSuccess: async (_data, vars) => {
      await qc.invalidateQueries({ queryKey: ["jobs"] });
      toast.push({
        title: vars.active ? "Cron enabled" : "Cron disabled",
        message: vars.active ? "The job has been scheduled." : "The job has been removed from cron.",
        variant: "success",
      });
    },
  });

  if (q.isLoading) return <div className="text-sm text-zinc-400">Loading…</div>;
  if (q.error) return <div className="text-sm text-red-400">{(q.error as any).message}</div>;

  const d = q.data!;

  return (
    <div className="space-y-6">
      <Title>Jobs</Title>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title ?? ""}
        message={confirm?.message ?? ""}
        confirmText={confirm?.confirmText}
        danger={confirm?.danger}
        confirmDisabled={confirm?.disabled}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const action = confirm?.onConfirm;
          setConfirm(null);
          action?.();
        }}
      />

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
                <Td className="whitespace-nowrap text-xs text-zinc-400">{fmtDateTime(r.updated_at)}</Td>
                <Td className="text-right">
                  <Button
                    variant="ghost"
                    onClick={() =>
                      setConfirm({
                        title: "Reset cursor",
                        message: `Reset cursor for ${r.job_name}? Next run will start from the beginning of pagination.`,
                        confirmText: "Reset",
                        danger: true,
                        disabled: mutReset.isPending,
                        onConfirm: () => mutReset.mutate(r.job_name),
                      })
                    }
                    disabled={mutReset.isPending}
                  >
                    Reset cursor
                  </Button>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
        {mutReset.isError ? <div className="mt-2 text-sm text-red-400">{(mutReset.error as any).message}</div> : null}
      </Card>

      <Card title="Cron jobs (pg_cron)">
        <div className="text-xs text-zinc-500">
          Note: This list comes from pg_cron. Disabling a job removes it from cron; enabling re-schedules it using stored schedule.
        </div>

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
                  <tr key={r.jobid}>
                    <Td className="font-mono text-xs">{r.jobid}</Td>
                    <Td className="font-mono text-xs">{r.jobname}</Td>
                    <Td className="font-mono text-xs">{r.schedule}</Td>
                    <Td className={r.active ? "text-emerald-300" : "text-zinc-500"}>{r.active ? "active" : "disabled"}</Td>
                    <Td className="text-right">
                      {r.active ? (
                        <Button
                          variant="danger"
                          onClick={() =>
                            setConfirm({
                              title: "Disable cron job",
                              message: `Disable ${r.jobname}? This removes it from cron until re-enabled.`,
                              confirmText: "Disable",
                              danger: true,
                              disabled: mutCron.isPending,
                              onConfirm: () => mutCron.mutate({ jobname: r.jobname, active: false }),
                            })
                          }
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

          {mutCron.isError ? <div className="mt-2 text-sm text-red-400">{(mutCron.error as any).message}</div> : null}
        </div>
      </Card>
    </div>
  );
}
