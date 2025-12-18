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

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

export function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  return null;
}

export function json(status: number, body: unknown): Response {
  if (status >= 400) {
    try {
      console.error("ADMIN_API_ERROR", JSON.stringify(body));
    } catch {
      console.error("ADMIN_API_ERROR", body);
    }
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...corsHeaders },
  });
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
  if (!jwt) throw new Error("Missing Authorization bearer token");

  const userClient = getSupabaseUserClient(jwt);
  const { data, error } = await userClient.auth.getUser();
  if (error || !data?.user?.id) throw new Error("Invalid session");
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

  if (error) throw new Error(error.message);
  if (!data?.user_id) throw new Error("Not authorized");

  return { userId, email, role: data.role ?? "admin", svc };
}
