import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "./Button";
import { Card } from "./Card";
import { Input } from "./Input";
import { ErrorBox } from "./ErrorBox";
import { getAppSettings, updateAppSettings } from "../lib/api";

type BlendWeights = {
  position: number;
  popularity: number;
  vote_avg: number;
  cf_score: number;
};

type SourceMultipliers = {
  for_you: number;
  combined: number;
  friends: number;
  trending: number;
  cf: number;
  seg_pop: number;
  other: number;
};

type BlendCfg = {
  enabled: boolean;
  skip_when_mix_active: boolean;
  weights: BlendWeights;
  source_multipliers: SourceMultipliers;
};

function clamp(n: number, lo: number, hi: number) {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

function num(v: any, d: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function coerceBlend(x: any): BlendCfg {
  const w = (x && typeof x === "object" ? (x as any).weights : null) ?? {};
  const m = (x && typeof x === "object" ? (x as any).source_multipliers : null) ?? {};

  return {
    enabled: Boolean((x as any)?.enabled ?? true),
    skip_when_mix_active: Boolean((x as any)?.skip_when_mix_active ?? true),
    weights: {
      position: clamp(num(w.position, 1.0), 0, 10),
      popularity: clamp(num(w.popularity, 0.25), 0, 10),
      vote_avg: clamp(num(w.vote_avg, 0.15), 0, 10),
      cf_score: clamp(num(w.cf_score, 1.0), 0, 10),
    },
    source_multipliers: {
      for_you: clamp(num(m.for_you, 1.0), 0, 10),
      combined: clamp(num(m.combined, 1.0), 0, 10),
      friends: clamp(num(m.friends, 1.0), 0, 10),
      trending: clamp(num(m.trending, 1.0), 0, 10),
      cf: clamp(num(m.cf, 1.0), 0, 10),
      seg_pop: clamp(num(m.seg_pop, 0.9), 0, 10),
      other: clamp(num(m.other, 1.0), 0, 10),
    },
  };
}

function SliderField(props: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  const { label, value, onChange, min = 0, max = 3, step = 0.05, hint } = props;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-medium text-zinc-700">{label}</div>
        <div className="flex items-center gap-2">
          <Input
            className="h-8 w-24"
            type="number"
            min={min}
            max={max}
            step={step}
            value={Number.isFinite(value) ? value : 0}
            onChange={(e) => onChange(clamp(Number(e.target.value), min, max))}
          />
        </div>
      </div>
      <input
        className="w-full"
        type="range"
        min={min}
        max={max}
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(clamp(Number(e.target.value), min, max))}
      />
      {hint ? <div className="text-xs text-zinc-500">{hint}</div> : null}
    </div>
  );
}

export function RecsysBlendEditor() {
  const q = useQuery({
    queryKey: ["app_settings"],
    queryFn: async () => getAppSettings(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const registryDefault = useMemo(() => {
    const reg = q.data?.registry ?? {};
    return reg["ranking.swipe.blend"]?.default ?? null;
  }, [q.data?.registry]);

  const currentValue = useMemo(() => {
    const rows = q.data?.rows ?? [];
    const row = rows.find((r) => r.key === "ranking.swipe.blend");
    const v = row?.value ?? registryDefault;
    return coerceBlend(v);
  }, [q.data?.rows, registryDefault]);

  const [draft, setDraft] = useState<BlendCfg | null>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);

  const applyImportJson = () => {
    setImportError(null);
    if (!importText.trim()) {
      setImportError("Paste JSON first.");
      return;
    }
    try {
      const parsed = JSON.parse(importText);

      // Accept either:
      // 1) { weights, source_multipliers, enabled?, skip_when_mix_active? }
      // 2) { ranking: { swipe: { blend: {...} } } }
      // 3) { suggested_source_multipliers: {...} } (from suggest tool output)
      const maybe =
        parsed?.ranking?.swipe?.blend ??
        parsed?.["ranking.swipe.blend"] ??
        parsed?.blend ??
        parsed;

      const nextCfg = {
        enabled: Boolean(maybe?.enabled ?? draft?.enabled ?? true),
        skip_when_mix_active: Boolean(maybe?.skip_when_mix_active ?? draft?.skip_when_mix_active ?? true),
        weights: {
          position: Number(maybe?.weights?.position ?? draft?.weights.position ?? 1),
          popularity: Number(maybe?.weights?.popularity ?? draft?.weights.popularity ?? 0.15),
          vote_avg: Number(maybe?.weights?.vote_avg ?? draft?.weights.vote_avg ?? 0.2),
          cf_score: Number(maybe?.weights?.cf_score ?? draft?.weights.cf_score ?? 1),
        },
        source_multipliers: {
          ...(draft?.source_multipliers ?? registryDefault.source_multipliers),
          ...(maybe?.source_multipliers ?? {}),
          ...(maybe?.suggested_source_multipliers ?? {}),
        },
      } satisfies BlendCfg;

      setDraft(coerceBlend(nextCfg as any));
      setImportOpen(false);
      setImportText("");
    } catch (e: any) {
      setImportError(e?.message ? String(e.message) : "Invalid JSON.");
    }
  };

  useEffect(() => {
    if (!draft && q.data) setDraft(currentValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data]);

  useEffect(() => {
    // keep in sync on refetch, but don't clobber local edits if user has changed something
    if (!draft) return;
    // if draft matches currentValue, update silently (e.g., on login refresh)
    const same = JSON.stringify(draft) === JSON.stringify(currentValue);
    if (same) setDraft(currentValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentValue]);

  const mut = useMutation({
    mutationFn: async (payload: { cfg: BlendCfg; reason: string }) => {
      const expected = q.data?.version;
      return updateAppSettings({ expected_version: expected, updates: { "ranking.swipe.blend": payload.cfg }, reason: payload.reason });
    },
    onSuccess: async () => {
      await q.refetch();
    },
  });

  const canSave = !!draft && !mut.isPending;

  return (
    <Card className="p-0">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-zinc-900">Swipe Blend Calibration</div>
          <div className="text-xs text-zinc-600">
            Controls the score-based reorder step (feature weights + per-source multipliers). Stored as <span className="font-mono">ranking.swipe.blend</span> (server_only).
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setImportError(null);
              setImportOpen(true);
            }}
            disabled={mut.isPending || q.isLoading}
            title="Paste JSON to update multipliers/weights (e.g., output of suggest_blend_calibration)"
          >
            Import JSON
          </Button>
          <Button
            variant="secondary"
            onClick={() => setDraft(currentValue)}
            disabled={mut.isPending || q.isLoading}
            title="Reset editor to current saved values"
          >
            Reset
          </Button>
          <Button
            onClick={() => draft && mut.mutate({ cfg: draft, reason: "Update swipe blend calibration" })}
            disabled={!canSave}
          >
            Save
          </Button>
        </div>
      </div>

      {importOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setImportOpen(false)} />
          <div className="relative w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl">
            <div className="text-lg font-semibold tracking-tight text-zinc-900">Import blend JSON</div>
            <div className="mt-2 text-sm text-zinc-600">
              Paste either <span className="font-mono">{`{"weights":..., "source_multipliers":...}`}</span> or the full{" "}
              <span className="font-mono">ranking.swipe.blend</span> object, or the output of{" "}
              <span className="font-mono">suggest_blend_calibration.mjs</span>.
            </div>

            <textarea
              className="mt-4 h-56 w-full rounded-xl border border-zinc-200 bg-white p-3 font-mono text-xs text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-300"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder='{"suggested_source_multipliers": {"cf": 1.1, "trending": 0.95}}'
            />

            {importError ? <div className="mt-3 text-sm text-red-700">{importError}</div> : null}

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setImportOpen(false)}>
                Cancel
              </Button>
              <Button onClick={applyImportJson}>Apply</Button>
            </div>
          </div>
        </div>
      ) : null}
      {q.isError ? <div className="p-4"><ErrorBox title="Failed to load app settings" error={q.error as any} /></div> : null}

      <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-zinc-800">
              <input
                type="checkbox"
                checked={Boolean(draft?.enabled ?? true)}
                onChange={(e) => setDraft((d) => (d ? { ...d, enabled: e.target.checked } : d))}
              />
              Enabled
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-800">
              <input
                type="checkbox"
                checked={Boolean(draft?.skip_when_mix_active ?? true)}
                onChange={(e) => setDraft((d) => (d ? { ...d, skip_when_mix_active: e.target.checked } : d))}
              />
              Skip when mix active
            </label>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="mb-3 text-sm font-semibold text-zinc-900">Feature weights</div>
            <div className="space-y-3">
              <SliderField
                label="Position"
                value={draft?.weights.position ?? 1.0}
                min={0}
                max={3}
                step={0.05}
                onChange={(v) => setDraft((d) => (d ? { ...d, weights: { ...d.weights, position: v } } : d))}
                hint="Higher = prefer earlier candidates (stability)."
              />
              <SliderField
                label="Popularity"
                value={draft?.weights.popularity ?? 0.25}
                min={0}
                max={2}
                step={0.05}
                onChange={(v) => setDraft((d) => (d ? { ...d, weights: { ...d.weights, popularity: v } } : d))}
                hint="Higher = more blockbuster bias."
              />
              <SliderField
                label="Vote avg"
                value={draft?.weights.vote_avg ?? 0.15}
                min={0}
                max={2}
                step={0.05}
                onChange={(v) => setDraft((d) => (d ? { ...d, weights: { ...d.weights, vote_avg: v } } : d))}
                hint="Higher = prefer higher-rated items."
              />
              <SliderField
                label="CF score"
                value={draft?.weights.cf_score ?? 1.0}
                min={0}
                max={3}
                step={0.05}
                onChange={(v) => setDraft((d) => (d ? { ...d, weights: { ...d.weights, cf_score: v } } : d))}
                hint="Higher = more personalized (ALS) influence."
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="mb-3 text-sm font-semibold text-zinc-900">Source multipliers</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(
              [
                ["for_you", "For You"],
                ["combined", "Combined"],
                ["friends", "Friends"],
                ["trending", "Trending"],
                ["cf", "CF"],
                ["seg_pop", "Seg-pop"],
                ["other", "Other"],
              ] as const
            ).map(([k, label]) => (
              <SliderField
                key={k}
                label={label}
                value={(draft?.source_multipliers as any)?.[k] ?? 1.0}
                min={0}
                max={2}
                step={0.05}
                onChange={(v) =>
                  setDraft((d) => (d ? { ...d, source_multipliers: { ...d.source_multipliers, [k]: v } as any } : d))
                }
                hint=""
              />
            ))}
          </div>
          <div className="mt-3 text-xs text-zinc-600">
            Tip: generate suggested multipliers from logs using <span className="font-mono">scripts/recsys/suggest_blend_calibration.mjs</span>.
          </div>

          {mut.isError ? (
            <div className="mt-3">
              <ErrorBox title="Save failed" error={mut.error as any} />
            </div>
          ) : null}

          {mut.isSuccess ? <div className="mt-3 text-xs text-emerald-700">Saved.</div> : null}
        </div>
      </div>
    </Card>
  );
}
