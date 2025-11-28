import { ResponseInit } from "https://deno.land/std@0.224.0/http/mod.ts";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export function optionsResponse() {
  return new Response("ok", { headers: corsHeaders });
}

export function methodNotAllowed(): Response {
  return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
}

export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}

export async function parseJson<T>(req: Request, fallback: T): Promise<T> {
  try {
    const parsed = (await req.json()) as T;
    return parsed;
  } catch {
    return fallback;
  }
}

export function errorResponse(message: string, status = 500): Response {
  return jsonResponse({ error: message }, { status });
}
