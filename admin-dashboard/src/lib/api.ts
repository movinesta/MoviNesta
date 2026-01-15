import { supabase } from "./supabaseClient";

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/+$/, "");
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_OR_ANON_KEY) as
  | string
  | undefined;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY for admin dashboard API calls.");
}

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

export type AdminErrorMeta = { message: string; code?: string; requestId?: string; details?: unknown };

export function getAdminErrorMeta(err: unknown): AdminErrorMeta {
  if (!err) return { message: "Unknown error" };
  if (err instanceof AdminApiError) {
    return { message: err.message || "Request failed", code: err.code, requestId: err.requestId, details: err.details };
  }
  if (err instanceof Error) return { message: err.message || "Request failed" };
  try {
    return { message: String(err) };
  } catch {
    return { message: "Unknown error" };
  }
}

export function formatAdminError(err: unknown): string {
  const m = getAdminErrorMeta(err);
  const bits: string[] = [];
  if (m.code) bits.push(m.code);
  if (m.requestId) bits.push(`req:${m.requestId}`);
  return bits.length ? `${m.message} (${bits.join(" ")})` : m.message;
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

  // Always attach an explicit Bearer token so Edge Functions never fail due to missing auth headers.
  // Some environments can be finicky about header merging in wrapped clients.
  let { data: sessionData } = await supabase.auth.getSession();
  let accessToken = sessionData?.session?.access_token ?? null;

  // If the session exists but the access token is missing/stale, try one refresh.
  if (!accessToken) {
    const refreshed = await supabase.auth.refreshSession().catch(() => null);
    accessToken = refreshed?.data?.session?.access_token ?? null;
  }

  if (!accessToken) {
    throw new AdminApiError("Not signed in", { code: "NO_SESSION", requestId });
  }

  const headers: Record<string, string> = {
    apikey: SUPABASE_ANON_KEY!,
    authorization: `Bearer ${accessToken}`,
    "x-request-id": requestId,
  };

  let body: BodyInit | undefined = undefined;
  if (method !== "GET" && opts?.body !== undefined) {
    if (typeof opts.body === "string" || opts.body instanceof Blob || opts.body instanceof FormData) {
      body = opts.body as any;
    } else {
      headers["content-type"] = "application/json";
      body = JSON.stringify(opts.body);
    }
  }

  const url = `${SUPABASE_URL}/functions/v1/${fn}`;

  let res: Response;
  try {
    res = await fetch(url, { method, headers, body });
  } catch (e: any) {
    throw new AdminApiError(e?.message ?? "Network error", { code: "NETWORK_ERROR", requestId });
  }

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    const msg =
      (data && typeof data === "object" && (data.message ?? data.error)) ||
      (text && text.trim()) ||
      `Request failed (${res.status})`;

    throw new AdminApiError(String(msg), {
      code: (data && typeof data === "object" && data.code) ? String(data.code) : `HTTP_${res.status}`,
      requestId: (data && typeof data === "object" && data.requestId) ? String(data.requestId) : requestId,
      details: data ?? text,
    });
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

async function invokeGet<T>(fn: string): Promise<T> {
  return invoke<T>(fn, { method: "GET" });
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
  ops_alerts?: OpsAlert[];
  zdr_coverage?: {
    total: number;
    requested: number;
    used: number;
    fallback: number;
    sensitive: number;
    coverage_rate: number;
  };
};

export type OpsAlert = {
  id: number;
  kind: string;
  dedupe_key: string;
  severity: "info" | "warn" | "critical" | string;
  title: string;
  detail: string | null;
  source: string;
  meta: any;
  created_at: string;
  updated_at: string;
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
 * Verification
 * ======================= */

export type AdminVerificationRequestRow = {
  id: string;
  user_id: string;
  status: "pending" | "needs_more_info" | "approved" | "rejected" | "none" | "revoked";
  badge_type: "identity" | "official" | "trusted_verifier" | "subscription" | null;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  updated_at: string;
  evidence: any;
  user: {
    id: string;
    username?: string | null;
    display_name?: string | null;
    avatar_url?: string | null;
    is_verified?: boolean | null;
    verified_type?: string | null;
    verified_label?: string | null;
  };
};

export type AdminVerificationListResp = {
  ok: true;
  requests: AdminVerificationRequestRow[];
  next_cursor: string | null;
};

export async function listVerificationRequests(payload: { status: "pending" | "needs_more_info" | "approved" | "rejected" | "none"; search?: string; cursor?: string | number; limit?: number }) {
  return invoke<AdminVerificationListResp>("admin-verification", {
    body: {
      action: "list_requests",
      status: payload.status,
      search: payload.search ?? "",
      cursor: payload.cursor ?? 0,
      limit: payload.limit ?? 50,
    },
  });
}

export async function getVerificationRequest(payload: { request_id: string }) {
  return invoke<{ ok: true; request: any }>("admin-verification", { body: { action: "get_request", request_id: payload.request_id } });
}

export async function approveVerificationRequest(payload: { request_id: string; badge_type: string; public_label?: string; verifier_org?: string }) {
  return invoke<{ ok: true }>("admin-verification", {
    body: { action: "approve_request", request_id: payload.request_id, badge_type: payload.badge_type, public_label: payload.public_label, verifier_org: payload.verifier_org },
  });
}

export async function rejectVerificationRequest(payload: { request_id: string; reason?: string }) {
  return invoke<{ ok: true }>("admin-verification", { body: { action: "reject_request", request_id: payload.request_id, reason: payload.reason } });
}

export async function needsMoreInfoVerificationRequest(payload: { request_id: string; note?: string }) {
  return invoke<{ ok: true }>("admin-verification", { body: { action: "needs_more_info", request_id: payload.request_id, note: payload.note } });
}

export async function markVerificationNeedsMoreInfo(payload: { request_id: string; note?: string }) {
  return invoke<{ ok: true }>("admin-verification", { body: { action: "needs_more_info", request_id: payload.request_id, note: payload.note } });
}

export async function listVerifiedUsers(payload: { cursor?: string | number; limit?: number }) {
  return invoke<{ ok: true; verified: any[]; next_cursor: string | null }>("admin-verification", {
    body: { action: "list_verified", cursor: payload.cursor ?? 0, limit: payload.limit ?? 50 },
  });
}

export async function revokeVerifiedUser(payload: { user_id: string; reason?: string }) {
  return invoke<{ ok: true }>("admin-verification", { body: { action: "revoke_user", user_id: payload.user_id, reason: payload.reason } });
}

export async function verifyUserDirect(payload: { user_id: string; badge_type: string; public_label?: string; verifier_org?: string; note?: string }) {
  return invoke<{ ok: true }>("admin-verification", {
    body: {
      action: "verify_direct",
      user_id: payload.user_id,
      badge_type: payload.badge_type,
      public_label: payload.public_label,
      verifier_org: payload.verifier_org,
      note: payload.note,
    },
  });
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
 * OpenRouter Cache
 * ======================= */

export async function getOpenRouterCredits(payload?: { base_url?: string | null }) {
  const qs = payload?.base_url ? `?base_url=${encodeURIComponent(payload.base_url)}` : "";
  return invoke<any>(`admin-openrouter-credits${qs}`, { method: "GET" });
}

export async function getOpenRouterKey(payload?: { base_url?: string | null }) {
  const qs = payload?.base_url ? `?base_url=${encodeURIComponent(payload.base_url)}` : "";
  return invoke<any>(`admin-openrouter-key${qs}`, { method: "GET" });
}

export async function getOpenRouterUsage(payload?: { base_url?: string | null }) {
  const qs = payload?.base_url ? `?base_url=${encodeURIComponent(payload.base_url)}` : "";
  return invoke<any>(`admin-openrouter-usage${qs}`, { method: "GET" });
}


export async function getOpenRouterModels(payload?: { base_url?: string | null }) {
  const qs = payload?.base_url ? `?base_url=${encodeURIComponent(payload.base_url)}` : "";
  return invoke<any>(`admin-openrouter-models${qs}`, { method: "GET" });
}

export async function getOpenRouterEndpoints(payload?: { base_url?: string | null }) {
  const qs = payload?.base_url ? `?base_url=${encodeURIComponent(payload.base_url)}` : "";
  return invoke<any>(`admin-openrouter-endpoints${qs}`, { method: "GET" });
}

export async function refreshOpenRouterCaches(payload?: {
  base_url?: string | null;
  timeout_ms?: number | null;
  refresh_parameters?: boolean | null;
  max_models?: number | null;
}) {
  return invoke<any>("admin-openrouter-refresh", { body: { ...(payload ?? {}) } });
}

export async function resetOpenRouterCircuit(model?: string | null) {
  if (model && String(model).trim()) {
    return invoke<any>("admin-openrouter-circuit", { body: { action: "reset", model: String(model).trim() } });
  }
  return invoke<any>("admin-openrouter-circuit", { body: { action: "reset_all" } });
}

export async function cleanupOpenRouterCircuits(payload?: { keep_days?: number | null }) {
  return invoke<any>("admin-openrouter-circuit", { body: { action: "cleanup", ...(payload ?? {}) } });
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
  behavior?: Record<string, unknown> | null;
};

export async function getOpenRouterParameters(payload: { model: string; provider?: string | null; base_url?: string | null }) {
  const parts: string[] = [];
  parts.push(`model=${encodeURIComponent(payload.model)}`);
  if (payload.provider) parts.push(`provider=${encodeURIComponent(payload.provider)}`);
  if (payload.base_url) parts.push(`base_url=${encodeURIComponent(payload.base_url)}`);
  const qs = parts.length ? `?${parts.join("&")}` : "";
  return invoke<any>(`admin-openrouter-parameters${qs}`, { method: "GET" });
}

export async function refreshOpenRouterParameters(payload: { model: string; provider?: string | null; base_url?: string | null }) {
  const parts: string[] = [];
  parts.push(`model=${encodeURIComponent(payload.model)}`);
  if (payload.provider) parts.push(`provider=${encodeURIComponent(payload.provider)}`);
  if (payload.base_url) parts.push(`base_url=${encodeURIComponent(payload.base_url)}`);
  const qs = parts.length ? `?${parts.join("&")}` : "";
  return invoke<any>(`admin-openrouter-parameters-refresh${qs}`, { method: "POST" });
}



export async function getAssistantSettings() {
  return invoke<any>("admin-assistant-settings", { body: { action: "get" } });
}

export async function setAssistantSettings(settings: AssistantSettingsPayload) {
  return invoke<{ ok: true }>("admin-assistant-settings", { body: { action: "set", settings } });
}

export type AssistantProviderTestResp = {
  ok: true;
  requestId?: string | null;
  test: {
    ok: boolean;
    durationMs?: number;
    baseUrl?: string | null;
    usedModel?: string | null;
    contentPreview?: string | null;
    userMessage?: string | null;
    envelope?: any;
    culprit?: any;
  };
};

export type AssistantRoutingTestResp = {
  ok: true;
  requestId?: string | null;
  test: {
    ok: boolean;
    durationMs?: number;
    baseUrl?: string | null;
    usedModel?: string | null;
    usedVariant?: string | null;
    usedProvider?: string | null;
    policyMode?: string | null;
    requireParameters?: boolean | null;
    requireParametersSource?: "policy" | "auto" | "none";
    contentPreview?: string | null;
    userMessage?: string | null;
    envelope?: any;
    culprit?: any;
    modelCandidates?: string[];
    routing?: any;
  };
};

export async function testAssistantProvider(payload?: { prompt?: string; model_key?: string; model?: string }) {
  return invoke<AssistantProviderTestResp>("admin-assistant-settings", {
    body: { action: "test_provider", test: payload ?? {} },
  });
}

export async function testAssistantRouting(payload?: { prompt?: string; mode?: "current" | "auto" | "fallback"; simulate_advanced_params?: boolean }) {
  return invoke<AssistantRoutingTestResp>("admin-assistant-settings", {
    body: { action: "test_routing", routing_test: payload ?? {} },
  });
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
  recentAiFailures?: Array<{
    id: string;
    fn: string;
    createdAt: string;
    requestId: string | null;
    conversationId: string | null;
    userId: string | null;
    code: string;
    reason: string;
    culprit: { var: string; source: string; value_preview?: string | null } | null;
    context: any;
  }>;
  aiFailureRollup?: {
    codes?: Array<{ code: string; count: number }>;
    models?: Array<{ model: string; count: number }>;
  };
  openrouterCircuits?: Array<{
    model: string;
    openUntil: string | null;
    failureStreak: number;
    lastStatus: number | null;
    lastError: string | null;
    updatedAt: string;
  }>;
  recentCron?: Array<{ id: string; job: string; requestId: string | null; createdAt: string }>;
};

export async function getAssistantHealthSnapshot() {
  return invoke<AssistantHealthSnapshot>("admin-assistant-health", { body: {} });
}

export type OpenRouterRequestLogResp = {
  ok: true;
  rows: Array<Record<string, unknown>>;
  next_before: string | null;
};

export async function getOpenRouterRequestLog(payload?: { limit?: number; before?: string | null; request_id?: string | null; fn?: string | null }) {
  return invoke<OpenRouterRequestLogResp>("admin-openrouter-requests", { body: { ...(payload ?? {}) } });
}

/* =========================
 * App Settings (non-secret)
 * ======================= */

export type AppSettingsRow = {
  key: string;
  scope: "public" | "admin" | "server_only" | string;
  value: any;
  version?: number | null;
  updated_at?: string | null;
  updated_by?: string | null;
  description?: string | null;
};

export type AppSettingsRegistryEntry = {
  scope: "public" | "admin" | "server_only";
  default: any;
  description: string;
  meta?:
    | { kind: "number"; int?: boolean; min?: number; max?: number }
    | { kind: "string"; minLength?: number; maxLength?: number }
    | { kind: "boolean" }
    | { kind: "enum"; values: string[] }
    | { kind: "json" };
};

export type AdminAppSettingsGetResp = {
  ok: true;
  version: number;
  rows: AppSettingsRow[];
  registry: Record<string, AppSettingsRegistryEntry>;
  favorites?: string[];
  favorites_storage?: "db" | "fallback";
  actor?: { userId: string; email?: string | null; role?: string | null };
};

export async function getAppSettings() {
  return invoke<AdminAppSettingsGetResp>("admin-app-settings", { body: { action: "get" } });
}



/* =========================
 * Settings Favorites (server-backed)
 * ======================= */

export async function setAppSettingsFavorites(payload: { favorites: string[] }) {
  return invoke<{ ok: true; favorites: string[]; favorites_storage?: "db" | "fallback" }>("admin-app-settings", {
    body: { action: "favorites_set", favorites: payload.favorites },
  });
}

export async function getAppSettingsFavorites() {
  return invoke<{ ok: true; favorites: string[]; favorites_storage?: "db" | "fallback" }>("admin-app-settings", { body: { action: "favorites_get" } });
}

export async function updateAppSettings(payload: { expected_version?: number; updates: Record<string, any>; reason?: string }) {
  return invoke<{ ok: true; version: number; updated_keys: string[]; deleted_keys?: string[]; same_keys?: string[]; ignored_default_keys?: string[] }>("admin-app-settings", {
    body: {
      action: "update",
      expected_version: payload.expected_version,
      updates: payload.updates,
      reason: payload.reason,
    },
  });
}

export type AppSettingsHistoryRow = {
  id: number;
  key: string;
  scope: string;
  old_value: any;
  new_value: any;
  old_version: number | null;
  new_version: number | null;
  change_reason: string | null;
  request_id: string | null;
  changed_at: string;
  changed_by: string | null;
};

export async function getAppSettingsHistory(payload?: { key?: string; limit?: number; since?: string }) {
  return invoke<{ ok: true; rows: AppSettingsHistoryRow[] }>("admin-app-settings", {
    body: { action: "history", ...(payload ?? {}) },
  });
}

export type AppSettingsExportBundleV1 = {
  format: "movinesta_app_settings_bundle_v1";
  exported_at: string;
  version: number;
  scopes: Array<"public" | "admin" | "server_only">;
  settings: Record<string, any>;
};

export async function exportAppSettings(payload?: { scopes?: Array<"public" | "admin" | "server_only">; include_registry?: boolean }) {
  return invoke<{ ok: true; bundle: AppSettingsExportBundleV1; skipped_unregistered?: string[] }>("admin-app-settings", {
    body: { action: "export", ...(payload ?? {}) },
  });
}

export type AppSettingsImportPreview = {
  requestedScopes: Array<"public" | "admin" | "server_only">;
  counts: { add: number; update: number; same: number; delete: number; skipped_scope: number; skipped_unknown: number };
  adds: string[];
  updates: string[];
  deletes: string[];
  skipped_scope: string[];
  skipped_unknown: string[];
  version: number;
};

export async function importAppSettings(payload: {
  mode: "dry_run" | "apply";
  bundle: any;
  scopes?: Array<"public" | "admin" | "server_only">;
  expected_version?: number;
  reason?: string;
  delete_missing?: boolean;
}) {
  return invoke<{ ok: true; preview: AppSettingsImportPreview; version?: number; request_id?: string }>("admin-app-settings", {
    body: { action: "import", ...(payload ?? {}) },
  });
}

/* =========================
 * App Settings Presets
 * ======================= */

export type AppSettingsPresetRow = {
  id: number;
  slug: string;
  title: string;
  description: string;
  group_key: string;
  preset: Record<string, any>;
  is_builtin: boolean;
  created_at: string;
  updated_at: string;
};

export type AppSettingsPresetListResp = {
  ok: true;
  presets: AppSettingsPresetRow[];
  presets_storage?: "db" | "fallback";
  actor?: { userId: string; email?: string | null; role?: string | null };
};

export async function getAppSettingsPresets() {
  return invoke<AppSettingsPresetListResp>("admin-app-settings", { body: { action: "presets_list" } });
}

export type AppSettingsPresetPreview = {
  counts: {
    update: number;
    reset: number;
    same: number;
    already_default: number;
    unknown: number;
    invalid: number;
  };
  changes: Array<{
    key: string;
    scope: string;
    change_type: "update" | "reset" | "same" | "already_default";
    current: any;
    target: any;
    had_override: boolean;
  }>;
  unknown_keys: string[];
  invalid_values: Array<{ key: string; message: string }>;
};

export type AppSettingsPresetPreviewResp = {
  ok: true;
  presets_storage: "db" | "fallback";
  preset: AppSettingsPresetRow | null;
  version?: number;
  preview: AppSettingsPresetPreview | null;
  message?: string;
  actor?: { userId: string; email?: string | null; role?: string | null };
};

export async function previewAppSettingsPreset(payload: { slug: string }) {
  return invoke<AppSettingsPresetPreviewResp>("admin-app-settings", { body: { action: "presets_preview", ...payload } });
}

export type AppSettingsPresetApplyResp = {
  ok: true;
  version: number;
  preset_slug: string;
  updated_keys: string[];
  deleted_keys: string[];
  same_keys: string[];
  ignored_default_keys: string[];
  ignored_unknown_keys?: string[];
  request_id?: string;
};

export async function applyAppSettingsPreset(payload: { slug: string; expected_version?: number; reason: string }) {
  return invoke<AppSettingsPresetApplyResp>("admin-app-settings", {
    body: { action: "presets_apply", ...payload },
  });
}

export async function listOpsAlerts(limit = 50): Promise<{ ok: true; alerts: OpsAlert[] }> {
  return invoke("admin-ops-alerts", { body: { action: "list", limit } });
}

export async function resolveOpsAlert(id: number, reason?: string): Promise<{ ok: true; resolved: boolean }> {
  return invoke("admin-ops-alerts", { body: { action: "resolve", id, reason: reason ?? null } });
}

export async function resolveAllOpsAlerts(reason?: string): Promise<{ ok: true; resolved_count: number }> {
  return invoke("admin-ops-alerts", { body: { action: "resolve_all", reason: reason ?? null } });
}


export type RecVariantMetricRow = {
  day: string;
  experiment_key: string;
  variant: string;
  impressions: number;
  users: number;
  detail_opens: number;
  likes: number;
  dislikes: number;
  watchlist_adds: number;
  ratings: number;
  like_rate: number | null;
  watchlist_add_rate: number | null;
};

export type RecVariantMetricsResp = { ok: true; since: string; days: number; rows: RecVariantMetricRow[] };

export async function getRecVariantMetrics(payload?: { days?: number }) {
  return invoke<RecVariantMetricsResp>("admin-rec-variant-metrics", { body: payload ?? {} });
}

/* =========================
 * Recsys Control Center
 * ======================= */

export type RecSourceMetricRow = {
  day: string;
  mode: string;
  source: string;
  impressions: number;
  users: number;
  detail_opens: number;
  likes: number;
  dislikes: number;
  watchlist_adds: number;
  ratings: number;
  like_rate: number | null;
  watchlist_add_rate: number | null;
};

export type RecCompositionMetricsResp = { ok: true; since: string; days: number; rows: RecSourceMetricRow[] };

export async function getRecCompositionMetrics(payload?: { days?: number; mode?: string | null; source?: string | null }) {
  return invoke<RecCompositionMetricsResp>("admin-rec-composition-metrics", { body: payload ?? {} });
}

export type RecGenreMetricRow = {
  day: string;
  genre_slug: string;
  impressions: number;
  users: number;
  share_day: number | null;
  share_catalog: number | null;
  muted_impressions: number;
};

export type RecGenreMetricsResp = { ok: true; since: string; days: number; rows: RecGenreMetricRow[] };

export async function getRecGenreMetrics(payload?: { days?: number; genre_slug?: string | null }) {
  return invoke<RecGenreMetricsResp>("admin-rec-genre-metrics", { body: payload ?? {} });
}

export type RecHealthMetricRow = {
  day: string;
  decks: number;
  impressions: number;
  users: number;
  cf_impressions: number;
  seg_pop_impressions: number;
  friends_impressions: number;
  trending_impressions: number;
  for_you_impressions: number;
  impressions_in_mix_decks: number;
  impressions_in_blend_decks: number;
  impressions_in_diversity_decks: number;
};

export type RecPositionMetricRow = {
  day: string;
  position: number;
  impressions: number;
  likes: number;
  dislikes: number;
  watchlist_adds: number;
  detail_opens: number;
  like_rate: number | null;
  dislike_rate: number | null;
};

export type RecPositionMetricsResp = { ok: true; since: string; days: number; max_position: number; rows: RecPositionMetricRow[] };


export type RecHealthMetricsResp = { ok: true; since: string; days: number; rows: RecHealthMetricRow[] };

export async function getRecHealthMetrics(payload?: { days?: number }) {
  return invoke<RecHealthMetricsResp>("admin-rec-health-metrics", { body: payload ?? {} });
}

export async function getRecPositionMetrics(params: { days?: number; max_position?: number }) {
  return invoke<RecPositionMetricsResp>("admin-rec-position-metrics", {
    body: { days: params.days, max_position: params.max_position },
  });
}

export type RecAlertsDailyMetricRow = {
  day: string;
  impressions: number;
  likes: number;
  dislikes: number;
  watchlist_adds: number;
  detail_opens: number;
  cf_impressions: number;
  muted_impressions: number;
  like_rate: number;
  dislike_rate: number;
  watchlist_rate: number;
  detail_open_rate: number;
  cf_share: number;
  like_rate_7d_avg: number | null;
  watchlist_rate_7d_avg: number | null;
  alert_muted_leakage: boolean;
  alert_like_rate_drop: boolean;
  alert_watchlist_rate_drop: boolean;
  alert_cf_starvation: boolean;
};

export type RecActiveAlertRow = {
  day: string;
  alert_key: string;
  severity: "high" | "medium" | "low";
  message: string;
};

export type RecAlertsMetricsResponse = {
  ok: true;
  since: string;
  days: number;
  daily: RecAlertsDailyMetricRow[];
  alerts: RecActiveAlertRow[];
};

export async function getRecAlertsMetrics(params: { days?: number } = {}): Promise<RecAlertsMetricsResponse> {
  return invoke<RecAlertsMetricsResponse>("admin-rec-alerts-metrics", { body: { days: params.days } });
}

export type RecsysDiagnosticsRow = {
  window_start: string;
  total_impressions: number;
  missing_experiments: number;
  missing_ratio: number;
  outcomes_without_impression: number;
};

export type RecsysDiagnosticsResp = { ok: true; row: RecsysDiagnosticsRow | null };

export async function getRecsysDiagnostics() {
  return invoke<RecsysDiagnosticsResp>("admin-recsys-diagnostics", { body: {} });
}

export type RecsysExperimentAssignmentCountRow = {
  experiment_key: string;
  variant: string;
  assignments: number;
};

export type RecsysExperimentAssignmentCountsResp = { ok: true; rows: RecsysExperimentAssignmentCountRow[] };

export async function getRecsysExperimentAssignmentCounts() {
  return invoke<RecsysExperimentAssignmentCountsResp>("admin-recsys-experiments-metrics", { body: {} });
}

/* =========================
 * Recsys Experiments (Admin)
 * ======================= */

export type RecsysExperimentVariant = {
  name: string;
  weight: number;
};

export type RecsysExperimentRow = {
  id: string;
  key: string;
  description?: string | null;
  status: string;
  variants?: RecsysExperimentVariant[] | null;
  salt?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type RecsysExperimentsResp = { ok: true; rows: RecsysExperimentRow[] };

export async function getRecsysExperiments() {
  return invoke<RecsysExperimentsResp>("admin-recsys-experiments-list", { body: {} });
}

export async function upsertRecsysExperiment(payload: {
  key: string;
  description?: string | null;
  status: "draft" | "active" | "ended";
  started_at?: string | null;
  ended_at?: string | null;
  variants: RecsysExperimentVariant[];
  salt?: string | null;
}) {
  return invoke<{ ok: true }>("admin-recsys-experiments-upsert", { body: payload });
}

export async function activateRecsysExperiment(payload: { key: string }) {
  return invoke<{ ok: true }>("admin-recsys-experiments-activate", { body: payload });
}

export async function endRecsysExperiment(payload: { key: string }) {
  return invoke<{ ok: true }>("admin-recsys-experiments-end", { body: payload });
}

export type RecsysAssignmentRow = {
  user_id: string;
  experiment_key: string;
  variant: string;
  assignment_mode?: string | null;
  available_variants?: string[];
};

export type RecsysAssignmentsResp = { ok: true; rows: RecsysAssignmentRow[] };

export async function getRecsysAssignments(payload: { user: string }) {
  return invoke<RecsysAssignmentsResp>("admin-recsys-assignments-get", { body: payload });
}

export async function setRecsysAssignment(payload: { experiment_key: string; user_id: string; variant: string }) {
  return invoke<{ ok: true }>("admin-recsys-assignments-set", { body: payload });
}

export async function resetRecsysAssignment(payload: { experiment_key: string; user_id: string }) {
  return invoke<{ ok: true }>("admin-recsys-assignments-reset", { body: payload });
}
