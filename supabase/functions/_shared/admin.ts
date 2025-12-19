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

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getConfig } from "./config.ts";
import { corsHeadersFor, handleCors as handleCorsBase } from "./cors.ts";
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
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
    "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "access-control-max-age": "86400",
  };
}



export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
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
  headers.set("content-type", "application/json; charset=utf-8");
  if (extraHeaders) {
    const eh = new Headers(extraHeaders);
    eh.forEach((v, k) => headers.set(k, v));
  }

  return new Response(JSON.stringify(body), { status, headers });
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
  if (!jwt) throw new HttpError(401, "Missing Authorization bearer token");

  const userClient = getSupabaseUserClient(jwt);
  const { data, error } = await userClient.auth.getUser();
  if (error || !data?.user?.id) throw new HttpError(401, "Invalid session");
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

  if (error) throw new HttpError(500, error.message);
  if (!data?.user_id) throw new HttpError(403, "Not authorized");

  return { userId, email, role: data.role ?? "admin", svc };
}
