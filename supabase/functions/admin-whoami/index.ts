// supabase/functions/admin-whoami/index.ts
//
// Self-contained "admin whoami" endpoint.
//
// Purpose
// - The admin dashboard (hosted on GitHub Pages) calls this endpoint to verify the
//   current user is an admin.
//
// Why self-contained?
// - If a shared module throws during initialization, Supabase can return a 500 without
//   CORS headers, which shows up as a CORS error in the browser. This file avoids
//   those shared imports and guarantees CORS headers on every response path.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type WhoamiOk = {
  ok: true;
  user_id: string;
  email: string | null;
  is_admin: true;
};

type WhoamiErr = {
  ok: false;
  error: string;
};

function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function parseAllowedOrigins(): string[] | null {
  const raw = Deno.env.get("ADMIN_ALLOWED_ORIGINS") ?? Deno.env.get("ALLOWED_ORIGINS");
  if (!raw) return null;
  const list = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!list.length) return null;
  return list;
}

function buildCorsHeaders(req: Request): Headers {
  const allowed = parseAllowedOrigins();
  const origin = req.headers.get("origin") ?? "";

  // Default: allow any origin (typical for public Edge Functions gated by auth).
  let allowOrigin = "*";

  // If an allowlist is configured, echo back request origin only when it matches.
  if (allowed && allowed.length) {
    if (origin && allowed.includes(origin)) allowOrigin = origin;
    else allowOrigin = allowed[0] ?? "*";
  }

  return new Headers({
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    Vary: "Origin",
  });
}

function json(req: Request, status: number, body: WhoamiOk | WhoamiErr): Response {
  const headers = buildCorsHeaders(req);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), { status, headers });
}

function getBearerToken(req: Request): string | null {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!auth) return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

async function isAdminUser(service: ReturnType<typeof createClient>, userId: string): Promise<boolean> {
  // NOTE: Keep this permissive to schema differences.
  // We check a common table name `app_admins` (user_id column). If your project uses a
  // different table, update this query accordingly.
  const { data, error } = await service.from("app_admins").select("user_id").eq("user_id", userId).maybeSingle();
  if (error) {
    // If the table doesn't exist, error message will be like "relation ... does not exist".
    // Treat as not admin (and still respond with CORS).
    return false;
  }
  return !!data?.user_id;
}

Deno.serve(async (req: Request) => {
  // Always answer CORS preflight quickly.
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: buildCorsHeaders(req) });
  }

  try {
    const token = getBearerToken(req);
    if (!token) return json(req, 401, { ok: false, error: "Missing Authorization bearer token" });

    const url = env("SUPABASE_URL");
    const anonKey = env("SUPABASE_ANON_KEY");
    const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");

    const anon = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userErr } = await anon.auth.getUser(token);
    if (userErr || !userData?.user) {
      return json(req, 401, { ok: false, error: "Invalid session" });
    }

    const user = userData.user;

    const service = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const ok = await isAdminUser(service, user.id);
    if (!ok) return json(req, 403, { ok: false, error: "Not an admin" });

    return json(req, 200, {
      ok: true,
      user_id: user.id,
      email: user.email ?? null,
      is_admin: true,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json(req, 500, { ok: false, error: msg });
  }
});
