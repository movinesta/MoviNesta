/// <reference lib="deno.ns" />

import { HttpError, requireAdmin } from "../_shared/admin.ts";

function buildCorsHeaders(req: Request): Headers {
  const h = new Headers();

  const origin = req.headers.get("origin");
  // For Authorization header usage, "*" is ok (no cookies). If you later use cookies, use a strict allowlist.
  h.set("access-control-allow-origin", origin ?? "*");
  h.set("vary", "Origin");

  h.set("access-control-allow-methods", "GET, POST, OPTIONS");

  const reqHeaders = req.headers.get("access-control-request-headers");
  h.set(
    "access-control-allow-headers",
    reqHeaders ?? "authorization, x-client-info, apikey, content-type",
  );

  // Cache preflight for 24h
  h.set("access-control-max-age", "86400");

  return h;
}

function jsonWithCors(req: Request, body: unknown, status = 200): Response {
  const headers = buildCorsHeaders(req);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), { status, headers });
}

Deno.serve(async (req) => {
  // Preflight must ALWAYS be 2xx + CORS headers; never run auth on OPTIONS.
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: buildCorsHeaders(req) });
  }

  try {
    const { userId, email, role } = await requireAdmin(req);
    return jsonWithCors(req, { ok: true, userId, email, role }, 200);
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    const message = err instanceof Error ? err.message : String(err);
    return jsonWithCors(req, { ok: false, error: message }, status);
  }
});
