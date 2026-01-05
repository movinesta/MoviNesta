// supabase/functions/_shared/logger.ts
//
// Lightweight structured logger for edge functions.
//
// Goals:
// - Always emit JSON (easy to filter in logs)
// - Include correlation context (requestId, jobId, userId, conversationId)
// - Stay safe: truncate huge strings/objects to avoid noisy logs

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

export type LogContext = {
  fn: string;
  requestId?: string | null;
  runnerJobId?: string | null;
  userId?: string | null;
  conversationId?: string | null;
};

function env(name: string): string | undefined {
  try {
    return (globalThis as any).Deno?.env?.get?.(name);
  } catch {
    return undefined;
  }
}

const LEVEL_NUM: Record<LogLevel, number> = {
  DEBUG: 10,
  INFO: 20,
  WARN: 30,
  ERROR: 40,
};

function configuredLevel(): LogLevel {
  const raw = (env("LOG_LEVEL") ?? "INFO").toUpperCase().trim();
  if (raw === "DEBUG" || raw === "INFO" || raw === "WARN" || raw === "ERROR") return raw;
  return "INFO";
}

const MIN_LEVEL = configuredLevel();

function shouldLog(level: LogLevel): boolean {
  return LEVEL_NUM[level] >= LEVEL_NUM[MIN_LEVEL];
}

function truncateDeep(v: any, depth = 0): any {
  const MAX_DEPTH = 4;
  const MAX_STRING = 2400;
  const MAX_ARRAY = 50;
  const MAX_KEYS = 60;

  if (depth > MAX_DEPTH) return "[truncated_depth]";
  if (v == null) return v;
  if (typeof v === "string") return v.length > MAX_STRING ? v.slice(0, MAX_STRING) + "…" : v;
  if (typeof v === "number" || typeof v === "boolean") return v;
  if (typeof v === "bigint") return v.toString();
  if (v instanceof Error) {
    return {
      name: v.name,
      message: truncateDeep(v.message, depth + 1),
      stack: truncateDeep(v.stack ?? "", depth + 1),
    };
  }
  if (Array.isArray(v)) return v.slice(0, MAX_ARRAY).map((x) => truncateDeep(x, depth + 1));
  if (typeof v === "object") {
    const o: Record<string, unknown> = {};
    for (const k of Object.keys(v).slice(0, MAX_KEYS)) {
      o[k] = truncateDeep((v as any)[k], depth + 1);
    }
    return o;
  }
  try {
    return String(v);
  } catch {
    return "[unstringifiable]";
  }
}

function emit(level: LogLevel, ctx: LogContext, message: string, extra?: unknown) {
  if (!shouldLog(level)) return;

  const payload: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    fn: ctx.fn,
    requestId: ctx.requestId ?? null,
    runnerJobId: ctx.runnerJobId ?? null,
    userId: ctx.userId ?? null,
    conversationId: ctx.conversationId ?? null,
    message,
  };

  if (extra !== undefined) payload.extra = truncateDeep(extra);

  try {
    console.log(JSON.stringify(payload));
  } catch (err) {
    // Last resort.
    console.log("[logger] failed to log", level, ctx.fn, message, err);
  }
}

// Backwards compatible: log() defaults to INFO.
export function log(ctx: LogContext, message: string, extra?: unknown) {
  emit("INFO", ctx, message, extra);
}

export function logDebug(ctx: LogContext, message: string, extra?: unknown) {
  emit("DEBUG", ctx, message, extra);
}

export function logInfo(ctx: LogContext, message: string, extra?: unknown) {
  emit("INFO", ctx, message, extra);
}

export function logWarn(ctx: LogContext, message: string, extra?: unknown) {
  emit("WARN", ctx, message, extra);
}

export function logError(ctx: LogContext, message: string, extra?: unknown) {
  emit("ERROR", ctx, message, extra);
}
