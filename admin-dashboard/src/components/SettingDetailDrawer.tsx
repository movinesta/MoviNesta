import React, { useEffect } from "react";
import { cn } from "../lib/ui";
import { Button } from "./Button";
import type { AppSettingsHistoryRow, AppSettingsRegistryEntry, AppSettingsRow } from "../lib/api";
import type { SettingHint } from "../lib/settingsHints";

function prettyJson(value: any): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatWhen(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return String(iso);
  return d.toLocaleString();
}

type Status = "default" | "overridden" | "redundant";

export function SettingDetailDrawer(props: {
  open: boolean;
  settingKey: string | null;
  entry?: AppSettingsRegistryEntry | null;
  row?: AppSettingsRow | null;
  status?: Status;
  hint?: SettingHint | null;
  effectiveValue?: any;
  draftValue?: any;
  recentHistory?: AppSettingsHistoryRow[] | null;
  onClose: () => void;
  onCopyKey?: () => void;
  onOpenHistory?: () => void;
  onApplyValue?: (value: any) => void;
  onNavigateToKey?: (key: string) => void;
}) {
  const {
    open,
    settingKey,
    entry,
    row,
    status,
    hint,
    effectiveValue,
    draftValue,
    recentHistory,
    onClose,
    onCopyKey,
    onOpenHistory,
    onApplyValue,
    onNavigateToKey,
  } = props;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const impacts = hint?.impacts ?? {};
  const impactKeys = Object.keys(impacts) as Array<keyof typeof impacts>;

  const recs: Array<{ label: string; value: any; why?: string | null }> = [];
  if (hint && hint.recommended !== undefined) recs.push({ label: "Recommended", value: hint.recommended, why: hint.recommended_why ?? null });
  if (hint && hint.recommended_safe !== undefined) recs.push({ label: "Safe", value: hint.recommended_safe, why: hint.recommended_safe_why ?? null });
  if (hint && hint.recommended_aggressive !== undefined) recs.push({ label: "Aggressive", value: hint.recommended_aggressive, why: hint.recommended_aggressive_why ?? null });

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/30" onClick={onClose} />

      <div className="absolute right-0 top-0 flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl" role="dialog" aria-modal="true">
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-4 py-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="truncate font-mono text-xs text-zinc-900">{settingKey ?? "Setting"}</div>
              {entry ? (
                <span
                  className={cn(
                    "rounded-lg px-2 py-1 text-xs font-semibold",
                    entry.scope === "public" && "bg-emerald-100 text-emerald-800",
                    entry.scope === "admin" && "bg-zinc-200 text-zinc-800",
                    entry.scope === "server_only" && "bg-blue-100 text-blue-800",
                  )}
                >
                  {entry.scope}
                </span>
              ) : null}
              {status ? (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    status === "default" && "bg-zinc-100 text-zinc-700",
                    status === "overridden" && "bg-amber-100 text-amber-900",
                    status === "redundant" && "bg-purple-100 text-purple-900",
                  )}
                >
                  {status}
                </span>
              ) : null}
            </div>
            {hint?.title ? <div className="mt-1 text-sm font-semibold text-zinc-900">{hint.title}</div> : null}
            {entry?.description ? <div className="mt-1 text-sm text-zinc-700">{entry.description}</div> : null}
          </div>

          <div className="flex items-center gap-2">
            {onCopyKey ? (
              <Button variant="ghost" onClick={onCopyKey}>
                Copy key
              </Button>
            ) : null}
            {onOpenHistory ? (
              <Button variant="ghost" onClick={onOpenHistory}>
                History
              </Button>
            ) : null}
            <button
              type="button"
              className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {/* What it does */}
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="text-xs font-semibold text-zinc-700">What it does</div>
            <div className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">{hint?.details ?? ""}</div>
            {hint?.caution ? <div className="mt-3 text-sm font-medium text-amber-700">⚠ {hint.caution}</div> : null}

            {impactKeys.length ? (
              <div className="mt-3">
                <div className="text-xs font-semibold text-zinc-700">Impact</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {impactKeys.map((k) => (
                    <span key={String(k)} className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-zinc-700 ring-1 ring-zinc-200">
                      {String(k)}
                      {impacts[k] ? <span className="ml-2 font-normal text-zinc-500">{String(impacts[k])}</span> : null}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {/* Values */}
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="text-xs font-semibold text-zinc-700">Current (effective)</div>
              <pre className="mt-2 max-h-40 overflow-auto rounded-xl border border-zinc-200 bg-zinc-50 p-2 text-xs">{prettyJson(effectiveValue)}</pre>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="text-xs font-semibold text-zinc-700">Draft (will save)</div>
              <pre className="mt-2 max-h-40 overflow-auto rounded-xl border border-zinc-200 bg-zinc-50 p-2 text-xs">{prettyJson(draftValue)}</pre>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="text-xs font-semibold text-zinc-700">Default</div>
              <pre className="mt-2 max-h-40 overflow-auto rounded-xl border border-zinc-200 bg-zinc-50 p-2 text-xs">{prettyJson(entry?.default)}</pre>
            </div>
          </div>

          {/* Examples */}
          <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="text-xs font-semibold text-zinc-700">Real-life examples</div>
            <div className="mt-3 space-y-3">
              {(hint?.examples ?? []).length ? (
                (hint?.examples ?? []).map((ex, idx) => (
                  <div key={idx} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                    <div className="text-xs font-semibold text-zinc-800">{ex.scenario}</div>
                    <div className="mt-1 text-sm text-zinc-700">{ex.effect}</div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-zinc-500">No examples available for this setting yet.</div>
              )}
            </div>
          </div>

          {/* Recommended values */}
          <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-semibold text-zinc-700">Recommended values</div>
              {onApplyValue && recs.length ? <div className="text-xs text-zinc-500">Apply will update the draft (don’t forget to Save).</div> : null}
            </div>

            {recs.length ? (
              <div className="mt-3 space-y-3">
                {recs.map((r) => (
                  <div key={r.label} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold text-zinc-800">{r.label}</div>
                        {r.why ? <div className="mt-1 text-xs text-zinc-600">{r.why}</div> : null}
                      </div>
                      {onApplyValue ? (
                        <Button variant="ghost" onClick={() => onApplyValue(r.value)}>
                          Apply
                        </Button>
                      ) : null}
                    </div>
                    <pre className="mt-2 max-h-44 overflow-auto rounded-xl border border-zinc-200 bg-white p-2 text-xs">{prettyJson(r.value)}</pre>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-2 text-sm text-zinc-500">No curated recommendations for this setting yet.</div>
            )}
          </div>

          {/* Related */}
          {hint?.related?.length ? (
            <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="text-xs font-semibold text-zinc-700">Related settings</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {hint.related.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => onNavigateToKey?.(k)}
                    className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* Recent history */}
          <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-zinc-700">Change history</div>
              {onOpenHistory ? (
                <Button variant="ghost" onClick={onOpenHistory}>
                  View all
                </Button>
              ) : null}
            </div>
            <div className="mt-3 space-y-2">
              {(recentHistory ?? []).length ? (
                (recentHistory ?? []).slice(0, 5).map((h) => (
                  <div key={h.id} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-semibold text-zinc-800">{formatWhen(h.changed_at)}</div>
                      <div className="text-[11px] text-zinc-500">{h.request_id ? `req ${h.request_id}` : ""}</div>
                    </div>
                    {h.change_reason ? <div className="mt-1 text-xs text-zinc-600">{h.change_reason}</div> : null}
                    <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                      <div>
                        <div className="text-[11px] font-semibold text-zinc-600">Old</div>
                        <pre className="mt-1 max-h-28 overflow-auto rounded-lg border border-zinc-200 bg-white p-2 text-[11px]">{prettyJson(h.old_value)}</pre>
                      </div>
                      <div>
                        <div className="text-[11px] font-semibold text-zinc-600">New</div>
                        <pre className="mt-1 max-h-28 overflow-auto rounded-lg border border-zinc-200 bg-white p-2 text-[11px]">{prettyJson(h.new_value)}</pre>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-zinc-500">No history rows found for this key.</div>
              )}
            </div>
          </div>

          {/* Footer spacing */}
          <div className="h-6" />
        </div>
      </div>
    </div>
  );
}
