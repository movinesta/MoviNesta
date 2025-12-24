import { getServiceClient } from "./supabase.ts";

// NOTE:
// The schema (schema_full_20251224_004751.sql) is the source of truth.
// There is no `public.check_rate_limit` RPC in the current schema, so we
// intentionally treat rate limiting as a no-op here.
//
// If you later add a real rate-limit RPC/function, this file is the one
// place to wire it back in.

export async function enforceRateLimit(
  _req: Request,
  _opts: {
    action: string;
    maxPerMinute: number;
  },
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  // No-op (allow).
  return { ok: true };
}

// Kept to avoid breaking imports in older edge functions.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function _unused(_req: Request) {
  // Initialize the client to ensure this file stays tree-shake safe.
  getServiceClient(_req);
}
