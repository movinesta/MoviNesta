import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCosts } from "../lib/api";
import { Card } from "../components/Card";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { StatCard } from "../components/StatCard";
import { Table, Td, Th } from "../components/Table";
import { cn, fmtDateTime, fmtInt } from "../lib/ui";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

function Title(props: { children: React.ReactNode }) {
  return <div className="mb-4 text-xl font-semibold tracking-tight">{props.children}</div>;
}

function parseDayUtc(day: string): Date {
  // day is YYYY-MM-DD
  return new Date(`${day}T00:00:00.000Z`);
}

function formatDay(day: string, mode: "utc" | "local") {
  const d = parseDayUtc(day);
  if (Number.isNaN(d.getTime())) return day;
  if (mode === "utc") return day;
  // render as local date (may differ by one day depending on TZ)
  return d.toLocaleDateString(undefined, { year: "numeric", month: "2-digit", day: "2-digit" });
}

function downloadText(filename: string, content: string, mime = "text/plain") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function Costs() {
  const [days, setDays] = useState(14);
  const [tz, setTz] = useState<"utc" | "local">("utc");
  const [view, setView] = useState<"providers" | "jobs">("providers");

  const q = useQuery({ queryKey: ["costs", { days }], queryFn: () => getCosts({ days }) });

  const resp = q.data;

  const dailyRows = useMemo(() => {
    const raw: any = (resp as any)?.daily;
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(Boolean)
      .filter((r: any) => typeof r.day === "string" && typeof r.provider === "string")
      .map((r: any) => ({
        day: String(r.day),
        provider: String(r.provider),
        tokens: Number.isFinite(Number(r.tokens)) ? Number(r.tokens) : 0,
        runs: Number.isFinite(Number(r.runs)) ? Number(r.runs) : 0,
        errors: Number.isFinite(Number(r.errors)) ? Number(r.errors) : 0,
      }));
  }, [resp]);

  const dailyJobRows = useMemo(() => {
    const raw: any = (resp as any)?.daily_jobs;
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(Boolean)
      .filter((r: any) => typeof r.day === "string" && typeof r.job_name === "string" && typeof r.provider === "string")
      .map((r: any) => ({
        day: String(r.day),
        job_name: String(r.job_name),
        provider: String(r.provider),
        tokens: Number.isFinite(Number(r.tokens)) ? Number(r.tokens) : 0,
        runs: Number.isFinite(Number(r.runs)) ? Number(r.runs) : 0,
        errors: Number.isFinite(Number(r.errors)) ? Number(r.errors) : 0,
      }));
  }, [resp]);

  const jobs = useMemo(() => {
    const raw: any = (resp as any)?.jobs;
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(Boolean)
      .filter((r: any) => typeof r.job_name === "string")
      .map((r: any) => ({
        job_name: String(r.job_name),
        provider: r.provider == null ? null : String(r.provider),
        tokens: Number.isFinite(Number(r.tokens)) ? Number(r.tokens) : 0,
        runs: Number.isFinite(Number(r.runs)) ? Number(r.runs) : 0,
        errors: Number.isFinite(Number(r.errors)) ? Number(r.errors) : 0,
        last_started_at: r.last_started_at ? String(r.last_started_at) : null,
      }))
      .sort((a: any, b: any) => b.tokens - a.tokens);
  }, [resp]);

  const providers = useMemo(() => {
    const s = new Set<string>();
    for (const r of dailyRows) s.add(r.provider);
    return Array.from(s.values()).sort();
  }, [dailyRows]);

  const dayList = useMemo(() => {
    const todayDay = (resp as any)?.today?.day as string | undefined;
    const d0 = todayDay ? parseDayUtc(todayDay) : new Date();
    if (Number.isNaN(d0.getTime())) return [] as string[];
    const out: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(d0.getTime());
      d.setUTCDate(d.getUTCDate() - i);
      out.push(d.toISOString().slice(0, 10));
    }
    return out;
  }, [resp, days]);

  const chartDataProviders = useMemo(() => {
    if (!dayList.length) return [];
    const byDay: Record<string, any> = {};
    for (const day of dayList) byDay[day] = { day, dayLabel: formatDay(day, tz) };
    for (const r of dailyRows) {
      if (!byDay[r.day]) byDay[r.day] = { day: r.day, dayLabel: formatDay(r.day, tz) };
      byDay[r.day][r.provider] = (byDay[r.day][r.provider] ?? 0) + r.tokens;
    }
    // fill zeros so lines render consistently
    for (const day of Object.keys(byDay)) {
      for (const p of providers) byDay[day][p] = Number(byDay[day][p] ?? 0);
    }
    return Object.values(byDay).sort((a: any, b: any) => String(a.day).localeCompare(String(b.day)));
  }, [dailyRows, dayList, providers, tz]);

  const topJobs = useMemo(() => {
    const totals = new Map<string, number>();
    for (const r of dailyJobRows) totals.set(r.job_name, (totals.get(r.job_name) ?? 0) + r.tokens);
    return Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name]) => name);
  }, [dailyJobRows]);

  const chartDataJobs = useMemo(() => {
    if (!dayList.length) return [];
    const byDay: Record<string, any> = {};
    for (const day of dayList) byDay[day] = { day, dayLabel: formatDay(day, tz) };
    const otherKey = "(other jobs)";
    for (const r of dailyJobRows) {
      if (!byDay[r.day]) byDay[r.day] = { day: r.day, dayLabel: formatDay(r.day, tz) };
      const k = topJobs.includes(r.job_name) ? r.job_name : otherKey;
      byDay[r.day][k] = (byDay[r.day][k] ?? 0) + r.tokens;
    }
    const lines = [...topJobs, otherKey];
    for (const day of Object.keys(byDay)) {
      for (const k of lines) byDay[day][k] = Number(byDay[day][k] ?? 0);
    }
    return Object.values(byDay).sort((a: any, b: any) => String(a.day).localeCompare(String(b.day)));
  }, [dailyJobRows, dayList, topJobs, tz]);

  const totals = useMemo(() => {
    const total = dailyRows.reduce((acc, r) => acc + r.tokens, 0);
    const byProvider: Record<string, number> = {};
    for (const r of dailyRows) byProvider[r.provider] = (byProvider[r.provider] ?? 0) + r.tokens;
    return { total, byProvider };
  }, [dailyRows]);

  const today = useMemo(() => {
    const t = (resp as any)?.today;
    const day = typeof t?.day === "string" ? t.day : "—";
    const totalTokens = Number.isFinite(Number(t?.total_tokens)) ? Number(t.total_tokens) : 0;
    const byProvider = (t?.by_provider && typeof t.by_provider === "object") ? (t.by_provider as Record<string, number>) : {};
    return { day, totalTokens, byProvider };
  }, [resp]);

  const dataQuality = useMemo(() => {
    const d = (resp as any)?.data_quality;
    return {
      rows: Number.isFinite(Number(d?.rows)) ? Number(d.rows) : 0,
      rowsWithTokens: Number.isFinite(Number(d?.rows_with_tokens)) ? Number(d.rows_with_tokens) : 0,
      rowsMissingTokens: Number.isFinite(Number(d?.rows_missing_tokens)) ? Number(d.rows_missing_tokens) : 0,
    };
  }, [resp]);

  const alerts = useMemo(() => {
    const out: Array<{ kind: "warn" | "info"; msg: string }> = [];
    if (dataQuality.rowsMissingTokens > 0) {
      out.push({ kind: "warn", msg: `There are ${fmtInt(dataQuality.rowsMissingTokens)} job_run_log rows missing total_tokens. Those rows won’t show up in charts.` });
    }
    return out;
  }, [dataQuality]);

  const exportDailyCsv = () => {
    const header = ["day", "provider", "tokens", "runs", "errors"].join(",");
    const lines = dailyRows.map((r) => [r.day, r.provider, r.tokens, r.runs, r.errors].join(","));
    downloadText(`costs_daily_${days}d.csv`, [header, ...lines].join("\n"), "text/csv");
  };

  const exportDailyJobsCsv = () => {
    const header = ["day", "job_name", "provider", "tokens", "runs", "errors"].join(",");
    const lines = dailyJobRows.map((r) => [r.day, JSON.stringify(r.job_name), r.provider, r.tokens, r.runs, r.errors].join(","));
    downloadText(`costs_daily_jobs_${days}d.csv`, [header, ...lines].join("\n"), "text/csv");
  };

  const exportJobsCsv = () => {
    const header = ["job_name", "provider", "tokens", "runs", "errors", "last_started_at"].join(",");
    const lines = jobs.map((r) => [JSON.stringify(r.job_name), r.provider ?? "", r.tokens, r.runs, r.errors, r.last_started_at ?? ""].join(","));
    downloadText(`costs_jobs_${days}d.csv`, [header, ...lines].join("\n"), "text/csv");
  };

  if (q.isLoading) return <div className="text-sm text-zinc-400">Loading…</div>;
  if (q.error) return <div className="text-sm text-red-400">{(q.error as any).message}</div>;

  return (
    <div className="space-y-6">
      <Title>Costs</Title>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <StatCard title={`Total tokens (last ${days}d)`} value={fmtInt(totals.total)} subtitle={<span className="font-mono text-zinc-500">since: {resp?.since ?? "—"}</span>} />
        <StatCard title={`Today (${formatDay(today.day, "utc")})`} value={fmtInt(today.totalTokens)} subtitle={<span className="text-zinc-500">Budgets disabled.</span>} />
        <StatCard title="Data quality" value={fmtInt(dataQuality.rows)} subtitle={<span><span className="font-mono">{fmtInt(dataQuality.rowsMissingTokens)}</span> rows missing total_tokens</span>} />
      </div>

      {alerts.length ? (
        <Card title="Alerts">
          <div className="space-y-2">
            {alerts.map((a, idx) => (
              <div key={idx} className={cn("rounded-xl border px-3 py-2 text-sm", a.kind === "warn" ? "border-amber-500/30 bg-amber-500/10 text-amber-200" : "border-zinc-800 bg-zinc-950/40 text-zinc-200")}>
                {a.msg}
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Card title="Controls">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <div className="mb-1 text-xs text-zinc-500">Days</div>
            <div className="w-28">
              <Input type="number" value={String(days)} min={3} max={60} onChange={(e) => setDays(Number(e.target.value))} />
            </div>
          </div>

          <div>
            <div className="mb-1 text-xs text-zinc-500">Chart</div>
            <div className="flex gap-2">
              <Button variant={view === "providers" ? "primary" : "ghost"} onClick={() => setView("providers")}>Providers</Button>
              <Button variant={view === "jobs" ? "primary" : "ghost"} onClick={() => setView("jobs")}>Jobs</Button>
            </div>
          </div>

          <div>
            <div className="mb-1 text-xs text-zinc-500">X-axis labels</div>
            <div className="flex gap-2">
              <Button variant={tz === "utc" ? "primary" : "ghost"} onClick={() => setTz("utc")}>UTC</Button>
              <Button variant={tz === "local" ? "primary" : "ghost"} onClick={() => setTz("local")}>Local</Button>
            </div>
          </div>

          <div className="flex-1" />

          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={exportDailyCsv}>Export daily CSV</Button>
            <Button variant="ghost" onClick={exportDailyJobsCsv}>Export daily jobs CSV</Button>
            <Button variant="ghost" onClick={exportJobsCsv}>Export jobs CSV</Button>
          </div>
        </div>
      </Card>

      <Card title={view === "providers" ? "Tokens by day (providers)" : "Tokens by day (top jobs)"}>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={view === "providers" ? chartDataProviders : chartDataJobs}>
              <XAxis dataKey="dayLabel" />
              <YAxis tickFormatter={(v) => fmtInt(Number(v))} />
              <Tooltip formatter={(v) => fmtInt(Number(v))} />
              <Legend />
              {(view === "providers" ? providers : [...topJobs, "(other jobs)"]).map((k) => (
                <Line key={k} type="monotone" dataKey={k} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 text-xs text-zinc-500">
          Note: This dashboard reads <span className="font-mono">total_tokens</span> from <span className="font-mono">job_run_log</span>.
          If a provider doesn’t report tokens, its line may be empty (and will show up as missing-token rows).
        </div>
      </Card>

      <Card title="Today usage (by provider)">
        <Table>
          <thead>
            <tr>
              <Th>Provider</Th>
              <Th className="text-right">Used</Th>
              
            </tr>
          </thead>
          <tbody>
            {providers.length ? (
              providers.map((p) => {
                const used = Number(today.byProvider[p] ?? 0);
                return (
                  <tr key={p}>
                    <Td className="font-mono">{p}</Td>
                    <Td className="text-right font-mono">{fmtInt(used)}</Td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <Td colSpan={2} className="text-zinc-500">No data.</Td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>

      <Card title="Daily breakdown">
        <Table>
          <thead>
            <tr>
              <Th>Day</Th>
              <Th className="text-right">Total</Th>
              {providers.map((p) => (
                <Th key={p} className="text-right">{p}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dayList.length ? (
              dayList.map((day) => {
                const rowTokens: Record<string, number> = {};
                for (const p of providers) rowTokens[p] = 0;
                for (const r of dailyRows) {
                  if (r.day !== day) continue;
                  rowTokens[r.provider] = (rowTokens[r.provider] ?? 0) + r.tokens;
                }
                const total = Object.values(rowTokens).reduce((a, b) => a + b, 0);
                return (
                  <tr key={day}>
                    <Td className="font-mono">{formatDay(day, tz)}</Td>
                    <Td className="text-right font-mono">{fmtInt(total)}</Td>
                    {providers.map((p) => (
                      <Td key={p} className="text-right font-mono">{fmtInt(rowTokens[p] ?? 0)}</Td>
                    ))}
                  </tr>
                );
              })
            ) : (
              <tr><Td colSpan={2 + providers.length} className="text-zinc-500">No data.</Td></tr>
            )}
          </tbody>
        </Table>
      </Card>

      <Card title="Top jobs (last period)">
        <Table>
          <thead>
            <tr>
              <Th>Job</Th>
              <Th>Provider</Th>
              <Th className="text-right">Tokens</Th>
              <Th className="text-right">Runs</Th>
              <Th className="text-right">Errors</Th>
              <Th>Last run</Th>
            </tr>
          </thead>
          <tbody>
            {jobs.length ? (
              jobs.slice(0, 25).map((r) => (
                <tr key={`${r.job_name}|${r.provider ?? ""}`}>
                  <Td className="font-mono">{r.job_name}</Td>
                  <Td className="font-mono">{r.provider ?? "—"}</Td>
                  <Td className="text-right font-mono">{fmtInt(r.tokens)}</Td>
                  <Td className="text-right font-mono">{fmtInt(r.runs)}</Td>
                  <Td className="text-right font-mono">{fmtInt(r.errors)}</Td>
                  <Td className="font-mono">{fmtDateTime(r.last_started_at)}</Td>
                </tr>
              ))
            ) : (
              <tr><Td colSpan={6} className="text-zinc-500">No data.</Td></tr>
            )}
          </tbody>
        </Table>
        <div className="mt-3 text-xs text-zinc-500">
          Tip: If you want exact attribution, ensure every worker writes <span className="font-mono">total_tokens</span> into <span className="font-mono">job_run_log</span>.
        </div>
      </Card>
    </div>
  );
}
