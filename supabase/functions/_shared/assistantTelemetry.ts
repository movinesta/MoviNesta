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
    const payload = {
      fn: row.fn,
      request_id: row.request_id ?? null,
      user_id: row.user_id ?? null,
      conversation_id: row.conversation_id ?? null,
      code: row.code ?? null,
      message: row.message ?? null,
      details: row.details ?? {},
    };

    const { error } = await supabase.from("assistant_failures").insert(payload);
    if (error) {
      console.warn("ASSISTANT_FAILURE_INSERT_FAILED", error.message);
    }
  } catch (e) {
    console.warn(
      "ASSISTANT_FAILURE_INSERT_FAILED",
      (e as any)?.message ?? String(e),
    );
  }
}
