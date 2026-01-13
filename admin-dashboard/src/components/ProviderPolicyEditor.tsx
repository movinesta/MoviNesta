import React, { useMemo } from "react";
import { Input } from "./Input";
import { Button } from "./Button";

export type ProviderOption = { slug: string; name?: string | null };

export type ProviderSort =
  | "price"
  | "throughput"
  | "latency"
  | {
      by: "price" | "throughput" | "latency";
      partition?: "model" | "none";
    };

export type Percentiles = {
  p50?: number;
  p75?: number;
  p90?: number;
  p99?: number;
};

export type ProviderMaxPrice = {
  prompt?: number;
  completion?: number;
  request?: number;
  image?: number;
};

export type ProviderPolicy = {
  order?: string[];
  only?: string[];
  ignore?: string[];
  allow_fallbacks?: boolean;
  require_parameters?: boolean;
  data_collection?: "allow" | "deny";
  zdr?: boolean;
  quantizations?: string[];
  sort?: ProviderSort;

  // Newer OpenRouter provider knobs (optional; passed through to OpenRouter if present)
  preferred_min_throughput?: number | Percentiles;
  preferred_max_latency?: number | Percentiles;
  max_price?: ProviderMaxPrice;
  enforce_distillable_text?: boolean;
};

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function uniqStrings(list: string[]): string[] {
  const out: string[] = [];
  for (const raw of list) {
    const s = String(raw ?? "").trim();
    if (!s) continue;
    if (!out.includes(s)) out.push(s);
  }
  return out;
}

function parseLines(text: string): string[] {
  return uniqStrings(
    String(text ?? "")
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

function formatLines(list: unknown): string {
  return Array.isArray(list) ? list.map((s) => String(s ?? "").trim()).filter(Boolean).join("\n") : "";
}

function parseCsv(text: string): string[] {
  return uniqStrings(
    String(text ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

function formatCsv(list: unknown): string {
  return Array.isArray(list) ? list.map((s) => String(s ?? "").trim()).filter(Boolean).join(", ") : "";
}

function parseNum(v: string): number | undefined {
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  return n;
}

function normalizePercentiles(v: unknown): number | Percentiles | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  if (isObject(v)) {
    const p: Percentiles = {};
    for (const k of ["p50", "p75", "p90", "p99"] as const) {
      const n = Number((v as any)[k]);
      if (Number.isFinite(n)) (p as any)[k] = n;
    }
    return Object.keys(p).length ? p : undefined;
  }
  return undefined;
}

function formatPercentiles(v: unknown): { mode: "single" | "percentiles"; single: string; p: Percentiles } {
  const out: Percentiles = {};
  if (typeof v === "number" && Number.isFinite(v)) return { mode: "single", single: String(v), p: out };
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return { mode: "single", single: String(n), p: out };
  }
  if (isObject(v)) {
    for (const k of ["p50", "p75", "p90", "p99"] as const) {
      const n = Number((v as any)[k]);
      if (Number.isFinite(n)) (out as any)[k] = n;
    }
    return { mode: Object.keys(out).length ? "percentiles" : "single", single: "", p: out };
  }
  return { mode: "single", single: "", p: out };
}

export function ProviderPolicyEditor(props: {
  value: unknown;
  onChange: (next: ProviderPolicy | null) => void;
  providerOptions?: ProviderOption[];
  className?: string;
}) {
  const policy: ProviderPolicy = useMemo(() => {
    if (isObject(props.value)) return props.value as any;
    return {};
  }, [props.value]);

  const options = useMemo(() => {
    const list = Array.isArray(props.providerOptions) ? props.providerOptions : [];
    const dedup = new Map<string, ProviderOption>();
    for (const o of list) {
      const slug = String(o?.slug ?? "").trim();
      if (!slug) continue;
      if (!dedup.has(slug)) dedup.set(slug, { slug, name: o?.name ?? null });
    }
    return Array.from(dedup.values()).sort((a, b) => a.slug.localeCompare(b.slug));
  }, [props.providerOptions]);

  const set = (patch: Partial<ProviderPolicy>) => {
    props.onChange({ ...(policy ?? {}), ...patch });
  };

  const setOrDelete = (key: keyof ProviderPolicy, value: any) => {
    const next: any = { ...(policy ?? {}) };
    if (value === undefined || value === null || (typeof value === "string" && value.trim() === "")) {
      delete next[key];
    } else {
      next[key] = value;
    }
    props.onChange(Object.keys(next).length ? (next as ProviderPolicy) : null);
  };

  const throughputFmt = formatPercentiles((policy as any).preferred_min_throughput);
  const latencyFmt = formatPercentiles((policy as any).preferred_max_latency);

  const maxPrice: ProviderMaxPrice = isObject((policy as any).max_price) ? ((policy as any).max_price as any) : {};

  return (
    <div className={props.className}>
      <div className="mb-2 text-[11px] font-semibold text-zinc-600">Provider routing policy (OpenRouter)</div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-zinc-500">Sort</span>
          <select
            value={typeof policy.sort === "string" ? policy.sort : isObject(policy.sort) ? (policy.sort as any).by : ""}
            onChange={(e) => {
              const by = e.target.value as any;
              if (!by) return setOrDelete("sort", undefined);
              const prev = policy.sort;
              if (isObject(prev)) {
                const partition = (prev as any).partition;
                setOrDelete("sort", { by, ...(partition ? { partition } : {}) });
              } else {
                setOrDelete("sort", by);
              }
            }}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
          >
            <option value="">(default)</option>
            <option value="price">Price</option>
            <option value="throughput">Throughput</option>
            <option value="latency">Latency</option>
          </select>
          <span className="text-[11px] text-zinc-400">Setting sort disables OpenRouter load balancing.</span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-zinc-500">Sort partition</span>
          <select
            value={isObject(policy.sort) ? String((policy.sort as any).partition ?? "") : ""}
            onChange={(e) => {
              const v = e.target.value || undefined;
              if (!policy.sort) return;
              if (typeof policy.sort === "string") {
                // Upgrade to object form to store partition
                setOrDelete("sort", { by: policy.sort, ...(v ? { partition: v } : {}) });
              } else {
                setOrDelete("sort", { ...(policy.sort as any), ...(v ? { partition: v } : {}) });
              }
            }}
            disabled={!policy.sort}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm disabled:opacity-50"
          >
            <option value="">(none)</option>
            <option value="model">Model</option>
            <option value="none">None</option>
          </select>
          <span className="text-[11px] text-zinc-400">Use &quot;model&quot; if you use model fallbacks.</span>
        </label>

        <div className="flex items-end justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => props.onChange(null)}
            title="Remove the provider policy section (OpenRouter defaults will apply)"
          >
            Clear
          </Button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-zinc-500">Provider order (one per line)</span>
          <textarea
            value={formatLines(policy.order)}
            onChange={(e) => setOrDelete("order", parseLines(e.target.value))}
            placeholder={options.slice(0, 8).map((o) => o.slug).join("\n")}
            className="h-24 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-mono"
          />
          <span className="text-[11px] text-zinc-400">If set, OpenRouter tries providers in this order first.</span>
        </label>

        <div className="grid grid-cols-1 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-zinc-500">Only allow (one per line)</span>
            <textarea
              value={formatLines(policy.only)}
              onChange={(e) => setOrDelete("only", parseLines(e.target.value))}
              placeholder="openai\nanthropic\n..."
              className="h-24 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-mono"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-zinc-500">Ignore providers (one per line)</span>
            <textarea
              value={formatLines(policy.ignore)}
              onChange={(e) => setOrDelete("ignore", parseLines(e.target.value))}
              placeholder="together\n..."
              className="h-24 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-mono"
            />
          </label>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
        <label className="flex items-center gap-2 text-xs text-zinc-700">
          <input
            type="checkbox"
            checked={Boolean(policy.allow_fallbacks ?? true)}
            onChange={(e) => set({ allow_fallbacks: e.target.checked })}
          />
          <span>Allow fallbacks</span>
        </label>

        <label className="flex items-center gap-2 text-xs text-zinc-700">
          <input
            type="checkbox"
            checked={Boolean(policy.require_parameters ?? false)}
            onChange={(e) => setOrDelete("require_parameters", e.target.checked)}
          />
          <span>Require parameters support</span>
        </label>

        <label className="flex items-center gap-2 text-xs text-zinc-700">
          <input
            type="checkbox"
            checked={Boolean(policy.zdr ?? false)}
            onChange={(e) => setOrDelete("zdr", e.target.checked)}
          />
          <span>ZDR</span>
        </label>

        <label className="flex items-center gap-2 text-xs text-zinc-700">
          <input
            type="checkbox"
            checked={Boolean((policy as any).enforce_distillable_text ?? false)}
            onChange={(e) => setOrDelete("enforce_distillable_text", e.target.checked)}
          />
          <span>Enforce distillable text</span>
        </label>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-zinc-500">Data collection</span>
          <select
            value={String(policy.data_collection ?? "")}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return setOrDelete("data_collection", undefined);
              setOrDelete("data_collection", v === "deny" ? "deny" : "allow");
            }}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
          >
            <option value="">(default)</option>
            <option value="allow">Allow</option>
            <option value="deny">Deny</option>
          </select>
          <span className="text-[11px] text-zinc-400">If set to deny, OpenRouter filters providers by their policy.</span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-zinc-500">Quantizations (comma-separated)</span>
          <Input
            value={formatCsv(policy.quantizations)}
            onChange={(e) => setOrDelete("quantizations", parseCsv((e.target as HTMLInputElement).value))}
            placeholder="int8, fp16, bf16"
          />
          <span className="text-[11px] text-zinc-400">Optional preference; availability depends on the provider.</span>
        </label>
      </div>

      <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
        <div className="text-[11px] font-semibold text-zinc-600">Performance preferences</div>
        <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-zinc-200 bg-white p-3">
            <div className="mb-2 text-[11px] font-semibold text-zinc-600">Preferred min throughput</div>

            <div className="flex items-center gap-2 text-xs text-zinc-700">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="throughput_mode"
                  checked={throughputFmt.mode === "single"}
                  onChange={() => {
                    const n = normalizePercentiles(throughputFmt.single);
                    setOrDelete("preferred_min_throughput", typeof n === "number" ? n : undefined);
                  }}
                />
                <span>Single</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="throughput_mode"
                  checked={throughputFmt.mode === "percentiles"}
                  onChange={() => setOrDelete("preferred_min_throughput", { ...(throughputFmt.p || {}) })}
                />
                <span>Percentiles</span>
              </label>
            </div>

            {throughputFmt.mode === "single" ? (
              <div className="mt-2">
                <Input
                  inputMode="decimal"
                  value={throughputFmt.single}
                  onChange={(e) => setOrDelete("preferred_min_throughput", parseNum((e.target as HTMLInputElement).value))}
                  placeholder="e.g. 50"
                />
                <div className="mt-1 text-[11px] text-zinc-400">Tokens/sec threshold (approx).</div>
              </div>
            ) : (
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(["p50", "p75", "p90", "p99"] as const).map((k) => (
                  <label key={k} className="flex flex-col gap-1">
                    <span className="text-[11px] text-zinc-500">{k}</span>
                    <Input
                      inputMode="decimal"
                      value={String((throughputFmt.p as any)[k] ?? "")}
                      onChange={(e) =>
                        setOrDelete("preferred_min_throughput", {
                          ...(throughputFmt.p || {}),
                          [k]: parseNum((e.target as HTMLInputElement).value),
                        })
                      }
                      placeholder="e.g. 50"
                    />
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-3">
            <div className="mb-2 text-[11px] font-semibold text-zinc-600">Preferred max latency</div>

            <div className="flex items-center gap-2 text-xs text-zinc-700">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="latency_mode"
                  checked={latencyFmt.mode === "single"}
                  onChange={() => {
                    const n = normalizePercentiles(latencyFmt.single);
                    setOrDelete("preferred_max_latency", typeof n === "number" ? n : undefined);
                  }}
                />
                <span>Single</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="latency_mode"
                  checked={latencyFmt.mode === "percentiles"}
                  onChange={() => setOrDelete("preferred_max_latency", { ...(latencyFmt.p || {}) })}
                />
                <span>Percentiles</span>
              </label>
            </div>

            {latencyFmt.mode === "single" ? (
              <div className="mt-2">
                <Input
                  inputMode="decimal"
                  value={latencyFmt.single}
                  onChange={(e) => setOrDelete("preferred_max_latency", parseNum((e.target as HTMLInputElement).value))}
                  placeholder="e.g. 2.5"
                />
                <div className="mt-1 text-[11px] text-zinc-400">Seconds threshold (approx).</div>
              </div>
            ) : (
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(["p50", "p75", "p90", "p99"] as const).map((k) => (
                  <label key={k} className="flex flex-col gap-1">
                    <span className="text-[11px] text-zinc-500">{k}</span>
                    <Input
                      inputMode="decimal"
                      value={String((latencyFmt.p as any)[k] ?? "")}
                      onChange={(e) =>
                        setOrDelete("preferred_max_latency", {
                          ...(latencyFmt.p || {}),
                          [k]: parseNum((e.target as HTMLInputElement).value),
                        })
                      }
                      placeholder="e.g. 2.5"
                    />
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-3 rounded-lg border border-zinc-200 bg-white p-3">
          <div className="mb-2 text-[11px] font-semibold text-zinc-600">Max price (optional)</div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
            {(
              [
                ["prompt", "Prompt"],
                ["completion", "Completion"],
                ["request", "Request"],
                ["image", "Image"],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className="flex flex-col gap-1">
                <span className="text-[11px] text-zinc-500">{label}</span>
                <Input
                  inputMode="decimal"
                  value={String((maxPrice as any)[k] ?? "")}
                  onChange={(e) => {
                    const n = parseNum((e.target as HTMLInputElement).value);
                    const next = { ...(maxPrice as any) };
                    if (n === undefined) delete next[k];
                    else next[k] = n;
                    setOrDelete("max_price", Object.keys(next).length ? next : undefined);
                  }}
                  placeholder="e.g. 0.0005"
                />
              </label>
            ))}
          </div>
          <div className="mt-1 text-[11px] text-zinc-400">
            Values are in $/token for prompt/completion, $/request for request, and $/image for image.
          </div>
        </div>
      </div>
    </div>
  );
}
