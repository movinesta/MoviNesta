/**
 * Shared CORS utilities for Supabase Edge Functions.
 *
 * This module is kept for compatibility with older functions that import
 * `_shared/cors.ts`. Newer functions should use `_shared/http.ts`.
 */

import { corsHeadersFor as corsHeadersForHttp, handleOptions, jsonResponse, getRequestId } from "./http.ts";

function getOrigin(req: any): string {
  try {
    const h = req?.headers ?? req;
    if (h && typeof h.get === "function") return String(h.get("origin") ?? "");
    return "";
  } catch {
    return "";
  }
}

/**
 * Compute CORS headers for a request (or request-like input).
 */
export function corsHeaders(req: any): Record<string, string> {
  // Delegate to the canonical implementation.
  return corsHeadersForHttp(req);
}

/**
 * Compatibility export used by `_shared/admin.ts`.
 */
export function corsHeadersFor(req: any): Record<string, string> {
  return corsHeadersForHttp(req);
}

/**
 * Handle preflight requests. Returns a Response if the request is OPTIONS, else null.
 */
export function handleCorsPreflight(req: any): Response | null {
  const method = req?.method ?? "";
  if (method !== "OPTIONS") return null;

  // Only return a successful preflight if the origin is allowlisted.
  const origin = getOrigin(req);
  const headers = corsHeadersFor(req);
  if (origin && !headers["Access-Control-Allow-Origin"]) {
    return new Response("CORS origin not allowed", { status: 403 });
  }

  // Reuse the canonical OPTIONS handler (sets the right headers).
  return handleOptions(req as Request) ?? new Response("ok", { headers });
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
  const status = init?.status ?? 200;
  const rid = (() => {
    try {
      return getRequestId(req as Request);
    } catch {
      return "";
    }
  })();

  return jsonResponse(req as Request, body, status, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      ...(rid ? { "x-request-id": rid } : {}),
    },
  });
}