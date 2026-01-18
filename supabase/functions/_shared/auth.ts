// supabase/functions/_shared/auth.ts
//
// Centralized auth helpers for Edge Functions.
//
// References (Supabase docs):
// - API keys: https://supabase.com/docs/guides/api/api-keys
// - getClaims(): https://supabase.com/docs/reference/javascript/auth-getclaims
// - getUser(): https://supabase.com/docs/reference/javascript/auth-getuser

import type { SupabaseClient } from "supabase";
import { getConfig } from "./config.ts";
import { jsonError } from "./http.ts";

export function getBearerToken(req: Request): string {
  const raw = (req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "").trim();
  const m = raw.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() ?? "";
}

export type ApiKeyRequirement = "public" | "secret" | "either";

/**
 * Optional safety check.
 *
 * Supabase Edge Functions don't always validate `apikey` in certain key setups,
 * so this helper provides a clear error when callers are misconfigured.
 */
export function requireApiKeyHeader(
  req: Request,
  options?: { require?: ApiKeyRequirement; allowBearer?: boolean },
): Response | null {
  const cfg = getConfig();
  if (options?.allowBearer && getBearerToken(req)) {
    return null;
  }
  const provided = (
    req.headers.get("apikey") ??
    req.headers.get("x-api-key") ??
    req.headers.get("X-Api-Key") ??
    ""
  ).trim();

  if (!provided) {
    if (options?.allowBearer && getBearerToken(req)) {
      return null;
    }
    return jsonError(req, "Missing apikey header", 401, "MISSING_APIKEY");
  }

  const requirement: ApiKeyRequirement = options?.require ?? "either";
  const allowed: string[] = [];

  if (requirement === "public" || requirement === "either") allowed.push(cfg.supabaseAnonKey);
  if (requirement === "secret" || requirement === "either") allowed.push(cfg.supabaseServiceRoleKey);

  const usable = allowed.filter(Boolean);
  if (!usable.length) {
    return jsonError(req, "Server misconfigured: missing Supabase keys", 500, "CONFIG_MISSING_KEYS");
  }

  if (!usable.includes(provided)) {
    return jsonError(req, "Invalid apikey header", 401, "INVALID_APIKEY");
  }

  return null;
}

export type AuthMode = "auto" | "claims" | "user";

export type AuthContext = {
  userId: string;
  email: string | null;
  jwt: string;
  claims: Record<string, unknown>;
};

export async function requireUserFromRequest(
  req: Request,
  userClient: SupabaseClient,
  options?: { mode?: AuthMode },
): Promise<{ data: AuthContext | null; errorResponse: Response | null }> {
  const jwt = getBearerToken(req);
  if (!jwt) {
    return {
      data: null,
      errorResponse: jsonError(req, "Missing Authorization bearer token", 401, "MISSING_JWT"),
    };
  }

  const mode: AuthMode = options?.mode ?? "auto";
  const authAny = (userClient as any)?.auth;

  // Preferred (fast) path: verify and extract claims via JWKS.
  if (mode !== "user" && typeof authAny?.getClaims === "function") {
    try {
      const { data, error } = await authAny.getClaims(jwt);
      const claims = (data?.claims ?? {}) as Record<string, unknown>;
      const sub = (claims as any)?.sub;

      if (!error && typeof sub === "string" && sub) {
        const email = typeof (claims as any).email === "string" ? ((claims as any).email as string) : null;
        return { data: { userId: sub, email, jwt, claims }, errorResponse: null };
      }

      if (mode === "claims") {
        return { data: null, errorResponse: jsonError(req, "Invalid JWT", 401, "INVALID_JWT") };
      }
      // fallthrough to getUser
    } catch {
      if (mode === "claims") {
        return { data: null, errorResponse: jsonError(req, "Invalid JWT", 401, "INVALID_JWT") };
      }
      // fallthrough to getUser
    }
  }

  // Strict path: validate the token with the Auth server.
  //
  // Note: supabase-js supports getUser(jwt) (preferred), but we keep a no-arg fallback
  // for compatibility with older runtimes.
  try {
    let data: any = null;
    let error: any = null;

    try {
      const res = await authAny.getUser(jwt);
      data = res?.data;
      error = res?.error;
    } catch {
      const res = await userClient.auth.getUser();
      data = res?.data;
      error = res?.error;
    }

    const userId = data?.user?.id;
    if (error || typeof userId !== "string" || !userId) {
      return { data: null, errorResponse: jsonError(req, "Invalid session", 401, "INVALID_SESSION") };
    }

    return {
      data: { userId, email: data?.user?.email ?? null, jwt, claims: {} },
      errorResponse: null,
    };
  } catch {
    return { data: null, errorResponse: jsonError(req, "Invalid session", 401, "INVALID_SESSION") };
  }
}
