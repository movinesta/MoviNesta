import { supabase } from "./supabaseClient";

type InvokeOpts = { body?: any; method?: "POST" | "GET" };

async function invoke<T>(fn: string, opts?: InvokeOpts): Promise<T> {
  const method = opts?.method ?? (opts?.body ? "POST" : "POST");
  const { data, error } = await supabase.functions.invoke(fn, {
    method,
    body: opts?.body,
  });
  if (error) throw new Error(error.message);
  return data as T;
}

export type WhoAmI = { ok: true; is_admin: boolean; user: { id: string; email?: string | null } | null };

export async function whoami(): Promise<WhoAmI> {
  return invoke<WhoAmI>("admin-whoami", { body: {} });
}

export type OverviewResp = {
  ok: true;
  active_profile: { provider: string; model: string; dimensions: number; task: string } | null;
  coverage: Array<{ provider: string; model: string; count: number }>;
  last_job_runs: Array<any>;
  recent_errors: Array<any>;
  job_state: Array<{ job_name: string; cursor: string | null; updated_at: string | null }>;
};

export async function getOverview(): Promise<OverviewResp> {
  return invoke<OverviewResp>("admin-overview", { body: {} });
}

export type EmbeddingsResp = {
  ok: true;
  embedding_settings: any;
  coverage: Array<{ provider: string; model: string; count: number }>;
};

export async function getEmbeddings(): Promise<EmbeddingsResp> {
  return invoke<EmbeddingsResp>("admin-embeddings", { body: { action: "get" } });
}

export async function setActiveProfile(payload: { provider: string; model: string; dimensions: number; task: string }) {
  return invoke<{ ok: true }>("admin-embeddings", { body: { action: "set_active_profile", ...payload } });
}

export async function setRerank(payload: { swipe_enabled: boolean; search_enabled: boolean; top_k: number }) {
  return invoke<{ ok: true }>("admin-embeddings", { body: { action: "set_rerank", ...payload } });
}

export type JobsResp = {
  ok: true;
  job_state: Array<{ job_name: string; cursor: string | null; updated_at: string | null }>;
  cron_jobs: Array<{ jobid: number | null; jobname: string; schedule: string; active: boolean }>;
};

export async function getJobs(): Promise<JobsResp> {
  return invoke<JobsResp>("admin-jobs", { body: { action: "get" } });
}

export async function resetCursor(job_name: string) {
  return invoke<{ ok: true }>("admin-jobs", { body: { action: "reset_cursor", job_name } });
}

export async function setCronActive(jobname: string, active: boolean) {
  return invoke<{ ok: true }>("admin-jobs", { body: { action: "set_cron_active", jobname, active } });
}

export async function setCronSchedule(jobname: string, schedule: string) {
  return invoke<{ ok: true }>("admin-jobs", { body: { action: "set_cron_schedule", jobname, schedule } });
}

export async function runCronNow(jobname: string) {
  return invoke<{ ok: true }>("admin-jobs", { body: { action: "run_now", jobname } });
}

export type UsersResp = {
  ok: true;
  users: Array<{ id: string; email?: string | null; created_at?: string; banned_until?: string | null }>;
  next_page?: string | null;
};

export async function listUsers(payload?: { page?: string | null; search?: string | null }): Promise<UsersResp> {
  return invoke<UsersResp>("admin-users", { body: { action: "list", ...payload } });
}

export async function banUser(user_id: string, banned: boolean) {
  return invoke<{ ok: true }>("admin-users", { body: { action: banned ? "ban" : "unban", user_id } });
}

export async function resetUserVectors(user_id: string) {
  return invoke<{ ok: true }>("admin-users", { body: { action: "reset_vectors", user_id } });
}

export type LogsResp = { ok: true; rows: any[] };

export async function getLogs(payload?: { limit?: number }): Promise<LogsResp> {
  return invoke<LogsResp>("admin-logs", { body: { action: "get", ...payload } });
}

export type AuditResp = { ok: true; rows: any[]; next_before?: string | null };

export async function getAudit(payload?: { limit?: number; search?: string | null; before?: string | null }): Promise<AuditResp> {
  // Server-side function currently supports limit + cursor (created_at). We still accept search for forward compatibility.
  const body: any = {
    limit: payload?.limit ?? 100,
    cursor: payload?.before ?? null,
  };
  if (payload?.search) body.search = payload.search;
  return invoke<AuditResp>("admin-audit", { body });
}

export type CostsDailyRow = {
  day: string;
  provider: string;
  tokens: number;
  runs: number;
  errors: number;
};

export type CostsDailyJobRow = {
  day: string;
  job_name: string;
  provider: string;
  tokens: number;
  runs: number;
  errors: number;
};

export type CostsJobSummaryRow = {
  job_name: string;
  provider: string | null;
  tokens: number;
  runs: number;
  errors: number;
  last_started_at: string | null;
};

export type CostsBudgets = {
  total_daily: number | null;
  by_provider: Record<string, number> | null;
};

export type CostsRemaining = {
  total_daily_remaining: number | null;
  provider_remaining: Record<string, number> | null;
};

export type CostsDataQuality = {
  rows: number;
  rows_with_tokens: number;
  rows_missing_tokens: number;
};

export type CostsResp = {
  ok: true;
  days: number;
  since: string;
  today: { day: string; total_tokens: number; by_provider: Record<string, number> };
  budgets: CostsBudgets;
  remaining: CostsRemaining;
  data_quality: CostsDataQuality;
  daily: CostsDailyRow[];
  daily_jobs: CostsDailyJobRow[];
  jobs: CostsJobSummaryRow[];
};

export async function getCosts(payload?: { days?: number }): Promise<CostsResp> {
  return invoke<CostsResp>("admin-costs", { body: { action: "get", ...payload } });
}

export async function setCostsBudgets(payload: { total_daily: number | null; by_provider: Record<string, number> | null }): Promise<{ ok: true }> {
  return invoke<{ ok: true }>("admin-costs", { body: { action: "set_budgets", ...payload } });
}
