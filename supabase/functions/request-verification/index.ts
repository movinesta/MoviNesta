import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { jsonWithCors, handleCors } from "../_shared/cors.ts";
import { getSupabaseServiceClient, getUserIdFromRequest, HttpError } from "../_shared/admin.ts";

type BadgeType = "identity" | "official" | "trusted_verifier" | "subscription";

function asString(v: unknown, maxLen = 5000): string {
  const s = v == null ? "" : String(v);
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function asBadgeType(v: unknown): BadgeType | null {
  const s = asString(v, 30);
  if (s === "identity" || s === "official" || s === "trusted_verifier" || s === "subscription") return s;
  return null;
}

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    if (req.method !== "POST") throw new HttpError(405, "Method not allowed");

    const { userId } = await getUserIdFromRequest(req);
    const svc = getSupabaseServiceClient();

    const body = await req.json().catch(() => ({}));
    const badgeType = asBadgeType((body as any).badge_type);
    const notes = asString((body as any).notes ?? "", 2000).trim() || null;
    const evidence = (body as any).evidence ?? null;

    // Basic abuse guard: allow only one "in flight" request within the last 30 days.
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: existing, error: exErr } = await svc
      .from("verification_requests")
      .select("id,status,submitted_at")
      .eq("user_id", userId)
      .in("status", ["pending", "needs_more_info"])
      .gte("submitted_at", since)
      .order("submitted_at", { ascending: false })
      .limit(1);
    if (exErr) throw new HttpError(500, exErr.message);
    const latest = (existing ?? [])[0] ?? null;
    if (latest?.status === "pending") {
      return jsonWithCors(req, { ok: false, code: "ALREADY_PENDING", message: "You already have a pending verification request." }, { status: 409 });
    }

    // If staff asked for more info, update the existing request and re-queue it.
    if (latest?.status === "needs_more_info") {
      const nowIso = new Date().toISOString();
      const { error: updErr } = await svc
        .from("verification_requests")
        .update({
          status: "pending",
          badge_type: badgeType,
          evidence,
          notes,
          reviewer_note: null,
          reviewer_reason: null,
          reviewed_at: null,
          reviewed_by: null,
          submitted_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", latest.id);
      if (updErr) throw new HttpError(500, updErr.message);
      return jsonWithCors(req, { ok: true, request_id: latest.id }, { status: 200 });
    }

    const { data: inserted, error } = await svc
      .from("verification_requests")
      .insert({
        user_id: userId,
        status: "pending",
        badge_type: badgeType,
        evidence,
        notes,
      })
      .select("id")
      .maybeSingle();
    if (error) throw new HttpError(500, error.message);

    return jsonWithCors(req, { ok: true, request_id: inserted?.id ?? null }, { status: 200 });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    const msg = e?.message ? String(e.message) : "Request failed";
    return jsonWithCors(req, { ok: false, message: msg }, { status });
  }
});
