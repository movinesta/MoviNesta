import { serve } from "jsr:@std/http@0.224.0/server";
import { requireAdmin, json, handleCors, jsonError } from "../_shared/admin.ts";
import { loadAppSettingsForScopes } from "../_shared/appSettings.ts";

function clampInt(n: number, a: number, b: number): number {
  const x = Number.isFinite(n) ? Math.trunc(n) : a;
  return Math.max(a, Math.min(b, x));
}

async function getAdminUserKnobs(svc: any): Promise<{ pageLimit: number; banDurationDays: number }> {
  // Best-effort: if settings cannot be loaded, fall back to current hard-coded behavior.
  let pageLimit = 50;
  let banDurationDays = 365 * 50;
  try {
    const env = await loadAppSettingsForScopes(svc, ["admin"], { cacheTtlMs: 60_000 });
    const s = (env.settings ?? {}) as Record<string, unknown>;
    pageLimit = clampInt(Number(s["admin.users.page_limit"] ?? pageLimit), 10, 500);
    banDurationDays = clampInt(Number(s["admin.users.ban_duration_days"] ?? banDurationDays), 1, 36500);
  } catch {
    // ignore
  }
  return { pageLimit, banDurationDays };
}

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { svc, userId } = await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "list");

    const knobs = await getAdminUserKnobs(svc);

    if (action === "list") {
      const search = body.search ? String(body.search) : null;
      const offset = body.page ? Math.max(0, Number(body.page)) : 0;

      const limit = knobs.pageLimit;
      const { data, error } = await svc.rpc("admin_search_users", { p_search: search, p_limit: limit, p_offset: offset });
      if (error) return json(req, 500, { ok: false, message: error.message });

      const users = (data ?? []).map((u: any) => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        banned_until: u.banned_until,
      }));

      const next_page = users.length === limit ? String(offset + limit) : null;

      return json(req, 200, { ok: true, users, next_page });
    }

    if (action === "ban" || action === "unban") {
      const target = String(body.user_id ?? "");
      if (!target) return json(req, 400, { ok: false, message: "user_id required" });

      const banned_until = action === "ban"
        ? new Date(Date.now() + 1000 * 60 * 60 * 24 * knobs.banDurationDays).toISOString()
        : null;
      const { error } = await svc.auth.admin.updateUserById(target, { banned_until });
      if (error) return json(req, 500, { ok: false, message: error.message });

      await svc.from("admin_audit_log").insert({
        admin_user_id: userId,
        action,
        target: "auth.users",
        details: { user_id: target },
      });

      return json(req, 200, { ok: true });
    }

    if (action === "reset_vectors") {
      const target = String(body.user_id ?? "");
      if (!target) return json(req, 400, { ok: false, message: "user_id required" });

      await svc.from("media_user_vectors").delete().eq("user_id", target);
      await svc.from("media_session_vectors").delete().eq("user_id", target);

      await svc.from("admin_audit_log").insert({
        admin_user_id: userId,
        action,
        target: "media_user_vectors",
        details: { user_id: target },
      });

      return json(req, 200, { ok: true });
    }

    return json(req, 400, { ok: false, message: `Unknown action: ${action}` });
  } catch (e) {
    return jsonError(req, e);
  }
});
