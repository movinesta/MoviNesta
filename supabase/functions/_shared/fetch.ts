// supabase/functions/_shared/fetch.ts
//
// Fetch helper with timeout and JSON parsing.
//
// IMPORTANT:
// - On upstream non-2xx responses, we throw an Error with `.status`, `.data`, `.url`.
// - On timeouts/connection errors, we preserve `.url` and `.timeoutMs` for better diagnostics.

export async function fetchJsonWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<unknown> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort("timeout"), timeoutMs);
  try {
    let res: Response;
    try {
      res = await fetch(url, { ...init, signal: controller.signal });
    } catch (e: any) {
      // Preserve useful context for callers that want to distinguish timeouts vs. network.
      const err: any = e instanceof Error ? e : new Error(String(e ?? "fetch_failed"));
      err.url = url;
      err.timeoutMs = timeoutMs;
      // Deno/Fetch uses AbortError for timeouts.
      if (controller.signal.aborted) {
        err.aborted = true;
        err.abortReason = controller.signal.reason ?? null;
      }
      throw err;
    }

    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (!res.ok) {
      const err: any = new Error(`upstream_error_${res.status}`);
      err.status = res.status;
      err.data = data;
      err.url = url;
      err.timeoutMs = timeoutMs;
      err.statusText = res.statusText;
      // Useful for retry/backoff decisions (best-effort; may be null).
      err.retryAfter = res.headers.get("retry-after") ?? null;
      err.upstreamRequestId =
        res.headers.get("x-request-id") ??
        res.headers.get("request-id") ??
        res.headers.get("openai-request-id") ??
        res.headers.get("cf-ray") ??
        null;
      throw err;
    }

    return data;
  } finally {
    clearTimeout(id);
  }
}

export async function fetchStreamWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort("timeout"), timeoutMs);
  try {
    let res: Response;
    try {
      res = await fetch(url, { ...init, signal: controller.signal });
    } catch (e: any) {
      const err: any = e instanceof Error ? e : new Error(String(e ?? "fetch_failed"));
      err.url = url;
      err.timeoutMs = timeoutMs;
      if (controller.signal.aborted) {
        err.aborted = true;
        err.abortReason = controller.signal.reason ?? null;
      }
      throw err;
    }

    if (!res.ok) {
      const text = await res.text();
      let data: unknown = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text;
      }
      const err: any = new Error(`upstream_error_${res.status}`);
      err.status = res.status;
      err.data = data;
      err.url = url;
      err.timeoutMs = timeoutMs;
      err.statusText = res.statusText;
      err.retryAfter = res.headers.get("retry-after") ?? null;
      err.upstreamRequestId =
        res.headers.get("x-request-id") ??
        res.headers.get("request-id") ??
        res.headers.get("openai-request-id") ??
        res.headers.get("cf-ray") ??
        null;
      throw err;
    }

    return res;
  } finally {
    clearTimeout(id);
  }
}
