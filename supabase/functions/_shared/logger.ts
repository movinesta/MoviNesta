// supabase/functions/_shared/logger.ts
//
// Lightweight structured logger for edge functions.

export type LogContext = {
  fn: string;
  userId?: string | null;
};

export function log(ctx: LogContext, message: string, extra?: unknown) {
  try {
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        fn: ctx.fn,
        userId: ctx.userId ?? null,
        message,
        extra,
      }),
    );
  } catch (err) {
    console.log("[logger] failed to log", message, err);
  }
}
