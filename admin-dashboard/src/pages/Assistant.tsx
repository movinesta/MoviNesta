import React, { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  getAssistantMetrics,
  getAssistantHealthSnapshot,
  getAssistantSettings,
  setAssistantSettings,
  testAssistantProvider,
  testAssistantRouting,
  getOpenRouterRequestLog,
  getOpenRouterEndpoints,
  type AssistantHealthSnapshot,
} from "../lib/api";
import type { OpenRouterRequestLogRow } from "../lib/types";
import { StatCard } from "../components/StatCard";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { CopyButton } from "../components/CopyButton";
import { HintIcon } from "../components/HintIcon";
import { SettingDetailDrawer } from "../components/SettingDetailDrawer";
import { Table, Th, Td } from "../components/Table";
import { fmtInt } from "../lib/ui";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { ErrorBox } from "../components/ErrorBox";
import { LoadingState } from "../components/LoadingState";
import { EmptyState } from "../components/EmptyState";
import { SETTING_HINTS, getSettingHint } from "../lib/settingsHints";

function Title(props: { children: React.ReactNode }) {
  return <div className="mb-4 text-xl font-semibold tracking-tight">{props.children}</div>;
}

function pct(x: number) {
  if (!isFinite(x)) return "0%";
  return `${Math.round(x * 100)}%`;
}

function fmtTs(ts?: string | null) {
  if (!ts) return "";
  const d = new Date(ts);
  if (!isFinite(d.getTime())) return String(ts);
  return d.toISOString().replace("T", " ").slice(0, 16);
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

type AnyJson = any;

const formatList = (value: AnyJson): string => (Array.isArray(value) ? value.join("\n") : "");

function isPlainObject(v: AnyJson): v is Record<string, AnyJson> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function deepCloneJson<T>(v: T): T {
  return v === undefined ? (v as T) : JSON.parse(JSON.stringify(v));
}

function getIn(obj: AnyJson, path: string[], fallback: AnyJson) {
  let cur: AnyJson = obj;
  for (const k of path) {
    if (!cur || typeof cur !== "object") return fallback;
    cur = (cur as AnyJson)[k];
  }
  return cur === undefined ? fallback : cur;
}

function setIn(obj: AnyJson, path: string[], value: AnyJson) {
  let cur: AnyJson = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const k = path[i];
    if (!cur[k] || typeof cur[k] !== "object") cur[k] = {};
    cur = cur[k];
  }
  cur[path[path.length - 1]] = value;
}

function previewValue(v: AnyJson): string {
  if (v === null) return "null";
  if (v === undefined) return "undefined";
  if (typeof v === "string") return v.length > 120 ? `${v.slice(0, 117)}…` : v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    const s = JSON.stringify(v);
    return s.length > 200 ? `${s.slice(0, 197)}…` : s;
  } catch {
    return String(v);
  }
}

function triBoolValue(v: AnyJson): "auto" | "on" | "off" {
  if (v === true) return "on";
  if (v === false) return "off";
  return "auto";
}

function triBoolToMaybe(v: string): boolean | undefined {
  if (v === "on") return true;
  if (v === "off") return false;
  return undefined;
}

function readRoutingMeta(meta: AnyJson): { routing: AnyJson | null; decision: AnyJson | null } {
  if (!isPlainObject(meta)) return { routing: null, decision: null };
  const routing = isPlainObject(meta.routing) ? meta.routing : null;
  const decision = isPlainObject(meta.decision) ? meta.decision : null;
  return { routing, decision };
}

function readZdrMeta(meta: AnyJson): AnyJson | null {
  if (!isPlainObject(meta)) return null;
  const routing = isPlainObject(meta.routing) ? meta.routing : null;
  const zdrFromRouting = routing && isPlainObject(routing.zdr) ? routing.zdr : null;
  if (zdrFromRouting) return zdrFromRouting;
  return isPlainObject(meta.zdr) ? meta.zdr : null;
}

type DiffRow = { path: string; a: AnyJson; b: AnyJson };

function diffJson(a: AnyJson, b: AnyJson, prefix = ""): DiffRow[] {
  if (a === b) return [];
  const aObj = isPlainObject(a);
  const bObj = isPlainObject(b);
  if (aObj && bObj) {
    const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)])).sort();
    const rows: DiffRow[] = [];
    for (const k of keys) {
      const p = prefix ? `${prefix}.${k}` : k;
      rows.push(...diffJson(a[k], b[k], p));
    }
    return rows;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    const as = JSON.stringify(a);
    const bs = JSON.stringify(b);
    return as === bs ? [] : [{ path: prefix || "(root)", a, b }];
  }
  return [{ path: prefix || "(root)", a, b }];
}

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
    behavior_json: string;
    params: Record<string, string>;
  } | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [showBehaviorDiff, setShowBehaviorDiff] = useState(false);
  const [showProactivityDiff, setShowProactivityDiff] = useState(false);

  // Provider test (admin-only) - helps debug OpenRouter connectivity/config.
  const [providerTestPrompt, setProviderTestPrompt] = useState<string>("Reply with exactly: OK");
  const [providerTestModelKey, setProviderTestModelKey] = useState<"fast" | "creative" | "planner" | "maker" | "critic">("fast");
  const [providerTestResult, setProviderTestResult] = useState<any>(null);
  const [providerTestError, setProviderTestError] = useState<string | null>(null);

  // Routing policy test
  const [routingTestPrompt, setRoutingTestPrompt] = useState<string>("Reply with exactly: OK");
  const [routingTestMode, setRoutingTestMode] = useState<"current" | "auto" | "fallback">("current");
  const [routingTestResult, setRoutingTestResult] = useState<any>(null);
  const [routingTestError, setRoutingTestError] = useState<string | null>(null);

  // Hint drawer (assistant settings)
  const [hintOpen, setHintOpen] = useState(false);
  const [hintKey, setHintKey] = useState<string | null>(null);

  // Recent AI provider error details drawer
  const [aiFailureOpen, setAiFailureOpen] = useState(false);
  type AiFailureRow = NonNullable<AssistantHealthSnapshot["recentAiFailures"]>[number];
  const [selectedAiFailure, setSelectedAiFailure] = useState<AiFailureRow | null>(null);

  // Routing request log details drawer
  const [routingLogSelectedId, setRoutingLogSelectedId] = useState<string | null>(null);
  const [routingLogLimit, setRoutingLogLimit] = useState<number>(50);
  const [routingLogRequestId, setRoutingLogRequestId] = useState<string>("");
  const [routingLogFn, setRoutingLogFn] = useState<string>("assistant-chat-reply");

  const closeAiFailureDrawer = () => {
    setAiFailureOpen(false);
    setSelectedAiFailure(null);
  };

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

  const routingLogQ = useQuery({
    queryKey: [
      "openrouter-request-log",
      { limit: routingLogLimit, requestId: routingLogRequestId, fn: routingLogFn },
    ],
    queryFn: () =>
      getOpenRouterRequestLog({
        limit: routingLogLimit,
        request_id: routingLogRequestId.trim() || null,
        fn: routingLogFn.trim() || null,
      }),
    enabled: tab === "diagnostics",
  });

  const endpointsQ = useQuery({
    queryKey: ["openrouter-endpoints", settingsForm?.openrouter_base_url ?? null],
    queryFn: () =>
      getOpenRouterEndpoints({
        base_url: settingsForm?.openrouter_base_url?.trim() || null,
      }),
    enabled: tab === "settings",
  });

  const saveSettings = useMutation({
    mutationFn: (payload: any) => setAssistantSettings(payload),
    onSuccess: () => {
      setSettingsInitialized(false);
      settingsQ.refetch();
    },
  });

  const runProviderTest = useMutation({
    mutationFn: (payload: { prompt?: string; model_key?: string }) => testAssistantProvider(payload),
    onSuccess: (resp) => {
      setProviderTestError(null);
      setProviderTestResult(resp);
    },
    onError: (err: any) => {
      setProviderTestResult(null);
      setProviderTestError(err?.message ?? "Provider test failed");
    },
  });

  const runRoutingTest = useMutation({
    mutationFn: (payload: { prompt?: string; mode?: "current" | "auto" | "fallback" }) => testAssistantRouting(payload),
    onSuccess: (resp) => {
      setRoutingTestError(null);
      setRoutingTestResult(resp);
    },
    onError: (err: any) => {
      setRoutingTestResult(null);
      setRoutingTestError(err?.message ?? "Routing test failed");
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
  const routingRows = (routingLogQ.data?.rows ?? []) as OpenRouterRequestLogRow[];
  const endpointsData = endpointsQ.data as any;
  const zdrEndpoints = Array.isArray(endpointsData?.zdr_endpoints) ? endpointsData.zdr_endpoints : [];
  const selectedRoutingRow = useMemo(
    () => routingRows.find((r) => String(r.id) === String(routingLogSelectedId)) ?? null,
    [routingRows, routingLogSelectedId],
  );
  const routingZdrSummary = useMemo(() => {
    let requested = 0;
    let used = 0;
    let sensitive = 0;
    let fallback = 0;

    for (const row of routingRows) {
      const zdr = readZdrMeta(row.meta as any);
      if (!zdr) continue;
      if (zdr.requested) requested += 1;
      if (zdr.used) used += 1;
      if (zdr.requested && !zdr.used) fallback += 1;
      if (zdr.sensitive) sensitive += 1;
    }

    return { requested, used, fallback, sensitive };
  }, [routingRows]);

  const defaultBehavior: AnyJson = defaultSettings?.behavior ?? {};
  const parsedBehavior = useMemo(() => {
    const raw = (settingsForm?.behavior_json ?? "").trim();
    if (!raw) return { ok: true as const, value: deepCloneJson(defaultBehavior) };
    try {
      const v = JSON.parse(raw);
      return { ok: true as const, value: v };
    } catch (e: any) {
      return { ok: false as const, value: deepCloneJson(defaultBehavior), error: String(e?.message ?? e) };
    }
  }, [settingsForm?.behavior_json, defaultBehavior]);

  const updateBehaviorJson = (mutate: (b: AnyJson) => void) => {
    setSettingsForm((prev) => {
      if (!prev) return prev;
      const raw = (prev.behavior_json ?? "").trim();
      let obj: AnyJson;
      try {
        obj = raw ? JSON.parse(raw) : deepCloneJson(defaultBehavior);
      } catch {
        // If behavior_json is invalid, avoid overwriting the user's edits.
        return prev;
      }
      const next = deepCloneJson(obj);
      mutate(next);
      return { ...prev, behavior_json: JSON.stringify(next, null, 2) };
    });
  };

  const resetBehaviorKeysToDefault = (keys: string[]) => {
    updateBehaviorJson((b) => {
      for (const k of keys) {
        b[k] = deepCloneJson((defaultBehavior ?? {})[k]);
      }
    });
  };

  const FIELD_ID_BY_KEY: Record<string, string> = {
    "assistant_settings.openrouter_base_url": "field-openrouter_base_url",
    "assistant_settings.default_instructions": "field-default_instructions",
    "assistant_settings.model_fast": "field-model_fast",
    "assistant_settings.model_creative": "field-model_creative",
    "assistant_settings.model_planner": "field-model_planner",
    "assistant_settings.model_maker": "field-model_maker",
    "assistant_settings.model_critic": "field-model_critic",
    "assistant_settings.fallback_models": "field-fallback_models",
    "assistant_settings.model_catalog": "field-model_catalog",
    "assistant_settings.params.timeout_ms": "field-param-timeout_ms",
    "behavior.diagnostics.user_error_detail": "field-behavior-user_error_detail",
    "behavior.diagnostics.user_error_show_culprit_var": "field-behavior-user_error_show_culprit_var",
    "behavior.diagnostics.user_error_show_culprit_value": "field-behavior-user_error_show_culprit_value",
    "behavior.diagnostics.user_error_show_status_model": "field-behavior-user_error_show_status_model",
    "behavior.diagnostics.user_error_show_trace_ids": "field-behavior-user_error_show_trace_ids",
    "behavior.router.zdr.enabled": "field-zdr-enabled",
    "behavior.router.zdr.mode": "field-zdr-mode",
    "behavior.router.zdr.allow_fallback": "field-zdr-allow-fallback",
    "behavior.router.zdr.base_url": "field-zdr-base-url",
    "assistant_settings.test_provider": "field-provider_test",
  };

  const scrollToSettingKey = (key: string) => {
    const id = FIELD_ID_BY_KEY[key];
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;
    try {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch {
      el.scrollIntoView();
    }
  };

  const openHint = (key: string, opts?: { scroll?: boolean }) => {
    setHintKey(key);
    setHintOpen(true);
    if (opts?.scroll) {
      // Ensure we're on the settings tab.
      setTab("settings");
      setTimeout(() => scrollToSettingKey(key), 50);
    }
  };

  const parseDraftParam = (key: string, raw: string): any => {
    const field = PARAM_FIELDS.find((f) => f.key === key);
    if (!field) return raw;
    if (field.type === "number") {
      const n = Number(raw);
      return raw === "" ? null : Number.isFinite(n) ? n : raw;
    }
    if (field.type === "boolean") {
      if (raw === "") return null;
      if (raw === "true") return true;
      if (raw === "false") return false;
      return raw;
    }
    if (field.type === "string-array") {
      return raw === "" ? [] : parseList(raw);
    }
    if (field.type === "json") {
      if (!raw.trim()) return null;
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    }
    return raw;
  };

  const getAssistantValueByKey = (key: string, which: "effective" | "draft" | "default"): any => {
    const eff = assistantSettings ?? {};
    const def = defaultSettings ?? {};
    const draft = settingsForm ?? ({} as any);

    // Assistant settings
    if (key.startsWith("assistant_settings.params.")) {
      const p = key.replace("assistant_settings.params.", "");
      if (which === "effective") return (eff as any)?.params?.[p];
      if (which === "default") return (def as any)?.params?.[p];
      return parseDraftParam(p, String((draft as any)?.params?.[p] ?? ""));
    }

    if (key.startsWith("assistant_settings.")) {
      const k = key.replace("assistant_settings.", "");
      if (k === "fallback_models" || k === "model_catalog") {
        if (which === "effective") return (eff as any)?.[k] ?? [];
        if (which === "default") return (def as any)?.[k] ?? [];
        return (draft as any)?.[k] ?? [];
      }
      if (which === "effective") return (eff as any)?.[k];
      if (which === "default") return (def as any)?.[k];
      return (draft as any)?.[k];
    }

    // Behavior settings
    if (key.startsWith("behavior.")) {
      const path = key.replace("behavior.", "").split(".");
      if (which === "effective") return getIn((eff as any)?.behavior ?? def?.behavior ?? {}, path, undefined);
      if (which === "default") return getIn(def?.behavior ?? {}, path, undefined);
      return getIn(parsedBehavior.value ?? {}, path, undefined);
    }

    return undefined;
  };

  const applyAssistantValueByKey = (key: string, value: any) => {
    if (!settingsForm) return;

    if (key.startsWith("assistant_settings.params.")) {
      const p = key.replace("assistant_settings.params.", "");
      setSettingsForm((prev) => {
        if (!prev) return prev;
        const field = PARAM_FIELDS.find((f) => f.key === p);
        let next = "";
        if (field?.type === "json") next = value === null || value === undefined ? "" : JSON.stringify(value, null, 2);
        else if (field?.type === "string-array") next = Array.isArray(value) ? value.join("\n") : String(value ?? "");
        else next = value === null || value === undefined ? "" : String(value);
        return { ...prev, params: { ...prev.params, [p]: next } };
      });
      return;
    }

    if (key.startsWith("assistant_settings.")) {
      const k = key.replace("assistant_settings.", "");
      setSettingsForm((prev) => (prev ? { ...prev, [k]: value } : prev));
      return;
    }

    if (key.startsWith("behavior.")) {
      const path = key.replace("behavior.", "").split(".");
      updateBehaviorJson((b) => setIn(b, path, value));
      return;
    }
  };

  const behaviorDiffRows = useMemo(
    () => diffJson(defaultBehavior ?? {}, parsedBehavior.value ?? {}),
    [defaultBehavior, parsedBehavior.value],
  );

  const proactivityDiffRows = useMemo(() => {
    const a = {
      rate_limit: (defaultBehavior ?? {}).rate_limit,
      orchestrator: (defaultBehavior ?? {}).orchestrator,
      router: (defaultBehavior ?? {}).router,
    };
    const b = {
      rate_limit: (parsedBehavior.value ?? {}).rate_limit,
      orchestrator: (parsedBehavior.value ?? {}).orchestrator,
      router: (parsedBehavior.value ?? {}).router,
    };
    return diffJson(a, b);
  }, [defaultBehavior, parsedBehavior.value]);

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
      behavior_json: JSON.stringify(assistantSettings?.behavior ?? defaultSettings?.behavior ?? {}, null, 2),
      params,
    });
    setSettingsInitialized(true);
  }, [assistantSettings, defaultSettings, settingsInitialized]);

  useEffect(() => {
    if (!routingLogSelectedId) return;
    if (!selectedRoutingRow) setRoutingLogSelectedId(null);
  }, [routingLogSelectedId, selectedRoutingRow]);

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

  const content = (() => {
    if (tab === "metrics") {
      if (metricsQ.isLoading) {
        return <LoadingState />;
      }
      if (metricsQ.isError) {
        return <ErrorBox error={metricsQ.error} />;
      }
      if (!data) {
        return <EmptyState title="No metrics yet" message="No assistant metrics were returned." />;
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
        return <LoadingState />;
      }
      if (healthQ.isError) {
        return <ErrorBox error={healthQ.error} />;
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


          <div className="mt-6">
            <Card>
              <div className="mb-2 text-sm font-semibold">Recent AI provider errors</div>
              <div className="text-xs text-zinc-500">
                Captures OpenRouter/provider issues even when we return a user-facing fallback message (jobs may still be "done").
              </div>
              <Table>
                <thead>
                  <tr>
                    <Th>When</Th>
                    <Th>Code</Th>
                    <Th>Culprit</Th>
                    <Th>Reason</Th>
                    <Th>Request</Th>
                  </tr>
                </thead>
                <tbody>
                  {(health?.recentAiFailures ?? []).map((r: any) => (
                    <tr
                      key={r.id}
                      className="border-t border-zinc-100 cursor-pointer hover:bg-zinc-50"
                      onClick={() => {
                        setSelectedAiFailure(r);
                        setAiFailureOpen(true);
                      }}
                    >
                      <Td>{fmtTs(r.createdAt)}</Td>
                      <Td className="font-mono text-xs">{r.code}</Td>
                      <Td className="font-mono text-xs" title={r.culprit?.value_preview ?? ""}>
                        {r.culprit?.var ?? "—"}
                      </Td>
                      <Td className="max-w-[520px] truncate" title={r.reason}>
                        {r.reason}
                      </Td>
                      <Td className="font-mono text-xs">{r.requestId ?? ""}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              {(health?.recentAiFailures ?? []).length === 0 ? (
                <div className="mt-2 text-xs text-zinc-500">No recent AI provider errors.</div>
              ) : null}
            </Card>
          </div>

          <div className="mt-6">
            <Card>
              <div className="mb-2 text-sm font-semibold">Routing decision log</div>
              <div className="text-xs text-zinc-500">
                Recent OpenRouter requests with routing policy details (per request ID).
              </div>

              <div className="mt-3 flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-500">Rows</span>
                  <input
                    type="number"
                    min={10}
                    max={200}
                    value={String(routingLogLimit)}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (!raw) return;
                      const n = Number(raw);
                      if (!Number.isFinite(n)) return;
                      setRoutingLogLimit(Math.max(10, Math.min(200, Math.trunc(n))));
                    }}
                    className="w-24 rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-500">Function</span>
                  <select
                    value={routingLogFn}
                    onChange={(e) => setRoutingLogFn(e.target.value)}
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                  >
                    <option value="">All</option>
                    <option value="assistant-chat-reply">assistant-chat-reply</option>
                    <option value="assistant-orchestrator">assistant-orchestrator</option>
                    <option value="admin-assistant-settings">admin-assistant-settings</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-500">Request ID</span>
                  <input
                    value={routingLogRequestId}
                    onChange={(e) => setRoutingLogRequestId(e.target.value)}
                    placeholder="req_..."
                    className="w-64 rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                  />
                </label>
                <Button
                  type="button"
                  variant="secondary"
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs"
                  onClick={() => routingLogQ.refetch()}
                >
                  Refresh
                </Button>
              </div>

              <div className="mt-2 text-xs text-zinc-500">
                ZDR coverage:{" "}
                <span className="font-mono">{routingZdrSummary.used}</span> /{" "}
                <span className="font-mono">{routingZdrSummary.requested}</span> requested
                {routingZdrSummary.fallback ? (
                  <>
                    {" "}
                    · fallback <span className="font-mono">{routingZdrSummary.fallback}</span>
                  </>
                ) : null}
                {routingZdrSummary.sensitive ? (
                  <>
                    {" "}
                    · sensitive <span className="font-mono">{routingZdrSummary.sensitive}</span>
                  </>
                ) : null}
              </div>

              {routingLogQ.isLoading ? (
                <div className="mt-3 text-xs text-zinc-500">Loading routing logs…</div>
              ) : routingLogQ.isError ? (
                <div className="mt-3">
                  <ErrorBox error={routingLogQ.error} />
                </div>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <Th>When</Th>
                      <Th>Request ID</Th>
                      <Th>Mode</Th>
                      <Th>Model</Th>
                      <Th>Variant</Th>
                      <Th>ZDR</Th>
                      <Th>Provider</Th>
                      <Th>Function</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {routingRows.length ? (
                      routingRows.map((r) => {
                        const { routing, decision } = readRoutingMeta(r.meta);
                        const mode = String(routing?.policy?.mode ?? "—");
                        const provider = String(decision?.provider ?? r.provider ?? "—");
                        const zdr = readZdrMeta(r.meta as any);
                        const zdrLabel = zdr?.used ? "used" : zdr?.requested ? "miss" : "—";
                        return (
                          <tr
                            key={r.id}
                            className="border-t border-zinc-100 cursor-pointer hover:bg-zinc-50"
                            onClick={() => setRoutingLogSelectedId(String(r.id))}
                          >
                            <Td>{fmtTs(r.created_at)}</Td>
                            <Td className="font-mono text-xs">{r.request_id ?? "—"}</Td>
                            <Td className="font-mono text-xs">{mode}</Td>
                            <Td className="font-mono text-xs">{r.model ?? "—"}</Td>
                            <Td className="font-mono text-xs">{r.variant ?? "—"}</Td>
                            <Td className="font-mono text-xs">{zdrLabel}</Td>
                            <Td className="font-mono text-xs">{provider}</Td>
                            <Td className="font-mono text-xs">{r.fn}</Td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <Td colSpan={8} className="p-6">
                          <EmptyState title="No routing logs" message="No OpenRouter request logs match this filter." className="border-0 bg-transparent p-0" />
                        </Td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              )}
            </Card>
          </div>
        </>
      );
    }

    return (
      <div className="mt-4">
        {settingsQ.isLoading || !settingsForm ? (
          <LoadingState />
        ) : settingsQ.isError ? (
          <ErrorBox error={settingsQ.error} />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <div id="field-openrouter_base_url" className="mb-2 flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold">OpenRouter base URL</div>
                  <HintIcon title="Details" onClick={() => openHint("assistant_settings.openrouter_base_url") } />
                </div>
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
                <div id="field-default_instructions" className="mb-2 flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold">Default instructions</div>
                  <HintIcon title="Details" onClick={() => openHint("assistant_settings.default_instructions") } />
                </div>
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

            <div className="mt-4">
              <Card>
                <div id="field-provider_test" className="mb-2 flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold">Provider test (OpenRouter)</div>
                  <HintIcon title="Details" onClick={() => openHint("assistant_settings.test_provider") } />
                </div>
                <div className="text-xs text-zinc-500">
                  Runs a tiny request using the current Assistant settings. This helps you see the exact failure reason
                  (and the culprit variable) before users hit the error.
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-5">
                  <label className="flex flex-col gap-1 md:col-span-1">
                    <span className="text-xs font-semibold text-zinc-600">Model role</span>
                    <select
                      value={providerTestModelKey}
                      onChange={(e) => setProviderTestModelKey(e.target.value as any)}
                      className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                    >
                      <option value="fast">Fast</option>
                      <option value="creative">Creative</option>
                      <option value="planner">Planner</option>
                      <option value="maker">Maker</option>
                      <option value="critic">Critic</option>
                    </select>
                  </label>

                  <label className="flex flex-col gap-1 md:col-span-3">
                    <span className="text-xs font-semibold text-zinc-600">Prompt</span>
                    <input
                      value={providerTestPrompt}
                      onChange={(e) => setProviderTestPrompt(e.target.value)}
                      placeholder="Reply with exactly: OK"
                      className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                    />
                  </label>

                  <div className="flex items-end md:col-span-1">
                    <Button
                      type="button"
                      className="w-full rounded-xl bg-zinc-900 px-4 py-2 text-sm text-white"
                      disabled={runProviderTest.isPending}
                      onClick={async () => {
                        setProviderTestError(null);
                        setProviderTestResult(null);
                        try {
                          await runProviderTest.mutateAsync({ prompt: providerTestPrompt, model_key: providerTestModelKey });
                        } catch {
                          // handled in onError
                        }
                      }}
                    >
                      {runProviderTest.isPending ? "Running…" : "Run test"}
                    </Button>
                  </div>
                </div>

                {providerTestError ? (
                  <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{providerTestError}</div>
                ) : null}

                {providerTestResult ? (
                  <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-zinc-900">
                        {providerTestResult?.test?.ok ? "✅ Test ok" : "⚠ Test failed"}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-xs text-zinc-500 font-mono">
                          {providerTestResult?.requestId ? `req ${providerTestResult.requestId}` : ""}
                        </div>
                        <CopyButton
                          label="Copy debug bundle"
                          className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs"
                          text={JSON.stringify(
                            {
                              requestId: providerTestResult?.requestId ?? null,
                              test: providerTestResult?.test ?? null,
                              selected: {
                                model_key: providerTestModelKey,
                                prompt: providerTestPrompt,
                                base_url: settingsForm?.openrouter_base_url ?? null,
                              },
                            },
                            null,
                            2,
                          )}
                        />
                      </div>
                    </div>

                    {providerTestResult?.test?.ok ? (
                      <div className="mt-2 text-sm text-zinc-700">
                        Used model: <span className="font-mono text-xs">{providerTestResult.test.usedModel ?? ""}</span>
                        {typeof providerTestResult.test.durationMs === "number" ? (
                          <span className="ml-2 text-xs text-zinc-500">({providerTestResult.test.durationMs}ms)</span>
                        ) : null}
                        {providerTestResult.test.contentPreview ? (
                          <div className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2 font-mono text-xs">{providerTestResult.test.contentPreview}</div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="mt-2 space-y-2">
                        <div className="text-sm text-zinc-800">{providerTestResult?.test?.userMessage ?? "Provider test failed."}</div>
                        {providerTestResult?.test?.envelope ? (
                          <div className="text-xs text-zinc-500">
                            Code: <span className="font-mono">{providerTestResult.test.envelope.code}</span>
                            {providerTestResult.test.culprit?.var ? (
                              <span className="ml-2">Culprit: <span className="font-mono">{providerTestResult.test.culprit.var}</span></span>
                            ) : null}
                            {providerTestResult.test.culprit?.var ? (
                              <Button
                                type="button"
                                variant="ghost"
                                className="ml-2 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[11px]"
                                onClick={() => openHint(String(providerTestResult.test.culprit.var), { scroll: true })}
                              >
                                Open culprit
                              </Button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                ) : null}
              </Card>
            </div>

            <div className="mt-4">
              <Card>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold">Routing policy test</div>
                </div>
                <div className="text-xs text-zinc-500">
                  Runs a tiny request using the current routing policy and captures the selected model/provider/variant.
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-5">
                  <label className="flex flex-col gap-1 md:col-span-1">
                    <span className="text-xs font-semibold text-zinc-600">Policy mode</span>
                    <select
                      value={routingTestMode}
                      onChange={(e) => setRoutingTestMode(e.target.value as any)}
                      className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                    >
                      <option value="current">Use saved policy</option>
                      <option value="auto">Force auto</option>
                      <option value="fallback">Force fallback</option>
                    </select>
                  </label>

                  <label className="flex flex-col gap-1 md:col-span-3">
                    <span className="text-xs font-semibold text-zinc-600">Prompt</span>
                    <input
                      value={routingTestPrompt}
                      onChange={(e) => setRoutingTestPrompt(e.target.value)}
                      placeholder="Reply with exactly: OK"
                      className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                    />
                  </label>

                  <div className="flex items-end md:col-span-1">
                    <Button
                      type="button"
                      className="w-full rounded-xl bg-zinc-900 px-4 py-2 text-sm text-white"
                      disabled={runRoutingTest.isPending}
                      onClick={async () => {
                        setRoutingTestError(null);
                        setRoutingTestResult(null);
                        try {
                          await runRoutingTest.mutateAsync({ prompt: routingTestPrompt, mode: routingTestMode });
                        } catch {
                          // handled in onError
                        }
                      }}
                    >
                      {runRoutingTest.isPending ? "Running…" : "Run test"}
                    </Button>
                  </div>
                </div>

                {routingTestError ? (
                  <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{routingTestError}</div>
                ) : null}

                {routingTestResult ? (
                  <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-zinc-900">
                        {routingTestResult?.test?.ok ? "✅ Test ok" : "⚠ Test failed"}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-xs text-zinc-500 font-mono">
                          {routingTestResult?.requestId ? `req ${routingTestResult.requestId}` : ""}
                        </div>
                        <CopyButton
                          label="Copy debug bundle"
                          className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs"
                          text={JSON.stringify(
                            {
                              requestId: routingTestResult?.requestId ?? null,
                              test: routingTestResult?.test ?? null,
                              selected: {
                                mode: routingTestMode,
                                prompt: routingTestPrompt,
                                base_url: settingsForm?.openrouter_base_url ?? null,
                              },
                            },
                            null,
                            2,
                          )}
                        />
                      </div>
                    </div>

                    {routingTestResult?.test?.ok ? (
                      <div className="mt-2 space-y-2 text-sm text-zinc-700">
                        <div>
                          Used model: <span className="font-mono text-xs">{routingTestResult.test.usedModel ?? ""}</span>
                          {typeof routingTestResult.test.durationMs === "number" ? (
                            <span className="ml-2 text-xs text-zinc-500">({routingTestResult.test.durationMs}ms)</span>
                          ) : null}
                        </div>
                        <div>
                          Provider: <span className="font-mono text-xs">{routingTestResult.test.usedProvider ?? "—"}</span>
                          <span className="ml-2 text-zinc-500">·</span>
                          <span className="ml-2 text-zinc-500">Variant:</span>{" "}
                          <span className="font-mono text-xs">{routingTestResult.test.usedVariant ?? "—"}</span>
                        </div>
                        {routingTestResult.test.contentPreview ? (
                          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-2 font-mono text-xs">
                            {routingTestResult.test.contentPreview}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="mt-2 space-y-2">
                        <div className="text-sm text-zinc-800">{routingTestResult?.test?.userMessage ?? "Routing test failed."}</div>
                        {routingTestResult?.test?.envelope ? (
                          <div className="text-xs text-zinc-500">
                            Code: <span className="font-mono">{routingTestResult.test.envelope.code}</span>
                            {routingTestResult.test.culprit?.var ? (
                              <span className="ml-2">Culprit: <span className="font-mono">{routingTestResult.test.culprit.var}</span></span>
                            ) : null}
                            {routingTestResult.test.culprit?.var ? (
                              <Button
                                type="button"
                                variant="ghost"
                                className="ml-2 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[11px]"
                                onClick={() => openHint(String(routingTestResult.test.culprit.var), { scroll: true })}
                              >
                                Open culprit
                              </Button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                ) : null}
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
                      <label key={field.key} id={`field-${field.key}`} className="flex flex-col gap-1 text-sm">
                        <span className="flex items-center justify-between gap-2 text-xs font-semibold text-zinc-600">
                          <span>{field.label}</span>
                          <HintIcon title="Details" onClick={() => openHint(`assistant_settings.${field.key}`)} />
                        </span>
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
                <div id="field-fallback_models" className="mb-2 flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold">Fallback models</div>
                  <HintIcon title="Details" onClick={() => openHint("assistant_settings.fallback_models")} />
                </div>
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
                <div id="field-model_catalog" className="mb-2 flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold">Model catalog</div>
                  <HintIcon title="Details" onClick={() => openHint("assistant_settings.model_catalog")} />
                </div>
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
                <div className="mb-2 text-sm font-semibold">Assistant behavior (prompts & chunking)</div>
                <div className="mb-2 text-xs text-zinc-500">
                  Stored in <span className="font-mono">assistant_settings.behavior</span>. Supports placeholders:
                  <span className="ml-1 font-mono">{"{{name}}"}</span>, <span className="font-mono">{"{{bioLine}}"}</span>,
                  <span className="font-mono">{"{{toolProtocol}}"}</span>.
                </div>

                {!parsedBehavior.ok ? (
                  <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Behavior JSON is invalid, so structured controls are disabled. Fix the JSON below to re-enable controls.
                  </div>
                ) : (
                  <div className="mb-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-semibold text-zinc-700">Behavior controls (safe knobs)</div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button variant="secondary"
                          type="button"
                          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs"
                          onClick={() =>
                            updateBehaviorJson((b) => {
                              b.rate_limit = deepCloneJson((defaultBehavior ?? {}).rate_limit);
                              b.orchestrator = deepCloneJson((defaultBehavior ?? {}).orchestrator);
                              setIn(
                                b,
                                ["router", "attribution"],
                                deepCloneJson(getIn(defaultBehavior ?? {}, ["router", "attribution"], {})),
                              );
                            })
                          }
                        >
                          Reset proactivity controls
                        </Button>

                        <Button variant="secondary"
                          type="button"
                          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs"
                          onClick={() => setShowProactivityDiff((v) => !v)}
                        >
                          {showProactivityDiff ? "Hide" : "Show"} proactivity diff
                        </Button>

                        <Button variant="secondary"
                          type="button"
                          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs"
                          onClick={() => setShowBehaviorDiff((v) => !v)}
                        >
                          {showBehaviorDiff ? "Hide" : "Show"} full diff
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="rounded-lg border border-zinc-200 bg-white p-3">
                        <div className="mb-2 text-[11px] font-semibold text-zinc-600">OpenRouter attribution</div>
                        <label className="flex flex-col gap-1">
                          <span className="text-[11px] text-zinc-500">HTTP-Referer</span>
                          <input
                            type="text"
                            value={String(getIn(parsedBehavior.value, ["router", "attribution", "http_referer"], ""))}
                            onChange={(e) =>
                              updateBehaviorJson((b) => setIn(b, ["router", "attribution", "http_referer"], e.target.value))
                            }
                            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                            placeholder={String(getIn(defaultBehavior, ["router", "attribution", "http_referer"], ""))}
                          />
                        </label>
                        <label className="mt-2 flex flex-col gap-1">
                          <span className="text-[11px] text-zinc-500">X-Title</span>
                          <input
                            type="text"
                            value={String(getIn(parsedBehavior.value, ["router", "attribution", "x_title"], ""))}
                            onChange={(e) => updateBehaviorJson((b) => setIn(b, ["router", "attribution", "x_title"], e.target.value))}
                            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                            placeholder={String(getIn(defaultBehavior, ["router", "attribution", "x_title"], ""))}
                          />
                        </label>
                      </div>

                      <div className="rounded-lg border border-zinc-200 bg-white p-3">
                        <div className="mb-2 text-[11px] font-semibold text-zinc-600">Chat reply rate limit</div>
                        <div className="grid grid-cols-2 gap-3">
                          <label className="flex flex-col gap-1">
                            <span className="text-[11px] text-zinc-500">Limit</span>
                            <input
                              type="number"
                              min={1}
                              max={100}
                              step={1}
                              value={String(getIn(parsedBehavior.value, ["rate_limit", "chat_reply", "limit"], ""))}
                              onChange={(e) => {
                                const raw = e.target.value;
                                updateBehaviorJson((b) => {
                                  const n = raw === "" ? undefined : Math.max(1, Math.min(100, Number(raw)));
                                  setIn(b, ["rate_limit", "chat_reply", "limit"], isFinite(Number(n)) ? n : undefined);
                                });
                              }}
                              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                              placeholder={String(getIn(defaultBehavior, ["rate_limit", "chat_reply", "limit"], 6))}
                            />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="text-[11px] text-zinc-500">Window (seconds)</span>
                            <input
                              type="number"
                              min={5}
                              max={3600}
                              step={1}
                              value={String(getIn(parsedBehavior.value, ["rate_limit", "chat_reply", "window_seconds"], ""))}
                              onChange={(e) => {
                                const raw = e.target.value;
                                updateBehaviorJson((b) => {
                                  const n = raw === "" ? undefined : Math.max(5, Math.min(3600, Number(raw)));
                                  setIn(b, ["rate_limit", "chat_reply", "window_seconds"], isFinite(Number(n)) ? n : undefined);
                                });
                              }}
                              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                              placeholder={String(getIn(defaultBehavior, ["rate_limit", "chat_reply", "window_seconds"], 60))}
                            />
                          </label>
                        </div>
                        <div className="mt-2 text-[11px] text-zinc-500">
                          Stored at <span className="font-mono">behavior.rate_limit.chat_reply</span>.
                        </div>
                      </div>

                      <div className="rounded-lg border border-zinc-200 bg-white p-3 md:col-span-2">
                        <div className="mb-2 flex items-center justify-between gap-2 text-[11px] font-semibold text-zinc-600">
                          <span>Zero Data Retention (ZDR) routing</span>
                          <HintIcon title="Details" onClick={() => openHint("behavior.router.zdr.enabled")} />
                        </div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                          <label id="field-zdr-enabled" className="flex items-center gap-2 text-xs text-zinc-700">
                            <input
                              type="checkbox"
                              checked={Boolean(getIn(parsedBehavior.value, ["router", "zdr", "enabled"], false))}
                              onChange={(e) => updateBehaviorJson((b) => setIn(b, ["router", "zdr", "enabled"], e.target.checked))}
                            />
                            <span>Enable ZDR routing</span>
                          </label>

                          <label id="field-zdr-mode" className="flex flex-col gap-1 text-xs text-zinc-700">
                            <span className="text-[11px] text-zinc-500">Mode</span>
                            <select
                              value={String(getIn(parsedBehavior.value, ["router", "zdr", "mode"], "sensitive_only"))}
                              onChange={(e) => updateBehaviorJson((b) => setIn(b, ["router", "zdr", "mode"], e.target.value))}
                              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                            >
                              <option value="sensitive_only">Sensitive only</option>
                              <option value="all">All requests</option>
                            </select>
                          </label>

                          <label id="field-zdr-allow-fallback" className="flex items-center gap-2 text-xs text-zinc-700">
                            <input
                              type="checkbox"
                              checked={Boolean(getIn(parsedBehavior.value, ["router", "zdr", "allow_fallback"], true))}
                              onChange={(e) =>
                                updateBehaviorJson((b) => setIn(b, ["router", "zdr", "allow_fallback"], e.target.checked))
                              }
                            />
                            <span>Allow fallback</span>
                          </label>

                          <label id="field-zdr-base-url" className="flex flex-col gap-1 text-xs text-zinc-700 md:col-span-2">
                            <span className="text-[11px] text-zinc-500">ZDR base URL override</span>
                            <input
                              type="text"
                              value={String(getIn(parsedBehavior.value, ["router", "zdr", "base_url"], ""))}
                              onChange={(e) => updateBehaviorJson((b) => setIn(b, ["router", "zdr", "base_url"], e.target.value))}
                              placeholder="Leave blank to use discovered ZDR endpoints"
                              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                            />
                          </label>
                        </div>

                        <div className="mt-3 text-xs text-zinc-500">
                          Uses cached OpenRouter endpoint discovery. Refresh the <span className="font-mono">openrouter-refresh</span> job to update.
                        </div>
                        {endpointsQ.isLoading ? (
                          <div className="mt-2 text-xs text-zinc-500">Loading ZDR endpoints…</div>
                        ) : endpointsQ.isError ? (
                          <div className="mt-2 text-xs text-red-600">Failed to load endpoints.</div>
                        ) : (
                          <div className="mt-2">
                            {zdrEndpoints.length ? (
                              <ul className="space-y-1 text-xs text-zinc-700">
                                {zdrEndpoints.map((endpoint: any) => (
                                  <li key={endpoint.base_url} className="flex flex-wrap gap-2">
                                    <span className="font-mono">{endpoint.base_url}</span>
                                    {endpoint.name ? <span className="text-zinc-500">({endpoint.name})</span> : null}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <div className="text-xs text-zinc-500">No ZDR endpoints found in cache.</div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="rounded-lg border border-zinc-200 bg-white p-3 md:col-span-2">
                        <div className="mb-2 text-[11px] font-semibold text-zinc-600">Routing policy</div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                          <label className="flex flex-col gap-1">
                            <span className="text-[11px] text-zinc-500">Mode</span>
                            <select
                              value={String(getIn(parsedBehavior.value, ["router", "policy", "mode"], "fallback"))}
                              onChange={(e) =>
                                updateBehaviorJson((b) => setIn(b, ["router", "policy", "mode"], e.target.value || "fallback"))
                              }
                              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                            >
                              <option value="fallback">Fallback</option>
                              <option value="auto">Auto</option>
                            </select>
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="text-[11px] text-zinc-500">Provider sort</span>
                            <select
                              value={String(getIn(parsedBehavior.value, ["router", "policy", "provider", "sort"], "price"))}
                              onChange={(e) =>
                                updateBehaviorJson((b) => setIn(b, ["router", "policy", "provider", "sort"], e.target.value || "price"))
                              }
                              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                            >
                              <option value="price">Price</option>
                              <option value="throughput">Throughput</option>
                              <option value="latency">Latency</option>
                            </select>
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="text-[11px] text-zinc-500">Allow provider fallbacks</span>
                            <select
                              value={String(getIn(parsedBehavior.value, ["router", "policy", "provider", "allow_fallbacks"], true))}
                              onChange={(e) =>
                                updateBehaviorJson((b) =>
                                  setIn(b, ["router", "policy", "provider", "allow_fallbacks"], e.target.value === "true"),
                                )
                              }
                              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                            >
                              <option value="true">True</option>
                              <option value="false">False</option>
                            </select>
                          </label>
                        </div>

                        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                          <label className="flex flex-col gap-1">
                            <span className="text-[11px] text-zinc-500">Auto model</span>
                            <input
                              type="text"
                              value={String(getIn(parsedBehavior.value, ["router", "policy", "auto_model"], ""))}
                              onChange={(e) =>
                                updateBehaviorJson((b) => setIn(b, ["router", "policy", "auto_model"], e.target.value))
                              }
                              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                              placeholder={String(getIn(defaultBehavior, ["router", "policy", "auto_model"], ""))}
                            />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="text-[11px] text-zinc-500">Fallback models (one per line)</span>
                            <textarea
                              value={formatList(getIn(parsedBehavior.value, ["router", "policy", "fallback_models"], []))}
                              onChange={(e) =>
                                updateBehaviorJson((b) =>
                                  setIn(b, ["router", "policy", "fallback_models"], parseList(e.target.value)),
                                )
                              }
                              className="h-24 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-mono"
                              placeholder={formatList(getIn(defaultBehavior, ["router", "policy", "fallback_models"], []))}
                            />
                          </label>
                        </div>

                        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                          <label className="flex flex-col gap-1">
                            <span className="text-[11px] text-zinc-500">Provider order (one per line)</span>
                            <textarea
                              value={formatList(getIn(parsedBehavior.value, ["router", "policy", "provider", "order"], []))}
                              onChange={(e) =>
                                updateBehaviorJson((b) => setIn(b, ["router", "policy", "provider", "order"], parseList(e.target.value)))
                              }
                              className="h-24 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-mono"
                              placeholder={formatList(getIn(defaultBehavior, ["router", "policy", "provider", "order"], []))}
                            />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="text-[11px] text-zinc-500">Provider require (one per line)</span>
                            <textarea
                              value={formatList(getIn(parsedBehavior.value, ["router", "policy", "provider", "require"], []))}
                              onChange={(e) =>
                                updateBehaviorJson((b) =>
                                  setIn(b, ["router", "policy", "provider", "require"], parseList(e.target.value)),
                                )
                              }
                              className="h-24 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-mono"
                              placeholder={formatList(getIn(defaultBehavior, ["router", "policy", "provider", "require"], []))}
                            />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="text-[11px] text-zinc-500">Provider allow (one per line)</span>
                            <textarea
                              value={formatList(getIn(parsedBehavior.value, ["router", "policy", "provider", "allow"], []))}
                              onChange={(e) =>
                                updateBehaviorJson((b) =>
                                  setIn(b, ["router", "policy", "provider", "allow"], parseList(e.target.value)),
                                )
                              }
                              className="h-24 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-mono"
                              placeholder={formatList(getIn(defaultBehavior, ["router", "policy", "provider", "allow"], []))}
                            />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="text-[11px] text-zinc-500">Provider ignore (one per line)</span>
                            <textarea
                              value={formatList(getIn(parsedBehavior.value, ["router", "policy", "provider", "ignore"], []))}
                              onChange={(e) =>
                                updateBehaviorJson((b) =>
                                  setIn(b, ["router", "policy", "provider", "ignore"], parseList(e.target.value)),
                                )
                              }
                              className="h-24 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-mono"
                              placeholder={formatList(getIn(defaultBehavior, ["router", "policy", "provider", "ignore"], []))}
                            />
                          </label>
                        </div>

                        <div className="mt-3">
                          <label className="flex flex-col gap-1">
                            <span className="text-[11px] text-zinc-500">Payload variants (one per line)</span>
                            <textarea
                              value={formatList(getIn(parsedBehavior.value, ["router", "policy", "variants"], []))}
                              onChange={(e) =>
                                updateBehaviorJson((b) => setIn(b, ["router", "policy", "variants"], parseList(e.target.value)))
                              }
                              className="h-24 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-mono"
                              placeholder={formatList(getIn(defaultBehavior, ["router", "policy", "variants"], []))}
                            />
                          </label>
                          <div className="mt-2 text-[11px] text-zinc-500">
                            Stored at <span className="font-mono">behavior.router.policy.*</span>.
                          </div>
                        </div>
                      </div>

                      <div className="rounded-lg border border-zinc-200 bg-white p-3">
                        <div className="mb-2 flex items-center justify-between gap-2 text-[11px] font-semibold text-zinc-600">
                          <div>User-facing AI error detail</div>
                          <HintIcon title="Details" onClick={() => openHint("behavior.diagnostics.user_error_detail", { scroll: false })} />
                        </div>

                        <label id="field-behavior-user_error_detail" className="flex flex-col gap-1">
                          <span className="flex items-center justify-between gap-2 text-[11px] text-zinc-500">
                            <span>Mode</span>
                            <HintIcon title="Details" onClick={() => openHint("behavior.diagnostics.user_error_detail")} />
                          </span>
                          <select
                            value={String(getIn(parsedBehavior.value, ["diagnostics", "user_error_detail"], "friendly"))}
                            onChange={(e) =>
                              updateBehaviorJson((b) =>
                                setIn(b, ["diagnostics", "user_error_detail"], e.target.value || "friendly"),
                              )
                            }
                            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                          >
                            <option value="friendly">Friendly (generic)</option>
                            <option value="code">Code (show error code)</option>
                            <option value="technical">Technical (cause + details)</option>
                          </select>
                        </label>

                        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                          <label id="field-behavior-user_error_show_culprit_var" className="flex flex-col gap-1">
                            <span className="flex items-center justify-between gap-2 text-[11px] text-zinc-500">
                              <span>Show culprit variable</span>
                              <HintIcon title="Details" onClick={() => openHint("behavior.diagnostics.user_error_show_culprit_var")} />
                            </span>
                            <select
                              value={triBoolValue(getIn(parsedBehavior.value, ["diagnostics", "user_error_show_culprit_var"], undefined))}
                              onChange={(e) =>
                                updateBehaviorJson((b) =>
                                  setIn(b, ["diagnostics", "user_error_show_culprit_var"], triBoolToMaybe(e.target.value)),
                                )
                              }
                              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                            >
                              <option value="auto">Auto (by mode)</option>
                              <option value="on">On</option>
                              <option value="off">Off</option>
                            </select>
                          </label>

                          <label id="field-behavior-user_error_show_culprit_value" className="flex flex-col gap-1">
                            <span className="flex items-center justify-between gap-2 text-[11px] text-zinc-500">
                              <span>Show culprit value preview</span>
                              <HintIcon title="Details" onClick={() => openHint("behavior.diagnostics.user_error_show_culprit_value")} />
                            </span>
                            <select
                              value={triBoolValue(getIn(parsedBehavior.value, ["diagnostics", "user_error_show_culprit_value"], undefined))}
                              onChange={(e) =>
                                updateBehaviorJson((b) =>
                                  setIn(b, ["diagnostics", "user_error_show_culprit_value"], triBoolToMaybe(e.target.value)),
                                )
                              }
                              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                            >
                              <option value="auto">Auto (by mode)</option>
                              <option value="on">On</option>
                              <option value="off">Off</option>
                            </select>
                          </label>

                          <label id="field-behavior-user_error_show_status_model" className="flex flex-col gap-1">
                            <span className="flex items-center justify-between gap-2 text-[11px] text-zinc-500">
                              <span>Show status / model</span>
                              <HintIcon title="Details" onClick={() => openHint("behavior.diagnostics.user_error_show_status_model")} />
                            </span>
                            <select
                              value={triBoolValue(getIn(parsedBehavior.value, ["diagnostics", "user_error_show_status_model"], undefined))}
                              onChange={(e) =>
                                updateBehaviorJson((b) =>
                                  setIn(b, ["diagnostics", "user_error_show_status_model"], triBoolToMaybe(e.target.value)),
                                )
                              }
                              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                            >
                              <option value="auto">Auto (by mode)</option>
                              <option value="on">On</option>
                              <option value="off">Off</option>
                            </select>
                          </label>

                          <label id="field-behavior-user_error_show_trace_ids" className="flex flex-col gap-1">
                            <span className="flex items-center justify-between gap-2 text-[11px] text-zinc-500">
                              <span>Show trace IDs (requestId, upstream)</span>
                              <HintIcon title="Details" onClick={() => openHint("behavior.diagnostics.user_error_show_trace_ids")} />
                            </span>
                            <select
                              value={triBoolValue(getIn(parsedBehavior.value, ["diagnostics", "user_error_show_trace_ids"], undefined))}
                              onChange={(e) =>
                                updateBehaviorJson((b) =>
                                  setIn(b, ["diagnostics", "user_error_show_trace_ids"], triBoolToMaybe(e.target.value)),
                                )
                              }
                              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                            >
                              <option value="auto">Auto (by mode)</option>
                              <option value="on">On</option>
                              <option value="off">Off</option>
                            </select>
                          </label>
                        </div>

                        <div className="mt-2 text-[11px] text-zinc-500">
                          Stored at <span className="font-mono">behavior.diagnostics.*</span>.
                        </div>
                      </div>

                    </div>

                    <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-3">
                      <div className="mb-2 text-[11px] font-semibold text-zinc-600">Orchestrator (proactive suggestions)</div>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                        <label className="flex flex-col gap-1">
                          <span className="text-[11px] text-zinc-500">Default verbosity</span>
                          <input
                            type="number"
                            min={0.1}
                            max={0.9}
                            step={0.05}
                            value={String(getIn(parsedBehavior.value, ["orchestrator", "default_verbosity"], ""))}
                            onChange={(e) => {
                              const raw = e.target.value;
                              updateBehaviorJson((b) => {
                                const n = raw === "" ? undefined : Math.max(0.1, Math.min(0.9, Number(raw)));
                                setIn(b, ["orchestrator", "default_verbosity"], isFinite(Number(n)) ? n : undefined);
                              });
                            }}
                            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                            placeholder={String(getIn(defaultBehavior, ["orchestrator", "default_verbosity"], 0.45))}
                          />
                        </label>

                        <label className="flex flex-col gap-1">
                          <span className="text-[11px] text-zinc-500">Default suggestions limit</span>
                          <input
                            type="number"
                            min={1}
                            max={6}
                            step={1}
                            value={String(getIn(parsedBehavior.value, ["orchestrator", "default_suggestions_limit"], ""))}
                            onChange={(e) => {
                              const raw = e.target.value;
                              updateBehaviorJson((b) => {
                                const n = raw === "" ? undefined : Math.max(1, Math.min(6, Number(raw)));
                                setIn(b, ["orchestrator", "default_suggestions_limit"], isFinite(Number(n)) ? n : undefined);
                              });
                            }}
                            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                            placeholder={String(getIn(defaultBehavior, ["orchestrator", "default_suggestions_limit"], 3))}
                          />
                        </label>

                        <label className="flex flex-col gap-1">
                          <span className="text-[11px] text-zinc-500">Max suggestions limit</span>
                          <input
                            type="number"
                            min={1}
                            max={6}
                            step={1}
                            value={String(getIn(parsedBehavior.value, ["orchestrator", "max_suggestions_limit"], ""))}
                            onChange={(e) => {
                              const raw = e.target.value;
                              updateBehaviorJson((b) => {
                                const n = raw === "" ? undefined : Math.max(1, Math.min(6, Number(raw)));
                                setIn(b, ["orchestrator", "max_suggestions_limit"], isFinite(Number(n)) ? n : undefined);
                              });
                            }}
                            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                            placeholder={String(getIn(defaultBehavior, ["orchestrator", "max_suggestions_limit"], 6))}
                          />
                        </label>

                        <label className="flex flex-col gap-1">
                          <span className="text-[11px] text-zinc-500">Daily cap (level2)</span>
                          <input
                            type="number"
                            min={0}
                            max={200}
                            step={1}
                            value={String(getIn(parsedBehavior.value, ["orchestrator", "daily_cap", "level2"], ""))}
                            onChange={(e) => {
                              const raw = e.target.value;
                              updateBehaviorJson((b) => {
                                const n = raw === "" ? undefined : Math.max(0, Math.min(200, Number(raw)));
                                setIn(b, ["orchestrator", "daily_cap", "level2"], isFinite(Number(n)) ? n : undefined);
                              });
                            }}
                            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                            placeholder={String(getIn(defaultBehavior, ["orchestrator", "daily_cap", "level2"], 20))}
                          />
                        </label>

                        <label className="flex flex-col gap-1">
                          <span className="text-[11px] text-zinc-500">Daily cap (level1)</span>
                          <input
                            type="number"
                            min={0}
                            max={200}
                            step={1}
                            value={String(getIn(parsedBehavior.value, ["orchestrator", "daily_cap", "level1"], ""))}
                            onChange={(e) => {
                              const raw = e.target.value;
                              updateBehaviorJson((b) => {
                                const n = raw === "" ? undefined : Math.max(0, Math.min(200, Number(raw)));
                                setIn(b, ["orchestrator", "daily_cap", "level1"], isFinite(Number(n)) ? n : undefined);
                              });
                            }}
                            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                            placeholder={String(getIn(defaultBehavior, ["orchestrator", "daily_cap", "level1"], 12))}
                          />
                        </label>

                        <label className="flex flex-col gap-1">
                          <span className="text-[11px] text-zinc-500">Daily cap (level0)</span>
                          <input
                            type="number"
                            min={0}
                            max={200}
                            step={1}
                            value={String(getIn(parsedBehavior.value, ["orchestrator", "daily_cap", "level0"], ""))}
                            onChange={(e) => {
                              const raw = e.target.value;
                              updateBehaviorJson((b) => {
                                const n = raw === "" ? undefined : Math.max(0, Math.min(200, Number(raw)));
                                setIn(b, ["orchestrator", "daily_cap", "level0"], isFinite(Number(n)) ? n : undefined);
                              });
                            }}
                            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                            placeholder={String(getIn(defaultBehavior, ["orchestrator", "daily_cap", "level0"], 0))}
                          />
                        </label>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                        {["home", "swipe", "messages", "search", "title", "diary", "default"].map((surface) => (
                          <label key={surface} className="flex flex-col gap-1">
                            <span className="text-[11px] text-zinc-500">TTL {surface} (min)</span>
                            <input
                              type="number"
                              min={1}
                              max={1440}
                              step={1}
                              value={String(getIn(parsedBehavior.value, ["orchestrator", "ttl_minutes", surface], ""))}
                              onChange={(e) => {
                                const raw = e.target.value;
                                updateBehaviorJson((b) => {
                                  const n = raw === "" ? undefined : Math.max(1, Math.min(1440, Number(raw)));
                                  setIn(b, ["orchestrator", "ttl_minutes", surface], isFinite(Number(n)) ? n : undefined);
                                });
                              }}
                              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                              placeholder={String(getIn(defaultBehavior, ["orchestrator", "ttl_minutes", surface], ""))}
                            />
                          </label>
                        ))}
                      </div>

                      <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                        <div className="mb-2 text-[11px] font-semibold text-zinc-600">Dismiss cooldown (minutes)</div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                          <div className="rounded-lg border border-zinc-200 bg-white p-3">
                            <div className="mb-2 text-[11px] font-semibold text-zinc-600">Level 2</div>
                            <div className="grid grid-cols-2 gap-3">
                              <label className="flex flex-col gap-1">
                                <span className="text-[11px] text-zinc-500">swipe</span>
                                <input
                                  type="number"
                                  min={0}
                                  max={240}
                                  step={1}
                                  value={String(getIn(parsedBehavior.value, ["orchestrator", "cooldown_minutes", "level2", "swipe"], ""))}
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    updateBehaviorJson((b) => {
                                      const n = raw === "" ? undefined : Math.max(0, Math.min(240, Number(raw)));
                                      setIn(b, ["orchestrator", "cooldown_minutes", "level2", "swipe"], isFinite(Number(n)) ? n : undefined);
                                    });
                                  }}
                                  className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                                  placeholder={String(getIn(defaultBehavior, ["orchestrator", "cooldown_minutes", "level2", "swipe"], ""))}
                                />
                              </label>
                              <label className="flex flex-col gap-1">
                                <span className="text-[11px] text-zinc-500">default</span>
                                <input
                                  type="number"
                                  min={0}
                                  max={240}
                                  step={1}
                                  value={String(getIn(parsedBehavior.value, ["orchestrator", "cooldown_minutes", "level2", "default"], ""))}
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    updateBehaviorJson((b) => {
                                      const n = raw === "" ? undefined : Math.max(0, Math.min(240, Number(raw)));
                                      setIn(b, ["orchestrator", "cooldown_minutes", "level2", "default"], isFinite(Number(n)) ? n : undefined);
                                    });
                                  }}
                                  className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                                  placeholder={String(getIn(defaultBehavior, ["orchestrator", "cooldown_minutes", "level2", "default"], ""))}
                                />
                              </label>
                            </div>
                          </div>

                          <div className="rounded-lg border border-zinc-200 bg-white p-3">
                            <div className="mb-2 text-[11px] font-semibold text-zinc-600">Level 1</div>
                            <div className="grid grid-cols-2 gap-3">
                              <label className="flex flex-col gap-1">
                                <span className="text-[11px] text-zinc-500">swipe</span>
                                <input
                                  type="number"
                                  min={0}
                                  max={240}
                                  step={1}
                                  value={String(getIn(parsedBehavior.value, ["orchestrator", "cooldown_minutes", "level1", "swipe"], ""))}
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    updateBehaviorJson((b) => {
                                      const n = raw === "" ? undefined : Math.max(0, Math.min(240, Number(raw)));
                                      setIn(b, ["orchestrator", "cooldown_minutes", "level1", "swipe"], isFinite(Number(n)) ? n : undefined);
                                    });
                                  }}
                                  className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                                  placeholder={String(getIn(defaultBehavior, ["orchestrator", "cooldown_minutes", "level1", "swipe"], ""))}
                                />
                              </label>
                              <label className="flex flex-col gap-1">
                                <span className="text-[11px] text-zinc-500">default</span>
                                <input
                                  type="number"
                                  min={0}
                                  max={240}
                                  step={1}
                                  value={String(getIn(parsedBehavior.value, ["orchestrator", "cooldown_minutes", "level1", "default"], ""))}
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    updateBehaviorJson((b) => {
                                      const n = raw === "" ? undefined : Math.max(0, Math.min(240, Number(raw)));
                                      setIn(b, ["orchestrator", "cooldown_minutes", "level1", "default"], isFinite(Number(n)) ? n : undefined);
                                    });
                                  }}
                                  className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                                  placeholder={String(getIn(defaultBehavior, ["orchestrator", "cooldown_minutes", "level1", "default"], ""))}
                                />
                              </label>
                            </div>
                          </div>

                          <div className="rounded-lg border border-zinc-200 bg-white p-3">
                            <div className="mb-2 text-[11px] font-semibold text-zinc-600">Level 0</div>
                            <label className="flex flex-col gap-1">
                              <span className="text-[11px] text-zinc-500">default</span>
                              <input
                                type="number"
                                min={0}
                                max={1440}
                                step={1}
                                value={String(getIn(parsedBehavior.value, ["orchestrator", "cooldown_minutes", "level0", "default"], ""))}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  updateBehaviorJson((b) => {
                                    const n = raw === "" ? undefined : Math.max(0, Math.min(1440, Number(raw)));
                                    setIn(b, ["orchestrator", "cooldown_minutes", "level0", "default"], isFinite(Number(n)) ? n : undefined);
                                  });
                                }}
                                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                                placeholder={String(getIn(defaultBehavior, ["orchestrator", "cooldown_minutes", "level0", "default"], ""))}
                              />
                            </label>
                          </div>
                        </div>

                        <div className="mt-2 text-[11px] text-zinc-500">
                          Stored at <span className="font-mono">behavior.orchestrator.cooldown_minutes</span>.
                        </div>
                      </div>
                    </div>

                    {showProactivityDiff ? (
                      <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-3">
                        <div className="mb-2 text-[11px] font-semibold text-zinc-700">
                          Proactivity diff vs defaults ({proactivityDiffRows.length})
                        </div>
                        {proactivityDiffRows.length ? (
                          <div className="max-h-64 overflow-auto">
                            <Table>
                              <thead>
                                <tr>
                                  <Th>Path</Th>
                                  <Th>Default</Th>
                                  <Th>Current</Th>
                                </tr>
                              </thead>
                              <tbody>
                                {proactivityDiffRows.slice(0, 80).map((r) => (
                                  <tr key={r.path}>
                                    <Td className="font-mono text-[11px]">{r.path}</Td>
                                    <Td className="text-[11px]">{previewValue(r.a)}</Td>
                                    <Td className="text-[11px]">{previewValue(r.b)}</Td>
                                  </tr>
                                ))}
                              </tbody>
                            </Table>
                          </div>
                        ) : (
                          <div className="text-xs text-zinc-500">No differences.</div>
                        )}
                        {proactivityDiffRows.length > 80 ? (
                          <div className="mt-2 text-[11px] text-zinc-500">Showing first 80 rows.</div>
                        ) : null}
                      </div>
                    ) : null}

                    {showBehaviorDiff ? (
                      <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-3">
                        <div className="mb-2 text-[11px] font-semibold text-zinc-700">
                          Full behavior diff vs defaults ({behaviorDiffRows.length})
                        </div>
                        {behaviorDiffRows.length ? (
                          <div className="max-h-64 overflow-auto">
                            <Table>
                              <thead>
                                <tr>
                                  <Th>Path</Th>
                                  <Th>Default</Th>
                                  <Th>Current</Th>
                                </tr>
                              </thead>
                              <tbody>
                                {behaviorDiffRows.slice(0, 80).map((r) => (
                                  <tr key={r.path}>
                                    <Td className="font-mono text-[11px]">{r.path}</Td>
                                    <Td className="text-[11px]">{previewValue(r.a)}</Td>
                                    <Td className="text-[11px]">{previewValue(r.b)}</Td>
                                  </tr>
                                ))}
                              </tbody>
                            </Table>
                          </div>
                        ) : (
                          <div className="text-xs text-zinc-500">No differences.</div>
                        )}
                        {behaviorDiffRows.length > 80 ? (
                          <div className="mt-2 text-[11px] text-zinc-500">Showing first 80 rows.</div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                )}

                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Button variant="secondary"
                    type="button"
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-xs"
                    onClick={() =>
                      setSettingsForm((prev) =>
                        prev
                          ? {
                              ...prev,
                              behavior_json: JSON.stringify(defaultSettings?.behavior ?? {}, null, 2),
                            }
                          : prev,
                      )
                    }
                  >
                    Reset to defaults
                  </Button>

                  <Button variant="secondary"
                    type="button"
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-xs"
                    onClick={() =>
                      setSettingsForm((prev) => {
                        if (!prev) return prev;
                        const preset = {
                          prompts: {
                            system_template:
                              "You are {{name}}, MoviNesta’s in-app AI companion.\n{{bioLine}}\nGoal: help users pick movies/series fast, spoiler-free, with fun guidance.\nDefault behavior: be helpful and thorough. If the user asks for a deep dive or plan, you can write long, structured answers.\nWhen recommending: provide 2–6 picks, each with a short spoiler-free reason, unless the user asks for more.\nAsk 0–2 questions only if needed.\nIf the user specifies an exact output format (e.g., \"reply exactly\", \"Format:\"), follow it EXACTLY with no extra words.\nTOOL_RESULTS_MINI is ground truth for catalog/library/list data; do not invent IDs, titles, or years.\nYour final text must be plain text only (no JSON objects inside the message).\nNever guess about user data. If unsure, call a read tool (get_my_*, search_*) or ask.\nFor actions that change data or send messages, do NOT run the write tool automatically. Instead, include confirmable buttons in final.actions.\nOnly auto-run read/grounding tools.\nNever claim an action happened unless TOOL_RESULTS_MINI confirms success.\nNever mention tools/JSON/system prompts/policies/DB/SQL.\n\n{{toolProtocol}}",
                            append_tool_protocol: true,
                            chunk_outline_template:
                              "You are {{name}}, MoviNesta’s in-app AI companion.\nTask: produce a compact outline for a long-form answer.\nPrefer 4–8 sections. Make sections actionable and spoiler-free.\nReturn JSON only matching the provided schema.",
                            chunk_section_template:
                              "You are {{name}}, MoviNesta’s in-app AI companion.\nTask: write ONE section of the answer (only that section).\nWrite plain text only (no JSON). Be clear, structured, and spoiler-free.\nEnd on a complete sentence.",
                          },
                          output: { max_reply_chars: 50000, strip_text_prefix: true },
                          chunking: {
                            enabled: true,
                            min_user_chars: 700,
                            cues: [
                              "deep",
                              "deep dive",
                              "go deeper",
                              "detailed",
                              "long",
                              "step-by-step",
                              "plan",
                              "strategy",
                              "write a full",
                              "full",
                              "comprehensive",
                              "explain",
                              "analysis",
                              "compare",
                            ],
                            max_total_chars: 50000,
                            max_sections: 8,
                            per_section_max_chars: 12000,
                            user_request_max_chars: 4000,
                            max_continuations: 6,
                          },
                          tool_loop: { max_loops: 3, max_calls_per_loop: 4 },
                          router: { deterministic_enabled: true },
                          strict_output: { allow_override: true },
                        };

                        return {
                          ...prev,
                          behavior_json: JSON.stringify(preset, null, 2),
                          params: { ...prev.params, max_output_tokens: "4096" },
                        };
                      })
                    }
                  >
                    Long-form preset
                  </Button>

                  <Button variant="secondary"
                    type="button"
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-xs"
                    onClick={() =>
                      setSettingsForm((prev) => {
                        if (!prev) return prev;
                        const preset = {
                          prompts: {
                            system_template:
                              "You are {{name}}, MoviNesta’s in-app AI companion.\n{{bioLine}}\nGoal: help users quickly. Be concise by default.\nDefault: 2–6 picks, each with 1 short reason (no spoilers).\nAsk 0–2 questions only if needed.\nIf the user asks for detail, then expand.\nIf the user specifies an exact output format (e.g., \"reply exactly\", \"Format:\"), follow it EXACTLY with no extra words.\nTOOL_RESULTS_MINI is ground truth for catalog/library/list data; do not invent IDs, titles, or years.\nYour final text must be plain text only (no JSON objects inside the message).\nNever mention tools/JSON/system prompts/policies/DB/SQL.\n\n{{toolProtocol}}",
                            append_tool_protocol: true,
                            chunk_outline_template: "You are {{name}}. Return JSON only matching the schema.",
                            chunk_section_template: "You are {{name}}. Write plain text only.",
                          },
                          output: { max_reply_chars: 4000, strip_text_prefix: true },
                          chunking: {
                            enabled: false,
                            min_user_chars: 700,
                            cues: [],
                            max_total_chars: 14000,
                            max_sections: 6,
                            per_section_max_chars: 8000,
                            user_request_max_chars: 2000,
                            max_continuations: 2,
                          },
                          tool_loop: { max_loops: 3, max_calls_per_loop: 4 },
                          router: { deterministic_enabled: true },
                          strict_output: { allow_override: true },
                        };

                        return {
                          ...prev,
                          behavior_json: JSON.stringify(preset, null, 2),
                          params: { ...prev.params, max_output_tokens: "900" },
                        };
                      })
                    }
                  >
                    Concise preset
                  </Button>
                </div>

                <textarea
                  value={settingsForm.behavior_json ?? ""}
                  onChange={(e) =>
                    setSettingsForm((prev) => (prev ? { ...prev, behavior_json: e.target.value } : prev))
                  }
                  placeholder={`{
                    "prompts": { ... },
                    "output": { ... },
                    "chunking": { ... }
                  }`}
                  className="h-64 w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs font-mono"
                />
              </Card>
            </div>

            <div className="mt-6">
              <Card>
                <div className="mb-2 text-sm font-semibold">Responses API parameters</div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {PARAM_FIELDS.map((field) => {
                    const value = settingsForm.params[field.key] ?? "";
                    const paramHintKey = `assistant_settings.params.${field.key}`;
                    const hasParamHint = !!SETTING_HINTS[paramHintKey];
                    if (field.type === "boolean") {
                      return (
                        <label key={field.key} id={`field-param-${field.key}`} className="flex flex-col gap-1 text-sm">
                          <span className="flex items-center justify-between gap-2 text-xs font-semibold text-zinc-600">
                            <span>{field.label}</span>
                            {hasParamHint ? (
                              <HintIcon title="Details" onClick={() => openHint(paramHintKey)} />
                            ) : null}
                          </span>
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
                        <label key={field.key} id={`field-param-${field.key}`} className="flex flex-col gap-1 text-sm">
                          <span className="flex items-center justify-between gap-2 text-xs font-semibold text-zinc-600">
                            <span>{field.label}</span>
                            {hasParamHint ? (
                              <HintIcon title="Details" onClick={() => openHint(paramHintKey)} />
                            ) : null}
                          </span>
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
                        <label key={field.key} id={`field-param-${field.key}`} className="flex flex-col gap-1 text-sm">
                          <span className="flex items-center justify-between gap-2 text-xs font-semibold text-zinc-600">
                            <span>{field.label}</span>
                            {hasParamHint ? (
                              <HintIcon title="Details" onClick={() => openHint(paramHintKey)} />
                            ) : null}
                          </span>
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
                      <label key={field.key} id={`field-param-${field.key}`} className="flex flex-col gap-1 text-sm">
                        <span className="flex items-center justify-between gap-2 text-xs font-semibold text-zinc-600">
                          <span>{field.label}</span>
                          {hasParamHint ? (
                            <HintIcon title="Details" onClick={() => openHint(paramHintKey)} />
                          ) : null}
                        </span>
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
                  <Button variant="ghost" type="button"
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

                      let behavior: Record<string, unknown> | null = null;
                      const braw = (settingsForm.behavior_json ?? "").trim();
                      if (braw) {
                        try {
                          behavior = JSON.parse(braw);
                        } catch {
                          setSettingsError("Invalid JSON for Behavior.");
                          return;
                        }
                      }

                      try {
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
                        behavior,
                      });
                      } catch (e: any) {
                        setSettingsError(e?.message ?? "Failed to save settings.");
                        return;
                      }
                    }}
                    className="rounded-xl bg-zinc-900 px-4 py-2 text-sm text-white"
                    disabled={saveSettings.isPending}
                  >
                    {saveSettings.isPending ? "Saving…" : "Save settings"}
                  </Button>
                  {saveSettings.isSuccess ? <span className="text-xs text-green-700">Saved.</span> : null}
                </div>
              </Card>
            </div>
          </>
        )}
      </div>
    );
  })();

  const hintResolved = hintKey ? getSettingHint(hintKey) : null;
  const hintEffectiveValue = hintKey ? getAssistantValueByKey(hintKey, "effective") : undefined;
  const hintDraftValue = hintKey ? getAssistantValueByKey(hintKey, "draft") : undefined;
  const hintDefaultValue = hintKey ? getAssistantValueByKey(hintKey, "default") : undefined;
  const hintStatus = (() => {
    if (!hintKey) return undefined;
    try {
      if (JSON.stringify(hintEffectiveValue) === JSON.stringify(hintDefaultValue)) return "default" as const;
      return "overridden" as const;
    } catch {
      return "overridden" as const;
    }
  })();

  const hintEntry = hintKey
    ? ({
        scope: "admin",
        default: hintDefaultValue,
        description: hintResolved?.details ?? "",
      } as any)
    : null;

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <Title>Assistant</Title>

        <div className="flex items-center gap-2">
          <Button variant="ghost" type="button"
            onClick={() => setTab("metrics")}
            className={`rounded-xl px-3 py-2 text-sm ${tab === "metrics" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-800"}`}
          >
            Metrics
          </Button>
          <Button variant="ghost" type="button"
            onClick={() => setTab("diagnostics")}
            className={`rounded-xl px-3 py-2 text-sm ${tab === "diagnostics" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-800"}`}
          >
            Diagnostics
          </Button>
          <Button variant="ghost" type="button"
            onClick={() => setTab("settings")}
            className={`rounded-xl px-3 py-2 text-sm ${tab === "settings" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-800"}`}
          >
            Settings
          </Button>

          {tab === "metrics" ? (
            <div className="ml-2 flex items-center gap-2">
              <Button variant="ghost" type="button"
                onClick={() => setDays(7)}
                className={`rounded-xl px-3 py-2 text-sm ${days === 7 ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-800"}`}
              >
                7d
              </Button>
              <Button variant="ghost" type="button"
                onClick={() => setDays(14)}
                className={`rounded-xl px-3 py-2 text-sm ${days === 14 ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-800"}`}
              >
                14d
              </Button>
              <Button variant="ghost" type="button"
                onClick={() => setDays(30)}
                className={`rounded-xl px-3 py-2 text-sm ${days === 30 ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-800"}`}
              >
                30d
              </Button>
            </div>
          ) : tab === "diagnostics" ? (
            <Button variant="ghost" type="button"
              onClick={() => healthQ.refetch()}
              className="ml-2 rounded-xl bg-zinc-100 px-3 py-2 text-sm text-zinc-800"
            >
              Refresh
            </Button>
          ) : null}
        </div>
      </div>

      {content}

      <SettingDetailDrawer
        open={hintOpen}
        settingKey={hintKey}
        entry={hintEntry}
        status={hintStatus}
        hint={hintResolved}
        effectiveValue={hintEffectiveValue}
        draftValue={hintDraftValue}
        recentHistory={null}
        onClose={() => setHintOpen(false)}
        onCopyKey={() => {
          if (!hintKey) return;
          navigator.clipboard?.writeText?.(hintKey).catch(() => void 0);
        }}
        onApplyValue={(v) => {
          if (!hintKey) return;
          applyAssistantValueByKey(hintKey, v);
        }}
        onNavigateToKey={(k) => openHint(k, { scroll: true })}
      />

      {aiFailureOpen && selectedAiFailure ? (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={closeAiFailureDrawer} />
          <div className="relative ml-auto h-full w-full max-w-[720px] overflow-auto bg-white shadow-xl">
            <div className="border-b border-zinc-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">AI provider error</div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {fmtTs(selectedAiFailure.createdAt)} · <span className="font-mono">{selectedAiFailure.code}</span>
                  </div>
                </div>
                <Button variant="ghost" type="button" className="rounded-lg border border-zinc-200 bg-white" onClick={closeAiFailureDrawer}>
                  Close
                </Button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              <div className="rounded-lg border border-zinc-200 p-3">
                <div className="text-xs font-semibold text-zinc-600">Summary</div>
                <div className="mt-1 text-sm text-zinc-800">{selectedAiFailure.reason}</div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-zinc-100 px-2 py-1 font-mono">{selectedAiFailure.requestId ?? ""}</span>
                  <span className="rounded-full bg-zinc-100 px-2 py-1 font-mono">{selectedAiFailure.conversationId ?? ""}</span>
                  <span className="rounded-full bg-zinc-100 px-2 py-1 font-mono">{selectedAiFailure.userId ?? ""}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <CopyButton
                    label="Copy debug JSON"
                    value={JSON.stringify(selectedAiFailure, null, 2)}
                    className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs"
                  />
                  {selectedAiFailure.culprit?.var ? (
                    <Button
                      variant="ghost"
                      type="button"
                      className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs"
                      onClick={() => openHint(String(selectedAiFailure.culprit.var), { scroll: true })}
                    >
                      Open culprit setting
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="rounded-lg border border-zinc-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-zinc-600">Culprit</div>
                  {selectedAiFailure.culprit?.var ? (
                    <span className="text-xs font-mono text-zinc-700">{selectedAiFailure.culprit.var}</span>
                  ) : (
                    <span className="text-xs text-zinc-400">—</span>
                  )}
                </div>
                <pre className="mt-2 overflow-auto rounded-lg bg-zinc-50 p-3 text-[11px] leading-snug text-zinc-800">
{JSON.stringify(selectedAiFailure.culprit ?? {}, null, 2)}
                </pre>
              </div>

              <div className="rounded-lg border border-zinc-200 p-3">
                <div className="text-xs font-semibold text-zinc-600">Context</div>
                <pre className="mt-2 overflow-auto rounded-lg bg-zinc-50 p-3 text-[11px] leading-snug text-zinc-800">
{JSON.stringify(selectedAiFailure.context ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <RoutingLogDetailsDrawer
        open={Boolean(selectedRoutingRow)}
        row={selectedRoutingRow}
        onClose={() => setRoutingLogSelectedId(null)}
      />

    </div>
  );
}

function RoutingLogDetailsDrawer(props: { open: boolean; row: OpenRouterRequestLogRow | null; onClose: () => void }) {
  useEffect(() => {
    if (!props.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props.open, props.onClose]);

  if (!props.open || !props.row) return null;

  const r = props.row;
  const { routing, decision } = readRoutingMeta(r.meta);
  const provider = String(decision?.provider ?? r.provider ?? "—");
  const metaText = (() => {
    try {
      return JSON.stringify(r.meta ?? {}, null, 2);
    } catch {
      return String(r.meta ?? "{}");
    }
  })();

  const routingText = (() => {
    try {
      return JSON.stringify(routing ?? {}, null, 2);
    } catch {
      return String(routing ?? "{}");
    }
  })();

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={props.onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-xl border-l border-zinc-200 bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold tracking-tight text-zinc-900">Routing request details</div>
            <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500 font-mono">
              <span>{r.request_id ?? r.id}</span>
              <CopyButton text={String(r.request_id ?? r.id)} label="Copy request id" className="h-8 px-2 py-1 text-xs" />
            </div>
          </div>
          <Button
            variant="ghost"
            type="button"
            className="rounded-xl px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100"
            onClick={props.onClose}
            aria-label="Close"
          >
            Close
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs font-medium text-zinc-500">When</div>
            <div className="text-zinc-700">{fmtTs(r.created_at)}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-zinc-500">Function</div>
            <div className="font-mono text-xs text-zinc-700">{r.fn}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-zinc-500">Model</div>
            <div className="font-mono text-xs text-zinc-700">{r.model ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-zinc-500">Variant</div>
            <div className="font-mono text-xs text-zinc-700">{r.variant ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-zinc-500">Provider</div>
            <div className="font-mono text-xs text-zinc-700">{provider}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-zinc-500">Upstream request</div>
            <div className="font-mono text-xs text-zinc-700">{r.upstream_request_id ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-zinc-500">Base URL</div>
            <div className="font-mono text-xs text-zinc-700">{r.base_url ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-zinc-500">Policy mode</div>
            <div className="font-mono text-xs text-zinc-700">{String(routing?.policy?.mode ?? "—")}</div>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-medium text-zinc-500">Routing policy</div>
            <CopyButton text={routingText} label="Copy routing JSON" className="h-8 px-2 py-1 text-xs" />
          </div>
          <pre className="mt-2 max-h-[24vh] overflow-auto rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700">
            {routingText}
          </pre>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-medium text-zinc-500">Meta</div>
            <CopyButton text={metaText} label="Copy JSON" className="h-8 px-2 py-1 text-xs" />
          </div>
          <pre className="mt-2 max-h-[24vh] overflow-auto rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700">
            {metaText}
          </pre>
        </div>
      </div>
    </div>
  );
}
