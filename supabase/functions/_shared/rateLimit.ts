// supabase/functions/_shared/rateLimit.ts
//
// DB-backed rate limiting via `public.check_rate_limit(bucket, max, window_seconds)`.
// Falls back to allow (best-effort) if the RPC is unavailable.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function enforceRateLimit(
  supabase: SupabaseClient,
  bucket: string,
  maxRequests: number,
  windowSeconds: number,
): Promise<{ ok: true } | { ok: false; retryAfterSeconds: number }> {
  try {
    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_bucket: bucket,
      p_max_requests: maxRequests,
      p_window_seconds: windowSeconds,
    });

    if (error) {
      // best-effort: do not hard fail on RPC errors; treat as allowed.
      return { ok: true };
    }

    const allowed = Boolean(data);
    if (!allowed) return { ok: false, retryAfterSeconds: windowSeconds };
    return { ok: true };
  } catch {
    return { ok: true };
  }
}
