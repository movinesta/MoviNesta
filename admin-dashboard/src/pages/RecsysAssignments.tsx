import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card } from "../components/Card";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { Table, Th, Td } from "../components/Table";
import { EmptyState } from "../components/EmptyState";
import { ErrorBox } from "../components/ErrorBox";
import { LoadingState } from "../components/LoadingState";
import { useToast } from "../components/ToastProvider";
import {
  getRecsysAssignments,
  setRecsysAssignment,
  resetRecsysAssignment,
  type RecsysAssignmentRow,
} from "../lib/api";

function Title(props: { children: React.ReactNode }) {
  return <div className="text-xl font-semibold tracking-tight">{props.children}</div>;
}

export default function RecsysAssignments() {
  const toast = useToast();
  const qc = useQueryClient();
  const [searchDraft, setSearchDraft] = useState("");
  const [searchApplied, setSearchApplied] = useState("");

  const applySearch = () => setSearchApplied(searchDraft.trim());
  const clearSearch = () => {
    setSearchDraft("");
    setSearchApplied("");
  };

  const q = useQuery({
    queryKey: ["recsys_assignments", searchApplied],
    queryFn: () => getRecsysAssignments({ user: searchApplied.trim() }),
    enabled: Boolean(searchApplied.trim()),
  });

  const rows = (q.data?.rows ?? []) as RecsysAssignmentRow[];

  const mutSet = useMutation({
    mutationFn: (payload: { experiment_key: string; user_id: string; variant: string }) => setRecsysAssignment(payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["recsys_assignments", searchApplied] });
      toast.push({ title: "Assignment set", message: "Manual variant override applied.", variant: "success" });
    },
  });

  const mutReset = useMutation({
    mutationFn: (payload: { experiment_key: string; user_id: string }) => resetRecsysAssignment(payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["recsys_assignments", searchApplied] });
      toast.push({ title: "Assignment reset", message: "Auto assignment restored.", variant: "success" });
    },
  });

  const isSearching = useMemo(() => Boolean(searchApplied.trim()), [searchApplied]);

  if (q.isLoading) return <LoadingState />;
  if (q.error) return <ErrorBox error={q.error} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Title>Experiment Assignments</Title>
        <Link className="text-sm text-zinc-600 hover:text-zinc-900" to="/recsys">
          ← Back to Recsys
        </Link>
      </div>

      <Card title="Find user">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex-1">
            <Input
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applySearch();
              }}
              placeholder="Search by user id or email"
            />
          </div>
          <div className="flex items-center gap-2">
            {(searchDraft || searchApplied) ? (
              <Button variant="ghost" onClick={clearSearch}>Clear</Button>
            ) : null}
            <Button variant="ghost" onClick={applySearch}>Search</Button>
          </div>
        </div>
        {searchApplied ? (
          <div className="mt-2 text-xs text-zinc-500">
            Applied filter: <span className="font-mono">{searchApplied}</span>
          </div>
        ) : null}
      </Card>

      <Card title="Assignments">
        {!isSearching ? (
          <EmptyState title="Search for a user" message="Enter a UUID or email to inspect experiment assignments." />
        ) : rows.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Experiment</Th>
                <Th>Variant</Th>
                <Th>Mode</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.experiment_key}:${row.user_id}`}>
                  <Td className="font-mono text-xs">{row.experiment_key}</Td>
                  <Td className="text-sm">{row.variant}</Td>
                  <Td className="text-xs text-zinc-600">{row.assignment_mode ?? "auto"}</Td>
                  <Td className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <select
                        className="rounded-xl border border-zinc-200 bg-white px-2 py-1 text-xs"
                        defaultValue={row.variant}
                        onChange={(e) =>
                          mutSet.mutate({ experiment_key: row.experiment_key, user_id: row.user_id, variant: e.target.value })
                        }
                      >
                        {(row.available_variants ?? [row.variant]).map((variant) => (
                          <option key={variant} value={variant}>{variant}</option>
                        ))}
                      </select>
                      <Button
                        variant="ghost"
                        onClick={() => mutReset.mutate({ experiment_key: row.experiment_key, user_id: row.user_id })}
                      >
                        Reset to auto
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState title="No assignments" message="No assignments were found for this user yet." />
        )}
      </Card>
    </div>
  );
}
