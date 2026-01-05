import { jsonResponse } from "./http.ts";

export function requireInternalJob(req: Request): Response | null {
  const expected = Deno.env.get("INTERNAL_JOB_TOKEN") ?? "";
  const provided = req.headers.get("x-job-token") ?? "";

  if (!expected || !provided || expected !== provided) {
    return jsonResponse(
      { ok: false, error: "Unauthorized", code: "INVALID_JOB_TOKEN" },
      401,
      undefined,
      req,
    );
  }

  return null;
}
