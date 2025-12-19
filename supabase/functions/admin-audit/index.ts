/// <reference path="../_shared/deno.d.ts" />
// Supabase Edge Function: admin-audit
// Fix: Always return 200 OK for CORS preflight (OPTIONS) and attach CORS headers to all responses.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
      ...extraHeaders,
    },
  });
}

function textResponse(body: string, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(body, {
    status,
    headers: {
      ...CORS_HEADERS,
      ...extraHeaders,
    },
  });
}

Deno.serve(async (req) => {
  // CORS preflight must succeed without auth checks.
  if (req.method === "OPTIONS") {
    return textResponse("ok", 200);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    if (!supabaseUrl || !anonKey) {
      return jsonResponse({ ok: false, error: "Missing SUPABASE_URL / SUPABASE_ANON_KEY" }, 500);
    }

    // Use request JWT so policies/admin checks work.
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Optional admin gate: if your project has public.is_admin() RPC, enforce it.
    // If it doesn't exist, we ignore and rely on RLS / table permissions.
    try {
      const { data: isAdmin, error: adminErr } = await supabase.rpc("is_admin");
      if (!adminErr && isAdmin !== true) {
        return jsonResponse({ ok: false, error: "Not authorized" }, 403);
      }
    } catch {
      // ignore
    }

    const payload = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const limit = Number(payload.limit ?? 100);
    const cursor = payload.cursor ?? null;

    let q = supabase
      .from("admin_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 500));

    if (cursor) q = q.lt("created_at", cursor);

    const { data, error } = await q;
    if (error) return jsonResponse({ ok: false, error: error.message }, 500);

    return jsonResponse({ ok: true, rows: data ?? [] }, 200);
  } catch (e) {
    return jsonResponse({ ok: false, error: String(getErrorMessage(e)) }, 500);
  }
});

function getErrorMessage(e: unknown) {
  if (e instanceof Error) return e.message;
  try { return JSON.stringify(e); } catch { return String(e); }
}
