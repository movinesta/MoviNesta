import { supabase } from "./supabase";

/**
 * In-memory access token cache.
 *
 * Supabase recommends extracting the access token (JWT) from auth events
 * and storing it in memory (instead of repeatedly calling getSession()).
 */
type TokenState = {
  accessToken: string | null;
  expiresAtSec: number | null;
  initialized: boolean;
};

let state: TokenState = {
  accessToken: null,
  expiresAtSec: null,
  initialized: false,
};

let subscribed = false;

function updateFromSession(session: any) {
  const token = (session?.access_token ?? null) as string | null;
  const exp = (session?.expires_at ?? null) as number | null;
  state = {
    accessToken: token,
    expiresAtSec: typeof exp === "number" ? exp : null,
    initialized: true,
  };
}

export async function initAuthTokenStore(): Promise<void> {
  if (!state.initialized) {
    try {
      // getSession() may refresh if the token is expired or about to expire.
      const { data } = await supabase.auth.getSession();
      updateFromSession(data?.session);
    } catch {
      state = { ...state, initialized: true };
    }
  }

  if (!subscribed) {
    subscribed = true;
    const onAuthStateChange = supabase.auth?.onAuthStateChange;
    if (typeof onAuthStateChange === "function") {
      onAuthStateChange((_event, session) => {
        updateFromSession(session);
      });
    }
  }
}

export function getCachedAccessToken(): string | null {
  return state.accessToken;
}

export function getCachedExpiresAtMs(): number | null {
  return state.expiresAtSec ? state.expiresAtSec * 1000 : null;
}

/**
 * Returns a token that is valid enough to make an API request.
 * - If `requireAuth` is true and there is no session, returns null.
 * - If the token is expiring soon, attempts a refresh.
 */
export async function getValidAccessToken(opts?: {
  requireAuth?: boolean;
  refreshIfExpiringWithinMs?: number;
}): Promise<string | null> {
  await initAuthTokenStore();

  if (!state.accessToken) return opts?.requireAuth ? null : null;

  const expMs = getCachedExpiresAtMs();
  const thresholdMs = Math.max(0, Math.min(5 * 60_000, opts?.refreshIfExpiringWithinMs ?? 30_000));

  if (expMs && expMs - Date.now() <= thresholdMs) {
    const refreshed = await supabase.auth.refreshSession().catch(() => null);
    const next = refreshed?.data?.session;
    if (next?.access_token) updateFromSession(next);
  }

  return state.accessToken;
}

/**
 * Force-refresh the session and return the newest access token (if any).
 */
export async function forceRefreshAccessToken(): Promise<string | null> {
  await initAuthTokenStore();
  const refreshed = await supabase.auth.refreshSession().catch(() => null);
  const next = refreshed?.data?.session;
  if (next?.access_token) {
    updateFromSession(next);
    return next.access_token as string;
  }
  return state.accessToken;
}
