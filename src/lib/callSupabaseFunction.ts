import { supabase } from "./supabase";
import { getPublicSettingNumber } from "./settings/publicSettingsStore";
import { forceRefreshAccessToken, getValidAccessToken } from "./authTokenStore";

export type ApiErrorShape = {
  ok: false;
  code?: string;
  message?: string;
  details?: unknown;
  requestId?: string;
  retryAfterSeconds?: number;
};

export class ApiError extends Error {
  status?: number;
  code?: string;
  details?: unknown;
  requestId?: string;
  retryAfterSeconds?: number;

  constructor(
    message: string,
    opts?: {
      status?: number;
      code?: string;
      details?: unknown;
      requestId?: string;
      retryAfterSeconds?: number;
    },
  ) {
    super(message);
    this.name = "ApiError";
    this.status = opts?.status;
    this.code = opts?.code;
    this.details = opts?.details;
    this.requestId = opts?.requestId;
    this.retryAfterSeconds = opts?.retryAfterSeconds;
  }
}

function createRequestId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `req_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
  }
}

function getSupabaseAnonKey(): string {
  const k =
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ??
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_OR_ANON_KEY as string | undefined);
  if (!k) {
    throw new ApiError("Supabase anonymous key is required.", {
      code: "MISSING_SUPABASE_ANON_KEY",
    });
  }
  return k;
}

interface CallSupabaseFunctionOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Opt-in retries (recommended only for read-only/idempotent edge functions). */
  retries?: number;
  /** Base delay for retry backoff. Defaults to 250ms. */
  retryDelayMs?: number;
  /** If true, fail fast when there is no authenticated session. */
  requireAuth?: boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function clampRetryAfterSeconds(v: unknown): number | undefined {
  if (v === undefined || v === null) return undefined;
  const n = typeof v === "number" ? v : Number.parseInt(String(v), 10);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.min(3600, Math.max(1, Math.floor(n)));
}

function isRetryableFunctionError(e: unknown): boolean {
  // Only used when callers opt-in to retries.
  const err = e as any;
  if (!err) return false;
  const status = Number(err.status ?? 0);
  // Supabase Edge Functions can surface 546 when the platform enforces resource limits.
  // We treat it as retryable with short backoff.
  if (status === 546) return true;
  if (status === 408 || status === 425 || status === 429) return true;
  if (status >= 500 && status <= 599) return true;
  // Transport timeouts.
  const name = String(err.name ?? "").toLowerCase();
  return name.includes("timeout") || name.includes("abort");
}

/**
 * Invoke a Supabase Edge Function with a standardized response/error envelope.
 *
 * Expected success: any JSON value (optionally { ok: true, ... }).
 * Expected error:   { ok: false, code, message, details?, requestId? }.
 *
 * This wrapper preserves HTTP status codes and structured error fields.
 */
export async function callSupabaseFunction<T>(
  name: string,
  body: any,
  opts?: CallSupabaseFunctionOptions,
): Promise<T> {
  if (opts?.signal?.aborted) {
    throw opts.signal.reason ?? new DOMException("Aborted", "AbortError");
  }

  const controller = new AbortController();
  const timeoutMs =
    opts?.timeoutMs ?? getPublicSettingNumber("ops.frontend.function_timeout_ms", 20_000);
  const timeoutId = setTimeout(
    () => controller.abort(new DOMException("Timeout", "TimeoutError")),
    timeoutMs,
  );

  const forwardAbort = () =>
    controller.abort(opts?.signal?.reason ?? new DOMException("Aborted", "AbortError"));
  opts?.signal?.addEventListener("abort", forwardAbort);

  const requestId = createRequestId();
  const maxRetries = Math.max(0, Math.min(5, Number(opts?.retries ?? 0)));
  const baseDelayMs = Math.max(0, Math.min(10_000, Number(opts?.retryDelayMs ?? 250)));
  const anonKey = getSupabaseAnonKey();

  // Best-effort: explicitly attach an auth token when available.
  // Prefer an in-memory token cache fed by auth events (reduces getSession() churn).
  let accessToken: string | null = await getValidAccessToken({ requireAuth: opts?.requireAuth });
  let refreshedAfterAuthError = false;

  if (opts?.requireAuth && !accessToken) {
    throw new ApiError("Please sign in to continue.", {
      status: 401,
      code: "AUTH_REQUIRED",
      requestId,
    });
  }

  try {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const res = (await supabase.functions.invoke(name, {
          body,
          headers: {
            "x-request-id": requestId,
            apikey: anonKey,
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          signal: controller.signal,
        })) as any;

        const data = res?.data;
        const error = res?.error;
        const echoedRequestId: string | undefined =
          (res?.response?.headers?.get?.("x-request-id") as string | undefined) ??
          (typeof data === "object" && data && typeof (data as any).requestId === "string"
            ? String((data as any).requestId)
            : undefined);
        const retryAfterSecondsHeader = clampRetryAfterSeconds(
          res?.response?.headers?.get?.("retry-after") as string | undefined,
        );

        // Transport-level error from supabase-js invoke
        if (error) {
          throw new ApiError(error.message, {
            status: error.status,
            requestId: echoedRequestId ?? requestId,
            retryAfterSeconds: retryAfterSecondsHeader,
          });
        }

        if (data === null || data === undefined) {
          throw new ApiError(`Missing data from ${name}`, {
            requestId: echoedRequestId ?? requestId,
          });
        }

        // App-level error envelope
        if (typeof data === "object" && data && (data as any).ok === false) {
          const e = data as ApiErrorShape;
          throw new ApiError(e.message ?? `Request failed: ${name}`, {
            status: (data as any).status ?? undefined,
            code: e.code,
            details: e.details,
            requestId: e.requestId ?? echoedRequestId ?? requestId,
            retryAfterSeconds: clampRetryAfterSeconds(
              (e as any).retryAfterSeconds ??
                (e.details as any)?.retryAfterSeconds ??
                retryAfterSecondsHeader,
            ),
          });
        }

        return data as T;
      } catch (err) {
        // If we got an auth error, try a single forced token refresh then retry once.
        const status = Number((err as any)?.status ?? 0);
        if (!refreshedAfterAuthError && accessToken && (status === 401 || status === 403)) {
          refreshedAfterAuthError = true;
          const next = await forceRefreshAccessToken().catch(() => null);
          if (next && next !== accessToken) {
            accessToken = next;
            continue;
          }
        }
        const isLast = attempt >= maxRetries;
        if (isLast || !opts?.retries || !isRetryableFunctionError(err)) throw err;
        // Respect Retry-After if provided.
        const ra = clampRetryAfterSeconds((err as any)?.retryAfterSeconds);
        const delayMs = ra ? ra * 1000 : Math.round(baseDelayMs * Math.pow(2, attempt));
        await sleep(delayMs);
      }
    }
    // Unreachable (loop returns or throws)
    throw new ApiError(`Request failed: ${name}`, { requestId });
  } finally {
    clearTimeout(timeoutId);
    opts?.signal?.removeEventListener("abort", forwardAbort);
  }
}
