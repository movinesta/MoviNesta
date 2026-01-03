// supabase/functions/_shared/http.ts
//
// Shared HTTP helpers for Edge Functions to standardize JSON responses and CORS.
//
// Backward compatibility note:
// Some functions call jsonResponse/jsonError with (req, ...) and others call them
// with (..., req). These helpers therefore accept both call styles.

const ORIGIN_ALLOWLIST = new Set<string>([
  "https://movinesta.github.io",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
]);

function isHeadersLike(x: unknown): x is { get: (key: string) => string | null } {
  return !!x && typeof x === "object" && typeof (x as any).get === "function";
}

function isRequestLike(x: unknown): x is Request {
  // Duck-typing: in Edge Runtime, `Request` is available but `instanceof` can be
  // unreliable across realms.
  return (
    !!x &&
    typeof x === "object" &&
    typeof (x as any).method === "string" &&
    isHeadersLike((x as any).headers)
  );
}

function getHeadersFrom(input?: unknown): { get: (key: string) => string | null } | undefined {
  if (!input) return undefined;
  if (isRequestLike(input)) return input.headers;
  if (isHeadersLike(input)) return input;
  const maybeHeaders = (input as any).headers;
  if (isHeadersLike(maybeHeaders)) return maybeHeaders;
  return undefined;
}

export function corsHeadersFor(input?: Request | Headers | unknown): Record<string, string> {
  const headers = getHeadersFrom(input);
  const origin = headers?.get("origin") ?? "";
  const allowOrigin = origin && ORIGIN_ALLOWLIST.has(origin) ? origin : "*";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
  };
}

/**
 * Return a simple CORS preflight response if the request is OPTIONS.
 */
export function handleOptions(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeadersFor(req) });
  }
  return null;
}

function mergeHeaders(base: Record<string, string>, extra?: HeadersInit): Headers {
  const h = new Headers();
  for (const [k, v] of Object.entries(base)) h.set(k, v);

  if (!extra) return h;

  if (extra instanceof Headers) {
    extra.forEach((v, k) => h.set(k, v));
    return h;
  }

  if (Array.isArray(extra)) {
    for (const [k, v] of extra) h.set(k, v);
    return h;
  }

  for (const [k, v] of Object.entries(extra)) h.set(k, v);
  return h;
}

type JsonInit = Omit<ResponseInit, "status" | "headers"> & { headers?: HeadersInit };

// Overloads for legacy and new call styles.
export function jsonResponse(req: Request, data: unknown, status?: number, init?: JsonInit): Response;
export function jsonResponse(data: unknown, status?: number, init?: JsonInit, req?: Request): Response;
export function jsonResponse(
  arg1: unknown,
  arg2?: unknown,
  arg3?: unknown,
  arg4?: unknown,
): Response {
  let req: Request | undefined;
  let data: unknown;
  let status = 200;
  let init: JsonInit | undefined;

  if (isRequestLike(arg1)) {
    // Legacy: (req, data, status?, init?)
    req = arg1;
    data = arg2;
    if (typeof arg3 === "number") {
      status = arg3;
      init = (arg4 as JsonInit | undefined);
    } else {
      status = 200;
      init = (arg3 as JsonInit | undefined);
    }
  } else {
    // New: (data, status?, init?, req?)
    data = arg1;
    if (typeof arg2 === "number") {
      status = arg2;
      init = (arg3 as JsonInit | undefined);
      req = isRequestLike(arg4) ? (arg4 as Request) : undefined;
    } else {
      status = 200;
      init = (arg2 as JsonInit | undefined);
      req = isRequestLike(arg3) ? (arg3 as Request) : isRequestLike(arg4) ? (arg4 as Request) : undefined;
    }
  }

  const baseHeaders: Record<string, string> = {
    ...corsHeadersFor(req),
    "Content-Type": "application/json",
  };

  const headers = mergeHeaders(baseHeaders, init?.headers);

  return new Response(JSON.stringify(data), {
    ...init,
    status,
    headers,
  });
}

export function jsonError(
  req: Request,
  message: string,
  status: number,
  code?: string,
  extra?: Record<string, unknown>,
): Response;
export function jsonError(
  message: string,
  status: number,
  code?: string,
  req?: Request,
  extra?: Record<string, unknown>,
): Response;
export function jsonError(
  arg1: unknown,
  arg2: unknown,
  arg3: unknown,
  arg4?: unknown,
  arg5?: unknown,
): Response {
  let req: Request | undefined;
  let message = "Unknown error";
  let status = 500;
  let code: string | undefined;
  let extra: Record<string, unknown> | undefined;

  if (isRequestLike(arg1)) {
    // Legacy: (req, message, status, code?, extra?)
    req = arg1;
    message = String(arg2 ?? "Unknown error");
    status = typeof arg3 === "number" ? arg3 : Number(arg3 ?? 500);
    code = typeof arg4 === "string" ? arg4 : undefined;
    extra = (arg5 && typeof arg5 === "object") ? (arg5 as Record<string, unknown>) : undefined;
  } else {
    // New: (message, status, code?, req?, extra?)
    message = String(arg1 ?? "Unknown error");
    status = typeof arg2 === "number" ? arg2 : Number(arg2 ?? 500);
    code = typeof arg3 === "string" ? (arg3 as string) : undefined;
    req = isRequestLike(arg4) ? (arg4 as Request) : undefined;
    extra = (arg5 && typeof arg5 === "object") ? (arg5 as Record<string, unknown>) : undefined;
  }

  if (!Number.isFinite(status)) status = 500;

  const body: Record<string, unknown> = { ok: false, error: message, message };
  if (code) body.code = code;
  if (extra) Object.assign(body, extra);

  return jsonResponse(body, status, undefined, req);
}

type ValidationResult<T> =
  | { data: T; errorResponse: null }
  | { data: null; errorResponse: Response };

/**
 * Safely parse and validate a JSON request body.
 *
 * - Handles invalid JSON with a consistent 400 response.
 * - Delegates validation to a caller-provided parser.
 * - Returns typed payload when successful, or an error Response to early-return.
 */
export async function validateRequest<T>(
  req: Request,
  parse: (body: unknown) => T,
  options?: { logPrefix?: string; requireJson?: boolean },
): Promise<ValidationResult<T>> {
  const prefix = options?.logPrefix ?? "";
  let raw: unknown;

  try {
    if (options?.requireJson) {
      const contentType = req.headers.get("content-type") ?? "";
      if (!isJsonContentType(contentType)) {
        return {
          data: null,
          errorResponse: jsonError(
            "Unsupported Media Type",
            415,
            "UNSUPPORTED_MEDIA_TYPE",
            req,
            { expected: "application/json" },
          ),
        };
      }
    }

    raw = await req.json();
  } catch (err) {
    if (prefix) console.error(`${prefix} invalid JSON body`, err);
    else console.error("Invalid JSON body", err);

    return {
      data: null,
      errorResponse: jsonError("Invalid JSON body", 400, "BAD_REQUEST_INVALID_BODY", req),
    };
  }

  try {
    return { data: parse(raw), errorResponse: null };
  } catch (err) {
    if (prefix) console.error(`${prefix} invalid request body`, err);
    else console.error("Invalid request body", err);

    return {
      data: null,
      errorResponse: jsonError("Invalid request body", 400, "BAD_REQUEST_INVALID_BODY", req),
    };
  }
}

function isJsonContentType(contentType: string): boolean {
  const lower = contentType.toLowerCase();
  if (!lower) return false;
  if (lower.startsWith("application/json")) return true;
  return lower.includes("+json");
}

/**
 * postJson — small helper for server-to-server JSON calls.
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
    const preview = text.length > 800 ? `${text.slice(0, 800)}…` : text;
    throw new Error(`POST ${url} failed (${res.status}): ${preview}`);
  }

  if (!text) return {} as TResp;

  try {
    return JSON.parse(text) as TResp;
  } catch {
    return ({ raw: text } as unknown) as TResp;
  }
}
