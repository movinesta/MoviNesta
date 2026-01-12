/// <reference path="../_shared/deno.d.ts" />
// Supabase Edge Function: admin-audit
//
// Admin-only endpoint to list recent admin audit log rows.
// Supports cursor pagination via `before` (ISO timestamp) and simple search across `action` + `target`.
//
// Contract (what the admin dashboard expects):
//   POST body: { limit?: number, search?: string|null, before?: string|null }
//   response:  { ok: true, rows: AdminAuditRow[], next_before: string|null }

import { handleCors, json, jsonError, requireAdmin } from "../_shared/admin.ts";
import { loadAppSettingsForScopes } from "../_shared/appSettings.ts";

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(n, b));
}

function asString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function isValidIsoDate(s: string): boolean {
  const t = Date.parse(s);
  return Number.isFinite(t);
}

function sanitizeSearch(s: string): string {
  // Keep the PostgREST `or(...)` filter stable.
  return s.replace(/[(),]/g, " ").trim();
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { svc } = await requireAdmin(req);

    const url = new URL(req.url);
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;

    // Default limit is admin-tunable; keep the hard max clamp as an invariant.
    let defaultLimit = 50;
    try {
      const env = await loadAppSettingsForScopes(svc as any, ["admin"], { cacheTtlMs: 60_000 });
      const s = (env.settings ?? {}) as Record<string, unknown>;
      const v = Number(s["admin.audit.default_limit"] ?? defaultLimit);
      if (Number.isFinite(v)) defaultLimit = clamp(Math.trunc(v), 1, 200);
    } catch {
      // ignore
    }

    const limitRaw = body.limit ?? url.searchParams.get("limit") ?? defaultLimit;
    const limit = clamp(Number(limitRaw), 1, 200);

    const searchRaw = asString(body.search ?? url.searchParams.get("search"));
    const search = searchRaw ? sanitizeSearch(searchRaw) : null;

    const beforeRaw = asString(body.before ?? url.searchParams.get("before"));
    const before = beforeRaw && isValidIsoDate(beforeRaw) ? beforeRaw : null;

    const pageSize = clamp(limit + 1, 1, 201);

    let q = svc
      .from("admin_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(pageSize);

    if (before) q = q.lt("created_at", before);

    if (search) {
      const pattern = `*${search}*`;
      // Search action OR target.
      q = q.or(`action.ilike.${pattern},target.ilike.${pattern}`);
    }

    const { data, error } = await q;

    if (error) return json(req, 500, { ok: false, message: error.message });

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    let next_before: string | null = null;

    if (rows.length > limit) {
      const extra = rows.pop() as any;
      next_before = String(extra?.created_at ?? "") || null;
    }

    return json(req, 200, { ok: true, rows, next_before });
  } catch (e) {
    return jsonError(req, e);
  }
});
