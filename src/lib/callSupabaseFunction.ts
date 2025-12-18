import { supabase } from "./supabase";

interface CallSupabaseFunctionOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
}

export async function callSupabaseFunction<T>(
  name: string,
  body: any,
  opts?: CallSupabaseFunctionOptions,
): Promise<T> {
  if (opts?.signal?.aborted) {
    throw opts.signal.reason ?? new DOMException("Aborted", "AbortError");
  }

  const controller = new AbortController();
  const timeoutMs = opts?.timeoutMs ?? 25000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const forwardAbort = () => controller.abort();
  opts?.signal?.addEventListener("abort", forwardAbort);

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    const { data, error } = await supabase.functions.invoke<T>(name, {
      body,
      signal: controller.signal,
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    });

    if (error) {
      const err = new Error(error.message ?? `Error invoking ${name}`);
      (err as Error & { status?: number }).status = error.status;
      throw err;
    }

    if (data === null || data === undefined) {
      throw new Error(`Missing data from ${name}`);
    }

    return data;
  } finally {
    clearTimeout(timeoutId);
    opts?.signal?.removeEventListener("abort", forwardAbort);
  }
}
