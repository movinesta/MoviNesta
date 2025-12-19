// supabase/functions/admin-whoami/index.ts

import { handleCors, json, requireAdmin } from "../_shared/admin.ts";

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const { user } = await requireAdmin(req);

    const email = user.email ?? (user.user_metadata as any)?.email ?? null;
    const isAdmin = Boolean((user.app_metadata as any)?.is_admin);
    return json(200, { ok: true, user_id: user.id, email, is_admin: isAdmin });
  } catch (err) {
    return json(401, { ok: false, error: (err as Error)?.message ?? String(err) });
  }
});
