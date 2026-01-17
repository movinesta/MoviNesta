import { serve } from "jsr:@std/http@0.224.0/server";
import { requireAdmin, json, handleCors, jsonError } from "../_shared/admin.ts";

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { svc, userId } = await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "get");
    const actionAlias = (() => {
      switch (action) {
        case "set_active":
          return "set_cron_active";
        case "set_schedule":
          return "set_cron_schedule";
        case "set_cursor":
          return "reset_cursor";
        case "runs":
          return "get_runs";
        case "prune_history":
          return "prune_runs";
        default:
          return action;
      }
    })();

    if (actionAlias === "get") {
      const { data: job_state } = await svc.from("media_job_state").select("job_name, cursor, updated_at").order("job_name");

      const { data: cron_jobs, error: cronErr } = await svc.rpc("admin_list_cron_jobs", {});
      if (cronErr) {
        // Don't fail the whole dashboard, but do surface the reason so the UI can explain.
        // Common causes: RPC not deployed, missing grants, or pg_cron/cron schema differences.
        return json(req, 200, {
          ok: true,
          job_state: job_state ?? [],
          cron_jobs: [],
          cron_error: cronErr.message,
        });
      }

      return json(req, 200, { ok: true, job_state: job_state ?? [], cron_jobs: cron_jobs ?? [] });
    }

    if (actionAlias === "reset_cursor") {
      const job_name = String(body.job_name ?? body.jobname ?? "");
      const cursor = body.cursor ?? null;
      if (!job_name) return json(req, 400, { ok: false, message: "job_name required" });

      const { error } = await svc
        .from("media_job_state")
        .upsert({ job_name, cursor, updated_at: new Date().toISOString() }, { onConflict: "job_name" });

      if (error) return json(req, 500, { ok: false, message: error.message });

      await svc.from("admin_audit_log").insert({
        admin_user_id: userId,
        action: "reset_cursor",
        target: "media_job_state",
        details: { job_name },
      });

      return json(req, 200, { ok: true });
    }

    if (actionAlias === "set_cron_active") {
      const jobname = String(body.jobname ?? body.job_name ?? "");
      const active = body.active ?? body.is_active ?? false;
      if (!jobname) return json(req, 400, { ok: false, message: "jobname required" });

      const { error } = await svc.rpc("admin_set_cron_active", { p_jobname: jobname, p_active: Boolean(active) });
      if (error) return json(req, 500, { ok: false, message: error.message });

      await svc.from("admin_audit_log").insert({
        admin_user_id: userId,
        action: active ? "enable_cron" : "disable_cron",
        target: "pg_cron",
        details: { jobname },
      });

      return json(req, 200, { ok: true });
    }

    if (actionAlias === "set_cron_schedule") {
      const jobname = String(body.jobname ?? body.job_name ?? "");
      const schedule = String(body.schedule ?? "");
      if (!jobname) return json(req, 400, { ok: false, message: "jobname required" });
      if (!schedule) return json(req, 400, { ok: false, message: "schedule required" });

      const { error } = await svc.rpc("admin_set_cron_schedule", { p_jobname: jobname, p_schedule: schedule });
      if (error) return json(req, 500, { ok: false, message: error.message });

      await svc.from("admin_audit_log").insert({
        admin_user_id: userId,
        action: "set_cron_schedule",
        target: "pg_cron",
        details: { jobname, schedule },
      });

      return json(req, 200, { ok: true });
    }

    if (actionAlias === "run_now") {
      const jobname = String(body.jobname ?? body.job_name ?? "");
      if (!jobname) return json(req, 400, { ok: false, message: "jobname required" });

      const { error } = await svc.rpc("admin_run_cron_job", { p_jobname: jobname });
      if (error) return json(req, 500, { ok: false, message: error.message });

      await svc.from("admin_audit_log").insert({
        admin_user_id: userId,
        action: "run_now",
        target: "pg_cron",
        details: { jobname },
      });

      return json(req, 200, { ok: true });
    }



    if (actionAlias === "get_runs") {
      const jobname = String(body.jobname ?? body.job_name ?? "");
      const limit = Number(body.limit ?? 50);
      if (!jobname) return json(req, 400, { ok: false, message: "jobname required" });

      const { data: runs, error } = await svc.rpc("admin_list_cron_job_runs", {
        p_jobname: jobname,
        p_limit: Number.isFinite(limit) ? limit : 50,
      });
      if (error) return json(req, 500, { ok: false, message: error.message });

      return json(req, 200, { ok: true, runs: runs ?? [] });
    }

    if (actionAlias === "prune_runs") {
      const keep_days = Number(body.keep_days ?? body.keepDays ?? 14);

      const { data, error } = await svc.rpc("admin_prune_cron_job_run_details", {
        p_keep_days: Number.isFinite(keep_days) ? keep_days : 14,
      });
      if (error) return json(req, 500, { ok: false, message: error.message });

      await svc.from("admin_audit_log").insert({
        admin_user_id: userId,
        action: "prune_cron_history",
        target: "pg_cron",
        details: { keep_days: Number.isFinite(keep_days) ? keep_days : 14, deleted: data },
      });

      return json(req, 200, { ok: true, deleted: data ?? 0 });
    }
    return json(req, 400, { ok: false, message: `Unknown action: ${action}` });
  } catch (e) {
    return jsonError(req, e);
  }
});
