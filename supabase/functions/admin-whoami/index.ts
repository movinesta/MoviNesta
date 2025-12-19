import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { handleCors, json, requireAdmin, HttpError } from "../_shared/admin.ts";

// Simple identity endpoint for the admin dashboard.
// Used to validate that the caller is authenticated + is an admin.
//
// 200: { ok: true, user_id, email, role }
// 401/403: { ok: false, error }
serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { userId, email, role } = await requireAdmin(req);

    return json(req, 200, {
      ok: true,
      user_id: userId,
      email: email ?? null,
      role,
    });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    const message = e instanceof Error ? e.message : "Unknown error";
    return json(req, status, { ok: false, error: message });
  }
});
