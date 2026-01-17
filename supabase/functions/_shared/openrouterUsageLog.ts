import { fetchOpenRouterGenerationStats, normalizeSafeOpenRouterBaseUrl } from "./openrouterGeneration.ts";

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

type GenerationStats = Record<string, unknown> | null;

export async function safeInsertOpenRouterUsageLog(
  supabase: any,
  row: OpenRouterUsageLogRow,
): Promise<void> {
  try {
    const metaIn = row.meta ?? {};
    const fetchStats = Boolean((metaIn as any).fetch_generation_stats);
    const genTimeout = Number((metaIn as any).generation_stats_timeout_ms ?? NaN);
    const baseUrl = normalizeSafeOpenRouterBaseUrl(row.base_url);
    const generationId = typeof row.upstream_request_id === "string" ? row.upstream_request_id.trim() : "";

    let generationStats: GenerationStats = null;
    if (fetchStats && generationId) {
      const { getConfig } = await import("./config.ts");
      const cfg: any = getConfig?.() ?? {};
      const apiKey = String(cfg.openrouterApiKey ?? "").trim();
      generationStats = await fetchOpenRouterGenerationStats({
        baseUrl,
        apiKey,
        generationId,
        timeoutMs: Number.isFinite(genTimeout) ? genTimeout : undefined,
        maxRetries: 2,
      });
    }

    const payload = {
      fn: row.fn,
      request_id: row.request_id ?? null,
      user_id: row.user_id ?? null,
      conversation_id: row.conversation_id ?? null,
      provider: row.provider ?? null,
      model: row.model ?? null,
      base_url: baseUrl ?? null,
      usage: row.usage ?? null,
      upstream_request_id: row.upstream_request_id ?? null,
      variant: row.variant ?? null,
      meta: {
        ...metaIn,
        // Always store the generation id for later audit.
        generation_id: generationId || null,
        // Optional: enrich logs with /generation stats (cost, native tokens, provider, latency, search count, etc.).
        ...(generationStats ? { generation_stats: generationStats } : {}),
      },
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
