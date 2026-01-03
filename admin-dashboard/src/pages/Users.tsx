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

  if (q.isLoading) return <div className="text-sm text-zinc-500">Loading…</div>;
  if (q.error) return <div className="text-sm text-red-400">{(q.error as any).message}</div>;

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
          <Button variant="ghost" onClick={applySearch}>
            Apply
          </Button>
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
            {q.data!.users.map((u) => {
              const banned = Boolean(u.banned_until);
              return (
                <tr key={u.id}>
                  <Td className="text-sm">{u.email ?? "—"}</Td>
                  <Td className="font-mono text-xs">{u.id}</Td>
                  <Td className="whitespace-nowrap text-xs text-zinc-600">{fmtDateTime(u.created_at)}</Td>
                  <Td className={banned ? "text-red-300" : "text-emerald-300"}>{banned ? "banned" : "active"}</Td>
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
                              message: `Ban ${u.email ?? u.id}? They will not be able to sign in until unbanned.`,
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
                        onClick={() =>
                          setConfirm({
                            title: "Reset user vectors",
                            message: `Clear embedding vectors for ${u.email ?? u.id}? This cannot be undone.`,
                            confirmText: "Reset vectors",
                            danger: true,
                            disabled: mutReset.isPending,
                            onConfirm: () => mutReset.mutate(u.id),
                          })
                        }
                        disabled={mutReset.isPending}
                      >
                        Reset vectors
                      </Button>
                    </div>
                  </Td>
                </tr>
              );
            })}
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

        {mutBan.isError ? <div className="mt-2 text-sm text-red-400">{(mutBan.error as any).message}</div> : null}
        {mutReset.isError ? <div className="mt-2 text-sm text-red-400">{(mutReset.error as any).message}</div> : null}
      </Card>
    </div>
  );
}
