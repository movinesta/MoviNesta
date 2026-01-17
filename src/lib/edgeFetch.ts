import { getPublicSettingNumber } from "./settings/publicSettingsStore";
import { forceRefreshAccessToken, getValidAccessToken } from "./authTokenStore";

export type EdgeFetchOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: any;
  accept?: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** If true, fail fast when there is no authenticated session. */
  requireAuth?: boolean;
  /** Retry once on 401/403 after forcing a token refresh (default: true). */
  retryAuthOnce?: boolean;
};

function createRequestId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `req_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
  }
}

function getSupabaseUrl(): string {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!url) throw new Error("Missing VITE_SUPABASE_URL");
  return url.replace(/\/+$/, "");
}

function getSupabaseAnonKey(): string {
  const k =
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ??
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_OR_ANON_KEY as string | undefined);
  if (!k) throw new Error("Missing VITE_SUPABASE_ANON_KEY");
  return k;
}

async function doFetch(url: string, init: RequestInit): Promise<Response> {
  return await fetch(url, init);
}

/**
 * Direct fetch to a Supabase Edge Function endpoint.
 *
 * Why this exists:
 * - `supabase.functions.invoke()` is great for JSON requests.
 * - Some endpoints (e.g., SSE streaming) need a raw `fetch()`.
 *
 * This helper standardizes headers (apikey + bearer), request id, timeouts,
 * and a safe single refresh+retry on 401/403.
 */
export async function fetchSupabaseEdgeFunction(
  name: string,
  opts?: EdgeFetchOptions,
): Promise<Response> {
  const method = opts?.method ?? "POST";
  const requestId = createRequestId();

  const url = `${getSupabaseUrl()}/functions/v1/${name}`;
  const anonKey = getSupabaseAnonKey();

  const timeoutMs =
    opts?.timeoutMs ?? getPublicSettingNumber("ops.frontend.function_timeout_ms", 20_000);

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(new DOMException("Timeout", "TimeoutError")),
    timeoutMs,
  );

  const forwardAbort = () =>
    controller.abort(opts?.signal?.reason ?? new DOMException("Aborted", "AbortError"));
  opts?.signal?.addEventListener("abort", forwardAbort);

  // Best-effort: explicitly attach an auth token when available.
  let accessToken: string | null = await getValidAccessToken({ requireAuth: opts?.requireAuth });

  if (opts?.requireAuth && !accessToken) {
    // Mirror the behavior of callSupabaseFunction.
    throw new Error("AUTH_REQUIRED");
  }

  const baseHeaders: Record<string, string> = {
    apikey: anonKey,
    "x-request-id": requestId,
    ...(opts?.accept ? { Accept: opts.accept } : {}),
    ...(opts?.headers ?? {}),
  };

  const makeInit = (): RequestInit => {
    const headers: Record<string, string> = {
      ...baseHeaders,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    };

    let body: any = undefined;
    if (method !== "GET" && opts?.body !== undefined) {
      if (
        typeof opts.body === "string" ||
        opts.body instanceof Blob ||
        opts.body instanceof FormData ||
        opts.body instanceof ArrayBuffer
      ) {
        body = opts.body;
      } else {
        headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
        body = JSON.stringify(opts.body);
      }
    }

    return {
      method,
      headers,
      body,
      signal: controller.signal,
    };
  };

  try {
    let res = await doFetch(url, makeInit());

    // Single refresh+retry on auth errors.
    const retryAuthOnce = opts?.retryAuthOnce ?? true;
    if (retryAuthOnce && (res.status === 401 || res.status === 403) && accessToken) {
      const next = await forceRefreshAccessToken().catch(() => null);
      if (next && next !== accessToken) {
        accessToken = next;
        res = await doFetch(url, makeInit());
      }
    }

    return res;
  } finally {
    clearTimeout(timeoutId);
    opts?.signal?.removeEventListener("abort", forwardAbort);
  }
}
