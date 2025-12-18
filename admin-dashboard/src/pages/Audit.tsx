import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAudit } from "../lib/api";
import type { AuditLogRow } from "../lib/types";
import { Card } from "../components/Card";
import { Table, Th, Td } from "../components/Table";
import { fmtDateTime } from "../lib/ui";
import { Input } from "../components/Input";

function Title(props: { children: React.ReactNode }) {
  return <div className="mb-4 text-xl font-semibold tracking-tight">{props.children}</div>;
}

export default function Audit() {
  const [limit, setLimit] = useState(100);
  const [searchDraft, setSearchDraft] = useState("");
  const [searchApplied, setSearchApplied] = useState("");
  const [before, setBefore] = useState<string | null>(null);
  const [history, setHistory] = useState<(string | null)[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["audit", { limit, search: searchApplied, before }],
    queryFn: () => getAudit({ limit, search: searchApplied.trim() || null, before }),
  });

  const rows = q.data?.rows ?? [];
  const selected = useMemo(() => rows.find((r: AuditLogRow) => String(r.id) === String(selectedId)) ?? null, [rows, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    if (!selected) setSelectedId(null);
  }, [selectedId, selected]);

  useEffect(() => {
    // Changing filters or page size should restart pagination.
    setBefore(null);
    setHistory([]);
    setSelectedId(null);
  }, [limit, searchApplied]);

  const applySearch = () => {
    setSelectedId(null);
    setBefore(null);
    setHistory([]);
    setSearchApplied(searchDraft.trim());
  };

  if (q.isLoading) return <div className="text-sm text-zinc-400">Loading…</div>;
  if (q.error) return <div className="text-sm text-red-400">{(q.error as any).message}</div>;

  return (
    <div className="space-y-6">
      <Title>Audit log</Title>

      <Card title="Filters">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="w-40">
            <Input type="number" value={String(limit)} min={10} max={500} onChange={(e) => setLimit(Number(e.target.value))} />
          </div>
          <div className="flex-1">
            <Input
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applySearch();
              }}
              placeholder="Search action/target (e.g., ban, reset_cursor, embedding_settings)"
            />
          </div>
          <button
            className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900/70"
            onClick={applySearch}
          >
            Apply
          </button>
        </div>
      </Card>

      <Card title="Recent admin actions">
        <Table>
          <thead>
            <tr>
              <Th>At</Th>
              <Th>Admin</Th>
              <Th>Action</Th>
              <Th>Target</Th>
              <Th>Details</Th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((r) => {
                const admin = r.admin_email ?? r.admin_user_id ?? "—";
                const detailsPreview = (() => {
                  try {
                    const s = JSON.stringify(r.details ?? {});
                    return s.length > 120 ? s.slice(0, 120) + "…" : s;
                  } catch {
                    return "{…}";
                  }
                })();

                return (
                  <tr
                    key={r.id}
                    className={
                      "cursor-pointer hover:bg-zinc-900/40 " +
                      (String(selectedId) === String(r.id) ? "bg-zinc-900/60" : "")
                    }
                    onClick={() => setSelectedId(String(r.id))}
                  >
                    <Td className="whitespace-nowrap text-xs text-zinc-400">{fmtDateTime(r.created_at)}</Td>
                    <Td className="max-w-[16rem] truncate text-xs text-zinc-300">{admin}</Td>
                    <Td className="font-mono text-xs">{r.action}</Td>
                    <Td className="font-mono text-xs">{r.target}</Td>
                    <Td className="max-w-[22rem] truncate text-xs text-zinc-300">{detailsPreview}</Td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <Td colSpan={5} className="text-zinc-500">
                  No audit rows yet.
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
                const next = q.data?.next_before ?? null;
                if (!next) return;
                setHistory((h) => [...h, before]);
                setBefore(next);
                setSelectedId(null);
              }}
              disabled={!q.data?.next_before}
            >
              Next
            </button>
          </div>
        </div>
      </Card>

      <AuditDetailsDrawer open={Boolean(selected)} row={selected} onClose={() => setSelectedId(null)} />
    </div>
  );
}

function AuditDetailsDrawer(props: { open: boolean; row: AuditLogRow | null; onClose: () => void }) {
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
  const detailsText = (() => {
    try {
      return JSON.stringify(r.details ?? {}, null, 2);
    } catch {
      return String(r.details ?? "{}");
    }
  })();

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={props.onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-xl border-l border-zinc-800 bg-zinc-950 p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold tracking-tight text-zinc-100">Audit details</div>
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
            <div className="text-xs font-medium text-zinc-500">At</div>
            <div className="text-zinc-200">{fmtDateTime(r.created_at)}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-zinc-500">Admin</div>
            <div className="text-zinc-200">{r.admin_email ?? r.admin_user_id ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-zinc-500">Action</div>
            <div className="font-mono text-xs text-zinc-200">{r.action}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-zinc-500">Target</div>
            <div className="font-mono text-xs text-zinc-200">{r.target}</div>
          </div>
        </div>

        <div className="mt-4">
          <div className="text-xs font-medium text-zinc-500">Details</div>
          <pre className="mt-2 max-h-[65vh] overflow-auto rounded-2xl border border-zinc-800 bg-zinc-900/30 p-3 text-xs text-zinc-200">
            {detailsText}
          </pre>
        </div>
      </div>
    </div>
  );
}
