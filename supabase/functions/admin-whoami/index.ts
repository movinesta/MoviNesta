import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { handleCors, json, jsonError, HttpError, getUserIdFromRequest, getSupabaseServiceClient } from "../_shared/admin.ts";

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { userId, email } = await getUserIdFromRequest(req);
    const svc = getSupabaseServiceClient();

    const { data, error } = await svc
      .from("app_admins")
      .select("user_id, role")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw new HttpError(500, error.message, "supabase_error");

    const is_admin = Boolean(data?.user_id);

    return json(req, 200, {
      ok: true,
      is_admin,
      user: { id: userId, email },
      role: data?.role ?? null,
    });
  } catch (err) {
    return jsonError(req, err);
  }
});
