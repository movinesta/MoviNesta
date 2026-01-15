/// <reference path="../_shared/deno.d.ts" />
// supabase/functions/assistant-chat-reply-runner/index.ts
//
// Background worker for assistant chat replies.
//
// Security model:
// - verify_jwt = false
// - Requires x-job-token header (INTERNAL_JOB_TOKEN)
//
// It claims pending jobs from public.assistant_reply_jobs via RPC,
// then calls the existing assistant-chat-reply function in internal mode.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

import { getRequestId, handleOptions, jsonError, jsonResponse } from "../_shared/http.ts";
import { requireInternalJob } from "../_shared/internal.ts";
import { getAdminClient } from "../_shared/supabase.ts";
import { safeInsertAssistantFailure } from "../_shared/assistantTelemetry.ts";
import { getConfig } from "../_shared/config.ts";
import { loadAppSettingsForScopes } from "../_shared/appSettings.ts";
import { log, logInfo, logWarn } from "../_shared/logger.ts";

const FN_NAME = "assistant-chat-reply-runner";

const BodySchema = z
  .object({
    reason: z.string().optional(),
    limit: z.number().int().min(1).max(200).optional(),
    maxAttempts: z.number().int().min(1).max(10).optional(),
    dryRun: z.boolean().optional(),
  })
  .optional();

type JobRow = {
  id: string;
  user_id: string;
  conversation_id: string;
  user_message_id: string;
  attempts: number;
  job_kind?: string | null;
};

type BackoffCfg = {
  base_seconds: number;
  max_exp: number;
  max_seconds: number;
  jitter_seconds: number;
};

function clampInt(n: unknown, min: number, max: number, fallback: number): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  const x = Math.trunc(v);
  return Math.max(min, Math.min(max, x));
}

function normalizeBackoffCfg(raw: any): BackoffCfg {
  return {
    base_seconds: clampInt(raw?.base_seconds, 1, 120, 10),
    max_exp: clampInt(raw?.max_exp, 1, 16, 10),
    max_seconds: clampInt(raw?.max_seconds, 10, 7200, 3600),
    jitter_seconds: clampInt(raw?.jitter_seconds, 0, 30, 5),
  };
}


function backoffSeconds(attempts: number, cfg: BackoffCfg): number {
  // attempts is already incremented by the claim function.
  const exp = Math.min(cfg.max_exp, Math.max(0, attempts - 1));
  const base = Math.min(cfg.max_seconds, cfg.base_seconds * 2 ** exp); // base, 2x, 4x... capped
  const jitter = cfg.jitter_seconds > 0 ? Math.floor(Math.random() * cfg.jitter_seconds) : 0;
  return base + jitter;
}


async function postJsonWithStatus<T = any>(
  url: string,
  body: unknown,
  headers: Record<string, string>,
): Promise<{ status: number; body: T | null; text: string }> {
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let parsed: any = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  return { status: res.status, body: parsed as T | null, text };
}

serve(async (req) => {
  const cors = handleOptions(req);
  if (cors) return cors;

  const auth = requireInternalJob(req);
  if (auth) return auth;

  const requestId = getRequestId(req);
  const logCtx = { fn: FN_NAME, requestId };

  try {

    const parsed = BodySchema.parse(await req.json().catch(() => ({})));
    const dryRun = Boolean(parsed?.dryRun);

    const cfg = getConfig();
    const supabaseUrl = cfg.supabaseUrl;
    const internalToken = Deno.env.get("INTERNAL_JOB_TOKEN") ?? "";

    if (!supabaseUrl) {
      return jsonError("Missing SUPABASE_URL", 500, "CONFIG_ERROR", req);
    }
    if (!internalToken) {
      return jsonError("Missing INTERNAL_JOB_TOKEN", 500, "CONFIG_ERROR", req);
    }

    const svc = getAdminClient(req);

    // Server-only runtime knobs (admin-controlled; non-secret).
    let serverOnly: Record<string, unknown> = {};
    try {
      const env = await loadAppSettingsForScopes(svc as any, ["server_only"]);
      serverOnly = env.settings ?? {};
    } catch {
      serverOnly = {};
    }

    const backoffCfg = normalizeBackoffCfg(serverOnly["assistant.reply_runner.backoff"] ?? null);

    const limit = clampInt(
      parsed?.limit ?? serverOnly["assistant.reply_runner.claim_limit_default"],
      1,
      200,
      20,
    );

    const maxAttempts = clampInt(
      parsed?.maxAttempts ?? serverOnly["assistant.reply_runner.max_attempts_default"],
      1,
      10,
      5,
    );

    const stuckMinutes = clampInt(
      serverOnly["assistant.reply_runner.stuck_minutes"],
      1,
      120,
      10,
    );

    const maxContextMessages = clampInt(
      serverOnly["assistant.reply_runner.max_context_messages"],
      1,
      50,
      12,
    );

    logInfo(logCtx, "Runner invoked", {
      reason: parsed?.reason ?? "cron",
      limit,
      maxAttempts,
      stuckMinutes,
      maxContextMessages,
      dryRun,
    });


    const { data: claimed, error: claimErr } = await svc.rpc("assistant_claim_reply_jobs_v1", {
      p_limit: limit,
      p_stuck_minutes: stuckMinutes,
    });

    if (claimErr) {
      logWarn(logCtx, "Failed to claim reply jobs", { error: claimErr.message });
      return jsonResponse(req, { ok: false, code: "DB_ERROR", error: claimErr.message }, 500);
    }

    const jobs = (claimed ?? []) as JobRow[];
    const results: any[] = [];

    // Used for non-LLM jobs (e.g., rate_limit_notice).
    let assistantUserId: string | null = null;
    try {
      const { data } = await svc.rpc("get_assistant_user_id_v1");
      assistantUserId = (data as any) ?? null;
    } catch {
      assistantUserId = null;
    }

    for (const job of jobs) {
      const kind = String(job.job_kind ?? "reply");
      const jobCtx = {
        ...logCtx,
        runnerJobId: job.id,
        conversationId: job.conversation_id,
        userId: job.user_id,
        jobKind: kind,
      };

      logInfo(jobCtx, "Processing job", { attempts: job.attempts });
      if (dryRun) {
        results.push({ id: job.id, ok: true, dryRun: true });
        continue;
      }

      try {
        if (kind === "rate_limit_notice") {
          if (!assistantUserId) throw new Error("ASSISTANT_NOT_CONFIGURED");

          const noticeText =
            "You're sending messages very fast. Give me a moment — I'll reply soon.";

          const { error: insErr } = await svc.from("messages").insert({
            conversation_id: job.conversation_id,
            user_id: assistantUserId,
            sender_id: assistantUserId,
            message_type: "text",
            text: noticeText,
            body: { type: "text", text: noticeText },
            client_id: `assistant_notice_${crypto.randomUUID()}`,
            meta: {
              ai: {
                kind: "rate_limit_notice",
                triggeredBy: { userMessageId: job.user_message_id },
              },
              triggeredBy: { userMessageId: job.user_message_id },
            },
          });

          if (insErr) throw new Error(insErr.message);

          await svc
            .from("assistant_reply_jobs")
            .update({
              status: "done",
              updated_at: new Date().toISOString(),
              last_error: null,
              meta: {
                handledBy: FN_NAME,
                reason: parsed?.reason ?? "cron",
                kind,
              },
            })
            .eq("id", job.id);

          results.push({ id: job.id, ok: true, kind });
          continue;
        }

        const t0 = Date.now();
        const { status, body: respBody, text: rawText } = await postJsonWithStatus<any>(
          `${supabaseUrl}/functions/v1/assistant-chat-reply`,
          {
            conversationId: job.conversation_id,
            userMessageId: job.user_message_id,
            userId: job.user_id,
            maxContextMessages,
          },
          {
            "x-job-token": internalToken,
            "Content-Type": "application/json",
            "x-request-id": requestId,
            "x-runner-job-id": job.id,
          },
        );

        const durationMs = Date.now() - t0;
        log(jobCtx, "assistant-chat-reply responded", {
          status,
          durationMs,
          ok: (respBody as any)?.ok ?? null,
          code: (respBody as any)?.code ?? null,
        });
        log(jobCtx, "assistant-chat-reply completed", { status, durationMs });

        // Handle rate limiting explicitly so we don't burn attempts quickly.
        if (status === 429 || (respBody && (respBody as any).code === "RATE_LIMITED")) {
          logWarn(jobCtx, "Rate limited; rescheduling job", {
            status,
            durationMs,
          });
          const retryAfter = Number((respBody as any)?.retryAfterSec ?? 0);
          const attempts = Number(job.attempts ?? 1);
          const backoff = backoffSeconds(attempts, backoffCfg);
          const retry = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : backoff;

          logWarn(jobCtx, "Rate limited", { retryAfterSec: retry, attempts });

          await svc
            .from("assistant_reply_jobs")
            .update({
              status: "pending",
              updated_at: new Date().toISOString(),
              next_run_at: new Date(Date.now() + retry * 1000).toISOString(),
              last_error: "RATE_LIMITED",
              meta: {
                handledBy: FN_NAME,
                reason: parsed?.reason ?? "cron",
                kind,
                response: respBody ?? null,
              },
            })
            .eq("id", job.id);

          results.push({ id: job.id, ok: false, kind, rateLimited: true, retryAfterSec: retry });
          logWarn(jobCtx, "Job rate-limited", { retryAfterSec: retry });
          continue;
        }

        if (status >= 400) {
          throw new Error(`assistant-chat-reply HTTP ${status}: ${rawText.slice(0, 200)}`);
        }

        const resp = respBody ?? null;
        if (resp && resp.ok === false) {
          throw new Error(String(resp.code ?? "ASSISTANT_FAILED"));
        }

        // Mark job done regardless of reused/new (assistant-chat-reply is idempotent).
        await svc
          .from("assistant_reply_jobs")
          .update({
            status: "done",
            updated_at: new Date().toISOString(),
            last_error: null,
            meta: {
              handledBy: FN_NAME,
              reason: parsed?.reason ?? "cron",
              kind,
              response: resp ?? null,
            },
          })
          .eq("id", job.id);

        results.push({
          id: job.id,
          ok: true,
          kind,
          messageId: resp?.messageId ?? null,
          reused: resp?.reused ?? false,
          superseded: resp?.superseded ?? false,
        });
      } catch (e: any) {
        const msg = String(e?.message ?? e);
        const attempts = Number(job.attempts ?? 1);

        const finalFail = attempts >= maxAttempts;
        const nextAt = new Date(Date.now() + backoffSeconds(attempts, backoffCfg) * 1000).toISOString();

        await svc
          .from("assistant_reply_jobs")
          .update({
            status: finalFail ? "failed" : "pending",
            updated_at: new Date().toISOString(),
            next_run_at: finalFail ? new Date().toISOString() : nextAt,
            last_error: msg.slice(0, 2000),
          })
          .eq("id", job.id);

        // Final failures: record to telemetry table for admin dashboards.
        if (finalFail) {
          try {
            await safeInsertAssistantFailure(svc, {
              fn: FN_NAME,
              request_id: String(requestId),
              user_id: job.user_id ?? null,
              conversation_id: job.conversation_id ?? null,
              code: "REPLY_JOB_FAILED",
              message: msg.slice(0, 2000),
              details: { jobId: job.id, attempts, kind },
            });
          } catch {
            // ignore
          }
        }

        log(jobCtx, "Job failed", { error: msg, attempts, finalFail });
        results.push({ id: job.id, ok: false, attempts, finalFail });
      }
    }

    return jsonResponse(req, {
      ok: true,
      claimed: jobs.length,
      processed: results.length,
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(logCtx, "Unexpected error", { error: message });
    return jsonError("Internal server error", 500, "INTERNAL_ERROR", req);
  }
});
