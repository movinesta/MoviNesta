// supabase/functions/_shared/http.ts
//
// Shared HTTP helpers for Edge Functions to standardize JSON responses and CORS.

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

/**
 * Return a simple CORS preflight response if the request is OPTIONS.
 */
export function handleOptions(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  return null;
}

export function jsonResponse(
  data: unknown,
  status = 200,
  init?: Omit<ResponseInit, "status" | "headers">,
): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

export function jsonError(
  message: string,
  status: number,
  code?: string,
): Response {
  return jsonResponse({ ok: false, error: message, code }, status);
}
