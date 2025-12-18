import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getLogs } from "../lib/api";
import { Card } from "../components/Card";
import { Table, Th, Td } from "../components/Table";
import { fmtDateTime, fmtInt } from "../lib/ui";
import { Input } from "../components/Input";

function Title(props: { children: React.ReactNode }) {
  return <div className="mb-4 text-xl font-semibold tracking-tight">{props.children}</div>;
}

export default function Logs() {
  const [limit, setLimit] = useState(100);
  const q = useQuery({ queryKey: ["logs", { limit }], queryFn: () => getLogs({ limit }) });

  if (q.isLoading) return <div className="text-sm text-zinc-400">Loading…</div>;
  if (q.error) return <div className="text-sm text-red-400">{(q.error as any).message}</div>;

  const rows = q.data!.rows;

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
              rows.map((r: any) => (
                <tr key={r.id}>
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
      </Card>
    </div>
  );
}
