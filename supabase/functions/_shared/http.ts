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

type ValidationResult<T> =
  | { data: T; errorResponse: null }
  | { data: null; errorResponse: Response };

/**
 * Safely parse and validate a JSON request body.
 *
 * - Handles invalid JSON with a consistent 400 response.
 * - Delegates validation to a caller-provided parser (e.g. Zod schema).
 * - Returns typed payload when successful, or an error Response to early-return.
 */
export async function validateRequest<T>(
  req: Request,
  parse: (body: unknown) => T,
  options?: { logPrefix?: string },
): Promise<ValidationResult<T>> {
  const prefix = options?.logPrefix ?? "";
  let raw: unknown;

  try {
    raw = await req.json();
  } catch (err) {
    if (prefix) console.error(`${prefix} invalid JSON body`, err);
    else console.error("Invalid JSON body", err);

    return {
      data: null,
      errorResponse: jsonError("Invalid JSON body", 400, "BAD_REQUEST_INVALID_BODY"),
    };
  }

  try {
    return { data: parse(raw), errorResponse: null };
  } catch (err) {
    if (prefix) console.error(`${prefix} invalid request body`, err);
    else console.error("Invalid request body", err);

    return {
      data: null,
      errorResponse: jsonError("Invalid request body", 400, "BAD_REQUEST_INVALID_BODY"),
    };
  }
}

/**
 * postJson — small helper for server-to-server JSON calls (e.g. Jina)
 *
 * This is intentionally dependency-free and works in Supabase Edge (Deno).
 * It throws on non-2xx responses (including response body preview).
 */
export async function postJson<TResp = unknown>(
  url: string,
  body: unknown,
  headers?: Record<string, string>,
): Promise<TResp> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "accept": "application/json",
      ...(headers ?? {}),
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    // keep it short to avoid log bloat
    const preview = text.length > 800 ? `${text.slice(0, 800)}…` : text;
    throw new Error(`POST ${url} failed (${res.status}): ${preview}`);
  }

  // Some APIs may return empty body on success
  if (!text) return {} as TResp;

  try {
    return JSON.parse(text) as TResp;
  } catch {
    // fallback: return raw text
    return ({ raw: text } as unknown) as TResp;
  }
}
