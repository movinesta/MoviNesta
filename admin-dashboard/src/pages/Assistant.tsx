import React, { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getAssistantMetrics, getAssistantHealthSnapshot, getAssistantSettings, setAssistantSettings } from "../lib/api";
import { StatCard } from "../components/StatCard";
import { Card } from "../components/Card";
import { Table, Th, Td } from "../components/Table";
import { fmtInt } from "../lib/ui";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

function Title(props: { children: React.ReactNode }) {
  return <div className="mb-4 text-xl font-semibold tracking-tight">{props.children}</div>;
}

function pct(x: number) {
  if (!isFinite(x)) return "0%";
  return `${Math.round(x * 100)}%`;
}

type ParamField =
  | { key: string; label: string; type: "number"; min?: number; max?: number; step?: number }
  | { key: string; label: string; type: "text" }
  | { key: string; label: string; type: "boolean" }
  | { key: string; label: string; type: "json" }
  | { key: string; label: string; type: "string-array" };

const PARAM_FIELDS: ParamField[] = [
  { key: "temperature", label: "Temperature", type: "number", min: 0, max: 2, step: 0.05 },
  { key: "top_p", label: "Top P", type: "number", min: 0, max: 1, step: 0.05 },
  { key: "max_output_tokens", label: "Max output tokens", type: "number", min: 1, max: 32768, step: 1 },
  { key: "presence_penalty", label: "Presence penalty", type: "number", min: -2, max: 2, step: 0.1 },
  { key: "frequency_penalty", label: "Frequency penalty", type: "number", min: -2, max: 2, step: 0.1 },
  { key: "seed", label: "Seed", type: "number", min: 0, max: 2000000000, step: 1 },
  { key: "stop", label: "Stop sequences", type: "string-array" },
  { key: "logprobs", label: "Logprobs", type: "boolean" },
  { key: "top_logprobs", label: "Top logprobs", type: "number", min: 0, max: 20, step: 1 },
  { key: "parallel_tool_calls", label: "Parallel tool calls", type: "boolean" },
  { key: "stream", label: "Stream", type: "boolean" },
  { key: "timeout_ms", label: "Timeout (ms)", type: "number", min: 1000, max: 120000, step: 1000 },
  { key: "user", label: "User", type: "text" },
  { key: "metadata", label: "Metadata (JSON)", type: "json" },
  { key: "tools", label: "Tools (JSON)", type: "json" },
  { key: "tool_choice", label: "Tool choice (JSON)", type: "json" },
  { key: "response_format", label: "Response format (JSON)", type: "json" },
  { key: "plugins", label: "Plugins (JSON)", type: "json" },
];

const parseList = (value: string) =>
  value
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean);

export default function Assistant() {
  const [tab, setTab] = useState<"metrics" | "diagnostics" | "settings">("metrics");
  const [days, setDays] = useState<number>(14);
  const [settingsInitialized, setSettingsInitialized] = useState(false);
  const [settingsForm, setSettingsForm] = useState<{
    openrouter_base_url: string;
    model_fast: string;
    model_creative: string;
    model_planner: string;
    model_maker: string;
    model_critic: string;
    fallback_models: string[];
    model_catalog: string[];
    default_instructions: string;
    params: Record<string, string>;
  } | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const metricsQ = useQuery({
    queryKey: ["assistant-metrics", days],
    queryFn: () => getAssistantMetrics({ days }),
    enabled: tab === "metrics",
  });

  const healthQ = useQuery({
    queryKey: ["assistant-health"],
    queryFn: () => getAssistantHealthSnapshot(),
    enabled: tab === "diagnostics",
    refetchInterval: 15000,
  });

  const settingsQ = useQuery({
    queryKey: ["assistant-settings"],
    queryFn: () => getAssistantSettings(),
    enabled: tab === "settings",
  });

  const saveSettings = useMutation({
    mutationFn: (payload: any) => setAssistantSettings(payload),
    onSuccess: () => {
      setSettingsInitialized(false);
      settingsQ.refetch();
    },
  });

  const data = metricsQ.data as any;

  const series = useMemo(() => (data?.series ?? []).map((r: any) => ({ ...r, day: String(r.day).slice(5) })), [data]);
  const triggerSeries = useMemo(
    () => (data?.trigger_series ?? []).map((r: any) => ({ ...r, day: String(r.day).slice(5) })),
    [data],
  );

  const bySurfaceKind = data?.by_surface_kind ?? [];
  const triggers = data?.triggers ?? [];

  const health = healthQ.data as any;
  const settingsData = settingsQ.data as any;
  const assistantSettings = settingsData?.assistant_settings;
  const defaultSettings = settingsData?.defaults?.settings;

  useEffect(() => {
    if (!assistantSettings || settingsInitialized) return;
    const coerce = (key: string) => {
      const raw = assistantSettings?.params?.[key] ?? defaultSettings?.params?.[key];
      if (raw === null || raw === undefined) return "";
      if (Array.isArray(raw)) return raw.join("\n");
      if (typeof raw === "object") return JSON.stringify(raw, null, 2);
      return String(raw);
    };

    const params: Record<string, string> = {};
    PARAM_FIELDS.forEach((field) => {
      params[field.key] = coerce(field.key);
    });

    setSettingsForm({
      openrouter_base_url: assistantSettings?.openrouter_base_url ?? "",
      model_fast: assistantSettings?.model_fast ?? "",
      model_creative: assistantSettings?.model_creative ?? "",
      model_planner: assistantSettings?.model_planner ?? "",
      model_maker: assistantSettings?.model_maker ?? "",
      model_critic: assistantSettings?.model_critic ?? "",
      fallback_models: assistantSettings?.fallback_models ?? [],
      model_catalog: assistantSettings?.model_catalog ?? defaultSettings?.model_catalog ?? [],
      default_instructions: assistantSettings?.default_instructions ?? "",
      params,
    });
    setSettingsInitialized(true);
  }, [assistantSettings, defaultSettings, settingsInitialized]);

  function fmtSec(s: number) {
    const sec = Math.max(0, Math.floor(Number(s) || 0));
    const m = Math.floor(sec / 60);
    const r = sec % 60;
    if (m <= 0) return `${r}s`;
    const h = Math.floor(m / 60);
    const mm = m % 60;
    if (h <= 0) return `${m}m ${r}s`;
    return `${h}h ${mm}m`;
  }

  function fmtTs(ts?: string | null) {
    if (!ts) return "";
    // Keep it compact: YYYY-MM-DD HH:MM
    const d = new Date(ts);
    if (!isFinite(d.getTime())) return String(ts);
    return d.toISOString().replace("T", " ").slice(0, 16);
  }

  const content = (() => {
    if (tab === "metrics") {
      if (metricsQ.isLoading) {
        return <div className="text-sm text-zinc-600">Loading…</div>;
      }
      if (metricsQ.isError) {
        return <div className="text-sm text-red-600">Failed to load.</div>;
      }
      return (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <StatCard title="Suggestions (created)" value={fmtInt(data?.totals?.created ?? 0)} />
            <StatCard title="Accepted" value={fmtInt(data?.totals?.accepted ?? 0)} />
            <StatCard title="Accept rate" value={pct(Number(data?.totals?.acceptRate ?? 0))} />
            <StatCard title="Tokens (est.)" value={fmtInt(data?.totals?.tokens ?? 0)} />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <div className="mb-2 text-sm font-semibold">Suggestions over time</div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={series}>
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="created" />
                    <Bar dataKey="accepted" />
                    <Bar dataKey="dismissed" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 text-xs text-zinc-500">
                If this chart stays empty, run the rollup once: call edge function <code>assistant-metrics-rollup</code>.
              </div>
            </Card>

            <Card>
              <div className="mb-2 text-sm font-semibold">Trigger fires over time</div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={triggerSeries}>
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Line dataKey="fires" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 text-xs text-zinc-500">Top triggers are shown below.</div>
            </Card>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <div className="mb-2 text-sm font-semibold">By surface + kind</div>
              <Table>
                <thead>
                  <tr>
                    <Th>Day</Th>
                    <Th>Surface</Th>
                    <Th>Kind</Th>
                    <Th className="text-right">Created</Th>
                    <Th className="text-right">Accepted</Th>
                    <Th className="text-right">Dismissed</Th>
                    <Th className="text-right">Rate</Th>
                  </tr>
                </thead>
                <tbody>
                  {bySurfaceKind.slice(0, 150).map((r: any, idx: number) => {
                    const created = Number(r.created_count ?? 0);
                    const accepted = Number(r.accepted_count ?? 0);
                    const rate = created ? accepted / created : 0;
                    return (
                      <tr key={idx} className="border-t border-zinc-100">
                        <Td>{String(r.day).slice(5)}</Td>
                        <Td>{r.surface}</Td>
                        <Td>{r.kind}</Td>
                        <Td className="text-right">{fmtInt(created)}</Td>
                        <Td className="text-right">{fmtInt(accepted)}</Td>
                        <Td className="text-right">{fmtInt(Number(r.dismissed_count ?? 0))}</Td>
                        <Td className="text-right">{pct(rate)}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </Card>

            <Card>
              <div className="mb-2 text-sm font-semibold">Top triggers</div>
              <Table>
                <thead>
                  <tr>
                    <Th>Trigger</Th>
                    <Th className="text-right">Fires</Th>
                    <Th className="text-right">Users</Th>
                  </tr>
                </thead>
                <tbody>
                  {triggers.map((r: any, idx: number) => (
                    <tr key={idx} className="border-t border-zinc-100">
                      <Td>{r.name}</Td>
                      <Td className="text-right">{fmtInt(Number(r.fires ?? 0))}</Td>
                      <Td className="text-right">{fmtInt(Number(r.unique_users ?? 0))}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>

              <div className="mt-3 text-xs text-zinc-500">
                Tip: You can disable noisy triggers by setting <code>assistant_triggers.enabled = false</code>.
              </div>
            </Card>
          </div>
        </>
      );
    }

    if (tab === "diagnostics") {
      if (healthQ.isLoading) {
        return <div className="text-sm text-zinc-600">Loading…</div>;
      }
      if (healthQ.isError) {
        return <div className="text-sm text-red-600">Failed to load.</div>;
      }
      return (
        <>
          <div className="mt-2 text-xs text-zinc-500">Snapshot: {fmtTs(health?.ts)}</div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
            <StatCard title="Pending" value={fmtInt(Number(health?.counts?.pending ?? 0))} />
            <StatCard title="Processing" value={fmtInt(Number(health?.counts?.processing ?? 0))} />
            <StatCard title="Failed" value={fmtInt(Number(health?.counts?.failed ?? 0))} />
            <StatCard title="Done" value={fmtInt(Number(health?.counts?.done ?? 0))} />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <div className="mb-2 text-sm font-semibold">Queue age</div>
              <div className="grid grid-cols-2 gap-3">
                <StatCard title="Oldest pending" value={fmtSec(Number(health?.oldestPendingSec ?? 0))} />
                <StatCard title="Oldest processing" value={fmtSec(Number(health?.oldestProcessingSec ?? 0))} />
              </div>
              <div className="mt-2 text-xs text-zinc-500">
                If queue age keeps growing, check runner health and rate limits.
              </div>
            </Card>

            <Card>
              <div className="mb-2 text-sm font-semibold">Last 24h</div>
              <div className="grid grid-cols-3 gap-3">
                <StatCard title="Created" value={fmtInt(Number(health?.last24h?.created ?? 0))} />
                <StatCard title="Done" value={fmtInt(Number(health?.last24h?.done ?? 0))} />
                <StatCard title="Failed" value={fmtInt(Number(health?.last24h?.failed ?? 0))} />
              </div>
            </Card>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <div className="mb-2 text-sm font-semibold">Jobs by kind</div>
              <Table>
                <thead>
                  <tr>
                    <Th>Kind</Th>
                    <Th className="text-right">Pending</Th>
                    <Th className="text-right">Processing</Th>
                    <Th className="text-right">Failed</Th>
                    <Th className="text-right">Done</Th>
                    <Th className="text-right">Total</Th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(health?.byKind ?? {}).map(([kind, v]: any) => (
                    <tr key={kind} className="border-t border-zinc-100">
                      <Td>{kind}</Td>
                      <Td className="text-right">{fmtInt(Number(v?.pending ?? 0))}</Td>
                      <Td className="text-right">{fmtInt(Number(v?.processing ?? 0))}</Td>
                      <Td className="text-right">{fmtInt(Number(v?.failed ?? 0))}</Td>
                      <Td className="text-right">{fmtInt(Number(v?.done ?? 0))}</Td>
                      <Td className="text-right">{fmtInt(Number(v?.total ?? 0))}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>

            <Card>
              <div className="mb-2 text-sm font-semibold">Recent cron invocations</div>
              <Table>
                <thead>
                  <tr>
                    <Th>When</Th>
                    <Th>Job</Th>
                    <Th>Request ID</Th>
                  </tr>
                </thead>
                <tbody>
                  {(health?.recentCron ?? []).map((r: any) => (
                    <tr key={r.id} className="border-t border-zinc-100">
                      <Td>{fmtTs(r.createdAt)}</Td>
                      <Td>{r.job}</Td>
                      <Td className="font-mono text-xs">{r.requestId ?? ""}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          </div>

          <div className="mt-6">
            <Card>
              <div className="mb-2 text-sm font-semibold">Recent failures</div>
              <Table>
                <thead>
                  <tr>
                    <Th>When</Th>
                    <Th>Kind</Th>
                    <Th>Conversation</Th>
                    <Th className="text-right">Attempts</Th>
                    <Th>Error</Th>
                  </tr>
                </thead>
                <tbody>
                  {(health?.recentFailures ?? []).map((r: any) => (
                    <tr key={r.id} className="border-t border-zinc-100">
                      <Td>{fmtTs(r.updatedAt)}</Td>
                      <Td>{r.jobKind}</Td>
                      <Td className="font-mono text-xs">{r.conversationId}</Td>
                      <Td className="text-right">{fmtInt(Number(r.attempts ?? 0))}</Td>
                      <Td className="max-w-[520px] truncate" title={r.lastError}>
                        {r.lastError}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              {(health?.recentFailures ?? []).length === 0 ? (
                <div className="mt-2 text-xs text-zinc-500">No recent failures.</div>
              ) : null}
            </Card>
          </div>
        </>
      );
    }

    return (
      <div className="mt-4">
        {settingsQ.isLoading || !settingsForm ? (
          <div className="text-sm text-zinc-600">Loading…</div>
        ) : settingsQ.isError ? (
          <div className="text-sm text-red-600">Failed to load settings.</div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <div className="mb-2 text-sm font-semibold">OpenRouter base URL</div>
                <input
                  value={settingsForm.openrouter_base_url}
                  onChange={(e) =>
                    setSettingsForm((prev) => (prev ? { ...prev, openrouter_base_url: e.target.value } : prev))
                  }
                  placeholder="https://openrouter.ai/api/v1"
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                />
                <div className="mt-2 text-xs text-zinc-500">Leave blank to use the environment default.</div>
              </Card>

              <Card>
                <div className="mb-2 text-sm font-semibold">Default instructions</div>
                <textarea
                  value={settingsForm.default_instructions}
                  onChange={(e) =>
                    setSettingsForm((prev) => (prev ? { ...prev, default_instructions: e.target.value } : prev))
                  }
                  placeholder="Optional system instructions applied to every call."
                  className="h-28 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                />
              </Card>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <div className="mb-2 text-sm font-semibold">Models (primary)</div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {[
                    { key: "model_fast", label: "Fast" },
                    { key: "model_creative", label: "Creative" },
                    { key: "model_planner", label: "Planner" },
                    { key: "model_maker", label: "Maker" },
                    { key: "model_critic", label: "Critic" },
                  ].map((field) => {
                    const options = Array.from(
                      new Set([...(settingsForm.model_catalog ?? []), (settingsForm as any)[field.key]].filter(Boolean)),
                    );
                    return (
                      <label key={field.key} className="flex flex-col gap-1 text-sm">
                        <span className="text-xs font-semibold text-zinc-600">{field.label}</span>
                        <select
                          value={(settingsForm as any)[field.key] ?? ""}
                          onChange={(e) =>
                            setSettingsForm((prev) => (prev ? { ...prev, [field.key]: e.target.value } : prev))
                          }
                          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                        >
                          <option value="">—</option>
                          {options.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </label>
                    );
                  })}
                </div>
              </Card>

              <Card>
                <div className="mb-2 text-sm font-semibold">Fallback models</div>
                <div className="grid grid-cols-1 gap-2 text-sm">
                  {Array.from(new Set([...(settingsForm.model_catalog ?? []), ...(settingsForm.fallback_models ?? [])])).map(
                    (model) => {
                      const checked = settingsForm.fallback_models.includes(model);
                      return (
                        <label key={model} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              setSettingsForm((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      fallback_models: e.target.checked
                                        ? Array.from(new Set([...prev.fallback_models, model]))
                                        : prev.fallback_models.filter((m) => m !== model),
                                    }
                                  : prev,
                              )
                            }
                          />
                          <span className="text-xs text-zinc-700">{model}</span>
                        </label>
                      );
                    },
                  )}
                </div>
                <div className="mt-2 text-xs text-zinc-500">These are used when the primary models fail.</div>
              </Card>
            </div>

            <div className="mt-6">
              <Card>
                <div className="mb-2 text-sm font-semibold">Model catalog</div>
                <textarea
                  value={(settingsForm.model_catalog ?? []).join("\n")}
                  onChange={(e) =>
                    setSettingsForm((prev) => (prev ? { ...prev, model_catalog: parseList(e.target.value) } : prev))
                  }
                  placeholder="One model per line"
                  className="h-40 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm font-mono"
                />
                <div className="mt-2 text-xs text-zinc-500">
                  This list powers the dropdowns and fallback checkboxes.
                </div>
              </Card>
            </div>

            <div className="mt-6">
              <Card>
                <div className="mb-2 text-sm font-semibold">Responses API parameters</div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {PARAM_FIELDS.map((field) => {
                    const value = settingsForm.params[field.key] ?? "";
                    if (field.type === "boolean") {
                      return (
                        <label key={field.key} className="flex flex-col gap-1 text-sm">
                          <span className="text-xs font-semibold text-zinc-600">{field.label}</span>
                          <select
                            value={value}
                            onChange={(e) =>
                              setSettingsForm((prev) =>
                                prev ? { ...prev, params: { ...prev.params, [field.key]: e.target.value } } : prev,
                              )
                            }
                            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                          >
                            <option value="">Unset</option>
                            <option value="true">true</option>
                            <option value="false">false</option>
                          </select>
                        </label>
                      );
                    }

                    if (field.type === "json") {
                      return (
                        <label key={field.key} className="flex flex-col gap-1 text-sm">
                          <span className="text-xs font-semibold text-zinc-600">{field.label}</span>
                          <textarea
                            value={value}
                            onChange={(e) =>
                              setSettingsForm((prev) =>
                                prev ? { ...prev, params: { ...prev.params, [field.key]: e.target.value } } : prev,
                              )
                            }
                            placeholder="{}"
                            className="h-28 w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs font-mono"
                          />
                        </label>
                      );
                    }

                    if (field.type === "string-array") {
                      return (
                        <label key={field.key} className="flex flex-col gap-1 text-sm">
                          <span className="text-xs font-semibold text-zinc-600">{field.label}</span>
                          <textarea
                            value={value}
                            onChange={(e) =>
                              setSettingsForm((prev) =>
                                prev ? { ...prev, params: { ...prev.params, [field.key]: e.target.value } } : prev,
                              )
                            }
                            placeholder="One per line"
                            className="h-28 w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs font-mono"
                          />
                        </label>
                      );
                    }

                    return (
                      <label key={field.key} className="flex flex-col gap-1 text-sm">
                        <span className="text-xs font-semibold text-zinc-600">{field.label}</span>
                        {field.type === "number" ? (
                          <input
                            type="number"
                            min={field.min}
                            max={field.max}
                            step={field.step}
                            value={value}
                            onChange={(e) =>
                              setSettingsForm((prev) =>
                                prev ? { ...prev, params: { ...prev.params, [field.key]: e.target.value } } : prev,
                              )
                            }
                            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                          />
                        ) : (
                          <input
                            type="text"
                            value={value}
                            onChange={(e) =>
                              setSettingsForm((prev) =>
                                prev ? { ...prev, params: { ...prev.params, [field.key]: e.target.value } } : prev,
                              )
                            }
                            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                          />
                        )}
                      </label>
                    );
                  })}
                </div>

                {settingsError ? (
                  <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {settingsError}
                  </div>
                ) : null}

                <div className="mt-4 flex items-center gap-3">
                  <button
                    onClick={async () => {
                      if (!settingsForm) return;
                      setSettingsError(null);
                      const params: Record<string, unknown> = {};

                      for (const field of PARAM_FIELDS) {
                        const raw = settingsForm.params[field.key] ?? "";
                        if (field.type === "number") {
                          const val = raw.trim();
                          params[field.key] = val ? Number(val) : null;
                        } else if (field.type === "boolean") {
                          if (raw === "true") params[field.key] = true;
                          else if (raw === "false") params[field.key] = false;
                          else params[field.key] = null;
                        } else if (field.type === "json") {
                          const val = raw.trim();
                          if (!val) {
                            params[field.key] = null;
                          } else {
                            try {
                              params[field.key] = JSON.parse(val);
                            } catch (err: any) {
                              setSettingsError(`Invalid JSON for ${field.label}.`);
                              return;
                            }
                          }
                        } else if (field.type === "string-array") {
                          params[field.key] = raw.trim() ? parseList(raw) : null;
                        } else {
                          params[field.key] = raw.trim() ? raw : null;
                        }
                      }

                      await saveSettings.mutateAsync({
                        openrouter_base_url: settingsForm.openrouter_base_url.trim() || null,
                        model_fast: settingsForm.model_fast.trim() || null,
                        model_creative: settingsForm.model_creative.trim() || null,
                        model_planner: settingsForm.model_planner.trim() || null,
                        model_maker: settingsForm.model_maker.trim() || null,
                        model_critic: settingsForm.model_critic.trim() || null,
                        fallback_models: settingsForm.fallback_models,
                        model_catalog: settingsForm.model_catalog,
                        default_instructions: settingsForm.default_instructions.trim() || null,
                        params,
                      });
                    }}
                    className="rounded-xl bg-zinc-900 px-4 py-2 text-sm text-white"
                    disabled={saveSettings.isPending}
                  >
                    {saveSettings.isPending ? "Saving…" : "Save settings"}
                  </button>
                  {saveSettings.isSuccess ? <span className="text-xs text-green-700">Saved.</span> : null}
                </div>
              </Card>
            </div>
          </>
        )}
      </div>
    );
  })();

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <Title>Assistant</Title>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setTab("metrics")}
            className={`rounded-xl px-3 py-2 text-sm ${tab === "metrics" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-800"}`}
          >
            Metrics
          </button>
          <button
            onClick={() => setTab("diagnostics")}
            className={`rounded-xl px-3 py-2 text-sm ${tab === "diagnostics" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-800"}`}
          >
            Diagnostics
          </button>
          <button
            onClick={() => setTab("settings")}
            className={`rounded-xl px-3 py-2 text-sm ${tab === "settings" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-800"}`}
          >
            Settings
          </button>

          {tab === "metrics" ? (
            <div className="ml-2 flex items-center gap-2">
              <button
                onClick={() => setDays(7)}
                className={`rounded-xl px-3 py-2 text-sm ${days === 7 ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-800"}`}
              >
                7d
              </button>
              <button
                onClick={() => setDays(14)}
                className={`rounded-xl px-3 py-2 text-sm ${days === 14 ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-800"}`}
              >
                14d
              </button>
              <button
                onClick={() => setDays(30)}
                className={`rounded-xl px-3 py-2 text-sm ${days === 30 ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-800"}`}
              >
                30d
              </button>
            </div>
          ) : tab === "diagnostics" ? (
            <button
              onClick={() => healthQ.refetch()}
              className="ml-2 rounded-xl bg-zinc-100 px-3 py-2 text-sm text-zinc-800"
            >
              Refresh
            </button>
          ) : null}
        </div>
      </div>

      {content}

    </div>
  );
}
