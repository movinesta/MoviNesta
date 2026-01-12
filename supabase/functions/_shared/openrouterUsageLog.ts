export type OpenRouterUsageLogRow = {
  fn: string;
  request_id?: string | null;
  user_id?: string | null;
  conversation_id?: string | null;
  provider?: string | null;
  model?: string | null;
  base_url?: string | null;
  usage?: unknown | null;
  upstream_request_id?: string | null;
  variant?: string | null;
  meta?: Record<string, unknown> | null;
  created_at?: string;
};

export async function safeInsertOpenRouterUsageLog(
  supabase: any,
  row: OpenRouterUsageLogRow,
): Promise<void> {
  try {
    const payload = {
      fn: row.fn,
      request_id: row.request_id ?? null,
      user_id: row.user_id ?? null,
      conversation_id: row.conversation_id ?? null,
      provider: row.provider ?? null,
      model: row.model ?? null,
      base_url: row.base_url ?? null,
      usage: row.usage ?? null,
      upstream_request_id: row.upstream_request_id ?? null,
      variant: row.variant ?? null,
      meta: row.meta ?? {},
      created_at: row.created_at ?? new Date().toISOString(),
    };

    const { error } = await supabase.from("openrouter_request_log").insert(payload);
    if (error) {
      console.warn("OPENROUTER_USAGE_LOG_INSERT_FAILED", error.message);
    }
  } catch (e) {
    console.warn("OPENROUTER_USAGE_LOG_INSERT_FAILED", (e as any)?.message ?? String(e));
  }
}
