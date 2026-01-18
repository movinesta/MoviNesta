import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getLogs } from "../lib/api";
import type { JobRunLog } from "../lib/types";
import { Card } from "../components/Card";
import { Table, Th, Td } from "../components/Table";
import { fmtDateTime, fmtInt } from "../lib/ui";
import { Input } from "../components/Input";
import { ErrorBox } from "../components/ErrorBox";
import { LoadingState } from "../components/LoadingState";
import { EmptyState } from "../components/EmptyState";
import { CopyButton } from "../components/CopyButton";
import { Button } from "../components/Button";

function Title(props: { children: React.ReactNode }) {
  return <div className="mb-4 text-xl font-semibold tracking-tight">{props.children}</div>;
}

export default function Logs() {
  const [limit, setLimit] = useState(100);
  const [cursor, setCursor] = useState<string | null>(null);
  const [history, setHistory] = useState<(string | null)[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["logs", { limit, cursor }], queryFn: () => getLogs({ limit, cursor }) });
  const data = q.data;

  // IMPORTANT: keep hooks unconditionally called across renders (avoids React error #310).
  const rows = (data?.rows ?? []) as JobRunLog[];
  const nextCursor = (data as any)?.next_cursor ?? null;

  const selected = useMemo(() => rows.find((r) => String(r.id) === String(selectedId)) ?? null, [rows, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    // If the selected row disappears due to limit change / refresh, close the panel.
    if (!selected) setSelectedId(null);
  }, [selectedId, selected]);

  useEffect(() => {
    // Changing page size should restart pagination.
    setCursor(null);
    setHistory([]);
    setSelectedId(null);
  }, [limit]);

  if (q.isLoading) return <LoadingState />;
  if (q.error) return <ErrorBox error={q.error} />;

  return (
    <div className="space-y-6">
      <Title>Logs</Title>

      <Card title="Job run log">
        <div className="mb-3 flex items-center gap-3">
          <div className="w-40">
            <Input type="number" value={String(limit)} min={10} max={500} onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") return;
                const n = Number(raw);
                if (!Number.isFinite(n)) return;
                const clamped = Math.max(10, Math.min(500, Math.trunc(n)));
                setLimit(clamped);
              }} />
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
                    "cursor-pointer hover:bg-zinc-100 " +
                    (String(selectedId) === String(r.id) ? "bg-zinc-200" : "")
                  }
                  onClick={() => setSelectedId(String(r.id))}
                >
                  <Td className="whitespace-nowrap text-xs text-zinc-600">{fmtDateTime(r.started_at)}</Td>
                  <Td className="whitespace-nowrap text-xs text-zinc-600">{fmtDateTime(r.finished_at)}</Td>
                  <Td className="font-mono text-xs">{r.job_name}</Td>
                  <Td className={r.ok ? "text-emerald-600" : "text-red-600"}>{r.ok ? "OK" : "FAIL"}</Td>
                  <Td className="text-right">{fmtInt(r.scanned)}</Td>
                  <Td className="text-right">{fmtInt(r.embedded)}</Td>
                  <Td className="text-right">{fmtInt(r.total_tokens)}</Td>
                  <Td className="max-w-[20rem] truncate text-xs text-zinc-600">{r.error_message ?? "—"}{r.error_message ? <CopyButton text={String(r.error_message)} label="Copy error" className="ml-2 h-8 px-2 py-1 text-xs" /> : null}</Td>
                </tr>
              ))
            ) : (
              <tr>
                <Td colSpan={8} className="p-6">
                  <EmptyState title="No logs" message="No job logs yet for this range." className="border-0 bg-transparent p-0" />
                </Td>
              </tr>
            )}
          </tbody>
        </Table>

        <div className="mt-4 flex items-center justify-between">
          <Button variant="secondary" type="button"
            className="rounded-xl border border-zinc-200 bg-zinc-100 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-200 disabled:opacity-50"
            onClick={() => {
              setCursor(null);
              setHistory([]);
              setSelectedId(null);
            }}
            disabled={!cursor && history.length === 0}
          >
            First page
          </Button>

          <Button variant="secondary" type="button"
            className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-200"
            onClick={() => {
              setLimit(100);
              setCursor(null);
              setHistory([]);
              setSelectedId(null);
            }}
          >
            Reset defaults
          </Button>

          <div className="ml-auto text-xs text-zinc-500">
            Applied: limit <span className="font-mono">{limit}</span>{cursor ? (
              <>
                {" "}· cursor <span className="font-mono">{cursor}</span>
              </>
            ) : null}
          </div>

          <div className="flex gap-2">
            <Button variant="secondary" type="button"
              className="rounded-xl border border-zinc-200 bg-zinc-100 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-200 disabled:opacity-50"
              onClick={() => {
                const prev = history[history.length - 1] ?? null;
                setHistory((h) => h.slice(0, -1));
                setCursor(prev);
                setSelectedId(null);
              }}
              disabled={history.length === 0}
            >
              Prev
            </Button>
            <Button variant="secondary" type="button"
              className="rounded-xl border border-zinc-200 bg-zinc-100 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-200 disabled:opacity-50"
              onClick={() => {
                if (!nextCursor) return;
                setHistory((h) => [...h, cursor]);
                setCursor(nextCursor);
                setSelectedId(null);
              }}
              disabled={!nextCursor}
            >
              Next
            </Button>
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
      <div className="absolute inset-0 bg-black/40" onClick={props.onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-xl border-l border-zinc-200 bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold tracking-tight text-zinc-900">Job run details</div>
            <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500 font-mono"><span>{r.id}</span><CopyButton text={String(r.id)} label="Copy id" className="h-8 px-2 py-1 text-xs" /></div>
          </div>
          <Button variant="ghost" type="button"
            className="rounded-xl px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100"
            onClick={props.onClose}
            aria-label="Close"
          >
            Close
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs font-medium text-zinc-500">Started</div>
            <div className="text-zinc-700">{fmtDateTime(r.started_at)}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-zinc-500">Finished</div>
            <div className="text-zinc-700">{fmtDateTime(r.finished_at)}</div>
          </div>

          <div>
            <div className="text-xs font-medium text-zinc-500">Job</div>
            <div className="font-mono text-xs text-zinc-700">{r.job_name}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-zinc-500">Status</div>
            <div className={r.ok ? "text-emerald-600" : "text-red-600"}>{r.ok ? "OK" : "FAIL"}</div>
          </div>

          <div>
            <div className="text-xs font-medium text-zinc-500">Provider / Model</div>
            <div className="text-zinc-700">
              <span className="font-mono text-xs">{r.provider ?? "—"}</span>
              <span className="text-zinc-600"> / </span>
              <span className="font-mono text-xs">{r.model ?? "—"}</span>
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-zinc-500">Tokens</div>
            <div className="text-zinc-700">{fmtInt(r.total_tokens)}</div>
          </div>

          <div>
            <div className="text-xs font-medium text-zinc-500">Scanned</div>
            <div className="text-zinc-700">{fmtInt(r.scanned)}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-zinc-500">Embedded</div>
            <div className="text-zinc-700">{fmtInt(r.embedded)}</div>
          </div>

          <div>
            <div className="text-xs font-medium text-zinc-500">Skipped existing</div>
            <div className="text-zinc-700">{fmtInt(r.skipped_existing)}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-zinc-500">Error code</div>
            <div className="font-mono text-xs text-zinc-700">{r.error_code ?? "—"}</div>
          </div>
        </div>

        <div className="mt-4">
          <div className="text-xs font-medium text-zinc-500">Error message</div>
          <div className="mt-1 whitespace-pre-wrap break-words text-sm text-zinc-700">{r.error_message ?? "—"}{r.error_message ? <CopyButton text={String(r.error_message)} label="Copy error" className="ml-2 h-8 px-2 py-1 text-xs" /> : null}</div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between gap-2"><div className="text-xs font-medium text-zinc-500">Meta</div><CopyButton text={metaText} label="Copy JSON" className="h-8 px-2 py-1 text-xs" /></div>
          <pre className="mt-2 max-h-[38vh] overflow-auto rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700">
            {metaText}
          </pre>
        </div>
      </div>
    </div>
  );
}
