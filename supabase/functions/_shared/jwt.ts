// supabase/functions/_shared/jwt.ts
//
// Lightweight JWT helpers for Edge Functions.
//
// IMPORTANT:
// - These helpers DO NOT verify signatures.
// - MoviNesta sets `verify_jwt = false` for Edge Functions to be compatible with
//   Supabase JWT Signing Keys. Do NOT use these helpers for authorization checks.
// - Prefer `getUserIdFromRequest()` from _shared/admin.ts (which verifies the token
//   using `supabase.auth.getClaims()` when available).

function base64UrlToJson(base64url: string): any | null {
  try {
    const b64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), "=");
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function getJwtFromRequest(req: Request): string | null {
  const auth = req.headers.get("Authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() ?? null;
}

export function getUserIdFromRequest(req: Request): string {
  const jwt = getJwtFromRequest(req);
  if (!jwt) throw new Error("Missing Authorization bearer token");

  const parts = jwt.split(".");
  if (parts.length < 2) throw new Error("Invalid JWT");

  const payload = base64UrlToJson(parts[1]);
  const sub = payload?.sub;
  if (typeof sub !== "string" || !sub) throw new Error("Missing JWT subject");

  return sub;
}
