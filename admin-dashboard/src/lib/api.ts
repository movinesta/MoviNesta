import { supabase } from "./supabaseClient";

type InvokeBody = BodyInit | Record<string, unknown> | undefined;
type InvokeOpts = { body?: InvokeBody; method?: "POST" | "GET" };

type ErrorEnvelope = { ok: false; code?: string; message?: string; details?: unknown; requestId?: string };

class AdminApiError extends Error {
  code?: string;
  requestId?: string;
  details?: unknown;

  constructor(message: string, opts?: { code?: string; requestId?: string; details?: unknown }) {
    super(message);
    this.name = "AdminApiError";
    this.code = opts?.code;
    this.requestId = opts?.requestId;
    this.details = opts?.details;
  }
}

function isErrorEnvelope(x: unknown): x is ErrorEnvelope {
  return !!x && typeof x === "object" && (x as any).ok === false;
}

/**
 * Invoke a Supabase Edge Function from the admin dashboard.
 * - Handles Supabase FunctionsHttpError with JSON error envelopes when present.
 * - Throws AdminApiError for consistent UI error handling.
 */
async function invoke<T>(fn: string, opts?: InvokeOpts): Promise<T> {
  const method = opts?.method ?? "POST";

  // Correlate admin-dashboard requests with Edge Function logs.
  const requestId =
    (globalThis as any)?.crypto?.randomUUID?.() ??
    `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  const { data, error } = await supabase.functions.invoke(fn, {
    method,
    body: opts?.body,
    headers: {
      "x-request-id": requestId,
    },
  });

  if (error) {
    const parsed = await parseFunctionsHttpError(error);
    if (parsed) throw parsed;
    throw new AdminApiError(error.message);
  }

  if (isErrorEnvelope(data)) {
    throw new AdminApiError(data.message ?? "Request failed", {
      code: data.code,
      requestId: data.requestId,
      details: data.details,
    });
  }

  return data as T;
}

async function parseFunctionsHttpError(error: unknown): Promise<AdminApiError | null> {
  if (!error || typeof error !== "object") return null;
  const err = error as { name?: string; context?: any; message?: string };

  // supabase-js typically uses name === "FunctionsHttpError" and context.response
  if (err.name !== "FunctionsHttpError") return null;

  const res: any = err.context?.response ?? err.context;
  if (!res) return null;

  try {
    const cloned = typeof res.clone === "function" ? res.clone() : res;
    const contentType = cloned.headers?.get?.("Content-Type")?.split(";")[0]?.trim?.();

    if (contentType === "application/json" && typeof cloned.json === "function") {
      const j = await cloned.json().catch(() => null);
      if (isErrorEnvelope(j)) {
        return new AdminApiError(j.message ?? "Request failed", {
          code: j.code,
          requestId: j.requestId,
          details: j.details,
        });
      }
      if (j?.message) return new AdminApiError(String(j.message));
    }

    if (typeof cloned.text === "function") {
      const t = await cloned.text().catch(() => "");
      if (t) return new AdminApiError(t);
    }
  } catch {
    // ignore
  }

  return new AdminApiError(err.message ?? "Function request failed");
}

/* =========================
 * WhoAmI
 * ======================= */

export type WhoAmI = { ok: true; is_admin: boolean; user: { id: string; email?: string | null } | null };

export async function whoami() {
  return invoke<WhoAmI>("admin-whoami");
}

/* =========================
 * Overview
 * ======================= */

export type AdminOverviewResp = {
  ok: true;
  active_profile: { provider: string; model: string; dimensions: number; task: string } | null;
  coverage: Array<{ provider: string; model: string; count: number }>;
  job_state: Array<{ job_name: string; cursor: string | null; updated_at: string | null }>;
  recent_errors: Array<{ id: string | number; created_at?: string; started_at?: string; job_name: string; error_code?: string | null; error_message?: string | null }>;
  last_job_runs: Array<{ id: string | number; started_at: string; finished_at?: string | null; job_name: string; ok: boolean }>;
};

export async function getOverview() {
  return invoke<AdminOverviewResp>("admin-overview");
}

/* =========================
 * Embeddings
 * ======================= */

export type EmbeddingsResp = {
  ok: true;
  embedding_settings: {
    id: number;
    active_provider: string | null;
    active_model: string | null;
    active_dimensions: number | null;
    active_task: string | null;
    rerank_swipe_enabled: boolean | null;
    rerank_search_enabled: boolean | null;
    rerank_top_k: number | null;
    updated_at?: string | null;
  } | null;
  coverage: Array<{ provider: string; model: string; count: number }>;
};

export async function getEmbeddings() {
  return invoke<EmbeddingsResp>("admin-embeddings", { body: { action: "get" } });
}

export async function setActiveProfile(payload: { provider: string; model: string; dimensions: number; task: string }) {
  // Server may ignore provider/model/dimensions (locked profile). Keep payload for compatibility.
  return invoke<{ ok: true }>("admin-embeddings", { body: { action: "set_active_profile", ...payload } });
}

export async function setRerank(payload: { swipe_enabled: boolean; search_enabled: boolean; top_k: number }) {
  return invoke<{ ok: true }>("admin-embeddings", { body: { action: "set_rerank", ...payload } });
}

/* =========================
 * Jobs / Cron
 * ======================= */

export type JobsResp = {
  ok: true;
  job_state: Array<{ job_name: string; cursor: string | null; updated_at: string | null }>;
  cron_jobs: Array<{ jobid: number; jobname: string; schedule: string | null; active: boolean }>;
  cron_error?: string;
};

export async function getJobs() {
  return invoke<JobsResp>("admin-jobs", { body: { action: "get" } });
}

export async function runCronNow(jobname: string) {
  return invoke<{ ok: true }>("admin-jobs", { body: { action: "run_now", jobname } });
}

export async function setCronActive(jobname: string, active: boolean) {
  return invoke<{ ok: true }>("admin-jobs", { body: { action: "set_cron_active", jobname, active } });
}

export async function setCronSchedule(jobname: string, schedule: string) {
  return invoke<{ ok: true }>("admin-jobs", { body: { action: "set_cron_schedule", jobname, schedule } });
}

export async function resetCursor(job_name: string, cursor: string | null = null) {
  return invoke<{ ok: true }>("admin-jobs", { body: { action: "reset_cursor", job_name, cursor } });
}

/* =========================
 * Costs / Budgets
 * ======================= */

export async function getCosts(payload?: { days?: number }) {
  return invoke<any>("admin-costs", { body: { ...(payload ?? {}) } });
}

export async function setCostsBudgets(payload: { total_daily_budget: number | null; by_provider_budget: Record<string, number> }) {
  return invoke<{ ok: true }>("admin-costs", { body: { action: "set_budgets", ...payload } });
}

/* =========================
 * Logs
 * ======================= */

export async function getLogs(payload?: { limit?: number; before?: string | null }) {
  // Some versions support cursor pagination; others just support limit.
  return invoke<any>("admin-logs", { body: { ...(payload ?? {}) } });
}

/* =========================
 * Audit
 * ======================= */

export async function getAudit(payload?: { limit?: number; search?: string | null; before?: string | null }) {
  // Your Audit page expects { rows, next_before }. Keep it flexible.
  return invoke<any>("admin-audit", { body: { ...(payload ?? {}) } });
}

/* =========================
 * Assistant Settings
 * ======================= */

export type AssistantSettingsPayload = {
  openrouter_base_url?: string | null;
  model_fast?: string | null;
  model_creative?: string | null;
  model_planner?: string | null;
  model_maker?: string | null;
  model_critic?: string | null;
  fallback_models?: string[] | null;
  model_catalog?: string[] | null;
  default_instructions?: string | null;
  params?: Record<string, unknown> | null;
};

export async function getAssistantSettings() {
  return invoke<any>("admin-assistant-settings", { body: { action: "get" } });
}

export async function setAssistantSettings(settings: AssistantSettingsPayload) {
  return invoke<{ ok: true }>("admin-assistant-settings", { body: { action: "set", settings } });
}

/* =========================
 * Users
 * ======================= */

export type UsersResp = {
  ok: true;
  users: Array<{
    id: string;
    email?: string | null;
    created_at?: string | null;
    banned_until?: string | null;
  }>;
  next_page: string | null;
};

export async function listUsers(payload?: { search?: string | null; page?: string | null }) {
  return invoke<UsersResp>("admin-users", { body: { action: "list", ...(payload ?? {}) } });
}

export async function banUser(user_id: string, banned: boolean) {
  // ✅ FIX: server expects action "ban" or "unban" (not {is_banned:true/false})
  return invoke<{ ok: true }>("admin-users", { body: { action: banned ? "ban" : "unban", user_id } });
}

export async function resetUserVectors(user_id: string) {
  return invoke<{ ok: true }>("admin-users", { body: { action: "reset_vectors", user_id } });
}

export async function getAssistantMetrics(payload?: { days?: number }) {
  // Admin assistant metrics endpoint (Supabase Edge Function)
  return invoke<any>("admin-assistant-metrics", { body: { ...(payload ?? {}) } });
}

export type AssistantHealthSnapshot = {
  ok: true;
  ts?: string;
  counts?: Record<string, number>;
  byKind?: Record<string, { pending: number; processing: number; done: number; failed: number; total: number }>;
  oldestPendingSec?: number;
  oldestProcessingSec?: number;
  last24h?: { created: number; done: number; failed: number };
  recentFailures?: Array<{
    id: string;
    conversationId: string;
    userId: string;
    jobKind: string;
    attempts: number;
    updatedAt: string;
    lastError: string;
  }>;
  recentCron?: Array<{ id: string; job: string; requestId: string | null; createdAt: string }>;
};

export async function getAssistantHealthSnapshot() {
  return invoke<AssistantHealthSnapshot>("admin-assistant-health", { body: {} });
}
