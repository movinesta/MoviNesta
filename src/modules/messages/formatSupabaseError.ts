import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Create a user-friendly, debuggable Supabase error string.
 * Includes code/details/hint when available (useful for RLS/policy debugging).
 */
export const formatSupabaseError = (error: unknown): string => {
  if (!error) return "Unknown error.";

  if (typeof error === "string") return error;

  const maybe = error as Partial<PostgrestError> & { message?: string; code?: string | number };

  const message =
    maybe.message ??
    (error instanceof Error
      ? error.message
      : typeof error === "object"
        ? JSON.stringify(error)
        : String(error));

  const code = maybe.code ? ` (${maybe.code})` : "";
  const details = (maybe as any).details ? ` — ${(maybe as any).details}` : "";
  const hint = (maybe as any).hint ? ` Hint: ${(maybe as any).hint}` : "";

  return `${message}${code}${details}${hint}`.trim();
};
