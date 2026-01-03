import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { requireAdmin, json, handleCors, jsonError } from "../_shared/admin.ts";

const LIMIT = 50;

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { svc, userId } = await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "list");

    if (action === "list") {
      const search = body.search ? String(body.search) : null;
      const offset = body.page ? Math.max(0, Number(body.page)) : 0;

      const { data, error } = await svc.rpc("admin_search_users", { p_search: search, p_limit: LIMIT, p_offset: offset });
      if (error) return json(req, 500, { ok: false, message: error.message });

      const users = (data ?? []).map((u: any) => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        banned_until: u.banned_until,
      }));

      const next_page = users.length === LIMIT ? String(offset + LIMIT) : null;

      return json(req, 200, { ok: true, users, next_page });
    }

    if (action === "ban" || action === "unban") {
      const target = String(body.user_id ?? "");
      if (!target) return json(req, 400, { ok: false, message: "user_id required" });

      const banned_until = action === "ban" ? new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 50).toISOString() : null;
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
