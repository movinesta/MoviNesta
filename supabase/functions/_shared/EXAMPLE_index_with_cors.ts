import { handleCorsPreflight, jsonWithCors } from "../_shared/cors.ts";

/**
 * Example wrapper showing the intended CORS + OPTIONS pattern.
 * NOTE: This file is NOT auto-wired into any function by itself.
 * Copy the pattern into each admin function's index.ts without changing your auth/logic.
 */
Deno.serve(async (req) => {
  const pre = handleCorsPreflight(req);
  if (pre) return pre;

  try {
    // TODO: paste your existing handler logic here.
    return jsonWithCors(req, { ok: true });
  } catch (e) {
    return jsonWithCors(req, { ok: false, error: String((e as any)?.message ?? e) }, 500);
  }
});
