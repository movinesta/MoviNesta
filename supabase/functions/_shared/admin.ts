// supabase/functions/_shared/admin.ts
//
// Shared helpers for Admin Edge Functions:
// - CORS (browser-friendly, allowlist-based)
// - authenticated user extraction (from Authorization: Bearer <jwt>)
// - admin gate (checks public.app_admins using service role)
// - consistent JSON responses
//
// IMPORTANT:
// - app_admins has RLS deny_all, so checks MUST use the service role client.
// - Browser clients (localhost, GitHub Pages) require OPTIONS preflight to return 200 with CORS headers.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getConfig } from "./config.ts";

const BASE_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

// Default allowlist: dev + GitHub Pages.
// Override in production with ADMIN_CORS_ORIGINS (comma-separated exact origins or patterns using '*').
// Examples:
// - ADMIN_CORS_ORIGINS="https://yourname.github.io,http://localhost:5173"
// - ADMIN_CORS_ORIGINS="https://yourname.github.io/*" (note: Origin never contains path; use exact origin)
// - ADMIN_CORS_ORIGINS="*" (not recommended)
const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:4173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:4173",
  "http://127.0.0.1:3000",
  "https://*.github.io",
];

function parseAllowedOrigins(): string[] {
  const raw =
    (Deno.env.get("ADMIN_CORS_ORIGINS") ?? Deno.env.get("CORS_ORIGINS") ?? "").trim();
  if (!raw) return DEFAULT_ALLOWED_ORIGINS;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function globToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`);
}

function originAllowed(origin: string): boolean {
  if (!origin) return true;
  if (origin === "null") return false;

  const patterns = parseAllowedOrigins();
  if (patterns.includes("*")) return true;

  for (const p of patterns) {
    try {
      if (p.includes("*")) {
        if (globToRegExp(p).test(origin)) return true;
      } else if (p === origin) {
        return true;
      }
    } catch {
      // ignore malformed patterns
    }
  }
  return false;
}

function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? req.headers.get("origin") ?? "";
  // Non-browser clients typically send no Origin. Keep permissive for those.
  if (!origin) {
    return { "Access-Control-Allow-Origin": "*", ...BASE_CORS_HEADERS };
  }
  if (!originAllowed(origin)) {
    // Caller should have rejected already, but keep a safe default.
    return { "Access-Control-Allow-Origin": "null", ...BASE_CORS_HEADERS };
  }
  return {
    "Access-Control-Allow-Origin": origin,
    "Vary": "Origin",
    ...BASE_CORS_HEADERS,
  };
}

/**
 * Lightweight HTTP error that preserves an intended status code.
 *
 * Edge functions often throw plain Errors; when we *want* to communicate a
 * specific HTTP status (e.g., 401/403), throw this instead.
 */
export class HttpError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
  }
}

/**
 * Handles CORS preflight and enforces an Origin allowlist.
 *
 * Call at the top of the request handler:
 *   const cors = handleCors(req); if (cors) return cors;
 */
export function handleCors(req: Request): Response | null {
  const origin = req.headers.get("Origin") ?? req.headers.get("origin") ?? "";
  if (origin && !originAllowed(origin)) {
    // Block cross-origin requests from unknown origins (defense in depth).
    // Do NOT include CORS headers, so browsers fail closed.
    const body = JSON.stringify({ ok: false, message: "CORS origin denied", code: "cors_denied" });
    return new Response(body, { status: 403, headers: { "content-type": "application/json; charset=utf-8" } });
  }

  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeadersFor(req) });
  }
  return null;
}

export function json(req: Request, status: number, body: unknown): Response {
  if (status >= 400) {
    try {
      console.error("ADMIN_API_ERROR", JSON.stringify(body));
    } catch {
      console.error("ADMIN_API_ERROR", body);
    }
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...corsHeadersFor(req) },
  });
}

export function jsonError(req: Request, e: unknown): Response {
  if (e instanceof HttpError) {
    return json(req, e.status, { ok: false, message: e.message, code: e.code ?? null });
  }
  const msg = (e as any)?.message ?? String(e);
  return json(req, 500, { ok: false, message: msg });
}

export function getSupabaseServiceClient() {
  const cfg = getConfig();
  if (!cfg.supabaseServiceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing");
  return createClient(cfg.supabaseUrl, cfg.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function getSupabaseUserClient(jwt: string) {
  const cfg = getConfig();
  return createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
}

function getJwtFromRequest(req: Request): string {
  const auth = req.headers.get("Authorization") ?? req.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (m?.[1]) return m[1].trim();
  // Sometimes supabase-js sets "apikey" only when unauthenticated; treat as missing.
  return "";
}

export async function getUserIdFromRequest(req: Request): Promise<{ userId: string; email: string | null; jwt: string }> {
  const jwt = getJwtFromRequest(req);
  if (!jwt) throw new HttpError(401, "Missing Authorization bearer token", "missing_auth");

  const userClient = getSupabaseUserClient(jwt);
  const { data, error } = await userClient.auth.getUser();
  if (error || !data?.user?.id) throw new HttpError(401, "Invalid session", "invalid_session");
  return { userId: data.user.id, email: data.user.email ?? null, jwt };
}

export async function requireAdmin(req: Request): Promise<{ userId: string; email: string | null; role: string; svc: ReturnType<typeof getSupabaseServiceClient> }> {
  const { userId, email } = await getUserIdFromRequest(req);
  const svc = getSupabaseServiceClient();

  const { data, error } = await svc
    .from("app_admins")
    .select("user_id, role")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new HttpError(500, error.message, "supabase_error");
  if (!data?.user_id) throw new HttpError(403, "Not authorized", "not_admin");

  return { userId, email, role: data.role ?? "admin", svc };
}
