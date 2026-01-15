import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  getRecVariantMetrics,
  getRecCompositionMetrics,
  getRecGenreMetrics,
  getRecHealthMetrics,
  getRecPositionMetrics,
  getRecAlertsMetrics,
  getRecsysDiagnostics,
  type RecVariantMetricRow,
  type RecSourceMetricRow,
  type RecGenreMetricRow,
  type RecHealthMetricRow,
  type RecPositionMetricRow,
  type RecAlertsDailyMetricRow,
  type RecActiveAlertRow,
  type RecAlertsMetricsResponse,
  type RecsysDiagnosticsRow,
} from "../lib/api";
import { Card } from "../components/Card";
import { Table, Th, Td } from "../components/Table";
import { ErrorBox } from "../components/ErrorBox";
import { cn, fmtDate } from "../lib/ui";
import { RecsysBlendEditor } from "../components/RecsysBlendEditor";
import { StatCard } from "../components/StatCard";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";

function fmtPct(x: number | null | undefined): string {
  if (x == null || !Number.isFinite(x)) return "—";
  return `${(x * 100).toFixed(1)}%`;
}

function fmtInt(x: any): string {
  const n = Number(x);
  if (!Number.isFinite(n)) return "0";
  return String(Math.trunc(n));
}

export default function Recsys() {
  const [days, setDays] = useState<number>(30);
  const [tab, setTab] = useState<"health" | "quality" | "composition" | "genres" | "positions" | "alerts" | "controls"> ("quality");

  const qVariant = useQuery({
    queryKey: useMemo(() => ["rec_variant_metrics", days], [days]),
    queryFn: async () => getRecVariantMetrics({ days }),
    staleTime: 30_000,
    refetchInterval: 60_000,
    enabled: tab === "quality",
  });

  const qComp = useQuery({
    queryKey: useMemo(() => ["rec_composition_metrics", days], [days]),
    queryFn: async () => getRecCompositionMetrics({ days }),
    staleTime: 30_000,
    refetchInterval: 60_000,
    enabled: tab === "composition",
  });

  const qGenre = useQuery({
    queryKey: useMemo(() => ["rec_genre_metrics", days], [days]),
    queryFn: async () => getRecGenreMetrics({ days }),
    staleTime: 30_000,
    refetchInterval: 60_000,
    enabled: tab === "genres",
  });

  const qHealth = useQuery({
    queryKey: useMemo(() => ["rec_health_metrics", days], [days]),
    queryFn: async () => getRecHealthMetrics({ days }),
    staleTime: 30_000,
    refetchInterval: 60_000,
    enabled: tab === "health",
  });

  const qDiagnostics = useQuery({
    queryKey: useMemo(() => ["rec_diagnostics"], []),
    queryFn: async () => getRecsysDiagnostics(),
    staleTime: 30_000,
    refetchInterval: 60_000,
    enabled: tab === "health",
  });

  const qPositions = useQuery({
    queryKey: useMemo(() => ["rec_position_metrics", days], [days]),
    queryFn: async () => getRecPositionMetrics({ days, max_position: 30 }),
    staleTime: 30_000,
    refetchInterval: 60_000,
    enabled: tab === "positions",
  });

  const qAlerts = useQuery({
    queryKey: useMemo(() => ["rec_alerts_metrics", days], [days]),
    queryFn: async () => getRecAlertsMetrics({ days }),
    staleTime: 30_000,
    refetchInterval: 60_000,
    enabled: tab === "alerts",
  });

  const rowsVariant = (qVariant.data?.rows ?? []) as RecVariantMetricRow[];
  const rowsComp = (qComp.data?.rows ?? []) as RecSourceMetricRow[];
  const rowsGenre = (qGenre.data?.rows ?? []) as RecGenreMetricRow[];
  const rowsHealth = (qHealth.data?.rows ?? []) as RecHealthMetricRow[];
  const rowsPos = (qPositions.data?.rows ?? []) as RecPositionMetricRow[];
  const diagnostics = (qDiagnostics.data?.row ?? null) as RecsysDiagnosticsRow | null;

  const latestHealth = rowsHealth[0];

  const posAgg = useMemo(() => {
    // Aggregate across selected window by position
    const byPos = new Map<number, { position: number; impressions: number; likes: number; dislikes: number; watchlist_adds: number; detail_opens: number }>();
    for (const r of rowsPos) {
      const p = Number((r as any).position);
      const cur = byPos.get(p) ?? { position: p, impressions: 0, likes: 0, dislikes: 0, watchlist_adds: 0, detail_opens: 0 };
      cur.impressions += Number((r as any).impressions ?? 0);
      cur.likes += Number((r as any).likes ?? 0);
      cur.dislikes += Number((r as any).dislikes ?? 0);
      cur.watchlist_adds += Number((r as any).watchlist_adds ?? 0);
      cur.detail_opens += Number((r as any).detail_opens ?? 0);
      byPos.set(p, cur);
    }
    const arr = Array.from(byPos.values()).sort((a,b)=>a.position-b.position);
    return arr.map((x) => ({
      ...x,
      like_rate: x.impressions ? x.likes / x.impressions : 0,
      dislike_rate: x.impressions ? x.dislikes / x.impressions : 0,
      watchlist_rate: x.impressions ? x.watchlist_adds / x.impressions : 0,
      detail_open_rate: x.impressions ? x.detail_opens / x.impressions : 0,
    }));
  }, [rowsPos]);


  const latestDayComp = rowsComp.length ? rowsComp[0].day : null;
  const latestCompRows = useMemo(() => rowsComp.filter((r) => (latestDayComp ? r.day === latestDayComp : false)), [rowsComp, latestDayComp]);

  const latestDayGenre = rowsGenre.length ? rowsGenre[0].day : null;
  const latestGenreRows = useMemo(() => rowsGenre.filter((r) => (latestDayGenre ? r.day === latestDayGenre : false)), [rowsGenre, latestDayGenre]);

  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const latestCompTotal = sum(latestCompRows.map((r) => Number(r.impressions) || 0));
  const latestMuted = sum(latestGenreRows.map((r) => Number(r.muted_impressions) || 0));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-lg font-semibold tracking-tight text-zinc-900">Recsys Control Center</div>
          <div className="text-sm text-zinc-600">Observe → diagnose → tune → roll out (metrics, composition, drift, and controls).</div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/recsys/experiments"
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm hover:bg-zinc-50"
          >
            Experiments
          </Link>
          <Link
            to="/recsys/assignments"
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm hover:bg-zinc-50"
          >
            Assignments
          </Link>
          <label className="text-xs font-medium text-zinc-700">Window</label>
          <select
            className={cn(
              "h-9 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 shadow-sm",
              "focus:outline-none focus:ring-2 focus:ring-zinc-300",
            )}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={60}>Last 60 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { key: "health", label: "Live health" },
            { key: "quality", label: "Quality (A/B)" },
            { key: "composition", label: "Composition" },
            { key: "genres", label: "Genres & drift" },
            { key: "positions", label: "Position funnel" },
            { key: "alerts", label: "Alerts & guardrails" },
            { key: "controls", label: "Controls" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "h-9 rounded-xl border px-3 text-sm shadow-sm",
              tab === t.key
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Health */}
      {tab === "health" ? (
        <>
          {qHealth.isError ? <ErrorBox title="Failed to load health" error={qHealth.error as any} /> : null}
          {qDiagnostics.isError ? <ErrorBox title="Failed to load diagnostics" error={qDiagnostics.error as any} /> : null}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <StatCard
              title="Decks (latest day)"
              value={latestHealth ? fmtInt(latestHealth.decks) : "—"}
              subtitle={latestHealth ? `Day: ${latestHealth.day}` : undefined}
            />
            <StatCard title="Impressions" value={latestHealth ? fmtInt(latestHealth.impressions) : "—"} subtitle="rec_impressions rows" />
            <StatCard title="Users" value={latestHealth ? fmtInt(latestHealth.users) : "—"} subtitle="unique users" />
          </div>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-zinc-900">Experiment tagging health (last 7 days)</div>
                <div className="text-xs text-zinc-500">Tracks impressions missing experiment tags and outcomes without impressions.</div>
              </div>
              <div className="text-xs text-zinc-500">
                Window start: {diagnostics?.window_start ? fmtDate(diagnostics.window_start) : "—"}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              <StatCard
                title="Impressions (7d)"
                value={diagnostics ? fmtInt(diagnostics.total_impressions) : "—"}
                subtitle="Total impressions"
              />
              <StatCard
                title="Missing experiments"
                value={diagnostics ? fmtInt(diagnostics.missing_experiments) : "—"}
                subtitle={diagnostics ? `${fmtPct(diagnostics.missing_ratio)} of impressions` : undefined}
              />
              <StatCard
                title="Outcomes without impression"
                value={diagnostics ? fmtInt(diagnostics.outcomes_without_impression) : "—"}
                subtitle="Join gaps (7d)"
              />
            </div>
          </Card>

          <Card className="p-0">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <div className="text-sm font-semibold text-zinc-900">Daily volume + feature flags</div>
              <div className="text-xs text-zinc-600">{qHealth.data?.since ? `Since ${qHealth.data.since}` : qHealth.isLoading ? "Loading…" : "—"}</div>
            </div>
            <Table>
              <table className="w-full text-left">
                <thead>
                  <tr>
                    <Th>Day</Th>
                    <Th className="text-right">Decks</Th>
                    <Th className="text-right">Impr</Th>
                    <Th className="text-right">Users</Th>
                    <Th className="text-right">CF impr</Th>
                    <Th className="text-right">Mix impr</Th>
                    <Th className="text-right">Blend impr</Th>
                    <Th className="text-right">Diversity impr</Th>
                  </tr>
                </thead>
                <tbody>
                  {rowsHealth.length ? (
                    rowsHealth.map((r, i) => (
                      <tr key={`${r.day}:${i}`}>
                        <Td className="text-xs text-zinc-700">{r.day}</Td>
                        <Td className="text-right text-xs tabular-nums">{fmtInt(r.decks)}</Td>
                        <Td className="text-right text-xs tabular-nums">{fmtInt(r.impressions)}</Td>
                        <Td className="text-right text-xs tabular-nums">{fmtInt(r.users)}</Td>
                        <Td className="text-right text-xs tabular-nums">{fmtInt(r.cf_impressions)}</Td>
                        <Td className="text-right text-xs tabular-nums">{fmtInt(r.impressions_in_mix_decks)}</Td>
                        <Td className="text-right text-xs tabular-nums">{fmtInt(r.impressions_in_blend_decks)}</Td>
                        <Td className="text-right text-xs tabular-nums">{fmtInt(r.impressions_in_diversity_decks)}</Td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <Td colSpan={8} className="py-8 text-center text-sm text-zinc-600">
                        {qHealth.isLoading ? "Loading…" : "No data yet."}
                      </Td>
                    </tr>
                  )}
                </tbody>
              </table>
            </Table>
          </Card>
        </>
      ) : null}

      {/* Quality */}
      {tab === "quality" ? (
        <>
          {qVariant.isError ? <ErrorBox title="Failed to load metrics" error={qVariant.error as any} /> : null}

          <Card className="p-0">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <div className="text-sm font-semibold text-zinc-900">Daily experiment metrics</div>
              <div className="text-xs text-zinc-600">
                {qVariant.data?.since ? `Since ${qVariant.data.since}` : qVariant.isLoading ? "Loading…" : "—"}
              </div>
            </div>

            <Table>
              <table className="w-full text-left">
                <thead>
                  <tr>
                    <Th>Day</Th>
                    <Th>Experiment</Th>
                    <Th>Variant</Th>
                    <Th className="text-right">Impr</Th>
                    <Th className="text-right">Users</Th>
                    <Th className="text-right">Detail</Th>
                    <Th className="text-right">Likes</Th>
                    <Th className="text-right">Watchlist</Th>
                    <Th className="text-right">Like rate</Th>
                    <Th className="text-right">WL rate</Th>
                  </tr>
                </thead>
                <tbody>
                  {rowsVariant.length ? (
                    rowsVariant.map((r, i) => (
                      <tr key={`${r.day}:${r.experiment_key}:${r.variant}:${i}`}>
                        <Td className="text-xs text-zinc-700">{r.day}</Td>
                        <Td className="text-xs">{r.experiment_key}</Td>
                        <Td className="text-xs font-medium">{r.variant}</Td>
                        <Td className="text-right text-xs tabular-nums">{fmtInt(r.impressions)}</Td>
                        <Td className="text-right text-xs tabular-nums">{fmtInt(r.users)}</Td>
                        <Td className="text-right text-xs tabular-nums">{fmtInt(r.detail_opens)}</Td>
                        <Td className="text-right text-xs tabular-nums">{fmtInt(r.likes)}</Td>
                        <Td className="text-right text-xs tabular-nums">{fmtInt(r.watchlist_adds)}</Td>
                        <Td className="text-right text-xs tabular-nums">{fmtPct(r.like_rate)}</Td>
                        <Td className="text-right text-xs tabular-nums">{fmtPct(r.watchlist_add_rate)}</Td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <Td colSpan={10} className="py-8 text-center text-sm text-zinc-600">
                        {qVariant.isLoading ? "Loading…" : "No data yet. Once users swipe, metrics will appear here."}
                      </Td>
                    </tr>
                  )}
                </tbody>
              </table>
            </Table>
          </Card>
        </>
      ) : null}

      {/* Composition */}
      {tab === "composition" ? (
        <>
          {qComp.isError ? <ErrorBox title="Failed to load composition" error={qComp.error as any} /> : null}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <StatCard title="Latest day" value={latestDayComp ?? "—"} subtitle="Composition snapshot" />
            <StatCard title="Total impressions" value={latestCompTotal ? fmtInt(latestCompTotal) : "—"} subtitle="Across all sources" />
            <StatCard
              title="Top source share"
              value={
                latestCompTotal && latestCompRows.length
                  ? (() => {
                      const top = [...latestCompRows].sort((a, b) => (b.impressions ?? 0) - (a.impressions ?? 0))[0];
                      const share = (Number(top?.impressions) || 0) / latestCompTotal;
                      return `${top?.source ?? "—"} · ${(share * 100).toFixed(0)}%`;
                    })()
                  : "—"
              }
              subtitle="Source dominance (watch for drift)"
            />
          </div>

          <Card className="p-0">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <div className="text-sm font-semibold text-zinc-900">Daily source metrics</div>
              <div className="text-xs text-zinc-600">{qComp.data?.since ? `Since ${qComp.data.since}` : qComp.isLoading ? "Loading…" : "—"}</div>
            </div>

            <Table>
              <table className="w-full text-left">
                <thead>
                  <tr>
                    <Th>Day</Th>
                    <Th>Mode</Th>
                    <Th>Source</Th>
                    <Th className="text-right">Impr</Th>
                    <Th className="text-right">Users</Th>
                    <Th className="text-right">Like rate</Th>
                    <Th className="text-right">WL rate</Th>
                    <Th className="text-right">Share</Th>
                  </tr>
                </thead>
                <tbody>
                  {rowsComp.length ? (
                    rowsComp.map((r, i) => {
                      const isLatest = latestDayComp ? r.day === latestDayComp : false;
                      const share = isLatest && latestCompTotal ? (Number(r.impressions) || 0) / latestCompTotal : null;
                      return (
                        <tr key={`${r.day}:${r.mode}:${r.source}:${i}`}>
                          <Td className="text-xs text-zinc-700">{r.day}</Td>
                          <Td className="text-xs">{r.mode}</Td>
                          <Td className="text-xs font-medium">{r.source}</Td>
                          <Td className="text-right text-xs tabular-nums">{fmtInt(r.impressions)}</Td>
                          <Td className="text-right text-xs tabular-nums">{fmtInt(r.users)}</Td>
                          <Td className="text-right text-xs tabular-nums">{fmtPct(r.like_rate)}</Td>
                          <Td className="text-right text-xs tabular-nums">{fmtPct(r.watchlist_add_rate)}</Td>
                          <Td className="text-right text-xs tabular-nums">{share == null ? "—" : `${(share * 100).toFixed(0)}%`}</Td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <Td colSpan={8} className="py-8 text-center text-sm text-zinc-600">
                        {qComp.isLoading ? "Loading…" : "No data yet."}
                      </Td>
                    </tr>
                  )}
                </tbody>
              </table>
            </Table>
          </Card>
        </>
      ) : null}

      {/* Genres */}
      {tab === "genres" ? (
        <>
          {qGenre.isError ? <ErrorBox title="Failed to load genre metrics" error={qGenre.error as any} /> : null}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <StatCard title="Latest day" value={latestDayGenre ?? "—"} subtitle="Genre exposure snapshot" />
            <StatCard title="Muted leakage (latest)" value={latestDayGenre ? fmtInt(latestMuted) : "—"} subtitle="Should trend to 0" />
            <StatCard
              title="Drift signal"
              value={
                latestGenreRows.length
                  ? (() => {
                      const worst = [...latestGenreRows]
                        .map((r) => ({
                          slug: r.genre_slug,
                          d: Math.abs((r.share_day ?? 0) - (r.share_catalog ?? 0)),
                        }))
                        .sort((a, b) => b.d - a.d)[0];
                      return worst ? `${worst.slug} · ${(worst.d * 100).toFixed(1)}pp` : "—";
                    })()
                  : "—"
              }
              subtitle="Largest |share_day - share_catalog|"
            />
          </div>

          <Card className="p-0">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <div className="text-sm font-semibold text-zinc-900">Daily genre exposure</div>
              <div className="text-xs text-zinc-600">{qGenre.data?.since ? `Since ${qGenre.data.since}` : qGenre.isLoading ? "Loading…" : "—"}</div>
            </div>

            <Table>
              <table className="w-full text-left">
                <thead>
                  <tr>
                    <Th>Day</Th>
                    <Th>Genre</Th>
                    <Th className="text-right">Impr</Th>
                    <Th className="text-right">Users</Th>
                    <Th className="text-right">Share (day)</Th>
                    <Th className="text-right">Share (catalog)</Th>
                    <Th className="text-right">Δ</Th>
                    <Th className="text-right">Muted leak</Th>
                  </tr>
                </thead>
                <tbody>
                  {rowsGenre.length ? (
                    rowsGenre.map((r, i) => {
                      const delta = (r.share_day ?? 0) - (r.share_catalog ?? 0);
                      const leak = Number(r.muted_impressions) || 0;
                      return (
                        <tr key={`${r.day}:${r.genre_slug}:${i}`}>
                          <Td className="text-xs text-zinc-700">{r.day}</Td>
                          <Td className="text-xs font-medium">{r.genre_slug}</Td>
                          <Td className="text-right text-xs tabular-nums">{fmtInt(r.impressions)}</Td>
                          <Td className="text-right text-xs tabular-nums">{fmtInt(r.users)}</Td>
                          <Td className="text-right text-xs tabular-nums">{fmtPct(r.share_day)}</Td>
                          <Td className="text-right text-xs tabular-nums">{fmtPct(r.share_catalog)}</Td>
                          <Td className="text-right text-xs tabular-nums">{`${(delta * 100).toFixed(1)}pp`}</Td>
                          <Td className={cn("text-right text-xs tabular-nums", leak > 0 ? "font-semibold text-red-600" : "text-zinc-700")}>
                            {fmtInt(leak)}
                          </Td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <Td colSpan={8} className="py-8 text-center text-sm text-zinc-600">
                        {qGenre.isLoading ? "Loading…" : "No data yet."}
                      </Td>
                    </tr>
                  )}
                </tbody>
              </table>
            </Table>
          </Card>
        </>
      ) : null}

      {/* Controls */}
      {tab === "positions" ? (
        <>
          {qPositions.isError ? <ErrorBox title="Failed to load position metrics" error={qPositions.error as any} /> : null}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Card className="p-4">
              <div className="mb-2 text-sm font-semibold text-zinc-900">Like rate by position</div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={posAgg} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="position" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} domain={[0, 1]} />
                    <Tooltip formatter={(v: any) => `${(Number(v) * 100).toFixed(1)}%`} />
                    <Legend />
                    <Line type="monotone" dataKey="like_rate" name="Like rate" dot={false} />
                    <Line type="monotone" dataKey="dislike_rate" name="Dislike rate" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4">
              <div className="mb-2 text-sm font-semibold text-zinc-900">Engagement by position</div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={posAgg} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="position" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} domain={[0, 1]} />
                    <Tooltip formatter={(v: any) => `${(Number(v) * 100).toFixed(1)}%`} />
                    <Legend />
                    <Line type="monotone" dataKey="detail_open_rate" name="Detail open rate" dot={false} />
                    <Line type="monotone" dataKey="watchlist_rate" name="Watchlist add rate" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <Card className="p-0">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <div className="text-sm font-semibold text-zinc-900">Aggregated counts by position (window)</div>
              <div className="text-xs text-zinc-600">{qPositions.data ? `Since ${qPositions.data.since}` : qPositions.isLoading ? "Loading…" : "—"}</div>
            </div>
            <Table>
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-600">
                    <Th>Pos</Th>
                    <Th className="text-right">Impr</Th>
                    <Th className="text-right">Likes</Th>
                    <Th className="text-right">Dislikes</Th>
                    <Th className="text-right">Detail opens</Th>
                    <Th className="text-right">Watchlist</Th>
                    <Th className="text-right">Like rate</Th>
                  </tr>
                </thead>
                <tbody>
                  {posAgg.map((r) => (
                    <tr key={r.position} className="border-b border-zinc-100 text-sm">
                      <Td>{r.position}</Td>
                      <Td className="text-right text-xs tabular-nums">{fmtInt(r.impressions)}</Td>
                      <Td className="text-right text-xs tabular-nums">{fmtInt(r.likes)}</Td>
                      <Td className="text-right text-xs tabular-nums">{fmtInt(r.dislikes)}</Td>
                      <Td className="text-right text-xs tabular-nums">{fmtInt(r.detail_opens)}</Td>
                      <Td className="text-right text-xs tabular-nums">{fmtInt(r.watchlist_adds)}</Td>
                      <Td className="text-right text-xs tabular-nums">{fmtPct(r.like_rate)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Table>
          </Card>
        </>
      ) : tab === "alerts" ? (
        <>
          {qAlerts.isError ? <ErrorBox title="Failed to load alerts" error={qAlerts.error as any} /> : null}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Card className="p-4 md:col-span-2">
              <div className="mb-2 text-sm font-semibold text-zinc-900">Guardrail rates over time</div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={qAlerts.data?.daily ?? []} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="like_rate" name="Like rate" dot={false} />
                    <Line type="monotone" dataKey="watchlist_rate" name="Watchlist add rate" dot={false} />
                    <Line type="monotone" dataKey="cf_share" name="CF share" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 text-xs text-zinc-600">
                Guardrails compare today vs trailing 7-day average and require enough volume (≥200 impressions/day).
              </div>
            </Card>

            <Card className="p-4">
              <div className="mb-2 text-sm font-semibold text-zinc-900">Active alerts (last {days}d)</div>
              <div className="space-y-2">
                {(qAlerts.data?.alerts ?? []).slice(0, 10).map((a, idx) => (
                  <div key={idx} className="rounded-xl border p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-zinc-900">{a.alert_key}</div>
                      <div
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-semibold",
                          a.severity === "high"
                            ? "bg-red-100 text-red-800"
                            : a.severity === "medium"
                            ? "bg-amber-100 text-amber-900"
                            : "bg-zinc-100 text-zinc-800",
                        )}
                      >
                        {a.severity}
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-zinc-700">{a.day}: {a.message}</div>
                  </div>
                ))}
                {(qAlerts.data?.alerts ?? []).length === 0 ? (
                  <div className="rounded-xl border p-3 text-xs text-zinc-700">No active alerts 🎉</div>
                ) : null}
              </div>
            </Card>
          </div>

          <Card className="mt-3 p-4">
            <div className="mb-2 text-sm font-semibold text-zinc-900">Daily guardrail table</div>
            <Table>
              <table>
                <thead>
                  <tr>
                    <Th>Day</Th>
                    <Th className="text-right">Impr</Th>
                    <Th className="text-right">Like%</Th>
                    <Th className="text-right">WL%</Th>
                    <Th className="text-right">CF%</Th>
                    <Th className="text-right">Muted</Th>
                    <Th>Flags</Th>
                  </tr>
                </thead>
                <tbody>
                  {(qAlerts.data?.daily ?? []).slice().reverse().map((r, i) => (
                    <tr key={i} className="border-t">
                      <Td>{r.day}</Td>
                      <Td className="text-right">{fmtInt(r.impressions)}</Td>
                      <Td className="text-right">{fmtPct(r.like_rate)}</Td>
                      <Td className="text-right">{fmtPct(r.watchlist_rate)}</Td>
                      <Td className="text-right">{fmtPct(r.cf_share)}</Td>
                      <Td className="text-right">{fmtInt(r.muted_impressions)}</Td>
                      <Td>
                        <div className="flex flex-wrap gap-1">
                          {r.alert_muted_leakage ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">Muted leakage</span> : null}
                          {r.alert_like_rate_drop ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">Like drop</span> : null}
                          {r.alert_watchlist_rate_drop ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">WL drop</span> : null}
                          {r.alert_cf_starvation ? <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-800">CF=0</span> : null}
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Table>
          </Card>
        </>
      ) : tab === "controls" ? (

        <>
          <RecsysBlendEditor />
        </>
      ) : null}

    </div>
  );
}
