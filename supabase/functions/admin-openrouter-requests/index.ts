import { serve } from "jsr:@std/http@0.224.0/server";
import { requireAdmin, json, handleCors, jsonError } from "../_shared/admin.ts";
import { getConfig } from "../_shared/config.ts";
import { fetchOpenRouterGenerationStats } from "../_shared/openrouterGeneration.ts";

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(n, b));
}

function asString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function isValidIsoDate(s: string): boolean {
  const t = Date.parse(s);
  return Number.isFinite(t);
}

/**
 * Admin-only endpoint to list OpenRouter request logs (routing decisions).
 *
 * Contract:
 *   POST body: {
 *     limit?: number,
 *     before?: string|null,
 *     request_id?: string|null,
 *     fn?: string|null,
 *     enrich_generation_stats?: boolean,
 *     enrich_limit?: number,
 *     enrich_timeout_ms?: number,
 *   }
 *   response:  { ok: true, rows: OpenRouterRequestLogRow[], next_before: string|null }
 */
serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { svc } = await requireAdmin(req);

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const limit = clamp(Number(body.limit ?? 100), 10, 200);

    const beforeRaw = asString(body.before);
    const before = beforeRaw && isValidIsoDate(beforeRaw) ? beforeRaw : null;
    const requestId = asString(body.request_id);
    const fn = asString(body.fn);

    const pageSize = clamp(limit + 1, 10, 201);

    const enrich = Boolean((body as any).enrich_generation_stats ?? (body as any).include_generation_stats);
    const enrichLimit = clamp(Number((body as any).enrich_limit ?? 10), 0, 25);
    const enrichTimeoutMs = clamp(Number((body as any).enrich_timeout_ms ?? 1200), 250, 15000);

    let q = svc
      .from("openrouter_request_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(pageSize);

    if (before) q = q.lt("created_at", before);
    if (requestId) q = q.eq("request_id", requestId);
    if (fn) q = q.eq("fn", fn);

    const { data, error } = await q;

    if (error) return json(req, 500, { ok: false, message: error.message });

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    let next_before: string | null = null;
    if (rows.length > limit) {
      const extra = rows.pop() as any;
      next_before = String(extra?.created_at ?? "") || null;
    }

    if (enrich && enrichLimit > 0) {
      const cfg = getConfig();
      const apiKey = String(cfg.openrouterApiKey ?? "").trim();
      if (apiKey) {
        const needs = rows
          .filter((r) => {
            const meta = (r as any)?.meta ?? {};
            const hasStats = !!(meta?.generation_stats && typeof meta.generation_stats === "object");
            const genId = String(meta?.generation_id ?? (r as any)?.upstream_request_id ?? "").trim();
            return !hasStats && !!genId;
          })
          .slice(0, enrichLimit);

        // Small best-effort enrichment; never fail the main list.
        const concurrency = 3;
        let i = 0;
        const workers = new Array(Math.max(1, concurrency)).fill(0).map(async () => {
          while (true) {
            const idx = i++;
            if (idx >= needs.length) break;
            const r: any = needs[idx];
            try {
              const meta = r?.meta ?? {};
              const generationId = String(meta?.generation_id ?? r?.upstream_request_id ?? "").trim();
              if (!generationId) continue;
              const stats = await fetchOpenRouterGenerationStats({
                baseUrl: r?.base_url,
                apiKey,
                generationId,
                timeoutMs: enrichTimeoutMs,
                maxRetries: 2,
              });
              if (!stats) continue;

              const metaNext = { ...meta, generation_id: generationId, generation_stats: stats };
              r.meta = metaNext;

              // Persist for future reads (best-effort).
              await svc.from("openrouter_request_log").update({ meta: metaNext }).eq("id", r.id);
            } catch {
              // ignore
            }
          }
        });

        await Promise.all(workers);
      }
    }

    return json(req, 200, { ok: true, rows, next_before });
  } catch (e) {
    return jsonError(req, e);
  }
});
