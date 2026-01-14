import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  approveVerificationRequest,
  verifyUserDirect,
  getVerificationRequest,
  listVerificationRequests,
  listVerifiedUsers,
  needsMoreInfoVerificationRequest,
  rejectVerificationRequest,
  revokeVerifiedUser,
} from "../lib/api";
import { supabase } from "../lib/supabaseClient";
import { Card } from "../components/Card";
import { Table, Th, Td } from "../components/Table";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ErrorBox } from "../components/ErrorBox";
import { LoadingState } from "../components/LoadingState";
import { EmptyState } from "../components/EmptyState";
import { useToast } from "../components/ToastProvider";
import { fmtDateTime } from "../lib/ui";

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

type BadgeType = "identity" | "official" | "trusted_verifier" | "subscription";

function BadgeTypeSelect(props: { value: BadgeType; onChange: (v: BadgeType) => void }) {
  return (
    <select
      className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm"
      value={props.value}
      onChange={(e) => props.onChange(e.target.value as BadgeType)}
    >
      <option value="identity">Identity</option>
      <option value="official">Official</option>
      <option value="trusted_verifier">Trusted verifier</option>
      <option value="subscription">Subscription</option>
    </select>
  );
}

function BadgeChip(props: { type?: string | null; label?: string | null }) {
  const t = String(props.type ?? "").trim();
  const l = String(props.label ?? "").trim();
  const txt = l || (t ? t.replace(/_/g, " ") : "");
  if (!txt) return null;
  return <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">{txt}</span>;
}

export default function Verification() {
  const qc = useQueryClient();
  const toast = useToast();

  const [tab, setTab] = useState<"requests" | "verified" | "direct">("requests");
  const [status, setStatus] = useState<"pending" | "needs_more_info" | "approved" | "rejected" | "none">("pending");
  const [searchDraft, setSearchDraft] = useState("");
  const [searchApplied, setSearchApplied] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);

  // Direct verify state (admin-only)
  const [dvSearchDraft, setDvSearchDraft] = useState("");
  const [dvSearchApplied, setDvSearchApplied] = useState("");
  const [dvUserIdDraft, setDvUserIdDraft] = useState("");
  const [dvUserIdApplied, setDvUserIdApplied] = useState("");
  const [dvSelected, setDvSelected] = useState<any | null>(null);
  const [dvType, setDvType] = useState<BadgeType>("identity");
  const [dvLabel, setDvLabel] = useState("");
  const [dvOrg, setDvOrg] = useState("");
  const [dvNote, setDvNote] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);

  const [approveType, setApproveType] = useState<BadgeType>("identity");
  const [approveLabel, setApproveLabel] = useState("");
  const [approveOrg, setApproveOrg] = useState("");
  const [needsMoreInfoNote, setNeedsMoreInfoNote] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [needsInfoNote, setNeedsInfoNote] = useState("");

  const applySearch = () => {
    setCursor(null);
    setSearchApplied(searchDraft.trim());
  };
  const clearSearch = () => {
    setCursor(null);
    setSearchDraft("");
    setSearchApplied("");
  };

  const qRequests = useQuery({
    enabled: tab === "requests",
    queryKey: ["verification", "requests", { status, search: searchApplied, cursor }],
    queryFn: () => listVerificationRequests({ status, search: searchApplied, cursor: cursor ?? 0, limit: 50 }),
  });

  const qVerified = useQuery({
    enabled: tab === "verified",
    queryKey: ["verification", "verified", { cursor }],
    queryFn: () => listVerifiedUsers({ cursor: cursor ?? 0, limit: 50 }),
  });

  const qDetail = useQuery({
    enabled: Boolean(selectedId) && tab === "requests",
    queryKey: ["verification", "request", { id: selectedId }],
    queryFn: () => getVerificationRequest({ request_id: selectedId! }),
  });

  const mutApprove = useMutation({
    mutationFn: () => approveVerificationRequest({
      request_id: selectedId!,
      badge_type: approveType,
      public_label: approveLabel.trim() || undefined,
      verifier_org: approveOrg.trim() || undefined,
    }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["verification"] });
      toast.push({ title: "Approved", message: "Verification has been granted.", variant: "success" });
      setSelectedId(null);
      setApproveLabel("");
      setApproveOrg("");
      setRejectReason("");
    },
  });

  const mutReject = useMutation({
    mutationFn: () => rejectVerificationRequest({ request_id: selectedId!, reason: rejectReason.trim() || undefined }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["verification"] });
      toast.push({ title: "Rejected", message: "Request has been rejected.", variant: "success" });
      setSelectedId(null);
      setRejectReason("");
      setNeedsMoreInfoNote("");
    },
  });

  const mutNeedsMoreInfo = useMutation({
    mutationFn: () => needsMoreInfoVerificationRequest({ request_id: selectedId!, note: needsMoreInfoNote.trim() || undefined }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["verification"] });
      toast.push({ title: "Needs more info", message: "The user has been asked for more evidence.", variant: "success" });
      setSelectedId(null);
      setNeedsMoreInfoNote("");
    },
  });

  function sanitizeSearch(v: string) {
    return v.replace(/[^a-zA-Z0-9 _.-]/g, "").trim();
  }

  const applyDirectSearch = () => {
    setDvSelected(null);
    const uid = dvUserIdDraft.trim();
    if (uid) {
      setDvUserIdApplied(uid);
      setDvSearchApplied("");
      return;
    }
    setDvUserIdApplied("");
    setDvSearchApplied(sanitizeSearch(dvSearchDraft));
  };
  const clearDirectSearch = () => {
    setDvSelected(null);
    setDvSearchDraft("");
    setDvSearchApplied("");
    setDvUserIdDraft("");
    setDvUserIdApplied("");
  };

  const qDirectUsers = useQuery({
    enabled: tab === "direct" && (Boolean(dvUserIdApplied.trim()) || Boolean(dvSearchApplied.trim())),
    queryKey: ["verification", "direct", { q: dvSearchApplied, user_id: dvUserIdApplied }],
    queryFn: async () => {
      const uid = dvUserIdApplied.trim();
      if (uid) {
        const { data, error } = await supabase
          .from("profiles_public")
          .select("id, username, display_name, avatar_url, is_verified, verified_type, verified_label, verified_at, verified_by_org")
          .eq("id", uid)
          .limit(1);
        if (error) throw new Error(error.message);
        return data ?? [];
      }

      const q = dvSearchApplied.trim();
      if (!q) return [];
      const { data, error } = await supabase
        .from("profiles_public")
        .select("id, username, display_name, avatar_url, is_verified, verified_type, verified_label, verified_at, verified_by_org")
        .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
        .limit(20);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });



  const mutRevoke = useMutation({
    mutationFn: ({ user_id, reason }: { user_id: string; reason?: string }) => revokeVerifiedUser({ user_id, reason }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["verification"] });
      toast.push({ title: "Revoked", message: "Verification has been revoked.", variant: "success" });
    },
  });

  const mutDirectVerify = useMutation({
    mutationFn: async () => {
      if (!dvSelected?.id) throw new Error("Select a user first");
      return verifyUserDirect({
        user_id: dvSelected.id,
        badge_type: dvType,
        public_label: dvLabel.trim() || undefined,
        verifier_org: dvOrg.trim() || undefined,
        note: dvNote.trim() || undefined,
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["verification"] });
      await qDirectUsers.refetch();
      toast.push({ title: "Saved", message: "Verification has been applied.", variant: "success" });

      // Refresh selected user from latest search results
      const latest = (qDirectUsers.data ?? []).find((u: any) => u.id === dvSelected?.id);
      if (latest) setDvSelected(latest);
    },
  });

  const rowsRequests = (qRequests.data?.requests ?? []) as any[];
  const rowsVerified = (qVerified.data?.verified ?? []) as any[];

  const canNext = useMemo(() => {
    const next = tab === "requests" ? qRequests.data?.next_cursor : qVerified.data?.next_cursor;
    return Boolean(next);
  }, [tab, qRequests.data?.next_cursor, qVerified.data?.next_cursor]);

  const nextCursor = tab === "requests" ? qRequests.data?.next_cursor : qVerified.data?.next_cursor;

  const detail = (qDetail.data as any)?.request ?? null;
  const detailUser = detail?.user ?? null;

  return (
    <div className="space-y-6">
      <Title>Verification</Title>

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

      <Card title="Tabs">
        <div className="flex flex-wrap gap-2">
          <Button variant={tab === "requests" ? "primary" : "ghost"} onClick={() => { setCursor(null); setTab("requests"); }}>
            Requests
          </Button>
          <Button variant={tab === "verified" ? "primary" : "ghost"} onClick={() => { setCursor(null); setTab("verified"); }}>
            Verified directory
          </Button>
          <Button variant={tab === "direct" ? "primary" : "ghost"} onClick={() => { setCursor(null); setTab("direct"); }}>
            Direct verify
          </Button>
        </div>
      </Card>

      {tab !== "direct" ? (
      <Card title="Filters">
        <div className="grid gap-3 md:grid-cols-3 md:items-end">
          <div>
            <div className="mb-1 text-xs font-medium text-zinc-600">Search</div>
            <Input
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") applySearch(); }}
              placeholder="Search by username, display name, or user id"
            />
          </div>

          <div>
            <div className="mb-1 text-xs font-medium text-zinc-600">Status</div>
            <select
              disabled={tab !== "requests"}
              className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm disabled:opacity-50"
              value={status}
              onChange={(e) => { setCursor(null); setStatus(e.target.value as any); }}
            >
              <option value="pending">Pending</option>
              <option value="needs_more_info">Needs more info</option>
              <option value="approved">Approved (requests)</option>
              <option value="rejected">Rejected (requests)</option>
              <option value="none">None</option>
            </select>
            {tab !== "requests" ? <div className="mt-1 text-xs text-zinc-500">Status filter applies to Requests only.</div> : null}
          </div>

          <div className="flex items-center gap-2">
            {(searchDraft.trim() || searchApplied.trim()) ? (
              <Button variant="ghost" onClick={clearSearch}>Clear</Button>
            ) : null}
            <Button variant="ghost" onClick={applySearch}>Apply</Button>
          </div>
        </div>
        {searchApplied.trim() ? (
          <div className="mt-2 text-xs text-zinc-500">Applied: <span className="font-mono">{searchApplied}</span></div>
        ) : null}
      </Card>
      ) : null}

      {tab === "direct" ? (
        <Card title="Direct verify (no request required)">
          <div className="grid gap-3 md:grid-cols-4 md:items-end">
            <div>
              <div className="mb-1 text-xs font-medium text-zinc-600">Search by username / display name</div>
              <Input
                value={dvSearchDraft}
                onChange={(e) => setDvSearchDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") applyDirectSearch(); }}
                placeholder="e.g. thulfiqar"
              />
            </div>
            <div>
              <div className="mb-1 text-xs font-medium text-zinc-600">Or paste User ID</div>
              <Input
                value={dvUserIdDraft}
                onChange={(e) => setDvUserIdDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") applyDirectSearch(); }}
                placeholder="uuid"
              />
            </div>
            <div className="flex items-center gap-2 md:col-span-2">
              {(dvSearchDraft.trim() || dvSearchApplied.trim() || dvUserIdDraft.trim() || dvUserIdApplied.trim()) ? (
                <Button variant="ghost" onClick={clearDirectSearch}>Clear</Button>
              ) : null}
              <Button variant="ghost" onClick={applyDirectSearch}>Search</Button>
            </div>
          </div>

          {(dvSearchApplied || dvUserIdApplied) ? (
            <div className="mt-2 text-xs text-zinc-500">
              Applied: <span className="font-mono">{dvUserIdApplied || dvSearchApplied}</span>
            </div>
          ) : null}

          <div className="mt-4">
            {qDirectUsers.isLoading ? (
              <LoadingState />
            ) : qDirectUsers.error ? (
              <ErrorBox error={qDirectUsers.error} />
            ) : (qDirectUsers.data ?? []).length ? (
              <Table>
                <thead>
                  <tr>
                    <Th>User</Th>
                    <Th>Status</Th>
                    <Th>Badge</Th>
                    <Th className="text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {(qDirectUsers.data ?? []).map((u: any) => (
                    <tr key={u.id}>
                      <Td>
                        <div className="flex items-center gap-3">
                          {u.avatar_url ? (
                            <img src={u.avatar_url} alt="" className="h-8 w-8 rounded-full" />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-zinc-100" />
                          )}
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">{u.display_name || u.username || u.id}</div>
                            <div className="truncate text-xs text-zinc-500">@{u.username || "(no username)"} · <span className="font-mono">{u.id}</span></div>
                          </div>
                        </div>
                      </Td>
                      <Td>
                        {u.is_verified ? <span className="text-sm font-medium text-emerald-700">Verified</span> : <span className="text-sm text-zinc-600">Not verified</span>}
                      </Td>
                      <Td>
                        <BadgeChip type={u.verified_type} label={u.verified_label} />
                      </Td>
                      <Td className="text-right">
                        <Button
                          variant={dvSelected?.id === u.id ? "primary" : "ghost"}
                          onClick={() => {
                            setDvSelected(u);
                            setDvLabel(String(u.verified_label ?? ""));
                            setDvOrg(String(u.verified_by_org ?? ""));
                            setDvType((u.verified_type as any) || "identity");
                          }}
                        >
                          {dvSelected?.id === u.id ? "Selected" : "Select"}
                        </Button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <EmptyState title="No users found" message="Try a different search term or paste a user id." />
            )}
          </div>

          {dvSelected ? (
            <div className="mt-6 rounded-2xl border border-zinc-200 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-semibold">Selected:</div>
                  <div className="text-sm">{dvSelected.display_name || dvSelected.username || dvSelected.id}</div>
                  <BadgeChip type={dvSelected.verified_type} label={dvSelected.verified_label} />
                </div>
                {dvSelected.is_verified ? (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      const reason = `Revoked by admin (direct screen)`;
                      setConfirm({
                        title: "Revoke verification",
                        message: `Revoke verification for @${dvSelected.username || dvSelected.id}?`,
                        danger: true,
                        confirmText: "Revoke",
                        onConfirm: () => mutRevoke.mutate({ user_id: dvSelected.id, reason }),
                      });
                    }}
                  >
                    Revoke
                  </Button>
                ) : null}
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <div className="mb-1 text-xs font-medium text-zinc-600">Badge type</div>
                  <BadgeTypeSelect value={dvType} onChange={setDvType} />
                </div>
                <div>
                  <div className="mb-1 text-xs font-medium text-zinc-600">Public label (optional)</div>
                  <Input value={dvLabel} onChange={(e) => setDvLabel(e.target.value)} placeholder="Shown in badge popover" />
                </div>
                <div>
                  <div className="mb-1 text-xs font-medium text-zinc-600">Verifier org (optional)</div>
                  <Input value={dvOrg} onChange={(e) => setDvOrg(e.target.value)} placeholder="e.g. MoviNesta" />
                </div>
              </div>

              <div className="mt-3">
                <div className="mb-1 text-xs font-medium text-zinc-600">Internal note (admin-only)</div>
                <textarea
                  className="w-full rounded-xl border border-zinc-200 bg-white p-3 text-sm"
                  rows={4}
                  value={dvNote}
                  onChange={(e) => setDvNote(e.target.value)}
                  placeholder="Evidence summary, links, or reason for direct verification"
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  disabled={mutDirectVerify.isLoading}
                  onClick={() => {
                    setConfirm({
                      title: dvSelected.is_verified ? "Update verification" : "Verify user",
                      message: `This will apply verification to @${dvSelected.username || dvSelected.id} and make it visible in the app. Continue?`,
                      confirmText: dvSelected.is_verified ? "Update" : "Verify",
                      onConfirm: () => mutDirectVerify.mutate(),
                    });
                  }}
                >
                  {dvSelected.is_verified ? "Update verification" : "Verify"}
                </Button>
              </div>
            </div>
          ) : null}
        </Card>
      ) : null}

      {tab === "requests" ? (
        qRequests.isLoading ? <LoadingState /> : qRequests.error ? <ErrorBox error={qRequests.error} /> : (
          <Card title="Requests">
            {rowsRequests.length ? (
              <>
                <Table>
                  <thead>
                    <tr>
                      <Th>User</Th>
                      <Th>Submitted</Th>
                      <Th>Suggested type</Th>
                      <Th>Evidence</Th>
                      <Th className="text-right">Actions</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {rowsRequests.map((r) => (
                      <tr key={r.id}>
                        <Td>
                          <div className="flex items-center gap-2">
                            {r.user?.avatar_url ? (
                              <img src={r.user.avatar_url} className="h-7 w-7 rounded-full" alt="" />
                            ) : (
                              <div className="h-7 w-7 rounded-full bg-zinc-200" />
                            )}
                            <div className="min-w-0">
                              <div className="truncate font-medium">{r.user?.display_name ?? r.user?.username ?? r.user_id}</div>
                              <div className="truncate text-xs text-zinc-500">@{r.user?.username ?? "—"}</div>
                            </div>
                          </div>
                        </Td>
                        <Td className="text-sm text-zinc-700">{fmtDateTime(r.submitted_at)}</Td>
                        <Td><BadgeChip type={r.badge_type} label={null} /></Td>
                        <Td className="text-xs text-zinc-700">{r.evidence ? "Yes" : "—"}</Td>
                        <Td className="text-right">
                          <Button variant="ghost" onClick={() => setSelectedId(r.id)}>Review</Button>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>

                <div className="mt-3 flex items-center justify-between">
                  <Button
                    variant="ghost"
                    disabled={!cursor}
                    onClick={() => setCursor(null)}
                  >
                    First page
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={!canNext}
                    onClick={() => setCursor(nextCursor ?? null)}
                  >
                    Next
                  </Button>
                </div>
              </>
            ) : (
              <EmptyState title="No requests" message="No verification requests match your current filters." />
            )}
          </Card>
        )
      ) : tab === "verified" ? (
        qVerified.isLoading ? <LoadingState /> : qVerified.error ? <ErrorBox error={qVerified.error} /> : (
          <Card title="Verified directory">
            {rowsVerified.length ? (
              <>
                <Table>
                  <thead>
                    <tr>
                      <Th>User</Th>
                      <Th>Type</Th>
                      <Th>Verified at</Th>
                      <Th>Org</Th>
                      <Th className="text-right">Actions</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {rowsVerified.map((r) => (
                      <tr key={r.user_id}>
                        <Td>
                          <div className="flex items-center gap-2">
                            {r.user?.avatar_url ? (
                              <img src={r.user.avatar_url} className="h-7 w-7 rounded-full" alt="" />
                            ) : (
                              <div className="h-7 w-7 rounded-full bg-zinc-200" />
                            )}
                            <div className="min-w-0">
                              <div className="truncate font-medium">{r.user?.display_name ?? r.user?.username ?? r.user_id}</div>
                              <div className="truncate text-xs text-zinc-500">@{r.user?.username ?? "—"}</div>
                            </div>
                          </div>
                        </Td>
                        <Td><BadgeChip type={r.badge_type} label={r.public_label} /></Td>
                        <Td className="text-sm text-zinc-700">{r.verified_at ? fmtDateTime(r.verified_at) : "—"}</Td>
                        <Td className="text-sm text-zinc-700">{r.verifier_org ?? "—"}</Td>
                        <Td className="text-right">
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setConfirm({
                                title: "Revoke verification",
                                message: "This will remove the badge from the app. You can re-verify later.",
                                danger: true,
                                confirmText: "Revoke",
                                onConfirm: () => mutRevoke.mutate({ user_id: r.user_id }),
                              });
                            }}
                          >
                            Revoke
                          </Button>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>

                <div className="mt-3 flex items-center justify-between">
                  <Button variant="ghost" disabled={!cursor} onClick={() => setCursor(null)}>First page</Button>
                  <Button variant="ghost" disabled={!canNext} onClick={() => setCursor(nextCursor ?? null)}>Next</Button>
                </div>
              </>
            ) : (
              <EmptyState title="No verified users" message="No verified users were found." />
            )}
          </Card>
        )
      ) : null}

      {/* Review modal (simple overlay) */}
      {selectedId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold tracking-tight">Review request</div>
                <div className="mt-1 text-xs text-zinc-500">ID: <span className="font-mono">{selectedId}</span></div>
              </div>
              <Button variant="ghost" onClick={() => setSelectedId(null)}>Close</Button>
            </div>

            {qDetail.isLoading ? <div className="mt-4"><LoadingState /></div> : qDetail.error ? (
              <div className="mt-4"><ErrorBox error={qDetail.error} /></div>
            ) : (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Card title="User">
                  <div className="flex items-center gap-3">
                    {detailUser?.avatar_url ? (
                      <img src={detailUser.avatar_url} className="h-10 w-10 rounded-full" alt="" />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-zinc-200" />
                    )}
                    <div className="min-w-0">
                      <div className="truncate font-medium">{detailUser?.display_name ?? detailUser?.username ?? detail?.user_id}</div>
                      <div className="truncate text-xs text-zinc-500">@{detailUser?.username ?? "—"}</div>
                      <div className="mt-1 text-xs text-zinc-500">User ID: <span className="font-mono">{detail?.user_id}</span></div>
                      {detailUser?.is_verified ? (
                        <div className="mt-2"><BadgeChip type={detailUser?.verified_type} label={detailUser?.verified_label} /></div>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-zinc-500">Submitted: {detail?.submitted_at ? fmtDateTime(detail.submitted_at) : "—"}</div>
                </Card>

                <Card title="Evidence / Notes">
                  <div className="text-xs text-zinc-500">Suggested type: <span className="font-mono">{String(detail?.badge_type ?? "—")}</span></div>
                  {detail?.notes ? <div className="mt-2 rounded-xl bg-zinc-50 p-3 text-sm text-zinc-800 whitespace-pre-wrap">{detail.notes}</div> : null}
                  {detail?.evidence ? (
                    <pre className="mt-2 max-h-64 overflow-auto rounded-xl bg-zinc-50 p-3 text-xs text-zinc-800">{JSON.stringify(detail.evidence, null, 2)}</pre>
                  ) : (
                    <div className="mt-2 text-sm text-zinc-700">No evidence provided.</div>
                  )}
                </Card>

                <Card title="Approve">
                  <div className="space-y-3">
                    <div>
                      <div className="mb-1 text-xs font-medium text-zinc-600">Badge type</div>
                      <BadgeTypeSelect value={approveType} onChange={setApproveType} />
                    </div>
                    <div>
                      <div className="mb-1 text-xs font-medium text-zinc-600">Public label (optional)</div>
                      <Input value={approveLabel} onChange={(e) => setApproveLabel(e.target.value)} placeholder="e.g., Identity verified" />
                    </div>
                    <div>
                      <div className="mb-1 text-xs font-medium text-zinc-600">Verifier org (optional)</div>
                      <Input value={approveOrg} onChange={(e) => setApproveOrg(e.target.value)} placeholder="e.g., MoviNesta" />
                    </div>
                    <Button
                      onClick={() => mutApprove.mutate()}
                      disabled={mutApprove.isPending}
                    >
                      {mutApprove.isPending ? "Approving…" : "Approve"}
                    </Button>
                  </div>
                </Card>

                <Card title="Needs more info">
                  <div className="space-y-3">
                    <div>
                      <div className="mb-1 text-xs font-medium text-zinc-600">Note to the user</div>
                      <textarea
                        className="min-h-[110px] w-full rounded-xl border border-zinc-200 bg-white p-3 text-sm"
                        value={needsMoreInfoNote}
                        onChange={(e) => setNeedsMoreInfoNote(e.target.value)}
                        placeholder="Ask for missing links, proof of ownership, etc."
                      />
                      <div className="mt-1 text-xs text-zinc-500">This moves the request to <span className="font-mono">needs_more_info</span>. The user can resubmit and it will return to <span className="font-mono">pending</span>.</div>
                    </div>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setConfirm({
                          title: "Request more information",
                          message: "Mark this request as needs more info and attach the note for the user.",
                          confirmText: "Send",
                          onConfirm: () => mutNeedsMoreInfo.mutate(),
                        });
                      }}
                      disabled={mutNeedsMoreInfo.isPending}
                    >
                      {mutNeedsMoreInfo.isPending ? "Sending…" : "Request more info"}
                    </Button>
                  </div>
                </Card>

                <Card title="Reject">
                  <div className="space-y-3">
                    <div>
                      <div className="mb-1 text-xs font-medium text-zinc-600">Reason (optional)</div>
                      <textarea
                        className="min-h-[110px] w-full rounded-xl border border-zinc-200 bg-white p-3 text-sm"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Short note that will be shown to the user in Settings → Verification."
                      />
                    </div>
                    <Button
                      variant="danger"
                      onClick={() => {
                        setConfirm({
                          title: "Reject request",
                          message: "This will mark the request as rejected.",
                          danger: true,
                          confirmText: "Reject",
                          onConfirm: () => mutReject.mutate(),
                        });
                      }}
                      disabled={mutReject.isPending}
                    >
                      {mutReject.isPending ? "Rejecting…" : "Reject"}
                    </Button>
                  </div>
                </Card>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
