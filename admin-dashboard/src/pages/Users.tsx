import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { banUser, listUsers, resetUserVectors } from "../lib/api";
import { Card } from "../components/Card";
import { Table, Th, Td } from "../components/Table";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { fmtDateTime } from "../lib/ui";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useToast } from "../components/ToastProvider";
import { ErrorBox } from "../components/ErrorBox";
import { LoadingState } from "../components/LoadingState";
import { EmptyState } from "../components/EmptyState";
import { CopyButton } from "../components/CopyButton";

function Title(props: { children: React.ReactNode }) {
  return <div className="mb-4 text-xl font-semibold tracking-tight">{props.children}</div>;
}

type ConfirmState = {
  title: string;
  message: string;
  confirmText?: string;
  danger?: boolean;
  disabled?: boolean;
  onConfirm: () => void;
} | null;

export default function Users() {
  const qc = useQueryClient();
  const toast = useToast();

  // Keep a draft value so we don't refetch on every keystroke.
  const [searchDraft, setSearchDraft] = useState("");
  const [searchApplied, setSearchApplied] = useState("");
  const [page, setPage] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);

  const applySearch = () => {
    // Changing the filter should always start from the first page.
    setPage(null);
    setSearchApplied(searchDraft.trim());
  };

  const clearSearch = () => {
    setPage(null);
    setSearchDraft("");
    setSearchApplied("");
  };

  const q = useQuery({
    queryKey: ["users", { search: searchApplied, page }],
    queryFn: () => listUsers({ search: searchApplied.trim() || null, page }),
  });

  const mutBan = useMutation({
    mutationFn: ({ user_id, banned }: { user_id: string; banned: boolean }) => banUser(user_id, banned),
    onSuccess: async (_data, vars) => {
      await qc.invalidateQueries({ queryKey: ["users"] });
      toast.push({
        title: vars.banned ? "User banned" : "User unbanned",
        message: vars.banned ? "The account has been banned." : "The account has been unbanned.",
        variant: "success",
      });
    },
  });

  const mutReset = useMutation({
    mutationFn: (user_id: string) => resetUserVectors(user_id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["users"] });
      toast.push({ title: "Vectors reset", message: "User embedding vectors were cleared.", variant: "success" });
    },
  });

  const canNext = useMemo(() => Boolean(q.data?.next_page), [q.data?.next_page]);

  if (q.isLoading) return <LoadingState />;
if (q.error) return <ErrorBox error={q.error} />;

  const users = (q.data?.users ?? []) as any[];

  return (
    <div className="space-y-6">
      <Title>Users</Title>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title ?? ""}
        message={confirm?.message ?? ""}
        confirmText={confirm?.confirmText}
        danger={confirm?.danger}
        confirmDisabled={confirm?.disabled}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const action = confirm?.onConfirm;
          setConfirm(null);
          action?.();
        }}
      />

      <Card title="Search">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex-1">
            <Input
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applySearch();
              }}
              placeholder="Search by email (partial match)"
            />
          </div>
          <div className="flex items-center gap-2">
            {(searchDraft.trim() || searchApplied.trim()) ? (
              <Button variant="ghost" onClick={clearSearch}>
                Clear
              </Button>
            ) : null}
            <Button variant="ghost" onClick={applySearch}>
              Apply
            </Button>
          </div>
          {searchApplied.trim() ? (
            <div className="mt-2 text-xs text-zinc-500">Applied: <span className="font-mono">{searchApplied}</span></div>
          ) : null}
        </div>
      </Card>

      <Card title="Users">
        <Table>
          <thead>
            <tr>
              <Th>Email</Th>
              <Th>User ID</Th>
              <Th>Created</Th>
              <Th>Status</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {users.length ? (
              users.map((u: any) => {
                const banned = Boolean(u.banned_until);
                return (
                  <tr key={u.id}>
                    <Td className="text-sm">{u.email ?? "—"}</Td>
                    <Td className="font-mono text-xs">
                      <div className="flex items-center gap-2">
                        <span>{u.id}</span>
                        <CopyButton text={String(u.id)} label="Copy" className="h-8 px-2 py-1 text-xs" />
                      </div>
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-zinc-600">{fmtDateTime(u.created_at)}</Td>
                    <Td className={banned ? "text-red-600" : "text-emerald-600"}>{banned ? "banned" : "active"}</Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-2">
                        {banned ? (
                          <Button
                            variant="primary"
                            onClick={() => mutBan.mutate({ user_id: u.id, banned: false })}
                            disabled={mutBan.isPending}
                          >
                            Unban
                          </Button>
                        ) : (
                          <Button
                            variant="danger"
                            onClick={() =>
                              setConfirm({
                                title: "Ban user",
                                message: `Ban ${u.email ?? u.id}? This will block access to the app.`,
                                confirmText: "Ban",
                                danger: true,
                                disabled: mutBan.isPending,
                                onConfirm: () => mutBan.mutate({ user_id: u.id, banned: true }),
                              })
                            }
                            disabled={mutBan.isPending}
                          >
                            Ban
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          onClick={() => mutReset.mutate(u.id)}
                          disabled={mutReset.isPending}
                        >
                          Reset vectors
                        </Button>
                      </div>
                    </Td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <Td colSpan={5} className="p-6">
                  <EmptyState
                    title="No users"
                    message="No users matched your search."
                    className="border-0 bg-transparent p-0"
                  />
                </Td>
              </tr>
            )}
          </tbody>
        </Table>

        <div className="mt-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => setPage(null)} disabled={!page}>
            First page
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setPage(q.data?.next_page ?? null)} disabled={!canNext}>
              Next page
            </Button>
          </div>
        </div>

        {mutBan.isError ? <ErrorBox error={mutBan.error} className="mt-2" /> : null}
        {mutReset.isError ? <ErrorBox error={mutReset.error} className="mt-2" /> : null}
      </Card>
    </div>
  );
}