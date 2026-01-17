import { serve } from "jsr:@std/http@0.224.0/server";
import { z } from "zod";

import { handleOptions, jsonError, jsonResponse, validateRequest } from "../_shared/http.ts";
import { getConfig } from "../_shared/config.ts";
import { getAdminClient } from "../_shared/supabase.ts";
import { safeInsertJobRunLog } from "../_shared/joblog.ts";
import { fetchOpenRouterGenerationStats } from "../_shared/openrouterGeneration.ts";
import { fetchOpenRouterKeyInfo } from "../_shared/openrouterKeyInfo.ts";
import { readOpenRouterCache, writeOpenRouterCache } from "../_shared/openrouterCache.ts";

const JOB_NAME = "openrouter-generation-backfill";

const BodySchema = z
  .object({
    batch_size: z.number().int().min(1).max(100).optional(),
    // Backwards-compatible: older callers used this to control how many rows we scan.
    max_scan: z.number().int().min(10).max(2000).optional(),
    max_age_hours: z.number().int().min(1).max(720).optional(),
    timeout_ms: z.number().int().min(250).max(15000).optional(),
    concurrency: z.number().int().min(1).max(10).optional(),
    // If set and OpenRouter key has a numeric remaining credit limit below this value,
    // the job will exit early to avoid burning last credits on enrichment.
    min_limit_remaining: z.number().min(0).max(1_000_000).optional(),
    // How fresh (minutes) the cached /key response must be before re-fetching.
    max_key_age_minutes: z.number().int().min(1).max(1440).optional(),
    cursor_created_at: z.string().optional(),
    cursor_id: z.string().uuid().optional(),
    dry_run: z.boolean().optional(),
  })
  .strict();

type Body = z.infer<typeof BodySchema>;

type LogRow = {
  id: string;
  created_at: string;
  base_url: string | null;
  upstream_request_id: string | null;
  meta: Record<string, unknown> | null;
};

type Cursor = { created_at: string; id: string };

function pickGenerationId(row: LogRow): string {
  const meta = row.meta ?? {};
  const mid = typeof (meta as any).generation_id === "string" ? String((meta as any).generation_id).trim() : "";
  if (mid) return mid;
  return typeof row.upstream_request_id === "string" ? row.upstream_request_id.trim() : "";
}

function hasGenerationStats(row: LogRow): boolean {
  const meta = row.meta ?? {};
  const gs = (meta as any).generation_stats;
  return !!(gs && typeof gs === "object");
}

async function pMap<T, R>(items: T[], concurrency: number, fn: (item: T, idx: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = new Array(Math.max(1, concurrency)).fill(0).map(async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) break;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}

serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;

  const cfg = getConfig();
  const internalToken = String(cfg.internalJobToken ?? "").trim();
  const provided = String(req.headers.get("x-job-token") ?? "").trim();
  if (!internalToken || provided !== internalToken) {
    return jsonError("Unauthorized", 401, "INVALID_JOB_TOKEN", req);
  }

  const parsed = await validateRequest<Body>(req, (b) => BodySchema.parse(b), {
    logPrefix: JOB_NAME,
    requireJson: true,
  });
  if (parsed.errorResponse) return parsed.errorResponse;
  const body = parsed.data;

  const dryRun = Boolean(body.dry_run);
  const batchSize = body.batch_size ?? 50;
  const maxScan = body.max_scan ?? 400;
  const maxAgeHours = body.max_age_hours ?? 72;
  const timeoutMs = body.timeout_ms ?? 1500;
  const concurrency = body.concurrency ?? 3;
  const minLimitRemaining = body.min_limit_remaining;
  const maxKeyAgeMinutes = body.max_key_age_minutes ?? 60;

  const cursor: Cursor | null = (() => {
    const ca = String(body.cursor_created_at ?? "").trim();
    const cid = String(body.cursor_id ?? "").trim();
    if (!ca || !cid) return null;
    // best-effort validation
    const t = Date.parse(ca);
    if (!Number.isFinite(t)) return null;
    return { created_at: ca, id: cid };
  })();

  const startedAt = new Date().toISOString();
  const sinceIso = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000).toISOString();

  const svc = getAdminClient();
  const apiKey = String(cfg.openrouterApiKey ?? "").trim();
  if (!apiKey) {
    return jsonError("Missing OpenRouter API key", 500, "OPENROUTER_KEY_MISSING", req);
  }

  // Best-effort credit/limit gate using OpenRouter /key.
  // We cache this in external_api_cache as category "key" so cron runs don't hammer /key.
  let key_limit_remaining: number | null = null;
  try {
    const baseUrl = String(cfg.openrouterBaseUrl ?? "").trim() || "https://openrouter.ai/api/v1";
    const cached = await readOpenRouterCache(svc, "key", baseUrl);
    const cachedAgeMs = cached?.fetched_at ? Date.now() - Date.parse(cached.fetched_at) : Number.POSITIVE_INFINITY;
    const maxAgeMs = maxKeyAgeMinutes * 60 * 1000;

    let keyData: any = cached?.payload ?? null;
    if (!keyData || !Number.isFinite(cachedAgeMs) || cachedAgeMs > maxAgeMs) {
      const fresh = await fetchOpenRouterKeyInfo({ baseUrl, apiKey, timeoutMs: Math.min(2000, timeoutMs) });
      if (fresh) {
        keyData = { data: fresh };
        await writeOpenRouterCache(svc, "key", baseUrl, keyData);
      }
    }

    const lr = (keyData as any)?.data?.limit_remaining;
    key_limit_remaining = typeof lr === "number" && Number.isFinite(lr) ? lr : null;
  } catch {
    // ignore
  }

  if (typeof minLimitRemaining === "number" && minLimitRemaining >= 0) {
    if (typeof key_limit_remaining === "number" && key_limit_remaining < minLimitRemaining) {
      const finishedAt = new Date().toISOString();
      await safeInsertJobRunLog(svc, {
        job_name: JOB_NAME,
        ok: true,
        started_at: startedAt,
        finished_at: finishedAt,
        scanned: 0,
        embedded: null,
        skipped_existing: 0,
        meta: {
          since: sinceIso,
          dry_run: dryRun,
          exited_early: "limit_remaining_below_threshold",
          limit_remaining: key_limit_remaining,
          min_limit_remaining: minLimitRemaining,
        },
      });
      return jsonResponse({
        ok: true,
        scanned: 0,
        eligible: 0,
        attempted: 0,
        updated: 0,
        skipped: 0,
        dry_run: dryRun,
        since: sinceIso,
        next_cursor: null,
        errors: {},
        exited_early: "limit_remaining_below_threshold",
        limit_remaining: key_limit_remaining,
        min_limit_remaining: minLimitRemaining,
      }, 200, req);
    }
  }

  try {
    // Prefer an RPC that can efficiently filter on jsonb keys + leverage indexes.
    // Falls back to a plain select if the RPC isn't present yet.
    let eligible: LogRow[] = [];
    let scanned = 0;
    {
      const { data, error } = await svc.rpc("openrouter_generation_backfill_candidates_v1", {
        p_since: sinceIso,
        p_limit: batchSize,
        p_cursor_created_at: cursor?.created_at ?? null,
        p_cursor_id: cursor?.id ?? null,
      } as any);

      if (!error) {
        eligible = ((data ?? []) as any[]).map((r) => ({
          id: String((r as any).id),
          created_at: String((r as any).created_at),
          base_url: (r as any).base_url ?? null,
          upstream_request_id: (r as any).upstream_request_id ?? null,
          meta: (r as any).meta ?? null,
        }));
        scanned = eligible.length;
      } else {
        const { data: fallback, error: fbErr } = await svc
          .from("openrouter_request_log")
          .select("id, created_at, base_url, upstream_request_id, meta")
          .gte("created_at", sinceIso)
          .order("created_at", { ascending: false })
          .limit(Math.max(10, Math.min(maxScan, 2000)));
        if (fbErr) return jsonError(fbErr.message, 500, "DB_QUERY_FAILED", req);

        const candidates: LogRow[] = (fallback ?? []) as any;
        scanned = candidates.length;
        eligible = candidates
          .filter((r) => !hasGenerationStats(r))
          .filter((r) => !!pickGenerationId(r))
          .slice(0, batchSize);
      }
    }

    const errors: Record<string, string> = {};
    let updated = 0;
    let attempted = 0;

    const results = await pMap(eligible, Math.max(1, Math.min(concurrency, 10)), async (row) => {
      const generationId = pickGenerationId(row);
      if (!generationId) return { id: row.id, ok: false, reason: "missing_generation_id" };

      attempted++;
      const stats = await fetchOpenRouterGenerationStats({
        baseUrl: row.base_url,
        apiKey,
        generationId,
        timeoutMs,
        maxRetries: 2,
      });

      if (!stats) return { id: row.id, ok: false, reason: "fetch_failed" };
      if (dryRun) return { id: row.id, ok: true, reason: "dry_run" };

      const meta = row.meta ?? {};
      const metaNext = {
        ...meta,
        generation_id: generationId,
        generation_stats: stats,
      };

      const { error: upErr } = await svc
        .from("openrouter_request_log")
        .update({ meta: metaNext })
        .eq("id", row.id);

      if (upErr) {
        return { id: row.id, ok: false, reason: `update_failed:${upErr.message}` };
      }
      updated++;
      return { id: row.id, ok: true, reason: "updated" };
    });

    for (const r of results) {
      if (!r.ok) errors[r.id] = r.reason;
    }

    const finishedAt = new Date().toISOString();

    const next_cursor: Cursor | null = eligible.length
      ? { created_at: eligible[eligible.length - 1].created_at, id: eligible[eligible.length - 1].id }
      : null;

    await safeInsertJobRunLog(svc, {
      job_name: JOB_NAME,
      ok: true,
      started_at: startedAt,
      finished_at: finishedAt,
      scanned,
      embedded: null,
      skipped_existing: 0,
      meta: {
        since: sinceIso,
        dry_run: dryRun,
        eligible: eligible.length,
        attempted,
        updated,
        timeout_ms: timeoutMs,
        concurrency,
        key_limit_remaining,
        min_limit_remaining: minLimitRemaining ?? null,
        max_key_age_minutes: maxKeyAgeMinutes,
        cursor_in: cursor,
        cursor_out: next_cursor,
      },
    });

    return jsonResponse({
      ok: true,
      scanned,
      eligible: eligible.length,
      attempted,
      updated,
      skipped: 0,
      dry_run: dryRun,
      since: sinceIso,
      next_cursor,
      errors,
    }, 200, req);
  } catch (e) {
    await safeInsertJobRunLog(getAdminClient(), {
      job_name: JOB_NAME,
      ok: false,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      error_code: "UNHANDLED",
      error_message: (e as any)?.message ?? String(e),
      meta: { since: sinceIso, dry_run: dryRun },
    });
    return jsonError(req, (e as any)?.message ?? String(e), 500, "UNHANDLED");
  }
});
