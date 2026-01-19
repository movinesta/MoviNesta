import { serve } from "jsr:@std/http@0.224.0/server";
import { json, jsonError } from "../_shared/admin.ts";
import { getConfig } from "../_shared/config.ts";
import { getAdminClient } from "../_shared/supabase.ts";
import { safeInsertJobRunLog } from "../_shared/joblog.ts";

type Body = { keep_days?: number | null; reason?: string | null };

serve(async (req) => {
  try {
    // NOTE: This endpoint is intended for server-to-server cron invocations.
    // It uses a shared internal job token instead of JWT.
    if (req.method !== "POST") {
      return json(req, 405, { ok: false, message: "Method not allowed" });
    }

    const cfg = getConfig();
    const token = (req.headers.get("x-job-token") ?? "").trim();
    if (!cfg.internalJobToken || token !== cfg.internalJobToken) {
      return json(req, 403, { ok: false, message: "Forbidden" });
    }

    const body: Body = await req.json().catch(() => ({}));
    const keepDaysRaw = Number(body.keep_days ?? 14);
    const keep_days = Number.isFinite(keepDaysRaw) ? Math.max(1, Math.min(365, Math.trunc(keepDaysRaw))) : 14;

    const svc = getAdminClient();
    const startedAtIso = new Date().toISOString();
    const startedAt = Date.now();

    const { data, error } = await svc.rpc("openrouter_circuit_cleanup_v1", { p_keep_days: keep_days });
    if (error) throw error;

    const deleted = Number(data ?? 0);
    const durationMs = Date.now() - startedAt;

    await safeInsertJobRunLog(svc, {
      job_name: "openrouter-circuit-cleanup",
      started_at: startedAtIso,
      finished_at: new Date().toISOString(),
      ok: true,
      meta: { deleted, keep_days, reason: body.reason ?? "", durationMs },
    });

    return json(req, 200, { ok: true, deleted, keep_days, durationMs });
  } catch (err) {
    return jsonError(req, err);
  }
});
