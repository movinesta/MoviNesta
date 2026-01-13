import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { requireAdmin, json, handleCors, jsonError } from "../_shared/admin.ts";
import { loadAppSettingsForScopes } from "../_shared/appSettings.ts";

function clampInt(n: number, a: number, b: number): number {
  const x = Number.isFinite(n) ? Math.trunc(n) : a;
  return Math.max(a, Math.min(b, x));
}

function since24hIso() {
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return d.toISOString();
}

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { svc } = await requireAdmin(req);

    // Best-effort: use admin settings if available; otherwise keep current hard-coded behavior.
    let recentErrorsLimit = 50;
    let lastRunsLimit = 20;
    
    let opsAlertsLimit = 25;
try {
      const env = await loadAppSettingsForScopes(svc as any, ["admin"], { cacheTtlMs: 60_000 });
      const s = (env.settings ?? {}) as Record<string, unknown>;
      recentErrorsLimit = clampInt(Number(s["admin.overview.recent_errors_limit"] ?? recentErrorsLimit), 1, 200);
      lastRunsLimit = clampInt(Number(s["admin.overview.last_job_runs_limit"] ?? lastRunsLimit), 1, 200);
    
      opsAlertsLimit = clampInt(Number(s["admin.overview.ops_alerts_limit"] ?? opsAlertsLimit), 1, 200);
} catch {
      // ignore
    }

    const [{ data: settings }, { data: coverage }, { data: jobState }] = await Promise.all([
      svc.from("embedding_settings").select("*").eq("id", 1).maybeSingle(),
      // `media_embeddings` has no `id` column in the schema; count media_item_id instead.
      svc.from("media_embeddings").select("provider, model, count:media_item_id.count()"),
      svc.from("media_job_state").select("job_name, cursor, updated_at").order("job_name"),
    ]);

    const { data: routingLogs } = await svc
      .from("openrouter_request_log")
      .select("id, created_at, meta")
      .gte("created_at", since24hIso())
      .order("created_at", { ascending: false })
      .limit(500);

    const { data: recentErrors } = await svc
      .from("job_run_log")
      .select("id, created_at, started_at, job_name, error_code, error_message")
      .eq("ok", false)
      .gte("started_at", since24hIso())
      .order("started_at", { ascending: false })
      .limit(recentErrorsLimit);

    const { data: lastRuns } = await svc
      .from("job_run_log")
      .select("id, started_at, finished_at, job_name, ok")
      .order("started_at", { ascending: false })
      .limit(lastRunsLimit);

    const { data: opsAlerts } = await svc
      .rpc("ops_alert_list_active_v1", { p_limit: opsAlertsLimit })
      .catch(() => ({ data: [] as any[] }));

    const active_profile = settings
      ? {
          provider: settings.active_provider,
          model: settings.active_model,
          dimensions: settings.active_dimensions,
          task: settings.active_task,
        }
      : null;

    const zdrStats = (() => {
      const rows = routingLogs ?? [];
      let total = 0;
      let requested = 0;
      let used = 0;
      let fallback = 0;
      let sensitive = 0;

      for (const row of rows) {
        total += 1;
        const meta = (row as any)?.meta ?? {};
        const zdr =
          (meta?.routing && typeof meta.routing === "object" ? (meta as any).routing.zdr : null) ??
          (meta?.zdr ?? null);
        if (!zdr || typeof zdr !== "object") continue;
        if ((zdr as any).requested) requested += 1;
        if ((zdr as any).used) used += 1;
        if ((zdr as any).requested && !(zdr as any).used) fallback += 1;
        if ((zdr as any).sensitive) sensitive += 1;
      }

      const coverage_rate = requested > 0 ? used / requested : 0;
      return { total, requested, used, fallback, sensitive, coverage_rate };
    })();

    return json(req, 200, {
      ok: true,
      active_profile,
      coverage: (coverage ?? []).map((r: any) => ({ provider: r.provider, model: r.model, count: (Number.isFinite(Number(r.count)) ? Number(r.count) : 0) })),
      job_state: jobState ?? [],
      recent_errors: recentErrors ?? [],
      last_job_runs: lastRuns ?? [],
      ops_alerts: opsAlerts ?? [],
      zdr_coverage: zdrStats,
    });
  } catch (e) {
    return jsonError(req, e);
  }
});
