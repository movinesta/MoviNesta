import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card } from "./Card";
import { Button } from "./Button";
import { ErrorBox } from "./ErrorBox";
import { SliderField } from "./SliderField";
import { getAppSettings, updateAppSettings } from "../lib/api";

type Draft = {
  watchedSyntheticDwellMs: number;
  centroidRefreshSampleRate: number;
  centroidK: number;
  centroidMaxItems: number;
  rateSwipeDeck: number;
  rateSwipeEvent: number;
  coldStartLookback: number;
  coldStartMin: number;
  coldStartLimit: number;
  deckLimit: number;
  deckMax: number;
  rerankTtl: number;
  rerankWindow: number;
};

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function toNumber(v: any, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function FieldRow(props: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-zinc-900">{props.label}</div>
          {props.hint ? <div className="mt-1 text-xs text-zinc-600">{props.hint}</div> : null}
        </div>
        <div className="min-w-[180px]">{props.children}</div>
      </div>
    </div>
  );
}

export function RecsysKnobsEditor() {
  const q = useQuery({ queryKey: ["appSettings"], queryFn: getAppSettings, staleTime: 10_000 });

  const base = useMemo(() => {
    const rows = q.data?.rows ?? [];
    const reg = q.data?.registry ?? {};

    const get = (key: string): any => {
      const row = rows.find((r) => r.key === key);
      if (row && row.value !== undefined) return row.value;
      return (reg as any)?.[key]?.default;
    };

    const rateLimits = get("ops.rate_limits") ?? {};
    const actions = (rateLimits as any)?.actions ?? {};

    return {
      watchedSyntheticDwellMs: clamp(toNumber(get("ranking.swipe.status_watched.synthetic_dwell_ms"), 12000), 0, 600_000),
      centroidRefreshSampleRate: clamp(toNumber(get("ranking.swipe.centroids.refresh_sample_rate"), 0.25), 0, 1),
      centroidK: clamp(Math.round(toNumber(get("ranking.swipe.centroids.k"), 3)), 1, 10),
      centroidMaxItems: clamp(Math.round(toNumber(get("ranking.swipe.centroids.max_items"), 60)), 10, 200),
      rateSwipeDeck: clamp(Math.round(toNumber((actions as any)?.swipe_deck, 120)), 1, 6000),
      rateSwipeEvent: clamp(Math.round(toNumber((actions as any)?.swipe_event, 1000)), 1, 6000),
      coldStartLookback: clamp(toNumber(get("ranking.swipe.cold_start.lookback_days"), 30), 1, 365),
      coldStartMin: clamp(toNumber(get("ranking.swipe.cold_start.min_strong_positive"), 3), 1, 100),
      coldStartLimit: clamp(toNumber(get("ranking.swipe.cold_start.event_limit"), 120), 10, 1000),
      deckLimit: clamp(toNumber(get("ranking.swipe.deck.default_limit"), 60), 10, 200),
      deckMax: clamp(toNumber(get("ranking.swipe.deck.max_limit"), 120), 10, 200),
      rerankTtl: clamp(toNumber(get("ops.rerank.cache_ttl_seconds"), 600), 0, 86400),
      rerankWindow: clamp(toNumber(get("ops.rerank.fresh_window_seconds"), 21600), 60, 604800),
      _rateLimitsRaw: rateLimits,
      _rateActions: actions,
    };
  }, [q.data]);

  const [draft, setDraft] = useState<Draft | null>(null);

  useEffect(() => {
    if (!q.data) return;
    setDraft({
      watchedSyntheticDwellMs: base.watchedSyntheticDwellMs,
      centroidRefreshSampleRate: base.centroidRefreshSampleRate,
      centroidK: base.centroidK,
      centroidMaxItems: base.centroidMaxItems,
      rateSwipeDeck: base.rateSwipeDeck,
      rateSwipeEvent: base.rateSwipeEvent,
      coldStartLookback: base.coldStartLookback,
      coldStartMin: base.coldStartMin,
      coldStartLimit: base.coldStartLimit,
      deckLimit: base.deckLimit,
      deckMax: base.deckMax,
      rerankTtl: base.rerankTtl,
      rerankWindow: base.rerankWindow,
    });
  }, [q.data, base]);

  const mut = useMutation({
    mutationFn: async () => {
      if (!draft) throw new Error("No draft");

      const nextActions = {
        ...(base as any)._rateActions,
        swipe_deck: clamp(Math.round(draft.rateSwipeDeck), 1, 6000),
        swipe_event: clamp(Math.round(draft.rateSwipeEvent), 1, 6000),
      };

      const nextRateLimits = {
        ...(base as any)._rateLimitsRaw,
        actions: nextActions,
      };

      return updateAppSettings({
        expected_version: q.data?.version,
        reason: "Recsys knobs update",
        updates: {
          "ranking.swipe.status_watched.synthetic_dwell_ms": clamp(Math.round(draft.watchedSyntheticDwellMs), 0, 600_000),
          "ranking.swipe.centroids.refresh_sample_rate": clamp(draft.centroidRefreshSampleRate, 0, 1),
          "ranking.swipe.centroids.k": clamp(Math.round(draft.centroidK), 1, 10),
          "ranking.swipe.centroids.max_items": clamp(Math.round(draft.centroidMaxItems), 10, 200),
          "ops.rate_limits": nextRateLimits,
          "ranking.swipe.cold_start.lookback_days": clamp(Math.round(draft.coldStartLookback), 1, 365),
          "ranking.swipe.cold_start.min_strong_positive": clamp(Math.round(draft.coldStartMin), 1, 100),
          "ranking.swipe.cold_start.event_limit": clamp(Math.round(draft.coldStartLimit), 10, 1000),
          "ranking.swipe.deck.default_limit": clamp(Math.round(draft.deckLimit), 10, 200),
          "ranking.swipe.deck.max_limit": clamp(Math.round(draft.deckMax), 10, 200),
          "ops.rerank.cache_ttl_seconds": clamp(Math.round(draft.rerankTtl), 0, 86400),
          "ops.rerank.fresh_window_seconds": clamp(Math.round(draft.rerankWindow), 60, 604800),
        },
      });
    },
    onSuccess: () => q.refetch(),
  });

  const dirty = !!draft && (
    draft.watchedSyntheticDwellMs !== base.watchedSyntheticDwellMs ||
    Math.abs(draft.centroidRefreshSampleRate - base.centroidRefreshSampleRate) > 1e-9 ||
    draft.centroidK !== base.centroidK ||
    draft.centroidMaxItems !== base.centroidMaxItems ||
    draft.rateSwipeDeck !== base.rateSwipeDeck ||
    draft.rateSwipeEvent !== base.rateSwipeEvent ||
    draft.coldStartLookback !== base.coldStartLookback ||
    draft.coldStartMin !== base.coldStartMin ||
    draft.coldStartLimit !== base.coldStartLimit ||
    draft.deckLimit !== base.deckLimit ||
    draft.deckMax !== base.deckMax ||
    draft.rerankTtl !== base.rerankTtl ||
    draft.rerankWindow !== base.rerankWindow
  );

  return (
    <Card
      title="Core knobs"
      subtitle="The key recsys knobs that previously were hard-coded. Saved into app_settings (server_only)."
      right={
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() =>
              setDraft({
                watchedSyntheticDwellMs: base.watchedSyntheticDwellMs,
                centroidRefreshSampleRate: base.centroidRefreshSampleRate,
                centroidK: base.centroidK,
                centroidMaxItems: base.centroidMaxItems,
                rateSwipeDeck: base.rateSwipeDeck,
                rateSwipeEvent: base.rateSwipeEvent,
                coldStartLookback: base.coldStartLookback,
                coldStartMin: base.coldStartMin,
                coldStartLimit: base.coldStartLimit,
                deckLimit: base.deckLimit,
                deckMax: base.deckMax,
                rerankTtl: base.rerankTtl,
                rerankWindow: base.rerankWindow,
              })
            }
            disabled={!dirty || mut.isPending}
          >
            Reset
          </Button>
          <Button onClick={() => mut.mutate()} disabled={!dirty || mut.isPending}>
            {mut.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      }
    >
      {q.isError ? <div className="p-4"><ErrorBox title="Failed to load app settings" error={q.error as any} /></div> : null}
      {mut.isError ? <div className="p-4"><ErrorBox title="Save failed" error={mut.error as any} /></div> : null}
      {mut.isSuccess ? <div className="px-4 pt-4 text-xs text-emerald-700">Saved.</div> : null}

      <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2">
        <div className="space-y-4">
          <FieldRow
            label="Watched → synthetic dwell (ms)"
            hint="When the app marks an item as watched, we emit a synthetic dwell event to train taste feedback. Keep this moderate to avoid over-confident positives."
          >
            <input
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-300"
              type="number"
              min={0}
              max={600000}
              step={1000}
              value={draft?.watchedSyntheticDwellMs ?? base.watchedSyntheticDwellMs}
              onChange={(e) => setDraft((d) => d ? ({ ...d, watchedSyntheticDwellMs: toNumber(e.target.value, d.watchedSyntheticDwellMs) }) : d)}
            />
          </FieldRow>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="mb-3 text-sm font-semibold text-zinc-900">Centroids refresh</div>
            <div className="space-y-3">
              <SliderField
                label="Refresh sample rate"
                value={draft?.centroidRefreshSampleRate ?? base.centroidRefreshSampleRate}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => setDraft((d) => d ? ({ ...d, centroidRefreshSampleRate: v }) : d)}
                hint="Higher = faster adaptation, more DB work."
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="mb-1 text-xs font-semibold text-zinc-700">k (centroids)</div>
                  <input
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-300"
                    type="number"
                    min={1}
                    max={10}
                    step={1}
                    value={draft?.centroidK ?? base.centroidK}
                    onChange={(e) => setDraft((d) => d ? ({ ...d, centroidK: toNumber(e.target.value, d.centroidK) }) : d)}
                  />
                </div>
                <div>
                  <div className="mb-1 text-xs font-semibold text-zinc-700">max items</div>
                  <input
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-300"
                    type="number"
                    min={10}
                    max={200}
                    step={5}
                    value={draft?.centroidMaxItems ?? base.centroidMaxItems}
                    onChange={(e) => setDraft((d) => d ? ({ ...d, centroidMaxItems: toNumber(e.target.value, d.centroidMaxItems) }) : d)}
                  />
                </div>
              </div>
              <div className="text-xs text-zinc-600">These parameters are passed to <span className="font-mono">media_refresh_user_centroids_v1</span>.</div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="mb-3 text-sm font-semibold text-zinc-900">Cold Start</div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="mb-1 text-xs font-semibold text-zinc-700">Lookback (days)</div>
                  <input
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-300"
                    type="number"
                    min={1}
                    max={365}
                    value={draft?.coldStartLookback ?? base.coldStartLookback}
                    onChange={(e) => setDraft((d) => d ? ({ ...d, coldStartLookback: toNumber(e.target.value, d.coldStartLookback) }) : d)}
                  />
                </div>
                <div>
                  <div className="mb-1 text-xs font-semibold text-zinc-700">Min strong signals</div>
                  <input
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-300"
                    type="number"
                    min={1}
                    max={100}
                    value={draft?.coldStartMin ?? base.coldStartMin}
                    onChange={(e) => setDraft((d) => d ? ({ ...d, coldStartMin: toNumber(e.target.value, d.coldStartMin) }) : d)}
                  />
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-700">Event limit</div>
                <input
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-300"
                  type="number"
                  min={10}
                  max={1000}
                  value={draft?.coldStartLimit ?? base.coldStartLimit}
                  onChange={(e) => setDraft((d) => d ? ({ ...d, coldStartLimit: toNumber(e.target.value, d.coldStartLimit) }) : d)}
                />
                <div className="mt-1 text-xs text-zinc-500">Max recent events to weigh</div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="mb-3 text-sm font-semibold text-zinc-900">Deck & Rerank</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-700">Deck Limit</div>
                <input
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-300"
                  type="number"
                  min={10}
                  max={200}
                  value={draft?.deckLimit ?? base.deckLimit}
                  onChange={(e) => setDraft((d) => d ? ({ ...d, deckLimit: toNumber(e.target.value, d.deckLimit) }) : d)}
                />
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-700">Deck Max</div>
                <input
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-300"
                  type="number"
                  min={10}
                  max={200}
                  value={draft?.deckMax ?? base.deckMax}
                  onChange={(e) => setDraft((d) => d ? ({ ...d, deckMax: toNumber(e.target.value, d.deckMax) }) : d)}
                />
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-700">Rerank TTL (s)</div>
                <input
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-300"
                  type="number"
                  min={0}
                  max={86400}
                  value={draft?.rerankTtl ?? base.rerankTtl}
                  onChange={(e) => setDraft((d) => d ? ({ ...d, rerankTtl: toNumber(e.target.value, d.rerankTtl) }) : d)}
                />
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-700">Fresh Window (s)</div>
                <input
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-300"
                  type="number"
                  min={60}
                  max={604800}
                  value={draft?.rerankWindow ?? base.rerankWindow}
                  onChange={(e) => setDraft((d) => d ? ({ ...d, rerankWindow: toNumber(e.target.value, d.rerankWindow) }) : d)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card >
  );
}
