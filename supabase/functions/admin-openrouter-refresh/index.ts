import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { handleCors, json, jsonError, requireAdmin } from "../_shared/admin.ts";
import { getConfig } from "../_shared/config.ts";

type Body = {
  base_url?: string | null;
  timeout_ms?: number | null;
  refresh_parameters?: boolean | null;
  max_models?: number | null;
};

async function readJsonSafe(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { ok: res.ok, status: res.status, body: text };
  }
}

serve(async (req) => {
  try {
    const cors = handleCors(req);
    if (cors) return cors;

    await requireAdmin(req);

    if (req.method !== "POST") {
      return json(req, 405, { ok: false, message: "Method not allowed" });
    }

    const cfg = getConfig();
    if (!cfg.internalJobToken) {
      return json(req, 500, { ok: false, message: "INTERNAL_JOB_TOKEN is not configured" });
    }

    const body: Body = await req.json().catch(() => ({}));
    const payload = {
      reason: "admin-openrouter-refresh",
      base_url: typeof body.base_url === "string" ? body.base_url : null,
      timeout_ms: typeof body.timeout_ms === "number" ? body.timeout_ms : null,
      refresh_parameters: Boolean(body.refresh_parameters),
      max_models: typeof body.max_models === "number" ? body.max_models : null,
    };

    const url = `${cfg.supabaseUrl.replace(/\/$/, "")}/functions/v1/openrouter-refresh`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${cfg.supabaseAnonKey}`,
        "x-job-token": cfg.internalJobToken,
      },
      body: JSON.stringify(payload),
    });

    const data = await readJsonSafe(res);
    return json(req, res.status, { ok: res.ok, ...data });
  } catch (err) {
    return jsonError(req, err);
  }
});
