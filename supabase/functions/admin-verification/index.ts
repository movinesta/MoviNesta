import { serve } from "jsr:@std/http@0.224.0/server";
import { requireAdmin, json, handleCors, jsonError } from "../_shared/admin.ts";

type VerificationStatus = "none" | "pending" | "approved" | "revoked";
type RequestStatus = "pending" | "needs_more_info" | "approved" | "rejected";
type BadgeType = "identity" | "official" | "trusted_verifier" | "subscription";

function asString(v: unknown, maxLen = 5000): string {
  const s = v == null ? "" : String(v);
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function asUuid(v: unknown): string {
  const s = asString(v, 100).trim();
  // very light validation (avoid rejecting valid UUID variants from Postgres)
  if (!s) return "";
  if (!/^[0-9a-fA-F-]{16,64}$/.test(s)) return "";
  return s;
}

function asStatus(v: unknown, fallback: VerificationStatus): VerificationStatus {
  const s = asString(v, 20);
  if (s === "none" || s === "pending" || s === "approved" || s === "revoked") return s;
  return fallback;
}

function asRequestStatus(v: unknown, fallback: RequestStatus): RequestStatus {
  const s = asString(v, 30);
  if (s === "pending" || s === "needs_more_info" || s === "approved" || s === "rejected") return s;
  return fallback;
}

function asBadgeType(v: unknown, fallback: BadgeType): BadgeType {
  const s = asString(v, 30);
  if (s === "identity" || s === "official" || s === "trusted_verifier" || s === "subscription") return s;
  return fallback;
}

async function enrichUsers(svc: any, userIds: string[]) {
  const uniq = Array.from(new Set(userIds.filter(Boolean)));
  if (!uniq.length) return new Map<string, any>();
  const { data } = await svc
    .from("profiles_public")
    .select("id, username, display_name, avatar_url, is_verified, verified_type, verified_label")
    .in("id", uniq);
  const m = new Map<string, any>();
  for (const row of (data ?? [])) m.set(row.id, row);
  return m;
}

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { svc, userId: adminUserId } = await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const action = asString((body as any).action ?? "list_requests", 50) || "list_requests";

    // Admin can verify a user directly (no user request needed)
    if (action === "verify_direct") {
      const targetUserId = asUuid((body as any).user_id);
      const badgeType = asBadgeType((body as any).badge_type, "identity");
      const publicLabel = asString((body as any).public_label ?? "", 120).trim() || null;
      const verifierOrg = asString((body as any).verifier_org ?? "", 200).trim() || null;
      const note = asString((body as any).note ?? "", 5000).trim() || null;

      if (!targetUserId) return json(req, 400, { ok: false, message: "user_id required" });

      const nowIso = new Date().toISOString();

      // Best-effort: merge any existing details
      const { data: existing } = await svc
        .from("profile_verifications")
        .select("details")
        .eq("user_id", targetUserId)
        .maybeSingle();

      const mergedDetails = {
        ...(existing?.details ?? {}),
        direct_verify: true,
        note,
        verified_by: adminUserId,
        verified_at: nowIso,
      };

      const { error: verErr } = await svc
        .from("profile_verifications")
        .upsert(
          {
            user_id: targetUserId,
            status: "approved",
            badge_type: badgeType,
            verified_at: nowIso,
            verified_by: adminUserId,
            verifier_org: verifierOrg,
            public_label: publicLabel,
            details: mergedDetails,
            updated_at: nowIso,
          },
          { onConflict: "user_id" },
        );
      if (verErr) return json(req, 500, { ok: false, message: verErr.message });

      await svc.from("admin_audit_log").insert({
        admin_user_id: adminUserId,
        action: "verification_direct_verify",
        target: "profile_verifications",
        details: {
          user_id: targetUserId,
          badge_type: badgeType,
          verifier_org: verifierOrg,
          public_label: publicLabel,
          note,
        },
      });

      return json(req, 200, { ok: true });
    }

    if (action === "list_requests") {
      const status = asRequestStatus((body as any).status, "pending");
      const limit = Math.max(10, Math.min(200, Number((body as any).limit ?? 50) || 50));
      const cursor = Math.max(0, Number((body as any).cursor ?? 0) || 0);
      const search = asString((body as any).search ?? "", 200).trim();

      // Fetch requests
      let q = svc
        .from("verification_requests")
        .select("id,user_id,status,badge_type,submitted_at,reviewed_at,reviewed_by,updated_at,evidence,reviewer_note,reviewer_reason")
        .eq("status", status)
        .order("submitted_at", { ascending: false })
        .range(cursor, cursor + limit - 1);

      // Optional search by user_id (uuid) fast-path
      const maybeUuid = asUuid(search);
      if (maybeUuid) q = q.eq("user_id", maybeUuid);

      const { data: rows, error } = await q;
      if (error) return json(req, 500, { ok: false, message: error.message });

      const userMap = await enrichUsers(svc, (rows ?? []).map((r: any) => r.user_id));

      // If search is not a UUID, filter by username/display_name locally (best-effort)
      let out = (rows ?? []).map((r: any) => ({
        ...r,
        user: userMap.get(r.user_id) ?? { id: r.user_id },
      }));

      if (search && !maybeUuid) {
        const s = search.toLowerCase();
        out = out.filter((r: any) => {
          const u = r.user ?? {};
          return String(u.username ?? "").toLowerCase().includes(s) || String(u.display_name ?? "").toLowerCase().includes(s);
        });
      }

      const next_cursor = (rows ?? []).length === limit ? String(cursor + limit) : null;
      return json(req, 200, { ok: true, requests: out, next_cursor });
    }

    if (action === "get_request") {
      const requestId = asUuid((body as any).request_id);
      if (!requestId) return json(req, 400, { ok: false, message: "request_id required" });
      const { data, error } = await svc
        .from("verification_requests")
        .select("*")
        .eq("id", requestId)
        .maybeSingle();
      if (error) return json(req, 500, { ok: false, message: error.message });
      if (!data) return json(req, 404, { ok: false, message: "Request not found" });
      const userMap = await enrichUsers(svc, [data.user_id]);
      return json(req, 200, { ok: true, request: { ...data, user: userMap.get(data.user_id) ?? { id: data.user_id } } });
    }

    if (action === "approve_request") {
      const requestId = asUuid((body as any).request_id);
      const badgeType = asBadgeType((body as any).badge_type, "identity");
      const publicLabel = asString((body as any).public_label ?? "", 120).trim() || null;
      const verifierOrg = asString((body as any).verifier_org ?? "", 200).trim() || null;

      if (!requestId) return json(req, 400, { ok: false, message: "request_id required" });

      const { data: reqRow, error: reqErr } = await svc
        .from("verification_requests")
        .select("id,user_id,status")
        .eq("id", requestId)
        .maybeSingle();
      if (reqErr) return json(req, 500, { ok: false, message: reqErr.message });
      if (!reqRow) return json(req, 404, { ok: false, message: "Request not found" });
      if (reqRow.status !== "pending" && reqRow.status !== "needs_more_info") {
        return json(req, 400, { ok: false, message: "Only pending requests can be approved" });
      }

      const nowIso = new Date().toISOString();

      // Mark request approved
      const { error: updErr } = await svc
        .from("verification_requests")
        .update({
          status: "approved",
          reviewed_at: nowIso,
          reviewed_by: adminUserId,
          badge_type: badgeType,
          reviewer_note: null,
          reviewer_reason: null,
          updated_at: nowIso,
        })
        .eq("id", requestId);
      if (updErr) return json(req, 500, { ok: false, message: updErr.message });

      // Upsert verification row
      const { error: verErr } = await svc
        .from("profile_verifications")
        .upsert({
          user_id: reqRow.user_id,
          status: "approved",
          badge_type: badgeType,
          verified_at: nowIso,
          verified_by: adminUserId,
          verifier_org: verifierOrg,
          public_label: publicLabel,
          updated_at: nowIso,
        }, { onConflict: "user_id" });
      if (verErr) return json(req, 500, { ok: false, message: verErr.message });

      await svc.from("admin_audit_log").insert({
        admin_user_id: adminUserId,
        action: "verification_approve",
        target: "profile_verifications",
        details: { request_id: requestId, user_id: reqRow.user_id, badge_type: badgeType, verifier_org: verifierOrg, public_label: publicLabel },
      });

      return json(req, 200, { ok: true });
    }

    if (action === "reject_request") {
      const requestId = asUuid((body as any).request_id);
      const reason = asString((body as any).reason ?? "", 2000).trim() || null;
      if (!requestId) return json(req, 400, { ok: false, message: "request_id required" });

      const { data: reqRow, error: reqErr } = await svc
        .from("verification_requests")
        .select("id,user_id,status")
        .eq("id", requestId)
        .maybeSingle();
      if (reqErr) return json(req, 500, { ok: false, message: reqErr.message });
      if (!reqRow) return json(req, 404, { ok: false, message: "Request not found" });
      if (reqRow.status !== "pending" && reqRow.status !== "needs_more_info") {
        return json(req, 400, { ok: false, message: "Only pending requests can be rejected" });
      }

      const nowIso = new Date().toISOString();
      const { error: updErr } = await svc
        .from("verification_requests")
        .update({
          status: "rejected",
          reviewed_at: nowIso,
          reviewed_by: adminUserId,
          reviewer_note: reason,
          reviewer_reason: "rejected",
          updated_at: nowIso,
        })
        .eq("id", requestId);
      if (updErr) return json(req, 500, { ok: false, message: updErr.message });

      await svc.from("admin_audit_log").insert({
        admin_user_id: adminUserId,
        action: "verification_reject",
        target: "verification_requests",
        details: { request_id: requestId, user_id: reqRow.user_id, reason },
      });

      return json(req, 200, { ok: true });
    }

    if (action === "needs_more_info") {
      const requestId = asUuid((body as any).request_id);
      const note = asString((body as any).note ?? (body as any).reason ?? "", 2000).trim() || null;
      if (!requestId) return json(req, 400, { ok: false, message: "request_id required" });

      const { data: reqRow, error: reqErr } = await svc
        .from("verification_requests")
        .select("id,user_id,status")
        .eq("id", requestId)
        .maybeSingle();
      if (reqErr) return json(req, 500, { ok: false, message: reqErr.message });
      if (!reqRow) return json(req, 404, { ok: false, message: "Request not found" });
      if (reqRow.status !== "pending") {
        return json(req, 400, { ok: false, message: "Only pending requests can be marked as needs_more_info" });
      }

      const nowIso = new Date().toISOString();
      const { error: updErr } = await svc
        .from("verification_requests")
        .update({
          status: "needs_more_info",
          reviewed_at: nowIso,
          reviewed_by: adminUserId,
          reviewer_note: note,
          reviewer_reason: "needs_more_info",
          updated_at: nowIso,
        })
        .eq("id", requestId);
      if (updErr) return json(req, 500, { ok: false, message: updErr.message });

      await svc.from("admin_audit_log").insert({
        admin_user_id: adminUserId,
        action: "verification_needs_more_info",
        target: "verification_requests",
        details: { request_id: requestId, user_id: reqRow.user_id, note },
      });

      return json(req, 200, { ok: true });
    }

    if (action === "list_verified") {
      const limit = Math.max(10, Math.min(200, Number((body as any).limit ?? 50) || 50));
      const cursor = Math.max(0, Number((body as any).cursor ?? 0) || 0);
      const { data: rows, error } = await svc
        .from("profile_verifications")
        .select("user_id,status,badge_type,verified_at,verifier_org,public_label,updated_at")
        .eq("status", "approved")
        .order("verified_at", { ascending: false })
        .range(cursor, cursor + limit - 1);
      if (error) return json(req, 500, { ok: false, message: error.message });
      const userMap = await enrichUsers(svc, (rows ?? []).map((r: any) => r.user_id));
      const out = (rows ?? []).map((r: any) => ({ ...r, user: userMap.get(r.user_id) ?? { id: r.user_id } }));
      const next_cursor = (rows ?? []).length === limit ? String(cursor + limit) : null;
      return json(req, 200, { ok: true, verified: out, next_cursor });
    }

    if (action === "revoke_user") {
      const targetUserId = asUuid((body as any).user_id);
      const reason = asString((body as any).reason ?? "", 2000).trim() || null;
      if (!targetUserId) return json(req, 400, { ok: false, message: "user_id required" });
      const nowIso = new Date().toISOString();
      const { error } = await svc
        .from("profile_verifications")
        .upsert({
          user_id: targetUserId,
          status: "revoked",
          updated_at: nowIso,
          details: reason ? { revoke_reason: reason, revoked_by: adminUserId, revoked_at: nowIso } : { revoked_by: adminUserId, revoked_at: nowIso },
        }, { onConflict: "user_id" });
      if (error) return json(req, 500, { ok: false, message: error.message });

      await svc.from("admin_audit_log").insert({
        admin_user_id: adminUserId,
        action: "verification_revoke",
        target: "profile_verifications",
        details: { user_id: targetUserId, reason },
      });
      return json(req, 200, { ok: true });
    }

    return json(req, 400, { ok: false, message: `Unknown action: ${action}` });
  } catch (e) {
    return jsonError(req, e);
  }
});
