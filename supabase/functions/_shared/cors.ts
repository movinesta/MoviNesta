/**
 * Shared CORS utilities for Supabase Edge Functions.
 *
 * This file must be defensive:
 * - Some call sites may pass a Request-like object or even `undefined`.
 * - We still want to return CORS headers (never throw), otherwise browsers will surface CORS errors
 *   that mask the real underlying failure.
 */

const ALLOWLIST = new Set<string>([
  // Production
  "https://movinesta.github.io",
  // Local dev
  "http://localhost:5173",
  "http://localhost:3000",
]);

function pickOrigin(origin: string | null | undefined): string {
  if (!origin) return "*";
  return ALLOWLIST.has(origin) ? origin : "*";
}

function getHeader(headers: any, name: string): string | null {
  try {
    if (!headers) return null;

    // Standard Headers
    if (typeof headers.get === "function") {
      return headers.get(name);
    }

    // Plain object (case-insensitive)
    if (typeof headers === "object") {
      const lower = name.toLowerCase();
      for (const k of Object.keys(headers)) {
        if (k.toLowerCase() === lower) {
          const v = (headers as any)[k];
          if (v == null) return null;
          return Array.isArray(v) ? String(v[0] ?? "") : String(v);
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Compute CORS headers for a request (or request-like input).
 */
export function corsHeaders(req: any): Record<string, string> {
  // Support being called with Request, Request-like objects, or `undefined`.
  const headers = req?.headers ?? req;
  const origin = pickOrigin(getHeader(headers, "origin"));

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
    // Helpful when auth headers vary; safe to always include
    Vary: "Origin",
  };
}

/**
 * Compatibility export used by `_shared/admin.ts`.
 */
export function corsHeadersFor(req: any): Record<string, string> {
  return corsHeaders(req);
}

/**
 * Handle preflight requests. Returns a Response if the request is OPTIONS, else null.
 */
export function handleCorsPreflight(req: any): Response | null {
  const method = req?.method ?? "";
  if (method !== "OPTIONS") return null;
  return new Response(null, { status: 200, headers: corsHeaders(req) });
}

/**
 * Compatibility export used by `_shared/admin.ts`.
 */
export function handleCors(req: any): Response | null {
  return handleCorsPreflight(req);
}

/**
 * Return JSON with CORS headers.
 */
export function jsonWithCors(req: any, body: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers ?? {});
  const ch = corsHeaders(req);
  for (const [k, v] of Object.entries(ch)) headers.set(k, v);
  if (!headers.has("content-type")) headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), { ...init, headers });
}
