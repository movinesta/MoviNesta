import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { requireAdmin, json, handleCors } from "../_shared/admin.ts";

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { svc, userId } = await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "get");

    if (action === "get") {
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

    if (action === "reset_cursor") {
      const job_name = String(body.job_name ?? "");
      if (!job_name) return json(req, 400, { ok: false, message: "job_name required" });

      const { error } = await svc
        .from("media_job_state")
        .upsert({ job_name, cursor: null, updated_at: new Date().toISOString() }, { onConflict: "job_name" });

      if (error) return json(req, 500, { ok: false, message: error.message });

      await svc.from("admin_audit_log").insert({
        admin_user_id: userId,
        action: "reset_cursor",
        target: "media_job_state",
        details: { job_name },
      });

      return json(req, 200, { ok: true });
    }

    if (action === "set_cron_active") {
      const jobname = String(body.jobname ?? "");
      const active = Boolean(body.active);
      if (!jobname) return json(req, 400, { ok: false, message: "jobname required" });

      const { error } = await svc.rpc("admin_set_cron_active", { p_jobname: jobname, p_active: active });
      if (error) return json(req, 500, { ok: false, message: error.message });

      await svc.from("admin_audit_log").insert({
        admin_user_id: userId,
        action: active ? "enable_cron" : "disable_cron",
        target: "pg_cron",
        details: { jobname },
      });

      return json(req, 200, { ok: true });
    }

    if (action === "set_cron_schedule") {
      const jobname = String(body.jobname ?? "");
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

    if (action === "run_now") {
      const jobname = String(body.jobname ?? "");
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

    return json(req, 400, { ok: false, message: `Unknown action: ${action}` });
  } catch (e) {
    // Important: return 500 here so client-side dashboards can distinguish
    // unexpected server failures from validation/auth errors.
    return json(req, 500, { ok: false, message: (e as any)?.message ?? String(e) });
  }
});
