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

async function parseFunctionsHttpError(error: any): Promise<AdminApiError> {
  // supabase-js errors can be:
  // - FunctionsHttpError (has `context` with response)
  // - normal Error
  // We'll try to read structured JSON error if present.
  try {
    const res = (error as any)?.context?.response;
    if (res && typeof res.json === "function") {
      const data = (await res.json().catch(() => null)) as ErrorEnvelope | null;
      if (data && data.ok === false) {
        return new AdminApiError(data.message || "Admin function error", {
          code: data.code,
          requestId: data.requestId,
          details: data.details,
        });
      }
    }
  } catch {
    // ignore
  }
  return new AdminApiError(error?.message || "Admin function error");
}

async function invoke<T>(fn: string, opts?: InvokeOpts): Promise<OkEnvelope<T>> {
  const method = opts?.method ?? "POST";

  const { data, error } = await supabase.functions.invoke(fn, {
    method,
    body: opts?.body,
  });

  if (error) {
    throw await parseFunctionsHttpError(error);
  }

  // Some functions wrap with { ok: true } — we allow either.
  if (data && typeof data === "object" && "ok" in (data as any) && (data as any).ok === false) {
    const e = data as ErrorEnvelope;
    throw new AdminApiError(e.message || "Admin function error", {
      code: e.code,
      requestId: e.requestId,
      details: e.details,
    });
  }

  return data as OkEnvelope<T>;
}

/* =========================
 * Stats
 * ======================= */

export type StatsResp = {
  ok: true;
  users_total?: number;
  users_7d?: number;
  users_30d?: number;
  titles_total?: number;
  ratings_total?: number;
  reviews_total?: number;
  watchlist_total?: number;
  vectors_total?: number;
};

export async function getStats() {
  return invoke<StatsResp>("admin-stats", { body: { action: "get" } });
}

/* =========================
 * Settings
 * ======================= */

export type SettingsResp = {
  ok: true;
  settings: {
    active_provider: string | null;
    active_model: string | null;
    active_dimensions: number | null;
    changed_at: string | null;
    changed_by: string | null;
  };
};

export async function getEmbeddingSettings() {
  return invoke<SettingsResp>("admin-settings", { body: { action: "get_embedding_settings" } });
}

export async function setEmbeddingSettings(payload: {
  active_provider: string | null;
  active_model: string | null;
  active_dimensions: number | null;
}) {
  return invoke<{ ok: true }>("admin-settings", { body: { action: "set_embedding_settings", ...payload } });
}

/* =========================
 * Audit
 * ======================= */

export type AuditRow = {
  id: string;
  created_at: string;
  admin_user_id: string;
  action: string;
  target: string;
  details: unknown;
};

export type AuditResp = {
  ok: true;
  rows: AuditRow[];
  next_before: string | null;
};

export async function getAudit(payload?: { before?: string | null; limit?: number }) {
  return invoke<AuditResp>("admin-audit", { body: { action: "get", ...(payload ?? {}) } });
}

/* =========================
 * Users
 * ======================= */

export type UsersResp = {
  ok: true;
  users: Array<{
    id: string;
    email: string | null;
    created_at: string | null;
    banned_until: string | null;
  }>;
  next_page: string | null;
};

export async function listUsers(payload?: { search?: string | null; page?: string | null }) {
  return invoke<UsersResp>("admin-users", { body: { action: "list", ...(payload ?? {}) } });
}

export async function banUser(user_id: string, banned: boolean) {
  return invoke<{ ok: true }>("admin-users", { body: { action: banned ? "ban" : "unban", user_id } });
}

export async function resetUserVectors(user_id: string) {
  return invoke<{ ok: true }>("admin-users", { body: { action: "reset_vectors", user_id } });
}
