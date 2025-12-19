/**
 * Shared CORS utilities for Supabase Edge Functions.
 *
 * Goals:
 * - Always respond to OPTIONS preflight with HTTP 200 + CORS headers.
 * - Echo back a safe origin (allowlist), otherwise fall back to "*".
 * - Include the headers the browser actually requests (apikey, authorization, content-type, x-client-info).
 */

const ALLOWLIST = new Set<string>([
  // Production
  "https://movinesta.github.io",
  // Local dev
  "http://localhost:5173",
  "http://localhost:3000",
]);

function pickOrigin(origin: string | null): string {
  if (!origin) return "*";
  return ALLOWLIST.has(origin) ? origin : "*";
}

/**
 * Compute CORS headers for a request.
 */
export function corsHeaders(req: Request): Record<string, string> {
  const origin = pickOrigin(req.headers.get("origin"));
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
    // Helpful when auth headers vary
    Vary: "Origin",
  };
}

/**
 * Compatibility export used by `_shared/admin.ts`.
 */
export function corsHeadersFor(req: Request): Record<string, string> {
  return corsHeaders(req);
}

/**
 * Handle preflight requests. Returns a Response if the request is OPTIONS, else null.
 */
export function handleCorsPreflight(req: Request): Response | null {
  if (req.method !== "OPTIONS") return null;
  return new Response(null, { status: 200, headers: corsHeaders(req) });
}

/**
 * Compatibility export used by `_shared/admin.ts`.
 */
export function handleCors(req: Request): Response | null {
  return handleCorsPreflight(req);
}

/**
 * Return JSON with CORS headers.
 */
export function jsonWithCors(req: Request, body: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers ?? {});
  const ch = corsHeaders(req);
  for (const [k, v] of Object.entries(ch)) headers.set(k, v);
  if (!headers.has("content-type")) headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), { ...init, headers });
}
