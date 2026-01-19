import type { SupabaseClient } from "supabase";
import { loadAppSettingsForScopes } from "./appSettings.ts";

/**
 * OpenRouter circuit breaker
 *
 * Why: even with retries + model fallbacks, bursts of 429/5xx can create thundering herds.
 * We keep a small DB-backed circuit per model so callers can skip "known-bad" models for
 * a short cooldown window.
 *
 * This module is intentionally "safe by default": if the DB objects do not exist yet,
 * all helpers no-op and the request proceeds normally.
 */

export type CircuitSkipRow = {
  model: string;
  open_until: string | null;
  failure_streak: number | null;
  last_status: number | null;
  last_error: string | null;
};

function asInt(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function asString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v);
  return s.trim() ? s : null;
}

export function shouldTripCircuit(status: number | null): boolean {
  // Trip on rate limits, 5xx, and network/timeouts (status=null).
  if (status === null) return true;
  if (status === 429) return true;
  if (status >= 500 && status <= 599) return true;
  return false;
}

export async function safeCircuitGetSkipSet(
  svc: SupabaseClient,
  models: string[],
): Promise<Set<string>> {
  try {
    const cfg = await getCircuitCfg(svc);
    if (!cfg.enabled) return new Set();
    if (!Array.isArray(models) || models.length === 0) return new Set();

    const nowIso = new Date().toISOString();
    const set = new Set<string>();

    // Read directly from the DB table. This avoids reliance on optional RPC overloads
    // and keeps the circuit breaker working even if only the base schema exists.
    const CHUNK = 50;
    for (let i = 0; i < models.length; i += CHUNK) {
      const chunk = models.slice(i, i + CHUNK).filter((m) => typeof m === "string" && m.trim());
      if (chunk.length === 0) continue;

      const { data, error } = await svc
        .from("openrouter_circuit_breakers")
        .select("model,open_until")
        .in("model", chunk)
        .gt("open_until", nowIso);

      if (error || !Array.isArray(data)) continue;
      for (const row of data as any[]) {
        const m = asString((row as any)?.model);
        if (m) set.add(m);
      }
    }

    return set;
  } catch {
    return new Set();
  }
}

export async function safeCircuitOnFailure(
  svc: SupabaseClient,
  args: {
    model: string;
    status: number | null;
    error: string | null;
    retryAfterSeconds?: number | null;
  },
): Promise<void> {
  try {
    const cfg = await getCircuitCfg(svc);
    if (!cfg.enabled) return;
    const model = asString(args.model);
    if (!model) return;

    const status = asInt(args.status);
    if (!shouldTripCircuit(status)) return;

    const err = asString(args.error);
    const retryAfterSeconds = asInt(args.retryAfterSeconds);

    const openUntil =
      retryAfterSeconds && retryAfterSeconds > 0
        ? new Date(Date.now() + retryAfterSeconds * 1000).toISOString()
        : null;

    // DB RPC: openrouter_circuit_on_failure_v1(p_model text, p_error_code text, p_error_message text,
    //                                         p_threshold int, p_cooldown_seconds int, p_open_until timestamptz)
    await svc.rpc("openrouter_circuit_on_failure_v1", {
      p_model: model,
      p_error_code: status === null ? "NETWORK" : String(status),
      p_error_message: err,
      p_threshold: cfg.threshold,
      p_cooldown_seconds: cfg.cooldownSeconds,
      p_open_until: openUntil,
    });
  } catch {
    // ignore
  }
}

export async function safeCircuitOnSuccess(
  svc: SupabaseClient,
  model: string,
): Promise<void> {
  try {
    const cfg = await getCircuitCfg(svc);
    if (!cfg.enabled) return;
    const m = asString(model);
    if (!m) return;
    await svc.rpc("openrouter_circuit_on_success_v1", { p_model: m });
  } catch {
    // ignore
  }
}


type CircuitCfg = { enabled: boolean; threshold: number; cooldownSeconds: number };

let _circuitCfgCache: { value: CircuitCfg; fetchedAt: number } | null = null;
const CIRCUIT_CFG_TTL_MS = 60_000;

function clampInt(n: unknown, fallback: number, min: number, max: number): number {
  const x = typeof n === "number" ? n : typeof n === "string" ? Number(n) : NaN;
  if (!Number.isFinite(x)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(x)));
}

async function getCircuitCfg(svc: SupabaseClient): Promise<CircuitCfg> {
  const now = Date.now();
  if (_circuitCfgCache && now - _circuitCfgCache.fetchedAt < CIRCUIT_CFG_TTL_MS) return _circuitCfgCache.value;

  // Defaults match DB function defaults.
  let enabled = true;
  let threshold = 3;
  let cooldownSeconds = 30;

  try {
    const env = await loadAppSettingsForScopes(svc as any, ["server_only"], { cacheTtlMs: CIRCUIT_CFG_TTL_MS });
    const s = (env.settings ?? {}) as Record<string, unknown>;
    enabled = Boolean(s["ops.openrouter.circuit.enabled"] ?? enabled);
    threshold = clampInt(s["ops.openrouter.circuit.threshold"], threshold, 1, 20);
    cooldownSeconds = clampInt(s["ops.openrouter.circuit.cooldown_seconds"], cooldownSeconds, 5, 3600);
  } catch {
    // ignore and keep defaults
  }

  const value = { enabled, threshold, cooldownSeconds };
  _circuitCfgCache = { value, fetchedAt: now };
  return value;
}
