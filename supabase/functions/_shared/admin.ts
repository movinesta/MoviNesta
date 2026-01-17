// supabase/functions/_shared/admin.ts
//
// Shared helpers for Admin Edge Functions:
// - CORS (browser-friendly)
// - authenticated user extraction (from Authorization: Bearer <jwt>)
// - admin gate (checks public.app_admins using service role)
// - consistent JSON responses
//
// IMPORTANT:
// - app_admins has RLS deny_all, so checks MUST use the service role client.
// - Browser clients (localhost, GitHub Pages) require OPTIONS preflight to return 200 with CORS headers.

import { createClient } from "supabase";
import { getConfig } from "./config.ts";

const ADMIN_CORS_ALLOWLIST = new Set<string>([
  // Web
  "https://movinesta.github.io",
  "https://movinesta.app",
  "https://www.movinesta.app",
  "https://admin.movinesta.app",

  // Local dev
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:4173",
  "http://localhost:4174",
  "http://localhost:3000",
]);

const MOVINESTA_APP_ORIGIN_RE = /^https:\/\/([a-z0-9-]+\.)*movinesta\.app$/i;

function uuid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `req_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
  }
}

function getRequestId(req: Request | null | undefined): string {
  if (!req) return uuid();
  const direct = (req.headers.get("x-request-id") ?? req.headers.get("x-correlation-id") ?? "").trim();
  if (direct) return direct;
  const cfRay = (req.headers.get("cf-ray") ?? "").trim();
  if (cfRay) return `cf_${cfRay}`;
  return uuid();
}

function isAllowedAdminOrigin(origin: string): boolean {
  if (!origin) return false;
  if (ADMIN_CORS_ALLOWLIST.has(origin)) return true;
  return MOVINESTA_APP_ORIGIN_RE.test(origin);
}


function adminCorsHeaders(req?: Request): Record<string, string> {
  const origin = req?.headers?.get?.("origin") ?? "";
  // Default-deny for unknown browser origins. If no Origin header (server-to-server),
  // we also deny CORS (no allow-origin) to avoid widening admin surface.
  if (!origin || !isAllowedAdminOrigin(origin)) {
    return {
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-request-id, x-runner-job-id",
      "Access-Control-Expose-Headers": "x-request-id, x-runner-job-id",
      "Vary": "Origin",
    };
  }
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-request-id, x-runner-job-id",
    "Access-Control-Expose-Headers": "x-request-id, x-runner-job-id",
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin",
  };
}

function handleAdminCors(req: Request): Response | null {
  if (req.method !== "OPTIONS") return null;
  return new Response(null, { status: 200, headers: adminCorsHeaders(req) });
}

function corsHeadersFor(req: any): Record<string, string> {
  return adminCorsHeaders(isRequest(req) ? req : undefined);
}

function handleCorsBase(req: any): Response | null {
  return isRequest(req) ? handleAdminCors(req) : null;
}

function isRequest(v: any): v is Request {
  return (
    v &&
    typeof v === "object" &&
    typeof (v as any).method === "string" &&
    (v as any).headers &&
    typeof (v as any).headers.get === "function"
  );
}

// Always return CORS headers even if we don't have a real Request (e.g. legacy json(status, body) calls)
function safeCorsHeadersFor(req?: Request | null): HeadersInit {
  try {
    if (req) return corsHeadersFor(req);
  } catch {
    // ignore
  }
  // Fallback: no origin information available. Keep preflight behavior, but
  // still include the shared allowlist/"Vary: Origin" behavior.
  return corsHeadersFor({ headers: { get: () => null } } as any);
}



export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export function handleCors(req: Request): Response | null {
  return handleCorsBase(req);
}

// Backward compatible:
// - json(req, status, body, extraHeaders?)
// - json(status, body, extraHeaders?)
export function json(...args: any[]): Response {
  let req: Request | null = null;
  let status: number;
  let body: unknown;
  let extraHeaders: HeadersInit | undefined;

  if (isRequest(args[0])) {
    req = args[0] as Request;
    status = Number(args[1]);
    body = args[2];
    extraHeaders = args[3] as HeadersInit | undefined;
  } else {
    status = Number(args[0]);
    body = args[1];
    extraHeaders = args[2] as HeadersInit | undefined;
  }

  // Never allow an invalid status to crash the function (Deno throws on 0, NaN, etc.)
  if (!Number.isFinite(status) || status < 200 || status > 599) status = 200;

  const headers = new Headers(safeCorsHeadersFor(req));
  const rid = getRequestId(req);
  if (!headers.has("x-request-id")) headers.set("x-request-id", rid);
  headers.set("content-type", "application/json; charset=utf-8");
  if (extraHeaders) {
    const eh = new Headers(extraHeaders);
    eh.forEach((v, k) => headers.set(k, v));
  }

  return new Response(JSON.stringify(body), { status, headers });
}

export function getErrorStatus(err: unknown): number | null {
  if (err instanceof HttpError) return err.status;
  if (!err || typeof err !== "object") return null;
  const maybe = (err as { status?: unknown; statusCode?: unknown }).status ??
    (err as { status?: unknown; statusCode?: unknown }).statusCode;
  if (typeof maybe === "number" && Number.isFinite(maybe)) return maybe;
  if (typeof maybe === "string") {
    const parsed = Number(maybe);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function jsonError(req: Request, err: unknown, fallbackStatus = 500): Response {
  const status = getErrorStatus(err) ?? fallbackStatus;
  const message = (err as { message?: string })?.message ?? String(err);
  const requestId = getRequestId(req);
  return json(req, status, { ok: false, message, requestId }, { "x-request-id": requestId });
}

export function getSupabaseServiceClient() {
  const cfg = getConfig();
  assertServiceRoleConfig(cfg);
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

function getApiKeyFromRequest(req: Request): string {
  return (
    req.headers.get("apikey") ??
    req.headers.get("x-api-key") ??
    req.headers.get("X-Api-Key") ??
    ""
  ).trim();
}

function requireAdminApiKey(req: Request): void {
  const cfg = getConfig();
  const provided = getApiKeyFromRequest(req);
  if (!provided) throw new HttpError(401, "Missing apikey header");

  // Admin endpoints are typically called from supabase-js (browser/app), which sends the publishable/anon key.
  // We also allow the service role key for internal server-to-server callers.
  if (provided !== cfg.supabaseAnonKey && provided !== cfg.supabaseServiceRoleKey) {
    throw new HttpError(401, "Invalid apikey header");
  }
}


export async function getUserIdFromRequest(req: Request): Promise<{ userId: string; email: string | null; jwt: string }> {
  requireAdminApiKey(req);

  const jwt = getJwtFromRequest(req);
  if (!jwt) throw new HttpError(401, "Missing Authorization bearer token");

  const userClient = getSupabaseUserClient(jwt);
  const authAny = userClient.auth as any;

  // Supabase: getUser(jwt) performs a network request to the Auth server, so it is authoritative
  // for server-side authorization checks.
  try {
    // Prefer overload that accepts a JWT explicitly.
    const { data, error } = await authAny.getUser(jwt);
    if (error || !data?.user?.id) throw error ?? new Error("Invalid session");
    return { userId: data.user.id, email: data.user.email ?? null, jwt };
  } catch {
    // Backward-compatible fallback (older client versions)
    const { data, error } = await userClient.auth.getUser();
    if (error || !data?.user?.id) throw new HttpError(401, "Invalid session");
    return { userId: data.user.id, email: data.user.email ?? null, jwt };
  }
}

export async function requireAdmin(req: Request): Promise<{ userId: string; email: string | null; role: string; svc: ReturnType<typeof getSupabaseServiceClient> }> {
  const { userId, email } = await getUserIdFromRequest(req);
  const svc = getSupabaseServiceClient();

  const { data, error } = await svc
    .schema("public")
    .from("app_admins")
    .select("user_id, role")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new HttpError(500, error.message);
  if (!data?.user_id) throw new HttpError(403, "Not authorized: Admin access required");

  return { userId, email, role: data.role ?? "admin", svc };
}

function assertServiceRoleConfig(cfg: { supabaseUrl: string; supabaseServiceRoleKey: string }) {
  if (!cfg.supabaseUrl || cfg.supabaseUrl === "mock_url" || !cfg.supabaseUrl.startsWith("https://")) {
    throw new HttpError(500, "SUPABASE_URL is missing or invalid for the edge runtime");
  }

  const role = decodeJwtRole(cfg.supabaseServiceRoleKey);
  if (role && role !== "service_role") {
    throw new HttpError(
      500,
      `SUPABASE_SERVICE_ROLE_KEY must be a service_role key (found role: ${role})`,
    );
  }
}

function decodeJwtRole(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(atob(base64UrlToBase64(parts[1])));
    const role = payload?.role;
    return typeof role === "string" ? role : null;
  } catch {
    return null;
  }
}

function base64UrlToBase64(input: string): string {
  return input.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(input.length / 4) * 4, "=");
}
