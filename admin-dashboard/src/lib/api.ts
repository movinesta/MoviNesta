import { supabase } from "./supabaseClient";

type InvokeOpts = { body?: unknown; method?: "POST" | "GET" };

type OkEnvelope<T> = T & { ok?: true };
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
 * Enforces the {ok:false} error envelope when returned by the function.
 */
async function invoke<T>(fn: string, opts?: InvokeOpts): Promise<OkEnvelope<T>> {
  const method = opts?.method ?? (opts?.body ? "POST" : "POST");
  const { data, error } = await supabase.functions.invoke(fn, { method, body: opts?.body });

  if (error) {
    const parsedError = await parseFunctionsHttpError(error);
    if (parsedError) throw parsedError;
    throw new AdminApiError(error.message);
  }
  if (isErrorEnvelope(data)) throw new AdminApiError(data.message ?? "Request failed", { code: data.code, requestId: data.requestId, details: data.details });

  return data as OkEnvelope<T>;
}

async function parseFunctionsHttpError(error: unknown): Promise<AdminApiError | null> {
  if (!error || typeof error !== "object") return null;
  const err = error as { name?: string; context?: Response };
  if (err.name !== "FunctionsHttpError" || !err.context) return null;

  const response = err.context;
  const cloned = typeof response.clone === "function" ? response.clone() : response;
  const contentType = cloned.headers?.get?.("Content-Type")?.split(";")[0].trim();

  try {
    if (contentType === "application/json") {
      const data = await cloned.json();
      if (isErrorEnvelope(data)) {
        return new AdminApiError(data.message ?? "Request failed", { code: data.code, requestId: data.requestId, details: data.details });
      }
      if (data?.message) return new AdminApiError(String(data.message));
    }

    const text = await cloned.text();
    if (text) return new AdminApiError(text);
  } catch {
    return null;
  }

  return null;
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
  totals: {
    users_total: number;
    users_new_7d: number;
    events_7d: number;
    messages_7d: number;
    swipes_7d: number;
    likes_7d: number;
    dislikes_7d: number;
  };
  embeddings?: {
    active_provider?: string | null;
    active_model?: string | null;
    active_dimensions?: number | null;
    active_task?: string | null;
    rerank_swipe_enabled?: boolean | null;
    rerank_search_enabled?: boolean | null;
    rerank_top_k?: number | null;
  } | null;
};

export async function getOverview() {
  return invoke<AdminOverviewResp>("admin-overview");
}

/* =========================
 * Embeddings Settings
 * ======================= */

export type EmbeddingsResp = {
  ok: true;
  active_provider: string | null;
  active_model: string | null;
  active_dimensions: number | null;
  active_task: string | null;
  rerank_swipe_enabled: boolean | null;
  rerank_search_enabled: boolean | null;
  rerank_top_k: number | null;
};

export async function getEmbeddings() {
  return invoke<EmbeddingsResp>("admin-embeddings", { body: { action: "get" } });
}

export async function setActiveProfile(payload: { provider: string; model: string; dimensions: number; task: string }) {
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

export async function runCronNow(job_name: string) {
  return invoke<{ ok: true }>("admin-jobs", { body: { action: "run_now", jobname: job_name } });
}

export async function setCronActive(job_name: string, is_active: boolean) {
  return invoke<{ ok: true }>("admin-jobs", { body: { action: "set_cron_active", jobname: job_name, active: is_active } });
}

export async function setCronSchedule(job_name: string, schedule: string) {
  return invoke<{ ok: true }>("admin-jobs", { body: { action: "set_cron_schedule", jobname: job_name, schedule } });
}

export async function resetCursor(job_name: string, cursor: string | null) {
  return invoke<{ ok: true }>("admin-jobs", { body: { action: "reset_cursor", job_name, cursor } });
}

/* =========================
 * Costs / Budgets
 * ======================= */

export type CostsProviderDailyRow = { day: string; provider: string; cost_usd: number };
export type CostsDailyJobRow = { day: string; job: string; provider: string; cost_usd: number };
export type CostsJobSummaryRow = { job: string; provider: string; total_cost_usd: number };

export type CostsResp = {
  ok: true;
  budgets: { month: string; provider: string; budget_usd: number }[];
  costs_provider_daily: CostsProviderDailyRow[];
  costs_daily_job: CostsDailyJobRow[];
  job_summary: CostsJobSummaryRow[];
};

export async function getCosts() {
  return invoke<CostsResp>("admin-costs");
}

export async function setCostsBudgets(payload: { budgets: { provider: string; budget_usd: number }[] }) {
  return invoke<{ ok: true }>("admin-costs", { body: { action: "set_budgets", ...payload } });
}

/* =========================
 * Logs
 * ======================= */

export type LogsResp = { ok: true; rows: any[] };

export async function getLogs(payload?: { job?: string; limit?: number }) {
  return invoke<LogsResp>("admin-logs", { body: { action: "get", ...(payload ?? {}) } });
}

/* =========================
 * Audit
 * ======================= */

export type AuditResp = { ok: true; rows: any[] };

export async function getAudit(payload?: { user_id?: string; limit?: number }) {
  return invoke<AuditResp>("admin-audit", { body: { action: "get", ...(payload ?? {}) } });
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
    is_banned?: boolean | null;
    last_seen_at?: string | null;
    display_name?: string | null;
  }>;
};

export async function listUsers(payload?: { search?: string; limit?: number }) {
  return invoke<UsersResp>("admin-users", { body: { action: "list", ...(payload ?? {}) } });
}

export async function banUser(user_id: string, is_banned: boolean) {
  return invoke<{ ok: true }>("admin-users", { body: { action: "ban", user_id, is_banned } });
}

export async function resetUserVectors(user_id: string) {
  return invoke<{ ok: true }>("admin-users", { body: { action: "reset_vectors", user_id } });
}
