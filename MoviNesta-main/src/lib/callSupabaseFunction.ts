import { supabase } from "./supabase";

export type ApiErrorShape = {
  ok: false;
  code?: string;
  message?: string;
  details?: unknown;
  requestId?: string;
};

export class ApiError extends Error {
  status?: number;
  code?: string;
  details?: unknown;
  requestId?: string;

  constructor(
    message: string,
    opts?: { status?: number; code?: string; details?: unknown; requestId?: string },
  ) {
    super(message);
    this.name = "ApiError";
    this.status = opts?.status;
    this.code = opts?.code;
    this.details = opts?.details;
    this.requestId = opts?.requestId;
  }
}

function createRequestId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `req_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
  }
}

interface CallSupabaseFunctionOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
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
  const timeoutMs = opts?.timeoutMs ?? 20_000;
  const timeoutId = setTimeout(
    () => controller.abort(new DOMException("Timeout", "TimeoutError")),
    timeoutMs,
  );

  const forwardAbort = () =>
    controller.abort(opts?.signal?.reason ?? new DOMException("Aborted", "AbortError"));
  opts?.signal?.addEventListener("abort", forwardAbort);

  try {
    const requestId = createRequestId();

    const res = (await supabase.functions.invoke(name, {
      body,
      headers: {
        "x-request-id": requestId,
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

    // Transport-level error from supabase-js invoke
    if (error) {
      const err = new ApiError(error.message, {
        status: error.status,
        requestId: echoedRequestId ?? requestId,
      });
      throw err;
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
        status: (data as any).status,
        code: e.code,
        details: e.details,
        requestId: e.requestId ?? echoedRequestId ?? requestId,
      });
    }

    return data as T;
  } finally {
    clearTimeout(timeoutId);
    opts?.signal?.removeEventListener("abort", forwardAbort);
  }
}
