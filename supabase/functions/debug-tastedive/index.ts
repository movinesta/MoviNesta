// supabase/functions/debug-tastedive/index.ts
//
// Direct TasteDive tester (returns status + parsed JSON + extracted results).
// Safe: does NOT return your API key.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { handleOptions, jsonError, jsonResponse } from "../_shared/http.ts";
import { getUserClient } from "../_shared/supabase.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { getConfig } from "../_shared/config.ts";

type TasteType = "movie" | "show";

function redactedUrl(u: URL) {
  const copy = new URL(u.toString());
  if (copy.searchParams.has("k")) copy.searchParams.set("k", "***REDACTED***");
  return copy.toString();
}

serve(async (req: Request) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  if (req.method !== "POST") {
    return jsonError(req, "Method not allowed. Use POST.", 405, "METHOD_NOT_ALLOWED");
  }

  // Require a valid Supabase session.
  const supabase = getUserClient(req);
  const { data: authData, error: authErr } = await supabase.auth.getUser();
  if (authErr || !authData?.user?.id) {
    return jsonError(req, "Unauthorized", 401, "UNAUTHORIZED");
  }

  const rl = await enforceRateLimit(req, { action: "tastedive", maxPerMinute: 60 });
  if (!rl.ok) {
    return jsonError(req, "Rate limit exceeded", 429, "RATE_LIMIT", { retryAfterSeconds: rl.retryAfterSeconds });
  }

  const { tastediveApiKey: apiKey } = getConfig();
  if (!apiKey) {
    return jsonError(req, "Missing secret: TASTEDIVE_API_KEY", 500, "MISSING_SECRET");
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonError(req, "Invalid JSON body", 400, "BAD_JSON");
  }

  const q = String(body?.q ?? "").trim();
  const type = String(body?.type ?? "movie").trim() as TasteType;
  const limit = Number.isFinite(body?.limit) ? Number(body.limit) : 20;
  const info = Number.isFinite(body?.info) ? Number(body.info) : 1;
  const slimit = Number.isFinite(body?.slimit) ? Number(body.slimit) : 1;

  if (!q) return jsonError(req, "Body must include: { q: string }", 400, "BAD_REQUEST");
  if (type !== "movie" && type !== "show") {
    return jsonError(req, `type must be "movie" or "show"`, 400, "BAD_REQUEST");
  }

  const url = new URL("https://tastedive.com/api/similar");
  url.search = new URLSearchParams({
    q,
    type,
    k: apiKey,
    limit: String(Math.max(1, Math.min(50, limit))),
    info: String(info ? 1 : 0),
    slimit: String(Math.max(1, Math.min(3, slimit))),
  }).toString();

  let status = 0;
  let text = "";
  try {
    const res = await fetch(url.toString());
    status = res.status;
    text = await res.text();
  } catch (e) {
    return jsonResponse(req,  { ok: false, stage: "fetch", error: String(e?.message ?? e) },
      502,
    );
  }

  let parsed: any = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    // keep parsed = null
  }

  const results = Array.isArray(parsed?.Similar?.Results) ? parsed.Similar.Results : [];

  return jsonResponse(req, {
    ok: status >= 200 && status < 300,
    request: {
      q,
      type,
      limit,
      info,
      slimit,
      url: redactedUrl(url),
    },
    tastedive: {
      status,
      resultsCount: results.length,
      results, // array of { Name, Type, ... }
    },
    // helpful when TasteDive sends non-JSON errors:
    rawPreview: text.slice(0, 1500),
  }, status >= 200 && status < 300 ? 200 : 502);
});
