import { supabase } from "./supabase";

export async function callSupabaseFunction<T>(
  name: string,
  body: unknown,
  opts?: { signal?: AbortSignal; timeoutMs?: number },
): Promise<T> {
  const timeoutMs = opts?.timeoutMs ?? 25_000;

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  const abort = () => controller.abort();
  opts?.signal?.addEventListener("abort", abort);

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    const { data, error } = await supabase.functions.invoke<T>(name, {
      body,
      // 👇 make the JWT explicit (prevents “never triggered” due to missing auth)
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      signal: controller.signal,
    });

    if (error) throw error;
    if (data == null) throw new Error("No data returned from function");
    return data;
  } finally {
    window.clearTimeout(timeoutId);
    opts?.signal?.removeEventListener("abort", abort);
  }
}
