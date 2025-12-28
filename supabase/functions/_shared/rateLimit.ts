import { getAdminClient } from "./supabase.ts";

type RateLimitOk = {
  ok: true;
  remaining?: number;
  resetAt?: string | null;
  retryAfterSeconds?: number;
};

type RateLimitBlocked = {
  ok: false;
  status: number;
  message: string;
  retryAfterSeconds?: number;
};

type RateLimitResult = RateLimitOk | RateLimitBlocked;

const FALLBACK_WINDOW_MS = 60_000;
const fallbackCounters = new Map<string, { resetAt: number; count: number }>();

function extractJwtSubject(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) return null;
  const token = match[1];
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    const sub = typeof payload?.sub === "string" ? payload.sub.trim() : "";
    return sub || null;
  } catch {
    return null;
  }
}

function extractIp(req: Request): string | null {
  const xfwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (xfwd) return xfwd;
  const cf = req.headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;
  return null;
}

function fallbackRateLimit(key: string, maxPerMinute: number): RateLimitResult {
  const now = Date.now();
  const entry = fallbackCounters.get(key);
  if (!entry || now >= entry.resetAt) {
    fallbackCounters.set(key, { resetAt: now + FALLBACK_WINDOW_MS, count: 1 });
    return { ok: true, remaining: Math.max(maxPerMinute - 1, 0), resetAt: new Date(now + FALLBACK_WINDOW_MS).toISOString() };
  }
  entry.count += 1;
  if (entry.count > maxPerMinute) {
    const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    return {
      ok: false,
      status: 429,
      message: "Rate limit exceeded",
      retryAfterSeconds,
    };
  }
  return {
    ok: true,
    remaining: Math.max(maxPerMinute - entry.count, 0),
    resetAt: new Date(entry.resetAt).toISOString(),
  };
}

export async function enforceRateLimit(
  req: Request,
  opts:
    | {
      action: string;
      maxPerMinute: number;
    }
    | string,
  maxPerMinute?: number,
): Promise<RateLimitResult> {
  const action = typeof opts === "string" ? opts : opts.action;
  const max = typeof opts === "string" ? Number(maxPerMinute ?? 60) : Number(opts.maxPerMinute ?? 60);

  if (!action || !Number.isFinite(max) || max <= 0) {
    return { ok: true };
  }

  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
  const sub = extractJwtSubject(authHeader);
  const ip = extractIp(req);
  const key = sub ? `user:${sub}` : ip ? `ip:${ip}` : "unknown";
  const rlKey = `${key}:${action}`;

  try {
    const admin = getAdminClient(req);
    const { data, error } = await admin.rpc("check_rate_limit", {
      p_key: key,
      p_action: action,
      p_max_per_minute: max,
    });

    if (error) {
      console.warn("RATE_LIMIT_RPC_FAILED", { action, message: error.message });
      return fallbackRateLimit(rlKey, max);
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row.ok !== "boolean") {
      console.warn("RATE_LIMIT_RPC_INVALID", { action });
      return fallbackRateLimit(rlKey, max);
    }

    if (!row.ok) {
      return {
        ok: false,
        status: 429,
        message: "Rate limit exceeded",
        retryAfterSeconds: row.retry_after_seconds ?? row.retryAfterSeconds ?? undefined,
      };
    }

    return {
      ok: true,
      remaining: row.remaining ?? undefined,
      resetAt: row.reset_at ?? row.resetAt ?? null,
      retryAfterSeconds: row.retry_after_seconds ?? row.retryAfterSeconds ?? undefined,
    };
  } catch (err) {
    console.warn("RATE_LIMIT_RPC_ERROR", { action, error: String((err as any)?.message ?? err) });
    return fallbackRateLimit(rlKey, max);
  }
}
