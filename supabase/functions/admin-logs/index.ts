import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { requireAdmin, json, handleCors } from "../_shared/admin.ts";

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(n, b));
}

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { svc } = await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const limit = clamp(Number(body.limit ?? 100), 10, 500);

    const { data, error } = await svc
      .from("job_run_log")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(limit);

    if (error) return json(req, 500, { ok: false, message: error.message });
    return json(req, 200, { ok: true, rows: data ?? [] });
  } catch (e) {
    return json(req, 500, { ok: false, message: (e as any)?.message ?? String(e) });
  }
});
