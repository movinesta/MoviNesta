export function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "*";

  // Allowlist production + common local dev origins.
  const allow = new Set([
    "https://movinesta.github.io",
    "http://localhost:5173",
    "http://localhost:3000",
  ]);

  const allowOrigin = allow.has(origin) ? origin : "https://movinesta.github.io";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}

export function handleCorsPreflight(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders(req) });
  }
  return null;
}

/**
 * Helper to ensure JSON responses always include CORS headers (including errors).
 */
export function jsonWithCors(req: Request, body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req),
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });
}
