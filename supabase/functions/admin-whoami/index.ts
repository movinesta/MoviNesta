import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { handleCors, json, requireAdmin } from "../_shared/admin.ts";

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { userId, email, role } = await requireAdmin(req);
    return json(200, { ok: true, user: { id: userId, email }, admin: { role } });
  } catch (err) {
    const msg = String((err as any)?.message ?? err);
    if (msg.includes("Missing Authorization") || msg.includes("Invalid session")) {
      return json(401, { ok: false, code: "UNAUTHORIZED" });
    }
    if (msg.includes("Not authorized")) {
      return json(403, { ok: false, code: "FORBIDDEN" });
    }
    return json(500, { ok: false, code: "INTERNAL_ERROR", message: msg });
  }
});
