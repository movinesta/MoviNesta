// supabase/functions/_shared/assistantTelemetry.ts
//
// Best-effort telemetry for assistant failures.
//
// This table is intended for service_role only. Logging must never break request handling.

export type AssistantFailureRow = {
  fn: string;
  request_id?: string | null;
  user_id?: string | null;
  conversation_id?: string | null;
  code?: string | null;
  message?: string | null;
  details?: Record<string, unknown>;
};

export async function safeInsertAssistantFailure(
  supabase: any,
  row: AssistantFailureRow,
): Promise<void> {
  try {
    const fn = row.fn ?? "unknown";
    const code = row.code ?? "UNKNOWN_ERROR";
    const conversationId = row.conversation_id ?? "none";

    const payload = {
      kind: "assistant_failure",
      severity: "warn",
      title: `Assistant Failure: ${code}`,
      detail: row.message ?? "No message provided",
      source: `assistant_telemetry:${fn}`,
      // Use a coarse dedupe key to avoid flooding the table with identical errors in the same thread
      dedupe_key: `fail_${fn}_${code}_${conversationId}_${new Date().toISOString().slice(0, 13)}`, // Hourly bucket
      meta: {
        fn: fn,
        request_id: row.request_id ?? null,
        user_id: row.user_id ?? null,
        conversation_id: row.conversation_id ?? null,
        code: code,
        details: row.details ?? {},
      },
    };

    const { error } = await supabase.from("ops_alerts").insert(payload);
    if (error) {
      console.warn("ASSISTANT_FAILURE_TO_OPS_ALERTS_FAILED", error.message);
    }
  } catch (e) {
    console.warn(
      "ASSISTANT_FAILURE_TO_OPS_ALERTS_FAILED",
      (e as any)?.message ?? String(e),
    );
  }
}

