// supabase/functions/debug-env/index.ts
//
// Lightweight health/debug endpoint for edge functions.
// Does NOT expose raw secrets, only flags indicating presence.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve((req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Method not allowed",
      }),
      {
        status: 405,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }

  const body = {
    ok: true,
    env: {
      hasSupabaseUrl: Boolean(Deno.env.get("SUPABASE_URL")),
      hasAnonKey: Boolean(Deno.env.get("SUPABASE_ANON_KEY")),
      hasServiceRoleKey: Boolean(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")),
    },
    runtime: {
      deno: Deno.version.deno,
      v8: Deno.version.v8,
      typescript: Deno.version.typescript,
    },
  };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
});
