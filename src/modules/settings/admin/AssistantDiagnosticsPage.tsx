import React from "react";

import { RefreshCcw, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageSection } from "@/components/PageChrome";
import TopBar from "@/components/shared/TopBar";

import { useIsAppAdmin } from "./useIsAppAdmin";
import { useAssistantHealthSnapshot } from "./useAssistantHealthSnapshot";

const formatSec = (sec?: number) => {
  const s = Number(sec ?? 0);
  if (!Number.isFinite(s) || s <= 0) return "—";
  if (s < 60) return `${Math.round(s)}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m < 60) return `${m}m ${Math.round(r)}s`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}h ${mm}m`;
};

const short = (id?: string, n = 6) => {
  if (!id) return "—";
  return id.length <= n * 2 ? id : `${id.slice(0, n)}…${id.slice(-n)}`;
};

const AssistantDiagnosticsPage: React.FC = () => {
  const { data: isAdmin, isLoading: adminLoading } = useIsAppAdmin();
  const snapshot = useAssistantHealthSnapshot({ enabled: Boolean(isAdmin) });

  const counts = snapshot.data?.counts ?? {};
  const byKind = snapshot.data?.byKind ?? {};

  const refresh = () => snapshot.refetch();

  return (
    <div className="flex flex-1 flex-col gap-4 pb-2 pt-1">
      <TopBar
        title="Assistant Diagnostics"
        actions={[
          {
            icon: RefreshCcw,
            label: "Refresh",
            onClick: refresh,
            disabled: snapshot.isFetching || !isAdmin,
          },
        ]}
      />

      <section className="flex flex-col stack-gap pb-2">
        <PageSection
          title="Health"
          description="Backend job queue + cron runner telemetry."
          actions={
            <div className="flex items-center gap-2">
              {snapshot.data?.requestId ? (
                <span className="text-[11px] text-muted-foreground">
                  requestId: {snapshot.data.requestId}
                </span>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={refresh}
                disabled={snapshot.isFetching || !isAdmin}
              >
                Refresh
              </Button>
            </div>
          }
        >
          {adminLoading ? (
            <p className="text-sm text-muted-foreground">Checking permissions…</p>
          ) : !isAdmin ? (
            <div className="flex items-start gap-3 rounded-md border border-dashed border-border bg-muted p-3">
              <ShieldAlert className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Admin access required</p>
                <p className="text-xs text-muted-foreground">
                  This page is only available for app admins.
                </p>
              </div>
            </div>
          ) : snapshot.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading snapshot…</p>
          ) : snapshot.isError ? (
            <p className="text-sm text-destructive">Failed to load snapshot.</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                <div className="rounded-lg border bg-background p-3">
                  <p className="text-xs text-muted-foreground">Pending</p>
                  <p className="text-lg font-semibold text-foreground">{counts.pending ?? 0}</p>
                </div>
                <div className="rounded-lg border bg-background p-3">
                  <p className="text-xs text-muted-foreground">Processing</p>
                  <p className="text-lg font-semibold text-foreground">{counts.processing ?? 0}</p>
                </div>
                <div className="rounded-lg border bg-background p-3">
                  <p className="text-xs text-muted-foreground">Failed</p>
                  <p className="text-lg font-semibold text-foreground">{counts.failed ?? 0}</p>
                </div>
                <div className="rounded-lg border bg-background p-3">
                  <p className="text-xs text-muted-foreground">Done</p>
                  <p className="text-lg font-semibold text-foreground">{counts.done ?? 0}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div className="rounded-lg border bg-background p-3">
                  <p className="text-xs text-muted-foreground">Oldest pending</p>
                  <p className="text-sm font-semibold text-foreground">
                    {formatSec(snapshot.data?.oldestPendingSec)}
                  </p>
                </div>
                <div className="rounded-lg border bg-background p-3">
                  <p className="text-xs text-muted-foreground">Oldest processing</p>
                  <p className="text-sm font-semibold text-foreground">
                    {formatSec(snapshot.data?.oldestProcessingSec)}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border bg-background p-3">
                <p className="mb-2 text-xs font-semibold text-muted-foreground">By kind</p>
                {Object.keys(byKind).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No jobs yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="text-muted-foreground">
                        <tr>
                          <th className="py-1 pr-3 font-semibold">Kind</th>
                          <th className="py-1 pr-3 font-semibold">Pending</th>
                          <th className="py-1 pr-3 font-semibold">Processing</th>
                          <th className="py-1 pr-3 font-semibold">Failed</th>
                          <th className="py-1 pr-3 font-semibold">Done</th>
                          <th className="py-1 font-semibold">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {Object.entries(byKind).map(([kind, c]) => (
                          <tr key={kind}>
                            <td className="py-2 pr-3 font-medium text-foreground">{kind}</td>
                            <td className="py-2 pr-3">{c.pending ?? 0}</td>
                            <td className="py-2 pr-3">{c.processing ?? 0}</td>
                            <td className="py-2 pr-3">{c.failed ?? 0}</td>
                            <td className="py-2 pr-3">{c.done ?? 0}</td>
                            <td className="py-2">{c.total ?? 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </PageSection>

        {isAdmin ? (
          <>
            <PageSection title="Recent failures" description="Last 20 failed jobs.">
              {snapshot.data?.recentFailures?.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-muted-foreground">
                      <tr>
                        <th className="py-1 pr-3 font-semibold">Updated</th>
                        <th className="py-1 pr-3 font-semibold">Kind</th>
                        <th className="py-1 pr-3 font-semibold">Conversation</th>
                        <th className="py-1 pr-3 font-semibold">Attempts</th>
                        <th className="py-1 font-semibold">Error</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {snapshot.data.recentFailures.map((f) => (
                        <tr key={f.id}>
                          <td className="py-2 pr-3 text-muted-foreground">
                            {f.updatedAt ? new Date(f.updatedAt).toLocaleString() : "—"}
                          </td>
                          <td className="py-2 pr-3 font-medium text-foreground">
                            {f.jobKind ?? "—"}
                          </td>
                          <td className="py-2 pr-3 text-muted-foreground">
                            {short(f.conversationId)}
                          </td>
                          <td className="py-2 pr-3">{f.attempts ?? 0}</td>
                          <td className="py-2 text-muted-foreground">{f.lastError ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No failures.</p>
              )}
            </PageSection>

            <PageSection title="Cron requests" description="Last 25 cron invocations.">
              {snapshot.data?.recentCron?.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-muted-foreground">
                      <tr>
                        <th className="py-1 pr-3 font-semibold">Created</th>
                        <th className="py-1 pr-3 font-semibold">Job</th>
                        <th className="py-1 font-semibold">Request</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {snapshot.data.recentCron.map((c) => (
                        <tr key={c.id}>
                          <td className="py-2 pr-3 text-muted-foreground">
                            {c.createdAt ? new Date(c.createdAt).toLocaleString() : "—"}
                          </td>
                          <td className="py-2 pr-3 font-medium text-foreground">{c.job ?? "—"}</td>
                          <td className="py-2 text-muted-foreground">
                            {c.requestId ? String(c.requestId) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No cron requests yet.</p>
              )}
            </PageSection>
          </>
        ) : null}

        <p className="text-xs text-muted-foreground">
          Tip: If something looks stuck, check your Supabase scheduled triggers, the Edge Function
          logs, and the OpenRouter key.
        </p>
      </section>
    </div>
  );
};

export default AssistantDiagnosticsPage;
