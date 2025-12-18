import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getLogs } from "../lib/api";
import type { JobRunLog } from "../lib/types";
import { Card } from "../components/Card";
import { Table, Th, Td } from "../components/Table";
import { fmtDateTime, fmtInt } from "../lib/ui";
import { Input } from "../components/Input";

function Title(props: { children: React.ReactNode }) {
  return <div className="mb-4 text-xl font-semibold tracking-tight">{props.children}</div>;
}

export default function Logs() {
  const [limit, setLimit] = useState(100);
  const [before, setBefore] = useState<string | null>(null);
  const [history, setHistory] = useState<(string | null)[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["logs", { limit, before }], queryFn: () => getLogs({ limit, before }) });

  // IMPORTANT: keep hooks unconditionally called across renders (avoids React error #310).
  const rows = q.data?.rows ?? [];
  const nextBefore = q.data?.next_before ?? null;

  const selected = useMemo(() => rows.find((r) => String(r.id) === String(selectedId)) ?? null, [rows, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    // If the selected row disappears due to limit change / refresh, close the panel.
    if (!selected) setSelectedId(null);
  }, [selectedId, selected]);

  useEffect(() => {
    // Changing page size should restart pagination.
    setBefore(null);
    setHistory([]);
    setSelectedId(null);
  }, [limit]);

  if (q.isLoading) return <div className="text-sm text-zinc-400">Loading…</div>;
  if (q.error) return <div className="text-sm text-red-400">{(q.error as any).message}</div>;

  return (
    <div className="space-y-6">
      <Title>Logs</Title>

      <Card title="Job run log">
        <div className="mb-3 flex items-center gap-3">
          <div className="w-40">
            <Input type="number" value={String(limit)} min={10} max={500} onChange={(e) => setLimit(Number(e.target.value))} />
          </div>
          <div className="text-xs text-zinc-500">Rows</div>
        </div>

        <Table>
          <thead>
            <tr>
              <Th>Started</Th>
              <Th>Finished</Th>
              <Th>Job</Th>
              <Th>Status</Th>
              <Th className="text-right">Scanned</Th>
              <Th className="text-right">Embedded</Th>
              <Th className="text-right">Tokens</Th>
              <Th>Error</Th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((r) => (
                <tr
                  key={r.id}
                  className={
                    "cursor-pointer hover:bg-zinc-900/40 " +
                    (String(selectedId) === String(r.id) ? "bg-zinc-900/60" : "")
                  }
                  onClick={() => setSelectedId(String(r.id))}
                >
                  <Td className="whitespace-nowrap text-xs text-zinc-400">{fmtDateTime(r.started_at)}</Td>
                  <Td className="whitespace-nowrap text-xs text-zinc-400">{fmtDateTime(r.finished_at)}</Td>
                  <Td className="font-mono text-xs">{r.job_name}</Td>
                  <Td className={r.ok ? "text-emerald-300" : "text-red-300"}>{r.ok ? "OK" : "FAIL"}</Td>
                  <Td className="text-right">{fmtInt(r.scanned)}</Td>
                  <Td className="text-right">{fmtInt(r.embedded)}</Td>
                  <Td className="text-right">{fmtInt(r.total_tokens)}</Td>
                  <Td className="max-w-[20rem] truncate text-xs text-zinc-300">{r.error_message ?? "—"}</Td>
                </tr>
              ))
            ) : (
              <tr>
                <Td colSpan={8} className="text-zinc-500">
                  No rows yet.
                </Td>
              </tr>
            )}
          </tbody>
        </Table>

        <div className="mt-4 flex items-center justify-between">
          <button
            className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900/70 disabled:opacity-50"
            onClick={() => {
              setBefore(null);
              setHistory([]);
              setSelectedId(null);
            }}
            disabled={!before && history.length === 0}
          >
            First page
          </button>

          <div className="flex gap-2">
            <button
              className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900/70 disabled:opacity-50"
              onClick={() => {
                const prev = history[history.length - 1] ?? null;
                setHistory((h) => h.slice(0, -1));
                setBefore(prev);
                setSelectedId(null);
              }}
              disabled={history.length === 0}
            >
              Prev
            </button>
            <button
              className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900/70 disabled:opacity-50"
              onClick={() => {
                if (!nextBefore) return;
                setHistory((h) => [...h, before]);
                setBefore(nextBefore);
                setSelectedId(null);
              }}
              disabled={!nextBefore}
            >
              Next
            </button>
          </div>
        </div>
      </Card>

      <LogDetailsDrawer
        open={Boolean(selected)}
        row={selected}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}

function LogDetailsDrawer(props: { open: boolean; row: JobRunLog | null; onClose: () => void }) {
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
  const metaText = (() => {
    try {
      return JSON.stringify(r.meta ?? {}, null, 2);
    } catch {
      return String(r.meta ?? "{}");
    }
  })();

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={props.onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-xl border-l border-zinc-800 bg-zinc-950 p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold tracking-tight text-zinc-100">Job run details</div>
            <div className="mt-1 text-xs text-zinc-500 font-mono">{r.id}</div>
          </div>
          <button
            className="rounded-xl px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900/60"
            onClick={props.onClose}
            aria-label="Close"
          >
            Close
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs font-medium text-zinc-500">Started</div>
            <div className="text-zinc-200">{fmtDateTime(r.started_at)}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-zinc-500">Finished</div>
            <div className="text-zinc-200">{fmtDateTime(r.finished_at)}</div>
          </div>

          <div>
            <div className="text-xs font-medium text-zinc-500">Job</div>
            <div className="font-mono text-xs text-zinc-200">{r.job_name}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-zinc-500">Status</div>
            <div className={r.ok ? "text-emerald-300" : "text-red-300"}>{r.ok ? "OK" : "FAIL"}</div>
          </div>

          <div>
            <div className="text-xs font-medium text-zinc-500">Provider / Model</div>
            <div className="text-zinc-200">
              <span className="font-mono text-xs">{r.provider ?? "—"}</span>
              <span className="text-zinc-600"> / </span>
              <span className="font-mono text-xs">{r.model ?? "—"}</span>
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-zinc-500">Tokens</div>
            <div className="text-zinc-200">{fmtInt(r.total_tokens)}</div>
          </div>

          <div>
            <div className="text-xs font-medium text-zinc-500">Scanned</div>
            <div className="text-zinc-200">{fmtInt(r.scanned)}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-zinc-500">Embedded</div>
            <div className="text-zinc-200">{fmtInt(r.embedded)}</div>
          </div>

          <div>
            <div className="text-xs font-medium text-zinc-500">Skipped existing</div>
            <div className="text-zinc-200">{fmtInt(r.skipped_existing)}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-zinc-500">Error code</div>
            <div className="font-mono text-xs text-zinc-200">{r.error_code ?? "—"}</div>
          </div>
        </div>

        <div className="mt-4">
          <div className="text-xs font-medium text-zinc-500">Error message</div>
          <div className="mt-1 whitespace-pre-wrap break-words text-sm text-zinc-200">{r.error_message ?? "—"}</div>
        </div>

        <div className="mt-4">
          <div className="text-xs font-medium text-zinc-500">Meta</div>
          <pre className="mt-2 max-h-[38vh] overflow-auto rounded-2xl border border-zinc-800 bg-zinc-900/30 p-3 text-xs text-zinc-200">
            {metaText}
          </pre>
        </div>
      </div>
    </div>
  );
}
