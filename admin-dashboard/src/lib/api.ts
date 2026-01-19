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


// Cursor helpers (stable pagination)
// We prefer cursor-based pagination over offset for large tables.
// Cursor is a base64url-encoded JSON object: { t: <timestamp>, id: <uuid> }

type Cursor = { t: string; id: string };

function base64UrlEncodeUtf8(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecodeUtf8(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
  const bin = atob(b64 + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function encodeCursor(c: Cursor | null): string | null {
  if (!c) return null;
  try {
    const t = String(c.t ?? "").trim();
    const id = String(c.id ?? "").trim();
    if (!t || !id) return null;
    return base64UrlEncodeUtf8(JSON.stringify({ t, id }));
  } catch {
    return null;
  }
}

function decodeCursor(s: unknown): Cursor | null {
  const raw = String(s ?? "").trim();
  if (!raw) return null;
  try {
    const j = JSON.parse(base64UrlDecodeUtf8(raw));
    const t = String(j?.t ?? "").trim();
    const id = String(j?.id ?? "").trim();
    if (!t || !id) return null;
    return { t, id };
  } catch {
    return null;
  }
}

type DiagnosticsReadSource = "auto" | "direct" | "edge";

const DIAGNOSTICS_READ_SOURCE_DEFAULT_KEY = "admin.diagnostics.read_source_default";
const DIAGNOSTICS_READ_SOURCE_OVERRIDES_KEY = "admin.diagnostics.read_source_overrides";

let diagnosticsReadSourceCache:
  | { fetchedAt: number; value: { defaultSource: DiagnosticsReadSource; overrides: Record<string, DiagnosticsReadSource> } }
  | null = null;

function normalizeDiagnosticsReadSource(v: unknown): DiagnosticsReadSource {
  const s = String(v ?? "").toLowerCase().trim();
  if (s === "direct" || s === "edge" || s === "auto") return s as DiagnosticsReadSource;
  return "auto";
}

function normalizeDiagnosticsReadSourceOverrides(v: unknown): Record<string, DiagnosticsReadSource> {
  if (!v || typeof v !== "object") return {};
  const out: Record<string, DiagnosticsReadSource> = {};
  for (const [k, val] of Object.entries(v as any)) {
    const key = String(k ?? "").trim();
    if (!key) continue;
    out[key] = normalizeDiagnosticsReadSource(val);
  }
  return out;
}

async function getDiagnosticsReadSource(area: string): Promise<DiagnosticsReadSource> {
  const now = Date.now();
  const ttlMs = 30_000;

  if (diagnosticsReadSourceCache && now - diagnosticsReadSourceCache.fetchedAt <= ttlMs) {
    const cached = diagnosticsReadSourceCache.value;
    return cached.overrides[area] ?? cached.defaultSource;
  }

  const fallback = { defaultSource: "auto" as DiagnosticsReadSource, overrides: {} as Record<string, DiagnosticsReadSource> };

  try {
    const resp = await getAppSettings();
    const rows = Array.isArray((resp as any)?.rows) ? (resp as any).rows : [];

    const byKey = new Map<string, any>();
    for (const r of rows) {
      const k = String((r as any)?.key ?? "");
      byKey.set(k, (r as any)?.value);
    }

    const defaultSource = normalizeDiagnosticsReadSource(byKey.get(DIAGNOSTICS_READ_SOURCE_DEFAULT_KEY) ?? "auto");
    const overrides = normalizeDiagnosticsReadSourceOverrides(byKey.get(DIAGNOSTICS_READ_SOURCE_OVERRIDES_KEY));

    diagnosticsReadSourceCache = { fetchedAt: now, value: { defaultSource, overrides } };
    return overrides[area] ?? defaultSource;
  } catch {
    diagnosticsReadSourceCache = { fetchedAt: now, value: fallback };
    return fallback.overrides[area] ?? fallback.defaultSource;
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

  // Always attach an explicit Bearer token so Edge Functions never fail due to missing auth headers.
  // Some environments can be finicky about header merging in wrapped clients.
  let { data: sessionData } = await supabase.auth.getSession();
  let accessToken = sessionData?.session?.access_token ?? null;

  // Proactively refresh when the token is about to expire.
  const expSec = sessionData?.session?.expires_at ?? null;
  if (typeof expSec === "number") {
    const expMs = expSec * 1000;
    if (expMs - Date.now() <= 30_000) {
      const refreshed = await supabase.auth.refreshSession().catch(() => null);
      accessToken = refreshed?.data?.session?.access_token ?? accessToken;
    }
  }

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

  async function doFetch(): Promise<Response> {
    return await fetch(url, { method, headers, body });
  }

  let res: Response;
  try {
    res = await doFetch();
  } catch (e: any) {
    throw new AdminApiError(e?.message ?? "Network error", { code: "NETWORK_ERROR", requestId });
  }

  // If a request fails due to token expiration (401/403), refresh once and retry.
  if (res.status === 401 || res.status === 403) {
    const refreshed = await supabase.auth.refreshSession().catch(() => null);
    const next = refreshed?.data?.session?.access_token ?? null;
    if (next && next !== accessToken) {
      accessToken = next;
      headers.authorization = `Bearer ${accessToken}`;
      res = await doFetch();
    }
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

export type CronJobRunRow = {
  jobid: number;
  jobname: string;
  runid: number;
  status: string;
  return_message: string | null;
  start_time: string | null;
  end_time: string | null;
};

export type CronRunsResp = { ok: true; runs: CronJobRunRow[] };

export async function getCronJobRuns(jobname: string, limit: number = 50) {
  return invoke<CronRunsResp>("admin-jobs", { body: { action: "get_runs", jobname, limit } });
}

export async function pruneCronHistory(keep_days: number = 14) {
  return invoke<{ ok: true; deleted: number }>("admin-jobs", { body: { action: "prune_runs", keep_days } });
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

type LogsQuery = {
  limit?: number;
  before?: string | null;
  cursor?: string | null;
  /**
   * auto (default): try direct PostgREST read first, then fallback to Edge Function
   * direct: direct read only (throws on failure)
   * edge: Edge Function only
   */
  prefer_source?: "auto" | "direct" | "edge";
};

async function ensureFreshSessionForDirectReads(requestId?: string) {
  const rid =
    requestId ??
    (globalThis as any)?.crypto?.randomUUID?.() ??
    `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  let { data: sessionData } = await supabase.auth.getSession();
  const expSec = sessionData?.session?.expires_at ?? null;
  if (typeof expSec === "number") {
    const expMs = expSec * 1000;
    if (expMs - Date.now() <= 30_000) {
      await supabase.auth.refreshSession().catch(() => null);
      sessionData = (await supabase.auth.getSession()).data;
    }
  }

  if (!sessionData?.session?.access_token) {
    await supabase.auth.refreshSession().catch(() => null);
    sessionData = (await supabase.auth.getSession()).data;
  }

  if (!sessionData?.session?.access_token) {
    throw new AdminApiError("Not signed in", { code: "NO_SESSION", requestId: rid });
  }

  return sessionData;
}

async function getLogsDirect(payload?: LogsQuery): Promise<any> {
  const requestId =
    (globalThis as any)?.crypto?.randomUUID?.() ??
    `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  await ensureFreshSessionForDirectReads(requestId);

  const limit = Math.max(10, Math.min(500, Number(payload?.limit ?? 100)));
  const before = payload?.before ?? null;
  const cursor = decodeCursor(payload?.cursor);

  let q = supabase
    .from("job_run_log")
    .select("*")
    .order("started_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  if (cursor) {
    // started_at < t OR (started_at = t AND id < id)
    q = q.or(`started_at.lt.${cursor.t},and(started_at.eq.${cursor.t},id.lt.${cursor.id})`);
  } else if (before) {
    // Backward compatible cursor: started_at only.
    q = q.lt("started_at", before);
  }

  const { data, error } = await q;
  if (error) {
    throw new AdminApiError(error.message || "Direct read failed", {
      code: (error as any)?.code,
      requestId,
      details: error,
    });
  }

  const rows = Array.isArray(data) ? (data as any[]) : [];
  let next_before: string | null = null;
  let next_cursor: string | null = null;
  if (rows.length > limit) {
    const extra = rows.pop() as any;
    next_before = String(extra?.started_at ?? "") || null;
    next_cursor = encodeCursor({ t: String(extra?.started_at ?? ""), id: String(extra?.id ?? "") });
  }

  return { ok: true, rows, next_before, next_cursor };
}

export async function getLogs(payload?: LogsQuery) {
  const prefer = payload?.prefer_source ?? (await getDiagnosticsReadSource("job_run_log"));

  if (prefer !== "edge") {
    try {
      return await getLogsDirect(payload);
    } catch (err) {
      if (prefer === "direct") throw err;
      // fallback to Edge Function
    }
  }

  const { prefer_source: _ps, ...rest } = (payload ?? {}) as any;
  return invoke<any>("admin-logs", { body: { ...rest } });
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


type OpenRouterCacheCategory = "models" | "credits" | "usage" | "endpoints" | "key" | "parameters";

type OpenRouterCacheResp = {
  ok: true;
  base_url: string;
  fetched_at: string | null;
  age_seconds: number | null;
  payload: unknown | null;
};

type OpenRouterParametersResp = {
  ok: true;
  base_url: string;
  model_id: string;
  provider: string | null;
  fetched_at: string | null;
  age_seconds: number | null;
  payload: unknown | null;
};

function normalizeOpenRouterBaseUrlLoose(value?: string | null): string {
  const raw = String(value ?? "").trim();
  const fallback = raw || "https://openrouter.ai/api/v1";
  const trimmed = fallback.replace(/\/+$/, "");
  try {
    const u = new URL(trimmed);
    const path = (u.pathname || "/").replace(/\/+$/, "");
    if (path === "" || path === "/") return `${u.origin}/api/v1`;
    // If it's already /api/v1, keep it. Otherwise leave as-is (Edge Functions validate strictly).
    if (path === "/api/v1") return `${u.origin}/api/v1`;
    return `${u.origin}${path}`;
  } catch {
    return trimmed;
  }
}

async function resolveOpenRouterBaseUrlForDirectCache(override?: string | null): Promise<string> {
  const overrideTrimmed = String(override ?? "").trim();
  if (overrideTrimmed) return normalizeOpenRouterBaseUrlLoose(overrideTrimmed);

  // Best effort: read from assistant_settings (admin-only table).
  try {
    const { data } = await supabase
      .from("assistant_settings")
      .select("openrouter_base_url")
      .eq("id", 1)
      .maybeSingle();

    const stored = (data as any)?.openrouter_base_url ?? null;
    if (stored && String(stored).trim()) return normalizeOpenRouterBaseUrlLoose(String(stored));
  } catch {
    // ignore
  }

  return "https://openrouter.ai/api/v1";
}

function makeOpenRouterCacheKey(category: OpenRouterCacheCategory, baseUrl: string, ext?: string) {
  let k = `openrouter:${category}:${baseUrl}`;
  if (ext) k += `:${ext}`;
  return k;
}

async function readExternalApiCacheKey(key: string): Promise<{ fetched_at: string; value: unknown } | null> {
  const { data, error } = await supabase
    .from("external_api_cache")
    .select("fetched_at,value")
    .eq("key", key)
    .maybeSingle();

  if (error || !data) return null;
  return { fetched_at: (data as any).fetched_at, value: (data as any).value };
}

function computeAgeSeconds(fetchedAt: string | null): number | null {
  if (!fetchedAt) return null;
  const ms = Date.parse(fetchedAt);
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.floor((Date.now() - ms) / 1000));
}

async function getOpenRouterCacheDirect(category: OpenRouterCacheCategory, baseUrlOverride?: string | null): Promise<OpenRouterCacheResp> {
  const requestId =
    (globalThis as any)?.crypto?.randomUUID?.() ??
    `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  await ensureFreshSessionForDirectReads(requestId);

  const baseUrl = await resolveOpenRouterBaseUrlForDirectCache(baseUrlOverride ?? null);
  const key = makeOpenRouterCacheKey(category, baseUrl);
  const row = await readExternalApiCacheKey(key);

  if (!row?.fetched_at) {
    return { ok: true, base_url: baseUrl, fetched_at: null, age_seconds: null, payload: null };
  }

  return {
    ok: true,
    base_url: baseUrl,
    fetched_at: row.fetched_at,
    age_seconds: computeAgeSeconds(row.fetched_at),
    payload: row.value ?? null,
  };
}

async function getOpenRouterParametersDirect(payload: { model: string; provider?: string | null; base_url?: string | null }): Promise<OpenRouterParametersResp> {
  const requestId =
    (globalThis as any)?.crypto?.randomUUID?.() ??
    `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  await ensureFreshSessionForDirectReads(requestId);

  const baseUrl = await resolveOpenRouterBaseUrlForDirectCache(payload.base_url ?? null);
  const modelId = String(payload.model ?? "").trim();
  const provider = payload.provider ? String(payload.provider).trim() : "";

  const key = makeOpenRouterCacheKey("parameters", baseUrl, `${modelId}:${provider}`);
  const row = await readExternalApiCacheKey(key);

  if (!row?.fetched_at) {
    return {
      ok: true,
      base_url: baseUrl,
      model_id: modelId,
      provider: (payload.provider ? String(payload.provider).trim() : null),
      fetched_at: null,
      age_seconds: null,
      payload: null,
    };
  }

  return {
    ok: true,
    base_url: baseUrl,
    model_id: modelId,
    provider: (provider ? provider : null),
    fetched_at: row.fetched_at,
    age_seconds: computeAgeSeconds(row.fetched_at),
    payload: row.value ?? null,
  };
}

export async function getOpenRouterCredits(payload?: { base_url?: string | null; prefer_source?: "auto" | "direct" | "edge" }) {
  const prefer = payload?.prefer_source ?? (await getDiagnosticsReadSource("openrouter_cache"));
  if (prefer !== "edge") {
    try {
      return await getOpenRouterCacheDirect("credits", payload?.base_url ?? null);
    } catch (err) {
      if (prefer === "direct") throw err;
    }
  }

  const qs = payload?.base_url ? `?base_url=${encodeURIComponent(payload.base_url)}` : "";
  return invoke<any>(`admin-openrouter-credits${qs}`, { method: "GET" });
}

export async function getOpenRouterKey(payload?: { base_url?: string | null; prefer_source?: "auto" | "direct" | "edge" }) {
  const prefer = payload?.prefer_source ?? (await getDiagnosticsReadSource("openrouter_cache"));
  if (prefer !== "edge") {
    try {
      return await getOpenRouterCacheDirect("key", payload?.base_url ?? null);
    } catch (err) {
      if (prefer === "direct") throw err;
    }
  }

  const qs = payload?.base_url ? `?base_url=${encodeURIComponent(payload.base_url)}` : "";
  return invoke<any>(`admin-openrouter-key${qs}`, { method: "GET" });
}

export async function getOpenRouterUsage(payload?: { base_url?: string | null; prefer_source?: "auto" | "direct" | "edge" }) {
  const prefer = payload?.prefer_source ?? (await getDiagnosticsReadSource("openrouter_cache"));
  if (prefer !== "edge") {
    try {
      return await getOpenRouterCacheDirect("usage", payload?.base_url ?? null);
    } catch (err) {
      if (prefer === "direct") throw err;
    }
  }

  const qs = payload?.base_url ? `?base_url=${encodeURIComponent(payload.base_url)}` : "";
  return invoke<any>(`admin-openrouter-usage${qs}`, { method: "GET" });
}


export async function getOpenRouterModels(payload?: { base_url?: string | null; prefer_source?: "auto" | "direct" | "edge" }) {
  const prefer = payload?.prefer_source ?? (await getDiagnosticsReadSource("openrouter_cache"));
  if (prefer !== "edge") {
    try {
      return await getOpenRouterCacheDirect("models", payload?.base_url ?? null);
    } catch (err) {
      if (prefer === "direct") throw err;
    }
  }

  const qs = payload?.base_url ? `?base_url=${encodeURIComponent(payload.base_url)}` : "";
  return invoke<any>(`admin-openrouter-models${qs}`, { method: "GET" });
}

export async function getOpenRouterEndpoints(payload?: { base_url?: string | null; prefer_source?: "auto" | "direct" | "edge" }) {
  const prefer = payload?.prefer_source ?? (await getDiagnosticsReadSource("openrouter_cache"));
  if (prefer !== "edge") {
    try {
      return await getOpenRouterCacheDirect("endpoints", payload?.base_url ?? null);
    } catch (err) {
      if (prefer === "direct") throw err;
    }
  }

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


export type OpenRouterCircuit = {
  model: string;
  isOpen: boolean;
  openUntil: string | null;
  failureStreak: number;
  lastStatus: number | null;
  lastError: string | null;
  updatedAt: string | null;
};

function parseMaybeStatus(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (!/^[0-9]{3}$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function normalizeCircuitRow(row: any, nowMs: number): OpenRouterCircuit | null {
  const model = String(row?.model ?? "").trim();
  if (!model) return null;

  const openUntil = (row?.open_until ?? row?.openUntil ?? null) as string | null;
  const openMs = openUntil ? Date.parse(String(openUntil)) : NaN;
  const isOpen = Number.isFinite(openMs) ? openMs > nowMs : false;

  const failureCount = Number(row?.failure_count ?? row?.failureCount ?? row?.failure_streak ?? row?.failureStreak ?? 0);
  const failureStreak = Number.isFinite(failureCount) ? Math.trunc(failureCount) : 0;

  const lastStatus =
    row?.last_status !== undefined || row?.lastStatus !== undefined
      ? parseMaybeStatus(row?.last_status ?? row?.lastStatus)
      : parseMaybeStatus(row?.last_error_code ?? row?.lastErrorCode);

  const lastError = (row?.last_error ?? row?.lastError ?? row?.last_error_message ?? row?.lastErrorMessage ?? null) as
    | string
    | null;

  const updatedAt = (row?.updated_at ?? row?.updatedAt ?? null) as string | null;

  return { model, isOpen, openUntil, failureStreak, lastStatus, lastError, updatedAt };
}

async function getOpenRouterCircuitsDirect(payload?: { limit?: number | null; include_closed?: boolean | null }) {
  await ensureFreshSessionForDirectReads();

  const limitRaw = Number(payload?.limit ?? 200);
  const limit = Number.isFinite(limitRaw) ? Math.max(10, Math.min(500, Math.trunc(limitRaw))) : 200;
  const includeClosed = Boolean(payload?.include_closed ?? false);

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  let q = supabase
    .from("openrouter_circuit_breakers")
    .select("model,failure_count,open_until,last_error_code,last_error_message,updated_at")
    .limit(limit);

  if (!includeClosed) {
    q = q.gt("open_until", nowIso);
  }

  const { data, error } = await q;
  if (error) throw error;

  const rows = (Array.isArray(data) ? data : [])
    .map((r) => normalizeCircuitRow(r, nowMs))
    .filter(Boolean) as OpenRouterCircuit[];

  rows.sort((a, b) => {
    const ao = a.isOpen ? 1 : 0;
    const bo = b.isOpen ? 1 : 0;
    if (ao !== bo) return bo - ao;
    const at = Date.parse(String(a.updatedAt ?? "")) || 0;
    const bt = Date.parse(String(b.updatedAt ?? "")) || 0;
    return bt - at;
  });

  return { ok: true as const, rows };
}

export async function getOpenRouterCircuits(payload?: {
  limit?: number | null;
  include_closed?: boolean | null;
  prefer_source?: "auto" | "direct" | "edge";
}) {
  const prefer = payload?.prefer_source ?? (await getDiagnosticsReadSource("openrouter_circuit_breakers"));
  if (prefer !== "edge") {
    try {
      return await getOpenRouterCircuitsDirect(payload);
    } catch (err) {
      if (prefer === "direct") throw err;
    }
  }

  const limitRaw = Number(payload?.limit ?? 200);
  const limit = Number.isFinite(limitRaw) ? Math.max(10, Math.min(500, Math.trunc(limitRaw))) : 200;

  const resp: any = await invoke<any>("admin-openrouter-circuit", { body: { action: "list", limit } });
  const nowMs = Date.now();
  const rawRows = Array.isArray(resp?.rows) ? resp.rows : Array.isArray(resp?.data?.rows) ? resp.data.rows : [];

  const rows = rawRows
    .map((r: any) => {
      // Edge function uses snake_case, but we normalize for the UI.
      return normalizeCircuitRow(r, nowMs);
    })
    .filter(Boolean) as OpenRouterCircuit[];

  // If caller wants closed circuits too, keep all; otherwise keep open only.
  const includeClosed = Boolean(payload?.include_closed ?? false);
  const filtered = includeClosed ? rows : rows.filter((r) => r.isOpen);

  filtered.sort((a, b) => {
    const ao = a.isOpen ? 1 : 0;
    const bo = b.isOpen ? 1 : 0;
    if (ao !== bo) return bo - ao;
    const at = Date.parse(String(a.updatedAt ?? "")) || 0;
    const bt = Date.parse(String(b.updatedAt ?? "")) || 0;
    return bt - at;
  });

  return { ok: true as const, rows: filtered };
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

export async function getOpenRouterParameters(payload: { model: string; provider?: string | null; base_url?: string | null; prefer_source?: "auto" | "direct" | "edge" }) {
  const prefer = (payload as any)?.prefer_source ?? "auto";
  if (prefer !== "edge") {
    try {
      return await getOpenRouterParametersDirect(payload);
    } catch (err) {
      if (prefer === "direct") throw err;
    }
  }

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
  next_cursor?: string | null;
};

type OpenRouterRequestLogQuery = {
  limit?: number;
  before?: string | null;
  cursor?: string | null;
  request_id?: string | null;
  fn?: string | null;
  /**
   * auto (default): try direct PostgREST read first, then fallback to Edge Function
   * direct: direct read only (throws on failure)
   * edge: Edge Function only
   */
  prefer_source?: "auto" | "direct" | "edge";
  /**
   * If you want server-side enrichment/backfill (generation stats), force Edge.
   * These are forwarded to the Edge Function unchanged.
   */
  enrich_generation_stats?: boolean;
  enrich_limit?: number;
  enrich_timeout_ms?: number;
};

async function getOpenRouterRequestLogDirect(payload?: OpenRouterRequestLogQuery): Promise<OpenRouterRequestLogResp> {
  // Keep the token fresh to reduce intermittent 401/403 when the dashboard has been open for a while.
  const requestId =
    (globalThis as any)?.crypto?.randomUUID?.() ??
    `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  let { data: sessionData } = await supabase.auth.getSession();
  const expSec = sessionData?.session?.expires_at ?? null;
  if (typeof expSec === "number") {
    const expMs = expSec * 1000;
    if (expMs - Date.now() <= 30_000) {
      await supabase.auth.refreshSession().catch(() => null);
      sessionData = (await supabase.auth.getSession()).data;
    }
  }

  if (!sessionData?.session?.access_token) {
    // Try one refresh.
    await supabase.auth.refreshSession().catch(() => null);
    sessionData = (await supabase.auth.getSession()).data;
  }

  if (!sessionData?.session?.access_token) {
    throw new AdminApiError("Not signed in", { code: "NO_SESSION", requestId });
  }

  const limit = Math.max(1, Math.min(500, Number(payload?.limit ?? 50)));

  // Fetch limit+1 to compute next cursor.
  let q = supabase
    .from("openrouter_request_log")
    .select("*")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  const cursor = decodeCursor(payload?.cursor);
  const before = payload?.before ?? null;
  if (cursor) {
    // created_at < t OR (created_at = t AND id < id)
    q = q.or(`created_at.lt.${cursor.t},and(created_at.eq.${cursor.t},id.lt.${cursor.id})`);
  } else if (before) {
    // Backward compatible cursor: created_at only.
    q = q.lt("created_at", before);
  }

  const requestIdFilter = payload?.request_id ?? null;
  if (requestIdFilter) q = q.eq("request_id", requestIdFilter);

  const fnFilter = payload?.fn ?? null;
  if (fnFilter) q = q.eq("fn", fnFilter);

  const { data, error } = await q;
  if (error) {
    // Surface as a consistent error so callers can decide to fallback.
    throw new AdminApiError(error.message || "Direct read failed", {
      code: (error as any)?.code,
      requestId,
      details: error,
    });
  }

  const rows = Array.isArray(data) ? (data as any[]) : [];
  const hasMore = rows.length > limit;
  const sliced = hasMore ? rows.slice(0, limit) : rows;
  const extra = hasMore ? (rows[limit] as any) : null;
  const next_before = hasMore ? (extra?.created_at ?? null) : null;
  const next_cursor = hasMore ? encodeCursor({ t: String(extra?.created_at ?? ""), id: String(extra?.id ?? "") }) : null;

  return { ok: true, rows: sliced as any, next_before, next_cursor };
}

export async function getOpenRouterRequestLog(payload?: OpenRouterRequestLogQuery) {
  const prefer = payload?.prefer_source ?? (await getDiagnosticsReadSource("openrouter_request_log"));
  const wantsEnrich = Boolean(payload?.enrich_generation_stats);

  // If caller wants enrichment, always use Edge Function.
  if (!wantsEnrich && prefer !== "edge") {
    try {
      return await getOpenRouterRequestLogDirect(payload);
    } catch (err) {
      if (prefer === "direct") throw err;
      // Fall through to Edge Function fallback.
    }
  }

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
  const prefer = await getDiagnosticsReadSource("ops_alerts");

  // Prefer direct DB reads when possible (admin RLS), but fall back to the Edge Function.
  if (prefer !== "edge") {
    try {
      await ensureFreshSessionForDirectReads();

      const limitRaw = Number(limit ?? 50);
      const lim = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, Math.trunc(limitRaw))) : 50;

      const { data, error } = await supabase
        .from("ops_alerts")
        .select(
          "id,kind,severity,title,detail,source,dedupe_key,meta,resolved_at,resolved_by,resolved_reason,created_at,updated_at",
        )
        .is("resolved_at", null)
        .limit(lim);

      if (!error && Array.isArray(data)) {
        const weight = (sev: unknown) => {
          const s = String(sev ?? "").toLowerCase();
          if (s === "critical") return 1;
          if (s === "warn") return 2;
          return 3;
        };

        const alerts = [...data].sort((a: any, b: any) => {
          const aw = weight(a?.severity);
          const bw = weight(b?.severity);
          if (aw != bw) return aw - bw;
          const at = Date.parse(String(a?.created_at ?? "")) || 0;
          const bt = Date.parse(String(b?.created_at ?? "")) || 0;
          return bt - at;
        }) as any as OpsAlert[];

        return { ok: true, alerts };
      }

      // Treat unexpected direct-read shapes as failures for 'direct'.
      if (prefer === "direct") {
        throw new AdminApiError("Direct read returned no data", { code: "DIRECT_EMPTY" });
      }
    } catch (err) {
      if (prefer === "direct") throw err;
      // fall through to edge
    }
  }

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

export type RecJoinIntegrityRow = {
  day: string;
  impressions: number;
  impressions_invalid_dedupe_key: number;
  impressions_with_event_same_day: number;
  events: number;
  events_missing_served_dedupe_key: number;
  events_invalid_served_dedupe_key: number;
  events_invalid_dedupe_key: number;
  events_missing_rec_request_id: number;
  events_missing_deck_id: number;
  events_missing_position: number;
  events_joined_to_impression: number;
  events_without_impression: number;
  event_unjoinable_rate: number | null;
};

export type RecJoinIntegrityByEventRow = {
  day: string;
  event_type: string;
  source: string | null;
  events: number;
  events_missing_served_dedupe_key: number;
  events_invalid_served_dedupe_key: number;
  events_invalid_dedupe_key: number;
  events_missing_rec_request_id: number;
  events_missing_deck_id: number;
  events_missing_position: number;
  events_joined_to_impression: number;
  events_without_impression: number;
  event_unjoinable_rate: number | null;
};

export type RecJoinIntegrityResp = {
  ok: true;
  since: string;
  days: number;
  daily: RecJoinIntegrityRow[];
  by_event: RecJoinIntegrityByEventRow[];
};

export async function getRecJoinIntegrity(params?: { days?: number; include_by_event?: boolean }) {
  return invoke<RecJoinIntegrityResp>("admin-rec-join-integrity", { body: params ?? {} });
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


// --- Swipe ingest health (from media-swipe-event rollups) ---

export type SwipeIngestHourlyRow = {
  bucket_start: string;
  requests: number;
  accepted_events: number;
  rejected_events: number;
  retry_events: number;
  rejection_rate: number | null;
  retry_rate: number | null;
  sample_rate: number;
  updated_at: string;
};

export type SwipeIngestIssueTotalRow = { code: string; count: number };

export type SwipeIngestHealthResp = {
  ok: true;
  since: string;
  hours: number;
  hourly: SwipeIngestHourlyRow[];
  issues: SwipeIngestIssueTotalRow[];
};

export async function getSwipeIngestHealth(params: { hours?: number; top_n?: number } = {}) {
  return invoke<SwipeIngestHealthResp>("admin-swipe-ingest-health", { body: { hours: params.hours, top_n: params.top_n } });
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
