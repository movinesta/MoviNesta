import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { requireAdmin, json, jsonError, handleCors, HttpError } from "../_shared/admin.ts";

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(n, b));
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { svc } = await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const days = clamp(Number(body.days ?? 14), 3, 60);

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await svc
      .from("job_run_log")
      .select("started_at, provider, total_tokens")
      .gte("started_at", since)
      .order("started_at", { ascending: true });

    if (error) throw new HttpError(500, error.message, "supabase_error");

    const agg = new Map<string, number>();
    for (const r of data ?? []) {
      const provider = String((r as any).provider ?? "unknown");
      const tokens = Number((r as any).total_tokens ?? 0);
      if (!tokens) continue;
      const day = dayKey(String((r as any).started_at));
      const k = `${day}|${provider}`;
      agg.set(k, (agg.get(k) ?? 0) + tokens);
    }

    const daily = Array.from(agg.entries()).map(([k, tokens]) => {
      const [day, provider] = k.split("|");
      return { day, provider, tokens };
    });

    return json(req, 200, { ok: true, daily });
  } catch (e) {
    return jsonError(req, e);
  }
});
