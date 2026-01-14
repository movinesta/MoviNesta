import React, { useMemo, useState } from "react";
import { ShieldCheck, BadgeCheck, AlertCircle, Loader2, ExternalLink } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { callSupabaseFunction } from "@/lib/callSupabaseFunction";
import VerifiedBadge from "@/components/VerifiedBadge";
import type { Database } from "@/types/supabase";

type BadgeType = Database["public"]["Enums"]["verification_badge_type"];
type RequestRow = Database["public"]["Tables"]["verification_requests"]["Row"];
type VerificationStatus = RequestRow["status"] | "needs_more_info" | "rejected";

const badgeTypeOptions: Array<{ key: BadgeType; label: string; hint: string }> = [
  {
    key: "identity",
    label: "Identity",
    hint: "For a real person/brand account where you can prove ownership.",
  },
  {
    key: "official",
    label: "Official",
    hint: "For notable public figures, studios, festivals, or official pages.",
  },
  {
    key: "trusted_verifier",
    label: "Verified by org",
    hint: "For accounts verified by a trusted organization (e.g., university, studio).",
  },
];

function normalizeLinks(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function prettyStatus(status: string | null | undefined): string {
  if (!status) return "";
  if (status === "rejected" || status === "revoked") return "Rejected";
  if (status === "needs_more_info") return "Needs more info";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export const VerificationPanel: React.FC<{
  userId: string;
  profile: {
    isVerified: boolean;
    verifiedType: BadgeType | null;
    verifiedLabel: string | null;
    verifiedAt: string | null;
    verifiedByOrg: string | null;
  };
}> = ({ userId, profile }) => {
  const queryClient = useQueryClient();
  const [badgeType, setBadgeType] = useState<BadgeType>("identity");
  const [evidenceText, setEvidenceText] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const evidenceLinks = useMemo(() => normalizeLinks(evidenceText), [evidenceText]);

  const { data: latestRequest, isLoading: isReqLoading } = useQuery<RequestRow | null, Error>({
    queryKey: ["verification", "latest_request", userId],
    enabled: !!userId && !profile.isVerified,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("verification_requests")
        .select("*")
        .eq("user_id", userId)
        .order("submitted_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });

  const submit = useMutation<{ ok: boolean; request_id?: string | null }, Error, void>({
    mutationFn: async () => {
      const payload = {
        badge_type: badgeType,
        evidence: evidenceLinks.length ? { links: evidenceLinks } : null,
        notes: notes.trim() || null,
      };
      return await callSupabaseFunction("request-verification", payload);
    },
    onSuccess: () => {
      setNotes("");
      setEvidenceText("");
      queryClient.invalidateQueries({ queryKey: ["verification", "latest_request", userId] });
    },
  });

  const statusBlock = (() => {
    if (profile.isVerified) {
      return (
        <div className="mt-3 flex items-start justify-between gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
          <div className="flex items-start gap-2">
            <BadgeCheck className="mt-0.5 h-4 w-4 text-emerald-400" aria-hidden="true" />
            <div>
              <div className="text-xs font-semibold text-foreground">Your account is verified</div>
              <div className="text-xs text-muted-foreground">
                {profile.verifiedLabel ?? "Verified"}
                {profile.verifiedByOrg ? ` · ${profile.verifiedByOrg}` : ""}
                {profile.verifiedAt
                  ? ` · ${new Date(profile.verifiedAt).toLocaleDateString()}`
                  : ""}
              </div>
            </div>
          </div>
          <div className="shrink-0">
            <VerifiedBadge
              isVerified={true}
              type={profile.verifiedType ?? "identity"}
              label={profile.verifiedLabel}
              verifiedAt={profile.verifiedAt}
              org={profile.verifiedByOrg}
            />
          </div>
        </div>
      );
    }

    if (isReqLoading) {
      return (
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          Checking verification status…
        </div>
      );
    }

    if (!latestRequest) return null;

    const status = latestRequest.status as VerificationStatus | null;
    const pretty = prettyStatus(status);
    const submitted = latestRequest.submitted_at
      ? new Date(latestRequest.submitted_at).toLocaleDateString()
      : null;

    const tone =
      status === "pending"
        ? "bg-muted/70"
        : status === "needs_more_info"
          ? "bg-amber-500/10"
          : "bg-destructive/10";

    const iconColor =
      status === "pending"
        ? "text-muted-foreground"
        : status === "needs_more_info"
          ? "text-amber-500"
          : "text-destructive";

    return (
      <div className={`mt-3 rounded-xl border border-border/60 ${tone} px-3 py-2`}>
        <div className="flex items-start gap-2">
          <AlertCircle className={`mt-0.5 h-4 w-4 ${iconColor}`} aria-hidden="true" />
          <div>
            <div className="text-xs font-semibold text-foreground">
              Verification request: {pretty}
            </div>
            <div className="text-xs text-muted-foreground">
              {submitted ? `Submitted on ${submitted}.` : ""}{" "}
              {status === "pending"
                ? "Our team will review it."
                : status === "needs_more_info"
                  ? "Please update your evidence and resubmit."
                  : status === "rejected"
                    ? "You can submit a new request with stronger evidence."
                    : ""}
            </div>
            {(latestRequest as any).reviewer_note && status === "needs_more_info" && (
              <div className="mt-1 text-xs text-muted-foreground">
                <span className="font-semibold">Requested:</span>{" "}
                {(latestRequest as any).reviewer_note}
              </div>
            )}
            {(latestRequest as any).reviewer_note && status === "rejected" && (
              <div className="mt-1 text-xs text-muted-foreground">
                <span className="font-semibold">Reason:</span>{" "}
                {(latestRequest as any).reviewer_note}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  })();

  const canSubmit =
    !profile.isVerified && (latestRequest?.status as VerificationStatus | null) !== "pending";

  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-card/80 p-[var(--card-pad)] shadow-sm">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-border/50">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </span>
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-heading font-semibold text-foreground">Verification</h2>
            {profile.isVerified && (
              <VerifiedBadge
                isVerified={true}
                type={profile.verifiedType ?? "identity"}
                label={profile.verifiedLabel}
                verifiedAt={profile.verifiedAt}
                org={profile.verifiedByOrg}
              />
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Verified accounts help reduce impersonation. The badge popover explains what your badge
            means.
          </p>
        </div>
      </div>

      {statusBlock}

      {!profile.isVerified && (
        <div className="space-y-3 pt-1">
          <div className="space-y-2">
            <div className="text-xs font-semibold text-foreground">
              Request a verification badge
            </div>
            <div className="grid grid-cols-3 gap-2 text-[12px]">
              {badgeTypeOptions.map((opt) => {
                const isActive = badgeType === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    disabled={!canSubmit}
                    onClick={() => setBadgeType(opt.key)}
                    className={`flex flex-col items-start justify-center gap-0.5 rounded-2xl border px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                      isActive
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border bg-background text-muted-foreground hover:bg-card"
                    } ${!canSubmit ? "opacity-60 cursor-not-allowed" : ""}`}
                  >
                    <span className="text-xs font-semibold leading-none">{opt.label}</span>
                    <span className="text-[11px] leading-snug opacity-90">{opt.hint}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              className="block type-overline text-muted-foreground"
              htmlFor="verification-evidence"
            >
              Evidence links
            </label>
            <Textarea
              id="verification-evidence"
              value={evidenceText}
              onChange={(e) => setEvidenceText(e.target.value)}
              rows={4}
              className="text-sm resize-none"
              placeholder={
                "Paste 1–8 links (one per line).\nExample: IMDb page, official website, social profile."
              }
              disabled={!canSubmit}
            />
            {evidenceLinks.length > 0 && (
              <div className="mt-1 space-y-1">
                {evidenceLinks.slice(0, 3).map((l) => (
                  <a
                    key={l}
                    href={l}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    <span className="truncate max-w-[320px]">{l}</span>
                  </a>
                ))}
                {evidenceLinks.length > 3 && (
                  <div className="text-xs text-muted-foreground">
                    +{evidenceLinks.length - 3} more
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label
              className="block type-overline text-muted-foreground"
              htmlFor="verification-notes"
            >
              Notes (optional)
            </label>
            <Input
              id="verification-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="text-sm"
              placeholder="Anything that helps the reviewer (e.g., official email, role, context)"
              disabled={!canSubmit}
            />
          </div>

          {submit.isError && (
            <div className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{submit.error?.message ?? "Couldn’t submit request."}</span>
            </div>
          )}
          {submit.isSuccess && !submit.isError && (
            <div className="text-xs text-emerald-400">Request submitted. We’ll review it soon.</div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={submit.isPending || !canSubmit}
              onClick={() => {
                setEvidenceText("");
                setNotes("");
              }}
            >
              Clear
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={
                submit.isPending || !canSubmit || (evidenceLinks.length === 0 && !notes.trim())
              }
              onClick={() => submit.mutate()}
            >
              {submit.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                "Submit request"
              )}
            </Button>
          </div>
          {!canSubmit && latestRequest?.status === "pending" && (
            <div className="text-xs text-muted-foreground">
              You already have a pending request. You can submit again after it’s reviewed.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VerificationPanel;
