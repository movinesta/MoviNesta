import { supabase } from "./supabaseClient";
import type {
  AuditResponse,
  CostsResponse,
  EmbeddingsResponse,
  JobsResponse,
  LogsResponse,
  OverviewResponse,
  UsersResponse,
  WhoAmIResponse,
} from "./types";

type InvokeOpts<B = unknown> = { body?: B; method?: "POST" | "GET" };

async function invoke<T, B = unknown>(fn: string, opts?: InvokeOpts<B>): Promise<T> {
  const method = opts?.method ?? "POST";
  const { data, error } = await supabase.functions.invoke(fn, {
    method,
    body: (opts?.body ?? {}) as any,
  });
  if (error) throw new Error(error.message);
  return data as T;
}

export type WhoAmI = WhoAmIResponse;

export async function whoami(): Promise<WhoAmIResponse> {
  return invoke<WhoAmIResponse>("admin-whoami", { body: {} });
}

export type OverviewResp = OverviewResponse;

export async function getOverview(): Promise<OverviewResponse> {
  return invoke<OverviewResponse>("admin-overview", { body: {} });
}

export type EmbeddingsResp = EmbeddingsResponse;

export async function getEmbeddings(): Promise<EmbeddingsResponse> {
  return invoke<EmbeddingsResponse>("admin-embeddings", { body: { action: "get" } });
}

export async function setActiveProfile(payload: { provider: string; model: string; dimensions: number; task: string }): Promise<{ ok: true }> {
  return invoke<{ ok: true }>("admin-embeddings", { body: { action: "set_active_profile", ...payload } });
}

export async function setRerank(payload: { swipe_enabled: boolean; search_enabled: boolean; top_k: number }): Promise<{ ok: true }> {
  return invoke<{ ok: true }>("admin-embeddings", { body: { action: "set_rerank", ...payload } });
}

export type JobsResp = JobsResponse;

export async function getJobs(): Promise<JobsResponse> {
  return invoke<JobsResponse>("admin-jobs", { body: { action: "get" } });
}

export async function resetCursor(job_name: string): Promise<{ ok: true }> {
  return invoke<{ ok: true }>("admin-jobs", { body: { action: "reset_cursor", job_name } });
}

export async function setCronActive(jobname: string, active: boolean): Promise<{ ok: true }> {
  return invoke<{ ok: true }>("admin-jobs", { body: { action: "set_cron_active", jobname, active } });
}

export type UsersResp = UsersResponse;

export async function listUsers(payload?: { page?: string | null; search?: string | null }): Promise<UsersResponse> {
  return invoke<UsersResponse>("admin-users", { body: { action: "list", ...payload } });
}

export async function banUser(user_id: string, banned: boolean): Promise<{ ok: true }> {
  return invoke<{ ok: true }>("admin-users", { body: { action: banned ? "ban" : "unban", user_id } });
}

export async function resetUserVectors(user_id: string): Promise<{ ok: true }> {
  return invoke<{ ok: true }>("admin-users", { body: { action: "reset_vectors", user_id } });
}

export type LogsResp = LogsResponse;

export async function getLogs(payload?: { limit?: number; before?: string | null }): Promise<LogsResponse> {
  return invoke<LogsResponse>("admin-logs", { body: { action: "get", ...payload } });
}

export type CostsResp = CostsResponse;

export async function getCosts(payload?: { days?: number }): Promise<CostsResponse> {
  return invoke<CostsResponse>("admin-costs", { body: { action: "get", ...payload } });
}

export type AuditResp = AuditResponse;

export async function getAudit(payload?: { limit?: number; search?: string | null; before?: string | null }): Promise<AuditResponse> {
  return invoke<AuditResponse>("admin-audit", { body: { action: "get", ...payload } });
}
