import React, { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCosts, getOpenRouterCredits, setCostsBudgets } from "../lib/api";
import { Card } from "../components/Card";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { StatCard } from "../components/StatCard";
import { Table, Td, Th } from "../components/Table";
import { cn, fmtDateTime, fmtInt } from "../lib/ui";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { ErrorBox } from "../components/ErrorBox";
import { LoadingState } from "../components/LoadingState";
import { EmptyState } from "../components/EmptyState";
import { CopyButton } from "../components/CopyButton";

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

function toNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function pickNumber(source: unknown, keys: string[]): number | null {
  if (!source || typeof source !== "object") return null;
  const obj = source as Record<string, unknown>;
  for (const key of keys) {
    if (key in obj) {
      const n = toNumber(obj[key]);
      if (n !== null) return n;
    }
  }
  return null;
}

function fmtUsd(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 4 }).format(n);
}

export default function Costs() {
  const [days, setDays] = useState(14);
  const [tz, setTz] = useState<"utc" | "local">("utc");
  const [view, setView] = useState<"providers" | "jobs">("providers");

  // Budgets are stored in DB (via admin-costs endpoint). No ENV-based budgets.
  const [totalBudgetText, setTotalBudgetText] = useState<string>("");
  const [byProviderJson, setByProviderJson] = useState<string>("{}");
  const [budgetsDirty, setBudgetsDirty] = useState(false);
  const [budgetsError, setBudgetsError] = useState<string | null>(null);
  const [budgetsSaving, setBudgetsSaving] = useState(false);

  function formatProviderJson() {
    try {
      const obj = byProviderJson.trim() ? JSON.parse(byProviderJson) : {};
      setBudgetsError(null);
      setBudgetsDirty(true);
      setByProviderJson(JSON.stringify(obj, null, 2));
    } catch (e: any) {
      setBudgetsError(e?.message ?? String(e));
    }
  }

  function resetBudgetsFromServer() {
    if (!resp) return;
    const b: any = (resp as any)?.budgets ?? {};
    const total = b.total_daily_budget;
    setTotalBudgetText(total == null ? "" : String(total));
    const map = (b.by_provider_budget && typeof b.by_provider_budget === "object") ? b.by_provider_budget : {};
    setByProviderJson(JSON.stringify(map, null, 2));
    setBudgetsDirty(false);
    setBudgetsError(null);
  }

  const q = useQuery({ queryKey: ["costs", { days }], queryFn: () => getCosts({ days }) });
  const creditsQ = useQuery({ queryKey: ["openrouter-credits"], queryFn: () => getOpenRouterCredits() });

  const resp = q.data;

  useEffect(() => {
    if (!resp) return;
    if (budgetsDirty) return;
    const b: any = (resp as any)?.budgets ?? {};
    const total = b.total_daily_budget;
    setTotalBudgetText(total == null ? "" : String(total));
    const map = (b.by_provider_budget && typeof b.by_provider_budget === "object") ? b.by_provider_budget : {};
    setByProviderJson(JSON.stringify(map, null, 2));
  }, [resp, budgetsDirty]);

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

  const models = useMemo(() => {
    const raw: any = (resp as any)?.models;
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(Boolean)
      .filter((r: any) => typeof r.model === "string")
      .map((r: any) => ({
        provider: r.provider == null ? null : String(r.provider),
        model: String(r.model),
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

  const openrouterUsage = useMemo(() => {
    const raw: any = (resp as any)?.openrouter_usage;
    const daily = Array.isArray(raw?.daily)
      ? raw.daily
          .filter(Boolean)
          .filter((r: any) => typeof r.day === "string")
          .map((r: any) => ({
            day: String(r.day),
            tokens: Number.isFinite(Number(r.tokens)) ? Number(r.tokens) : 0,
            requests: Number.isFinite(Number(r.requests)) ? Number(r.requests) : 0,
            cost: Number.isFinite(Number(r.cost)) ? Number(r.cost) : 0,
          }))
      : [];
    const byUser = Array.isArray(raw?.by_user)
      ? raw.by_user
          .filter(Boolean)
          .map((r: any) => ({
            user_id: String(r.user_id ?? "unknown"),
            tokens: Number.isFinite(Number(r.tokens)) ? Number(r.tokens) : 0,
            requests: Number.isFinite(Number(r.requests)) ? Number(r.requests) : 0,
            cost: Number.isFinite(Number(r.cost)) ? Number(r.cost) : 0,
          }))
      : [];
    const byModel = Array.isArray(raw?.by_model)
      ? raw.by_model
          .filter(Boolean)
          .map((r: any) => ({
            provider: r.provider == null ? null : String(r.provider),
            model: String(r.model ?? "unknown"),
            tokens: Number.isFinite(Number(r.tokens)) ? Number(r.tokens) : 0,
            requests: Number.isFinite(Number(r.requests)) ? Number(r.requests) : 0,
            cost: Number.isFinite(Number(r.cost)) ? Number(r.cost) : 0,
          }))
      : [];
    return { daily, byUser, byModel };
  }, [resp]);

  const openrouterDailyChart = useMemo(() => {
    if (!openrouterUsage.daily.length) return [];
    return openrouterUsage.daily.map((r) => ({
      day: r.day,
      dayLabel: formatDay(r.day, tz),
      Tokens: r.tokens,
      Cost: r.cost,
      Requests: r.requests,
    }));
  }, [openrouterUsage.daily, tz]);

  const creditsSummary = useMemo(() => {
    const payload = (creditsQ.data as any)?.payload;
    if (!payload) return null;
    const source = payload?.data ?? payload;
    const balance = pickNumber(source, ["balance", "remaining", "credits", "available", "total_credits_remaining"]);
    const total = pickNumber(source, ["total", "total_credits", "total_credits_granted"]);
    const used = pickNumber(source, ["used", "spent", "total_credits_used"]);
    return {
      balance,
      total,
      used,
      raw: payload,
      fetchedAt: (creditsQ.data as any)?.fetched_at ?? null,
      baseUrl: (creditsQ.data as any)?.base_url ?? null,
    };
  }, [creditsQ.data]);

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

  const exportModelsCsv = () => {
    const header = ["provider", "model", "tokens", "runs", "errors", "last_started_at"].join(",");
    const lines = models.map((r) => [r.provider ?? "", JSON.stringify(r.model), r.tokens, r.runs, r.errors, r.last_started_at ?? ""].join(","));
    downloadText(`costs_models_${days}d.csv`, [header, ...lines].join("\n"), "text/csv");
  };

  if (q.isLoading) return <LoadingState />;
if (q.error) return <ErrorBox error={q.error} />;

  return (
    <div className="space-y-6">
      <Title>Costs</Title>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <StatCard
          title={`Total tokens (last ${days}d)`}
          value={fmtInt(totals.total)}
          subtitle={<span className="font-mono text-zinc-500">since: {resp?.since ?? "—"}</span>}
        />
        <StatCard
          title={`Today (${formatDay(today.day, "utc")})`}
          value={fmtInt(today.totalTokens)}
          subtitle={
            (resp as any)?.today?.total_budget == null
              ? <span className="text-zinc-500">No daily budget set.</span>
              : <span className="text-zinc-500">Remaining: <span className="font-mono">{fmtInt(Number((resp as any).today.total_remaining ?? 0))}</span></span>
          }
        />
        <StatCard
          title="Data quality"
          value={fmtInt(dataQuality.rows)}
          subtitle={<span><span className="font-mono">{fmtInt(dataQuality.rowsMissingTokens)}</span> rows missing total_tokens</span>}
        />
      </div>

      {alerts.length ? (
        <Card title="Alerts">
          <div className="space-y-2">
            {alerts.map((a, idx) => (
              <div key={idx} className={cn("rounded-xl border px-3 py-2 text-sm", a.kind === "warn" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-zinc-200 bg-zinc-50 text-zinc-700")}>
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
              <Input type="number" value={String(days)} min={3} max={60} onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") return;
                const n = Number(raw);
                if (!Number.isFinite(n)) return;
                const clamped = Math.max(3, Math.min(60, Math.trunc(n)));
                setDays(clamped);
              }} />
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

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" onClick={exportDailyCsv}>Export daily CSV</Button>
            <Button variant="ghost" onClick={exportDailyJobsCsv}>Export daily jobs CSV</Button>
            <Button variant="ghost" onClick={exportJobsCsv}>Export jobs CSV</Button>
            <Button variant="ghost" onClick={exportModelsCsv}>Export models CSV</Button>

            <Button
              variant="ghost"
              onClick={() => {
                setDays(14);
                setTz("utc");
                setView("providers");
              }}
            >
              Reset defaults
            </Button>

            <div className="flex items-center pl-2 text-xs text-zinc-500">
              Applied: last <span className="font-mono">{days}</span> days · labels <span className="font-mono">{tz}</span> · view <span className="font-mono">{view}</span>
            </div>
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
              <Th className="text-right">Budget</Th>
              <Th className="text-right">Remaining</Th>
            </tr>
          </thead>
          <tbody>
            {providers.length ? (
              providers.map((p) => {
                const used = Number(today.byProvider[p] ?? 0);
                const budget = (resp as any)?.today?.budget_by_provider?.[p] as number | null | undefined;
                const remaining = (resp as any)?.today?.remaining_by_provider?.[p] as number | null | undefined;
                return (
                  <tr key={p}>
                    <Td className="font-mono">{p}</Td>
                    <Td className="text-right font-mono">{fmtInt(used)}</Td>
                    <Td className="text-right font-mono">{budget == null ? "—" : fmtInt(Number(budget))}</Td>
                    <Td className="text-right font-mono">{remaining == null ? "—" : fmtInt(Number(remaining))}</Td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <Td colSpan={4} className="p-6"><EmptyState title="No cost data" message="No provider/model costs were returned for this period." className="border-0 bg-transparent p-0" /></Td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>

      <Card title="OpenRouter credits">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <StatCard title="Balance" value={fmtUsd(creditsSummary?.balance ?? null)} subtitle={<span className="text-xs text-zinc-500">Remaining credits</span>} />
          <StatCard title="Total" value={fmtUsd(creditsSummary?.total ?? null)} subtitle={<span className="text-xs text-zinc-500">Granted credits</span>} />
          <StatCard title="Used" value={fmtUsd(creditsSummary?.used ?? null)} subtitle={<span className="text-xs text-zinc-500">Consumed credits</span>} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
          <span>Base URL: <span className="font-mono">{creditsSummary?.baseUrl ?? "—"}</span></span>
          <span>Fetched: <span className="font-mono">{creditsSummary?.fetchedAt ?? "—"}</span></span>
          {!creditsSummary ? <span>No credits payload cached yet.</span> : null}
        </div>
      </Card>

      <Card title="OpenRouter usage trends">
        {openrouterDailyChart.length ? (
          <>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={openrouterDailyChart}>
                  <XAxis dataKey="dayLabel" />
                  <YAxis tickFormatter={(v) => fmtInt(Number(v))} />
                  <Tooltip formatter={(v: any, name: any) => name === "Cost" ? fmtUsd(Number(v)) : fmtInt(Number(v))} />
                  <Legend />
                  <Line type="monotone" dataKey="Tokens" dot={false} />
                  <Line type="monotone" dataKey="Cost" dot={false} />
                  <Line type="monotone" dataKey="Requests" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 text-xs text-zinc-500">
              Trends are based on <span className="font-mono">openrouter_request_log</span> entries for the last {days} days.
            </div>
          </>
        ) : (
          <EmptyState title="No OpenRouter usage" message="No OpenRouter request logs found for this range." className="border-0 bg-transparent p-0" />
        )}
      </Card>

      <Card title="Budgets">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <div className="mb-1 text-xs text-zinc-500">Total daily token budget (optional)</div>
            <Input
              type="number"
              value={totalBudgetText}
              placeholder="0"
              min={0}
              onChange={(e) => {
                setBudgetsError(null);
                setBudgetsDirty(true);
                setTotalBudgetText(e.target.value);
              }}
            />
            <div className="mt-1 text-xs text-zinc-500">If set, the dashboard will show “remaining” for today.</div>
          </div>
          <div>
            <div className="mb-1 text-xs text-zinc-500">Daily budgets by provider (JSON map)</div>
            <textarea
              value={byProviderJson}
              rows={6}
              onChange={(e) => {
                setBudgetsError(null);
                setBudgetsDirty(true);
                setByProviderJson(e.target.value);
              }}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 font-mono text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300"
              spellCheck={false}
            />
            <div className="mt-1 text-xs text-zinc-500">Keys must match <span className="font-mono">job_run_log.provider</span>.</div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            disabled={budgetsSaving || !budgetsDirty}
            onClick={async () => {
              setBudgetsError(null);
              setBudgetsSaving(true);
              try {
                const totalText = totalBudgetText.trim();
                let total: number | null = null;
                if (totalText !== "") {
                  const n = Number(totalText);
                  if (!Number.isFinite(n) || n < 0) throw new Error("Total daily budget must be a non-negative number");
                  total = Math.floor(n);
                }

                let parsed: any = {};
                try {
                  parsed = JSON.parse(byProviderJson || "{}");
                } catch {
                  throw new Error("Provider budget JSON is invalid");
                }
                if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
                  throw new Error("Provider budget JSON must be an object map");
                }

                const out: Record<string, number> = {};
                for (const [k, v] of Object.entries(parsed)) {
                  const n = Number(v);
                  if (!Number.isFinite(n) || n < 0) continue;
                  out[String(k)] = Math.floor(n);
                }

                await setCostsBudgets({ total_daily_budget: total, by_provider_budget: out });
                setBudgetsDirty(false);
                await q.refetch();
              } catch (e: any) {
                setBudgetsError(e?.message ?? String(e));
              } finally {
                setBudgetsSaving(false);
              }
            }}
          >
            {budgetsSaving ? "Saving…" : "Save budgets"}
          </Button>
          <Button variant="ghost" onClick={formatProviderJson}>Format JSON</Button>
          <CopyButton text={byProviderJson} label="Copy JSON" />
          <Button variant="ghost" onClick={resetBudgetsFromServer} disabled={!resp}>Reset</Button>
          <div className="text-xs text-zinc-500">Stored in DB (<span className="font-mono">admin_costs_settings</span>). No ENV vars.</div>
          {budgetsError ? <div className="text-xs text-red-600">{budgetsError}</div> : null}
        </div>
      </Card>

      <Card title="Per-model token costs (job runs)">
        <Table>
          <thead>
            <tr>
              <Th>Provider</Th>
              <Th>Model</Th>
              <Th className="text-right">Tokens</Th>
              <Th className="text-right">Runs</Th>
              <Th className="text-right">Errors</Th>
              <Th>Last run</Th>
            </tr>
          </thead>
          <tbody>
            {models.length ? (
              models.slice(0, 30).map((r) => (
                <tr key={`${r.provider ?? ""}|${r.model}`}>
                  <Td className="font-mono">{r.provider ?? "—"}</Td>
                  <Td className="font-mono">{r.model}</Td>
                  <Td className="text-right font-mono">{fmtInt(r.tokens)}</Td>
                  <Td className="text-right font-mono">{fmtInt(r.runs)}</Td>
                  <Td className="text-right font-mono">{fmtInt(r.errors)}</Td>
                  <Td className="font-mono">{fmtDateTime(r.last_started_at)}</Td>
                </tr>
              ))
            ) : (
              <tr><Td colSpan={6} className="text-zinc-500">No model-level data.</Td></tr>
            )}
          </tbody>
        </Table>
        <div className="mt-3 text-xs text-zinc-500">
          Token totals are sourced from <span className="font-mono">job_run_log</span> entries.
        </div>
      </Card>

      <Card title="OpenRouter usage by user">
        <Table>
          <thead>
            <tr>
              <Th>User</Th>
              <Th className="text-right">Tokens</Th>
              <Th className="text-right">Requests</Th>
              <Th className="text-right">Cost (USD)</Th>
            </tr>
          </thead>
          <tbody>
            {openrouterUsage.byUser.length ? (
              openrouterUsage.byUser.slice(0, 25).map((r) => (
                <tr key={r.user_id}>
                  <Td className="font-mono">{r.user_id}</Td>
                  <Td className="text-right font-mono">{fmtInt(r.tokens)}</Td>
                  <Td className="text-right font-mono">{fmtInt(r.requests)}</Td>
                  <Td className="text-right font-mono">{fmtUsd(r.cost)}</Td>
                </tr>
              ))
            ) : (
              <tr><Td colSpan={4} className="text-zinc-500">No OpenRouter user usage for this range.</Td></tr>
            )}
          </tbody>
        </Table>
      </Card>

      <Card title="OpenRouter usage by model">
        <Table>
          <thead>
            <tr>
              <Th>Provider</Th>
              <Th>Model</Th>
              <Th className="text-right">Tokens</Th>
              <Th className="text-right">Requests</Th>
              <Th className="text-right">Cost (USD)</Th>
            </tr>
          </thead>
          <tbody>
            {openrouterUsage.byModel.length ? (
              openrouterUsage.byModel.slice(0, 25).map((r) => (
                <tr key={`${r.provider ?? ""}|${r.model}`}>
                  <Td className="font-mono">{r.provider ?? "—"}</Td>
                  <Td className="font-mono">{r.model}</Td>
                  <Td className="text-right font-mono">{fmtInt(r.tokens)}</Td>
                  <Td className="text-right font-mono">{fmtInt(r.requests)}</Td>
                  <Td className="text-right font-mono">{fmtUsd(r.cost)}</Td>
                </tr>
              ))
            ) : (
              <tr><Td colSpan={5} className="text-zinc-500">No OpenRouter model usage for this range.</Td></tr>
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
