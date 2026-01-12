import React, { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getCosts,
  getOpenRouterCredits,
  getOpenRouterKey,
  getOpenRouterModels,
  getOpenRouterEndpoints,
  getOpenRouterParameters,
  refreshOpenRouterParameters,
  setCostsBudgets,
  getAssistantSettings,
} from "../lib/api";
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


function fmtUptime(u: number | null | undefined) {
  if (u == null || !Number.isFinite(u)) return "—";
  // OpenRouter uptime_last_30m is typically 0..1
  const p = u <= 1.5 ? u * 100 : u;
  return `${p.toFixed(p < 99.95 ? 2 : 3)}%`;
}

function fmtLatencySeconds(s: number | null | undefined) {
  if (s == null || !Number.isFinite(s)) return "—";
  if (s < 1) return `${(s * 1000).toFixed(0)}ms`;
  if (s < 10) return `${s.toFixed(2)}s`;
  return `${s.toFixed(1)}s`;
}

function fmtThroughput(tps: number | null | undefined) {
  if (tps == null || !Number.isFinite(tps)) return "—";
  if (tps < 10) return `${tps.toFixed(2)} tok/s`;
  if (tps < 100) return `${tps.toFixed(1)} tok/s`;
  return `${Math.round(tps)} tok/s`;
}


function parseCsvList(input: string): string[] {
  const parts = String(input ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const k = p.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
  }
  return out;
}


function extractSupportedParams(payload: any): Set<string> {
  const set = new Set<string>();
  if (!payload) return set;

  const maybe = (payload as any).supported_parameters ?? (payload as any).supported ?? (payload as any).parameters ?? null;
  const collect = (v: any) => {
    if (!v) return;
    if (Array.isArray(v)) {
      for (const item of v) {
        const s = String(item ?? "").trim();
        if (s) set.add(s);
      }
      return;
    }
    if (typeof v === "object") {
      for (const k of Object.keys(v)) {
        const s = String(k ?? "").trim();
        if (s) set.add(s);
      }
    }
  };

  collect(maybe);
  collect((payload as any).data?.supported_parameters);
  collect((payload as any).data?.parameters);
  collect((payload as any).data?.supported);

  return set;
}

function toSnakeCase(key: string): string {
  // Best-effort camelCase -> snake_case.
  return key.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

function getParamAliases(key: string): string[] {
  const k = key.trim();
  const snake = toSnakeCase(k);

  // Keep this list conservative: only map the few parameter name variants that commonly differ
  // between OpenAI-style APIs and OpenRouter / provider conventions.
  const aliases: Record<string, string[]> = {
    // Token limits
    max_output_tokens: ["max_tokens"],
    max_tokens: ["max_output_tokens"],

    // Stops
    stop_sequences: ["stop"],
    stop: ["stop_sequences"],

    // Logprobs naming differences
    top_logprobs: ["logprobs"],
    logprobs: ["top_logprobs"],

    // Common camelCase variants
    ...(snake !== k ? { [k]: [snake], [snake]: [k] } : {}),
  };

  return aliases[k] ?? aliases[snake] ?? (snake !== k ? [snake] : []);
}

function isSupportedParam(key: string, supported: Set<string>): boolean {
  if (!supported || supported.size === 0) return false;

  const supportedLower = new Set(Array.from(supported).map((s) => String(s).trim().toLowerCase()));
  const k = String(key ?? "").trim();
  const kl = k.toLowerCase();
  if (supportedLower.has(kl)) return true;

  for (const a of getParamAliases(k)) {
    const al = String(a ?? "").trim().toLowerCase();
    if (!al) continue;
    if (supportedLower.has(al)) return true;
  }

  return false;
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
  const keyQ = useQuery({ queryKey: ["openrouter-key"], queryFn: () => getOpenRouterKey(), refetchInterval: 60_000 });

  const assistantSettingsQ = useQuery({ queryKey: ["assistant-settings"], queryFn: () => getAssistantSettings(), staleTime: 60_000 });

  const modelsQ = useQuery({ queryKey: ["openrouter-models"], queryFn: () => getOpenRouterModels(), staleTime: 5 * 60_000 });

  const endpointsQ = useQuery({ queryKey: ["openrouter-endpoints"], queryFn: () => getOpenRouterEndpoints(), staleTime: 5 * 60_000 });

  const [paramModel, setParamModel] = useState<string>("");
  const [paramProvider, setParamProvider] = useState<string>("");
  const [paramBaseUrl, setParamBaseUrl] = useState<string>("");

  const [endpointsModel, setEndpointsModel] = useState<string>("");
  const [endpointsProvider, setEndpointsProvider] = useState<string>("");
  const [endpointsShowPerf, setEndpointsShowPerf] = useState(true);
  const [endpointsShowProviderName, setEndpointsShowProviderName] = useState(true);
  const [endpointsShowQuant, setEndpointsShowQuant] = useState(true);
  const [endpointsShowParams, setEndpointsShowParams] = useState(false);

  // Provider routing simulator (uses cached endpoints)
  const [routeModel, setRouteModel] = useState<string>('');
  const [routeOnlyProviders, setRouteOnlyProviders] = useState<string>('');
  const [routeIgnoreProviders, setRouteIgnoreProviders] = useState<string>('');
  const [routeQuantizations, setRouteQuantizations] = useState<string>('');
  const [routeDataCollection, setRouteDataCollection] = useState<'any' | 'allow' | 'deny'>('any');
  const [routeZdrOnly, setRouteZdrOnly] = useState(false);
  const [routeRequireParameters, setRouteRequireParameters] = useState(false);
  const [routeRequireTools, setRouteRequireTools] = useState(false);
  const [routeRequireResponseFormat, setRouteRequireResponseFormat] = useState(false);
  const [routeRequirePlugins, setRouteRequirePlugins] = useState(false);


  const paramsQ = useQuery({
    queryKey: ["openrouter-parameters", { model: paramModel, provider: paramProvider || null, base_url: paramBaseUrl || null }],
    queryFn: () => getOpenRouterParameters({ model: paramModel.trim(), provider: paramProvider.trim() || null, base_url: paramBaseUrl.trim() || null }),
    enabled: Boolean(paramModel.trim()),
  });

  const modelOptions = useMemo(() => {
    const payload: any = (modelsQ.data as any)?.payload ?? null;
    const arr = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
    const ids = arr
      .map((m: any) => String(m?.id ?? m?.name ?? "").trim())
      .filter((s: string) => s.length > 0);
    // Deduplicate while preserving order; cap to keep the DOM light.
    const seen = new Set<string>();
    const out: string[] = [];
    for (const id of ids) {
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(id);
      if (out.length >= 2000) break;
    }
    return out;
  }, [modelsQ.data]);

  const endpoints = useMemo(() => {
    const payload: any = (endpointsQ.data as any)?.payload ?? null;

    const pickArray = (p: any): any[] => {
      if (!p) return [];
      if (Array.isArray(p)) return p;
      if (Array.isArray(p.data)) return p.data;
      if (Array.isArray(p.data?.data)) return p.data.data;
      if (Array.isArray(p.data?.endpoints)) return p.data.endpoints;
      if (Array.isArray(p.endpoints)) return p.endpoints;
      return [];
    };

    const arr = pickArray(payload);

    return arr
      .filter(Boolean)
      .map((e: any) => {
        // OpenRouter endpoints commonly expose:
        // - tag: provider slug (e.g. "openai")
        // - provider_name: display name (e.g. "OpenAI")
        const providerSlug = String(e?.tag ?? e?.provider ?? e?.provider_id ?? e?.owner ?? "").trim();
        const providerName = String(e?.provider_name ?? e?.providerName ?? e?.name ?? "").trim();

        const model = String(e?.model ?? e?.model_id ?? e?.modelId ?? "").trim();
        const id = String(e?.id ?? e?.endpoint_id ?? e?.endpointId ?? "").trim();

        const contextLength = toNumber(e?.context_length ?? e?.contextLength ?? e?.context ?? null);
        const supported = extractSupportedParams(
          e?.supported_parameters ?? e?.supported ?? e?.parameters ?? e?.capabilities ?? null,
        );

        // Best-effort pricing extraction. Keep as raw numbers when present.
        const pricing = e?.pricing ?? e?.price ?? null;
        const promptCost = pricing ? toNumber(pricing?.prompt ?? pricing?.prompt_cost ?? pricing?.promptCost ?? null) : null;
        const completionCost = pricing
          ? toNumber(pricing?.completion ?? pricing?.completion_cost ?? pricing?.completionCost ?? null)
          : null;

        const baseUrl = String(e?.base_url ?? e?.baseUrl ?? e?.url ?? e?.endpoint ?? e?.endpoint_url ?? "").trim();
        const dataCollection = String(e?.data_collection ?? e?.dataCollection ?? e?.data_policy ?? e?.dataPolicy ?? "").trim();

        // Performance metrics (OpenRouter endpoints schema)
        const uptime30m = toNumber(e?.uptime_last_30m ?? e?.uptimeLast30m ?? null);
        const latency30m = toNumber(e?.latency_last_30m ?? e?.latencyLast30m ?? null);
        const throughput30m = toNumber(e?.throughput_last_30m ?? e?.throughputLast30m ?? null);

        const quant = e?.quantization ?? e?.quantizations ?? e?.quant ?? null;
        const quantizations = new Set<string>();
        if (Array.isArray(quant)) {
          for (const item of quant) {
            const s = String(item ?? "").trim();
            if (s) quantizations.add(s);
          }
        } else if (quant != null) {
          const s = String(quant).trim();
          if (s) {
            for (const part of s.split(",")) {
              const t = String(part ?? "").trim();
              if (t) quantizations.add(t);
            }
          }
        }

        const isZdr =
          Boolean(e?.zdr ?? e?.is_zdr ?? e?.isZdr ?? false) ||
          /zdr/i.test(baseUrl) ||
          /zdr/i.test(dataCollection);

        return {
          provider: providerSlug || providerName || null,
          providerSlug: providerSlug || null,
          providerName: providerName || null,
          model: model || null,
          id: id || null,
          baseUrl: baseUrl || null,
          dataCollection: dataCollection || null,
          isZdr,
          quantizations,
          contextLength,
          promptCost,
          completionCost,
          uptime30m,
          latency30m,
          throughput30m,
          supported,
          raw: e,
        };
      });
  }, [endpointsQ.data]);

  const endpointsFiltered = useMemo(() => {
    const m = endpointsModel.trim().toLowerCase();
    const p = endpointsProvider.trim().toLowerCase();
    return endpoints.filter((e) => {
      if (m) {
        const hay = `${e.model ?? ""} ${e.id ?? ""}`.toLowerCase();
        if (!hay.includes(m)) return false;
      }
      if (p) {
        const hay = `${e.provider ?? ""} ${e.providerName ?? ""}`.toLowerCase();
        if (!hay.includes(p)) return false;
      }
      return true;
    });
  }, [endpoints, endpointsModel, endpointsProvider]);

  const endpointsUnionSupported = useMemo(() => {
    const set = new Set<string>();
    for (const e of endpointsFiltered) {
      for (const s of e.supported ?? new Set<string>()) set.add(s);
    }
    return set;
  }, [endpointsFiltered]);

  const endpointProviderNames = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const e of endpoints) {
      const p = String(e.provider ?? '').trim();
      if (!p) continue;
      const k = p.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(p);
    }
    return out.sort((a, b) => a.localeCompare(b));
  }, [endpoints]);

  const routeOnlyList = useMemo(() => parseCsvList(routeOnlyProviders), [routeOnlyProviders]);
  const routeIgnoreList = useMemo(() => parseCsvList(routeIgnoreProviders), [routeIgnoreProviders]);
  const routeQuantList = useMemo(() => parseCsvList(routeQuantizations), [routeQuantizations]);

  const routeRequiredParamKeys = useMemo(() => {
    const keys: string[] = [];
    if (routeRequireTools) keys.push('tools', 'tool_choice');
    if (routeRequireResponseFormat) keys.push('response_format');
    if (routeRequirePlugins) keys.push('plugins');
    const seen = new Set<string>();
    const out: string[] = [];
    for (const k of keys) {
      const kk = k.toLowerCase();
      if (seen.has(kk)) continue;
      seen.add(kk);
      out.push(k);
    }
    return out;
  }, [routeRequireTools, routeRequireResponseFormat, routeRequirePlugins]);

  const routeEndpointsFiltered = useMemo(() => {
    const m = routeModel.trim().toLowerCase();
    const only = new Set(routeOnlyList.map((s) => s.toLowerCase()));
    const ignore = new Set(routeIgnoreList.map((s) => s.toLowerCase()));
    const quant = new Set(routeQuantList.map((s) => s.toLowerCase()));

    return endpoints.filter((e) => {
      // Model filter
      if (m) {
        const hay = `${e.model ?? ''} ${e.id ?? ''}`.toLowerCase();
        if (!hay.includes(m)) return false;
      }

      // Provider allow/ignore
      const prov = String(e.provider ?? '').trim();
      const provKey = prov.toLowerCase();
      if (only.size) {
        if (!provKey || !only.has(provKey)) return false;
      }
      if (ignore.size && provKey && ignore.has(provKey)) return false;

      // data_collection
      if (routeDataCollection !== 'any') {
        const dc = String((e as any).dataCollection ?? '').toLowerCase();
        if (!dc) return false;
        if (!dc.includes(routeDataCollection)) return false;
      }

      // ZDR
      if (routeZdrOnly && !(e as any).isZdr) return false;

      // Quantizations (intersection)
      if (quant.size) {
        const qset: Set<string> = (e as any).quantizations ?? new Set<string>();
        if (!qset || qset.size === 0) return false;
        let ok = false;
        for (const q of qset) {
          if (quant.has(String(q).toLowerCase())) {
            ok = true;
            break;
          }
        }
        if (!ok) return false;
      }

      // Strict parameter support simulation
      if (routeRequireParameters && routeRequiredParamKeys.length) {
        for (const k of routeRequiredParamKeys) {
          if (!isSupportedParam(k, (e as any).supported ?? new Set<string>())) return false;
        }
      }

      return true;
    });
  }, [endpoints, routeModel, routeOnlyList, routeIgnoreList, routeQuantList, routeDataCollection, routeZdrOnly, routeRequireParameters, routeRequiredParamKeys]);

  const routeUnionSupported = useMemo(() => {
    const set = new Set<string>();
    for (const e of routeEndpointsFiltered) {
      for (const s of (e as any).supported ?? new Set<string>()) set.add(s);
    }
    return set;
  }, [routeEndpointsFiltered]);

  const routeProviderObject = useMemo(() => {
    const obj: Record<string, any> = {};
    if (routeOnlyList.length) obj.only = routeOnlyList;
    if (routeIgnoreList.length) obj.ignore = routeIgnoreList;
    if (routeDataCollection !== 'any') obj.data_collection = routeDataCollection;
    if (routeQuantList.length) obj.quantizations = routeQuantList;
    if (routeZdrOnly) obj.zdr = true;
    if (routeRequireParameters) obj.require_parameters = true;
    return obj;
  }, [routeOnlyList, routeIgnoreList, routeDataCollection, routeQuantList, routeZdrOnly, routeRequireParameters]);


  const paramsSummary = useMemo(() => {
    const d: any = paramsQ.data ?? null;
    if (!d) return null;
    return {
      baseUrl: d.base_url ?? null,
      modelId: d.model_id ?? null,
      provider: d.provider ?? null,
      fetchedAt: d.fetched_at ?? null,
      ageSeconds: typeof d.age_seconds === "number" ? d.age_seconds : null,
      payload: d.payload ?? null,
    };
  }, [paramsQ.data]);

  const configuredParams = useMemo(() => {
    const s: any = (assistantSettingsQ.data as any)?.assistant_settings?.params ?? null;
    return s && typeof s === "object" ? (s as Record<string, unknown>) : null;
  }, [assistantSettingsQ.data]);

  const supportedParams = useMemo(() => {
    const payload: any = paramsSummary?.payload ?? null;
    return extractSupportedParams(payload);
  }, [paramsSummary]);

  const effectiveSupportedParams = useMemo(() => {
    // Prefer model-level /parameters. If missing, fall back to union of endpoint-supported params
    // (when available). Endpoints can differ by provider; this is a best-effort safety net.
    if (supportedParams && supportedParams.size > 0) return supportedParams;
    if (endpointsUnionSupported && endpointsUnionSupported.size > 0) return endpointsUnionSupported;
    return supportedParams;
  }, [supportedParams, endpointsUnionSupported]);

  const paramStatusRows = useMemo(() => {
    if (!configuredParams) return [] as Array<{ key: string; value: unknown; status: "supported" | "unsupported" | "local" | "unknown" }>;

    // Params we use client-side only (not part of OpenRouter /parameters).
    const localOnly = new Set<string>(["timeout_ms", "base_url", "payload_variants"]);

    const keys = Object.keys(configuredParams).sort();
    return keys.map((k) => {
      const v = (configuredParams as any)[k];
      if (localOnly.has(k)) return { key: k, value: v, status: "local" as const };
      if (!effectiveSupportedParams || effectiveSupportedParams.size === 0) return { key: k, value: v, status: "unknown" as const };
      return { key: k, value: v, status: isSupportedParam(k, effectiveSupportedParams) ? "supported" as const : "unsupported" as const };
    });
  }, [configuredParams, effectiveSupportedParams]);

  const recommendedParams = useMemo(() => {
    if (!configuredParams) return null as null | { params: Record<string, unknown>; notes: string[] };

    const localOnly = new Set<string>(["timeout_ms", "base_url", "payload_variants"]);

    const out: Record<string, unknown> = {};
    const notes: string[] = [];

    const supported = effectiveSupportedParams;
    const hasSupportList = !!supported && supported.size > 0;

    for (const k of Object.keys(configuredParams)) {
      const v = (configuredParams as any)[k];
      if (localOnly.has(k)) {
        out[k] = v;
        continue;
      }

      if (!hasSupportList) {
        // Without a support list, keep the param but note that it may be unsupported.
        out[k] = v;
        continue;
      }

      if (isSupportedParam(k, supported)) {
        out[k] = v;
        continue;
      }

      // Try a safe rename using known aliases.
      const candidates = getParamAliases(k);
      const supportedLower = new Set(Array.from(supported).map((s) => String(s).trim().toLowerCase()));
      const alias = candidates.find((c) => supportedLower.has(String(c).trim().toLowerCase()));
      if (alias) {
        out[alias] = v;
        notes.push(`Rename ${k} → ${alias}`);
        continue;
      }

      notes.push(`Drop ${k} (unsupported)`);
    }

    return { params: out, notes };
  }, [configuredParams, effectiveSupportedParams]);

  const [paramsError, setParamsError] = useState<string | null>(null);
  const [paramsRefreshing, setParamsRefreshing] = useState(false);


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

  const keySummary = useMemo(() => {
    const payload = (keyQ.data as any)?.payload;
    if (!payload) return null;
    const source = payload?.data ?? payload;
    const limit = pickNumber(source, ["limit"]);
    const remaining = pickNumber(source, ["limit_remaining", "remaining", "credits_remaining"]);
    const usage = pickNumber(source, ["usage", "spent", "total_usage"]);
    const usageDaily = pickNumber(source, ["usage_daily"]);
    const usageWeekly = pickNumber(source, ["usage_weekly"]);
    const usageMonthly = pickNumber(source, ["usage_monthly"]);
    const byokUsage = pickNumber(source, ["byok_usage"]);
    const byokUsageDaily = pickNumber(source, ["byok_usage_daily"]);
    const isFreeTier = !!source?.is_free_tier;
    const label = typeof source?.label === "string" ? source.label : null;

    return {
      label,
      limit,
      remaining,
      usage,
      usageDaily,
      usageWeekly,
      usageMonthly,
      byokUsage,
      byokUsageDaily,
      isFreeTier,
      raw: payload,
      fetchedAt: (keyQ.data as any)?.fetched_at ?? null,
      baseUrl: (keyQ.data as any)?.base_url ?? null,
    };
  }, [keyQ.data]);


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

      <Card title="OpenRouter key limits">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <StatCard title="Remaining" value={fmtUsd(keySummary?.remaining ?? null)} sub={<span className="text-xs text-zinc-500">Credit limit remaining</span>} />
          <StatCard title="Used today" value={fmtUsd(keySummary?.usageDaily ?? null)} sub={<span className="text-xs text-zinc-500">UTC day usage</span>} />
          <StatCard title="Used (all time)" value={fmtUsd(keySummary?.usage ?? null)} sub={<span className="text-xs text-zinc-500">Total usage</span>} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
          <span>Label: <span className="font-mono">{keySummary?.label ?? "—"}</span></span>
          <span>Free tier: <span className="font-mono">{keySummary?.isFreeTier ? "true" : "false"}</span></span>
          <span>Base URL: <span className="font-mono">{keySummary?.baseUrl ?? "—"}</span></span>
          <span>Fetched: <span className="font-mono">{keySummary?.fetchedAt ?? "—"}</span></span>
          {!keySummary ? <span>No key payload cached yet.</span> : null}
        </div>

        {keySummary?.raw ? (
          <details className="mt-3">
            <summary className="cursor-pointer text-sm text-zinc-700">Raw /key payload</summary>
            <div className="mt-2">
              <CopyButton text={JSON.stringify(keySummary.raw, null, 2)} />
              <pre className="mt-2 max-h-72 overflow-auto rounded bg-zinc-950 p-3 text-xs text-zinc-100">
                {JSON.stringify(keySummary.raw, null, 2)}
              </pre>
            </div>
          </details>
        ) : null}
      </Card>



      <Card title="OpenRouter model parameters">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <div className="mb-1 text-xs text-zinc-500">Model ID (from OpenRouter)</div>
            <Input
              value={paramModel}
              placeholder="e.g. openai/gpt-4o-mini"
              list="openrouter-model-ids"
              onChange={(e) => setParamModel(e.target.value)}
            />
            <datalist id="openrouter-model-ids">
              {modelOptions.map((id) => <option key={id} value={id} />)}
            </datalist>
            <div className="mt-1 text-xs text-zinc-500">
              Tip: start typing to pick from cached models (up to {modelOptions.length} shown).
            </div>
          </div>

          <div>
            <div className="mb-1 text-xs text-zinc-500">Provider (optional)</div>
            <Input
              value={paramProvider}
              placeholder="e.g. OpenAI"
              onChange={(e) => setParamProvider(e.target.value)}
            />
            <div className="mt-1 text-xs text-zinc-500">Used as a cache key. Leave blank for default.</div>
          </div>

          <div className="md:col-span-2">
            <div className="mb-1 text-xs text-zinc-500">Base URL override (optional)</div>
            <Input
              value={paramBaseUrl}
              placeholder="Leave blank to use assistant settings / default"
              onChange={(e) => setParamBaseUrl(e.target.value)}
            />
            <div className="mt-1 text-xs text-zinc-500">Note: for security, only OpenRouter’s official host/path is accepted.</div>
          </div>

          <div className="flex items-end gap-2">
            <Button
              variant="primary"
              disabled={!paramModel.trim() || paramsQ.isFetching}
              onClick={() => { setParamsError(null); paramsQ.refetch(); }}
            >
              {paramsQ.isFetching ? "Loading…" : "Load from cache"}
            </Button>
            <Button
              variant="ghost"
              disabled={!paramModel.trim() || paramsRefreshing}
              onClick={async () => {
                setParamsError(null);
                setParamsRefreshing(true);
                try {
                  await refreshOpenRouterParameters({
                    model: paramModel.trim(),
                    provider: paramProvider.trim() || null,
                    base_url: paramBaseUrl.trim() || null,
                  });
                  await paramsQ.refetch();
                  await modelsQ.refetch();
                } catch (e: any) {
                  setParamsError(e?.message ?? String(e));
                } finally {
                  setParamsRefreshing(false);
                }
              }}
            >
              {paramsRefreshing ? "Refreshing…" : "Refresh now"}
            </Button>
          </div>
        </div>

        {paramsError ? <div className="mt-3"><ErrorBox title="Parameters error" message={paramsError} /></div> : null}

        {paramsQ.isError ? (
          <div className="mt-3">
            <ErrorBox title="Parameters error" message={(paramsQ.error as any)?.message ?? "Failed to load parameters"} />
          </div>
        ) : null}

        {paramsSummary ? (
          <div className="mt-4">
            <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
              <span>Model: <span className="font-mono">{paramsSummary.modelId ?? "—"}</span></span>
              <span>Provider: <span className="font-mono">{paramsSummary.provider ?? "—"}</span></span>
              <span>Base URL: <span className="font-mono">{paramsSummary.baseUrl ?? "—"}</span></span>
              <span>Fetched: <span className="font-mono">{paramsSummary.fetchedAt ?? "—"}</span></span>
              <span>Age: <span className="font-mono">{paramsSummary.ageSeconds == null ? "—" : `${paramsSummary.ageSeconds}s`}</span></span>
            </div>

            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-zinc-700">Raw /parameters payload</summary>
              <div className="mt-2">
                <CopyButton text={JSON.stringify(paramsSummary.payload ?? null, null, 2)} />
                <pre className="mt-2 max-h-80 overflow-auto rounded bg-zinc-950 p-3 text-xs text-zinc-100">
                  {JSON.stringify(paramsSummary.payload ?? null, null, 2)}
                </pre>
              </div>
            </details>

            <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold text-zinc-900">App configured OpenRouter params</div>
                <div className="text-xs text-zinc-500">
                  From <span className="font-mono">assistant_settings.params</span>
                </div>
              </div>
              {!configuredParams ? (
                <div className="mt-2 text-xs text-zinc-500">No params loaded (or assistant settings not accessible).</div>
              ) : (
                <div className="mt-2 overflow-auto rounded-lg border border-zinc-200 bg-white">
                  <Table>
                    <thead>
                      <tr>
                        <Th>Param</Th>
                        <Th>Status</Th>
                        <Th>Value</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {paramStatusRows.length ? (
                        paramStatusRows.map((row) => (
                          <tr key={row.key}>
                            <Td className="font-mono text-xs">{row.key}</Td>
                            <Td className="text-xs">
                              {row.status === "supported" ? (
                                <span className="rounded-full bg-green-50 px-2 py-0.5 text-green-700">Supported</span>
                              ) : row.status === "unsupported" ? (
                                <span className="rounded-full bg-red-50 px-2 py-0.5 text-red-700">Unsupported</span>
                              ) : row.status === "local" ? (
                                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-700">Local-only</span>
                              ) : (
                                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">Unknown</span>
                              )}
                            </Td>
                            <Td className="font-mono text-xs">{typeof row.value === "string" ? row.value : JSON.stringify(row.value)}</Td>
                          </tr>
                        ))
                      ) : (
                        <tr><Td colSpan={3} className="text-zinc-500">No params configured.</Td></tr>
                      )}
                    </tbody>
                  </Table>
                </div>
              )}
              <div className="mt-2 text-xs text-zinc-500">
                Note: “Local-only” params affect your app’s request wrapper but won’t appear in OpenRouter’s <span className="font-mono">/parameters</span> support list.
              </div>

              {recommendedParams ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <CopyButton
                    text={JSON.stringify(recommendedParams.params, null, 2)}
                    label="Copy recommended params"
                  />
                  <Button
                    variant="ghost"
                    onClick={() =>
                      downloadText(
                        `assistant_settings_params_recommended_${(paramsSummary?.modelId ?? "model").replace(/[^a-zA-Z0-9._-]/g, "_")}.json`,
                        JSON.stringify(recommendedParams.params, null, 2),
                        "application/json",
                      )
                    }
                  >
                    Download JSON
                  </Button>
                  <div className="text-xs text-zinc-500">
                    Uses the support list (or endpoints fallback) to keep only compatible params.
                  </div>
                </div>
              ) : null}

              {recommendedParams?.notes?.length ? (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-zinc-600">Show recommended changes</summary>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-zinc-600">
                    {recommendedParams.notes.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="mt-4 text-xs text-zinc-500">
            Enter a model ID to view cached parameters (and optionally refresh them).
          </div>
        )}
      </Card>


      <Card title="OpenRouter endpoints">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <div className="mb-1 text-xs text-zinc-500">Model filter (substring)</div>
            <Input
              value={endpointsModel}
              placeholder="e.g. gpt-4o-mini"
              list="openrouter-model-ids"
              onChange={(e) => setEndpointsModel(e.target.value)}
            />
            <div className="mt-1 text-xs text-zinc-500">Matches endpoint model/id. Leave blank to show all endpoints.</div>
          </div>

          <div>
            <div className="mb-1 text-xs text-zinc-500">Provider filter (substring)</div>
            <Input
              value={endpointsProvider}
              placeholder="e.g. OpenAI"
              onChange={(e) => setEndpointsProvider(e.target.value)}
            />
            <div className="mt-1 text-xs text-zinc-500">Matches endpoint provider/owner fields.</div>
          </div>

          <div className="flex items-end gap-2">
            <Button
              variant="ghost"
              disabled={!paramModel.trim()}
              onClick={() => setEndpointsModel(paramModel.trim())}
            >
              Use model from above
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setEndpointsModel("");
                setEndpointsProvider("");
              }}
            >
              Clear
            </Button>
          </div>
        </div>

        {endpointsQ.isError ? (
          <div className="mt-3">
            <ErrorBox title="Endpoints error" message={(endpointsQ.error as any)?.message ?? "Failed to load /endpoints"} />
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
          <span>Cached endpoints: <span className="font-mono">{endpoints.length}</span></span>
          <span>Matching: <span className="font-mono">{endpointsFiltered.length}</span></span>
          <span>Union supported params: <span className="font-mono">{endpointsUnionSupported.size}</span></span>
          {endpointsUnionSupported.size ? (
            <CopyButton
              text={JSON.stringify(Array.from(endpointsUnionSupported).sort(), null, 2)}
              label="Copy union supported params"
            />
          ) : null}
        </div>

        {endpointsFiltered.length ? (
          <>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-zinc-700">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={endpointsShowPerf}
                  onChange={(e) => setEndpointsShowPerf(e.target.checked)}
                />
                <span>Show perf (uptime/latency/throughput)</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={endpointsShowProviderName}
                  onChange={(e) => setEndpointsShowProviderName(e.target.checked)}
                />
                <span>Show provider name</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={endpointsShowQuant}
                  onChange={(e) => setEndpointsShowQuant(e.target.checked)}
                />
                <span>Show quantization</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={endpointsShowParams}
                  onChange={(e) => setEndpointsShowParams(e.target.checked)}
                />
                <span>Show supported params</span>
              </label>
            </div>

            <div className="mt-3 overflow-auto rounded-lg border border-zinc-200 bg-white">
              <Table>
                <thead>
                  <tr>
                    <Th>Provider</Th>
                    {endpointsShowProviderName ? <Th>Name</Th> : null}
                    {endpointsShowQuant ? <Th>Quant</Th> : null}
                    {endpointsShowPerf ? (
                      <>
                        <Th className="text-right">Uptime</Th>
                        <Th className="text-right">Latency</Th>
                        <Th className="text-right">Throughput</Th>
                      </>
                    ) : null}
                    <Th>Model</Th>
                    <Th>Endpoint ID</Th>
                    <Th className="text-right">Context</Th>
                    <Th className="text-right">Prompt</Th>
                    <Th className="text-right">Completion</Th>
                    {endpointsShowParams ? <Th>Supported params</Th> : null}
                  </tr>
                </thead>
                <tbody>
                  {endpointsFiltered.slice(0, 50).map((e, idx) => {
                    const supportedArr = Array.from(e.supported ?? new Set<string>()).sort();
                    const preview = supportedArr.slice(0, 10).join(", ");
                    const quant = Array.from(e.quantizations ?? new Set<string>()).join(", ");
                    return (
                      <tr key={`${e.id ?? "id"}-${idx}`}>
                        <Td className="font-mono text-xs">{e.provider ?? "—"}</Td>
                        {endpointsShowProviderName ? <Td className="text-xs">{e.providerName ?? "—"}</Td> : null}
                        {endpointsShowQuant ? <Td className="font-mono text-xs">{quant || "—"}</Td> : null}
                        {endpointsShowPerf ? (
                          <>
                            <Td className="text-right font-mono text-xs">{fmtUptime(e.uptime30m)}</Td>
                            <Td className="text-right font-mono text-xs">{fmtLatencySeconds(e.latency30m)}</Td>
                            <Td className="text-right font-mono text-xs">{fmtThroughput(e.throughput30m)}</Td>
                          </>
                        ) : null}
                        <Td className="font-mono text-xs">{e.model ?? "—"}</Td>
                        <Td className="font-mono text-xs">{e.id ?? "—"}</Td>
                        <Td className="text-right font-mono text-xs">
                          {e.contextLength == null ? "—" : fmtInt(e.contextLength)}
                        </Td>
                        <Td className="text-right font-mono text-xs">
                          {e.promptCost == null ? "—" : String(e.promptCost)}
                        </Td>
                        <Td className="text-right font-mono text-xs">
                          {e.completionCost == null ? "—" : String(e.completionCost)}
                        </Td>
                        {endpointsShowParams ? (
                          <Td className="text-xs">
                            <div className="flex flex-col gap-1">
                              <div className="text-zinc-700">
                                {preview || "—"}
                                {supportedArr.length > 10 ? "…" : ""}
                              </div>
                              {supportedArr.length > 10 ? (
                                <details>
                                  <summary className="cursor-pointer text-[11px] text-zinc-500">Show all</summary>
                                  <div className="mt-1 whitespace-pre-wrap font-mono text-[11px] text-zinc-600">
                                    {supportedArr.join(", ")}
                                  </div>
                                </details>
                              ) : null}
                              {supportedArr.length ? (
                                <div className="text-[11px] text-zinc-400">{supportedArr.length} params</div>
                              ) : null}
                            </div>
                          </Td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          </>
        ) : null}
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        ) : (
          <div className="mt-3 text-xs text-zinc-500">
            {endpointsQ.isLoading ? "Loading cached endpoints…" : "No endpoints match the current filters."}
          </div>
        )}

        {endpointsFiltered.length > 50 ? (
          <div className="mt-2 text-xs text-zinc-500">Showing first 50 matching endpoints. Refine filters to narrow further.</div>
        ) : null}
      </Card>


      <Card title="Provider routing simulator">
        <div className="text-xs text-zinc-600">
          Preview how OpenRouter <span className="font-mono">provider</span> routing constraints could reduce the set of available endpoints for a model (using your cached endpoints list). Turn on <span className="font-mono">require_parameters</span> to simulate strict compatibility when using tools / response_format / plugins.
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <div className="mb-1 text-xs text-zinc-500">Model filter (substring)</div>
            <Input value={routeModel} placeholder="e.g. gpt-4o-mini" list="openrouter-model-ids" onChange={(e) => setRouteModel(e.target.value)} />
          </div>

          <div>
            <div className="mb-1 text-xs text-zinc-500">Provider only (comma-separated)</div>
            <Input value={routeOnlyProviders} placeholder="e.g. OpenAI, Anthropic" onChange={(e) => setRouteOnlyProviders(e.target.value)} />
          </div>

          <div>
            <div className="mb-1 text-xs text-zinc-500">Provider ignore (comma-separated)</div>
            <Input value={routeIgnoreProviders} placeholder="e.g. Together" onChange={(e) => setRouteIgnoreProviders(e.target.value)} />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <div className="mb-1 text-xs text-zinc-500">Data collection</div>
            <select
              value={routeDataCollection}
              onChange={(e) => setRouteDataCollection(e.target.value as any)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-300"
            >
              <option value="any">Any</option>
              <option value="allow">Allow</option>
              <option value="deny">Deny</option>
            </select>
          </div>

          <div>
            <div className="mb-1 text-xs text-zinc-500">Quantizations (comma-separated)</div>
            <Input value={routeQuantizations} placeholder="e.g. fp16, int8" onChange={(e) => setRouteQuantizations(e.target.value)} />
          </div>

          <div className="flex flex-col justify-end gap-2">
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input type="checkbox" checked={routeZdrOnly} onChange={(e) => setRouteZdrOnly(e.target.checked)} />
              ZDR endpoints only
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input type="checkbox" checked={routeRequireParameters} onChange={(e) => setRouteRequireParameters(e.target.checked)} />
              require_parameters
            </label>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-zinc-200 bg-white p-3">
            <div className="text-xs font-semibold text-zinc-700">Advanced params (strict mode)</div>
            <div className="mt-2 flex flex-col gap-2 text-sm text-zinc-700">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={routeRequireTools} onChange={(e) => setRouteRequireTools(e.target.checked)} />
                tools / tool_choice
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={routeRequireResponseFormat} onChange={(e) => setRouteRequireResponseFormat(e.target.checked)} />
                response_format
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={routeRequirePlugins} onChange={(e) => setRouteRequirePlugins(e.target.checked)} />
                plugins
              </label>
            </div>
            <div className="mt-2 text-xs text-zinc-500">
              Required keys: <span className="font-mono">{routeRequiredParamKeys.length ? routeRequiredParamKeys.join(", ") : "(none)"}</span>
            </div>
            <div className="mt-2 text-xs text-zinc-500">
              Tip: if you rely on these, keeping <span className="font-mono">require_parameters</span> enabled helps avoid providers that ignore unsupported parameters.
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-3">
            <div className="text-xs font-semibold text-zinc-700">Result</div>
            <div className="mt-2 text-xs text-zinc-600">Matching endpoints: <span className="font-mono">{routeEndpointsFiltered.length}</span></div>
            <div className="mt-1 text-xs text-zinc-600">Union supported params: <span className="font-mono">{routeUnionSupported.size}</span></div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {routeUnionSupported.size ? <CopyButton text={JSON.stringify(Array.from(routeUnionSupported).sort(), null, 2)} label="Copy supported params" /> : null}
              <Button
                variant="ghost"
                onClick={() => {
                  setRouteModel('');
                  setRouteOnlyProviders('');
                  setRouteIgnoreProviders('');
                  setRouteQuantizations('');
                  setRouteDataCollection('any');
                  setRouteZdrOnly(false);
                  setRouteRequireParameters(false);
                  setRouteRequireTools(false);
                  setRouteRequireResponseFormat(false);
                  setRouteRequirePlugins(false);
                }}
              >
                Clear
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-3">
            <div className="text-xs font-semibold text-zinc-700">Provider routing JSON</div>
            <div className="mt-2 text-xs text-zinc-500">Copy into <span className="font-mono">assistant_settings.router.policy.provider</span>.</div>
            <div className="mt-2">
              <CopyButton text={JSON.stringify(routeProviderObject, null, 2)} label="Copy provider object" />
            </div>
            <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-zinc-50 p-2 text-[11px] text-zinc-700">{JSON.stringify(routeProviderObject, null, 2)}</pre>
          </div>
        </div>

        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-zinc-600">Show provider names in cache ({endpointProviderNames.length})</summary>
          <div className="mt-2 text-xs text-zinc-600">{endpointProviderNames.length ? endpointProviderNames.join(", ") : "No providers found in cached endpoints."}</div>
        </details>

        {routeRequireParameters && routeRequiredParamKeys.length && !routeEndpointsFiltered.length ? (
          <div className="mt-3 text-xs text-amber-700">
            No endpoints matched these strict constraints. Try disabling <span className="font-mono">require_parameters</span>, reducing advanced params, or adjusting provider filters.
          </div>
        ) : null}
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
