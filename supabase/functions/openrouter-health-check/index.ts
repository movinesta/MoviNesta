import { serve } from "jsr:@std/http@0.224.0/server";
import { json, jsonError } from "../_shared/admin.ts";
import { getConfig } from "../_shared/config.ts";
import { getAdminClient } from "../_shared/supabase.ts";
import { safeInsertJobRunLog } from "../_shared/joblog.ts";
import { loadAppSettingsForScopes } from "../_shared/appSettings.ts";

type Body = { source?: string | null };

function toNumber(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function minutesSince(tsIso: string | null | undefined): number | null {
  if (!tsIso) return null;
  const ms = Date.now() - new Date(tsIso).getTime();
  if (!Number.isFinite(ms)) return null;
  return ms / 60000;
}

serve(async (req) => {
  const startedAt = new Date().toISOString();
  const jobName = "openrouter-health-check";
  let ok = true;
  let error_code: string | null = null;
  let error_message: string | null = null;

  try {
    const cfg = getConfig();
    const token = req.headers.get("x-job-token") ?? "";
    if (!cfg.internalJobToken || token !== cfg.internalJobToken) {
      return json(req, 401, { ok: false, error: "Unauthorized" });
    }

    const body = (await req.json().catch(() => ({}))) as Body;

    const svc = getAdminClient();
    const settingsEnv = await loadAppSettingsForScopes(svc as any, ["server_only", "admin"]);
    const s = (settingsEnv?.settings ?? {}) as Record<string, any>;

    const enabled = Boolean(s["ops.openrouter.health_check.enabled"] ?? true);
    if (!enabled) {
      return json(req, 200, { ok: true, skipped: true, reason: "disabled" });
    }

    const cacheStaleMinutes = Math.max(1, Number(s["ops.openrouter.health_check.cache_stale_minutes"] ?? 90));
    const minCreditsRemaining = Number(s["ops.openrouter.health_check.min_credits_remaining"] ?? 2);
    const minKeyLimitRemaining = Number(s["ops.openrouter.health_check.min_key_limit_remaining"] ?? 10);
    const maxOpenCircuits = Math.max(0, Number(s["ops.openrouter.health_check.max_open_circuits"] ?? 3));
    const autoResolve = Boolean(s["ops.openrouter.health_check.auto_resolve"] ?? true);

    // Fetch latest caches
    const { data: creditsRow } = await svc
      .from("external_api_cache")
      .select("fetched_at, value")
      .eq("provider", "openrouter")
      .eq("category", "credits")
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: keyRow } = await svc
      .from("external_api_cache")
      .select("fetched_at, value")
      .eq("provider", "openrouter")
      .eq("category", "key")
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const creditsFetchedAt = creditsRow?.fetched_at ?? null;
    const keyFetchedAt = keyRow?.fetched_at ?? null;

    const creditsMinutes = minutesSince(creditsFetchedAt);
    const keyMinutes = minutesSince(keyFetchedAt);

    const creditsIsStale = creditsMinutes === null || creditsMinutes > cacheStaleMinutes;
    const keyIsStale = keyMinutes === null || keyMinutes > cacheStaleMinutes;

    const creditsPayload = (creditsRow?.value ?? {}) as any;
    const totalCredits = toNumber(creditsPayload?.data?.total_credits);
    const totalUsage = toNumber(creditsPayload?.data?.total_usage);
    const creditsRemaining = totalCredits !== null && totalUsage !== null ? totalCredits - totalUsage : null;

    const keyPayload = (keyRow?.value ?? {}) as any;
    const limitRemaining = toNumber(keyPayload?.data?.limit_remaining);

    const { count: openCircuitsCount } = await svc
      .from("openrouter_circuit_breakers")
      .select("*", { count: "exact", head: true })
      .eq("is_open", true);


    // Raise/resolve alerts via RPCs (service_role only)
    const raise = async (kind: string, dedupe: string, severity: string, title: string, detail: string, meta: any) => {
      await svc.rpc("ops_alert_raise_v1", {
        p_kind: kind,
        p_dedupe_key: dedupe,
        p_severity: severity,
        p_title: title,
        p_detail: detail,
        p_source: "openrouter-health-check",
        p_meta: meta ?? {},
      });
    };

    const resolve = async (dedupe: string, reason: string) => {
      await svc.rpc("ops_alert_resolve_by_dedupe_key_v1", {
        p_dedupe_key: dedupe,
        p_resolved_by: "system",
        p_reason: reason,
      });
    };

    // cache stale
    if (creditsIsStale || keyIsStale) {
      const detail = `OpenRouter cache stale. credits_age_min=${creditsMinutes ?? "?"}, key_age_min=${keyMinutes ?? "?"}, threshold_min=${cacheStaleMinutes}`;
      await raise(
        "openrouter_cache_stale",
        "openrouter_cache_stale",
        "warn",
        "OpenRouter cache is stale",
        detail,
        { creditsFetchedAt, keyFetchedAt, creditsMinutes, keyMinutes, cacheStaleMinutes },
      );
    } else if (autoResolve) {
      await resolve("openrouter_cache_stale", "cache fresh");
    }

    // low credits
    if (creditsRemaining !== null && creditsRemaining <= minCreditsRemaining) {
      const severity = creditsRemaining <= Math.max(0, minCreditsRemaining / 2) ? "critical" : "warn";
      const detail = `OpenRouter credits low. remaining=${creditsRemaining}, threshold=${minCreditsRemaining}`;
      await raise(
        "openrouter_low_credits",
        "openrouter_low_credits",
        severity,
        "OpenRouter credits low",
        detail,
        { creditsRemaining, minCreditsRemaining, totalCredits, totalUsage },
      );
    } else if (autoResolve) {
      await resolve("openrouter_low_credits", "credits ok");
    }

    // low key limit remaining
    if (limitRemaining !== null && limitRemaining <= minKeyLimitRemaining) {
      const severity = limitRemaining <= Math.max(0, minKeyLimitRemaining / 2) ? "critical" : "warn";
      const detail = `OpenRouter key daily limit remaining low. remaining=${limitRemaining}, threshold=${minKeyLimitRemaining}`;
      await raise(
        "openrouter_low_key_limit",
        "openrouter_low_key_limit",
        severity,
        "OpenRouter key limit low",
        detail,
        { limitRemaining, minKeyLimitRemaining },
      );
    } else if (autoResolve) {
      await resolve("openrouter_low_key_limit", "key limit ok");
    }

    // too many open circuits
    if (maxOpenCircuits > 0 && openCircuitsCount !== null && openCircuitsCount >= maxOpenCircuits) {
      const detail = `Many OpenRouter circuits are open. open=${openCircuitsCount}, threshold=${maxOpenCircuits}`;
      await raise(
        "openrouter_open_circuits_high",
        "openrouter_open_circuits_high",
        "warn",
        "Many OpenRouter circuits open",
        detail,
        { openCircuitsCount, maxOpenCircuits },
      );
    } else if (autoResolve) {
      await resolve("openrouter_open_circuits_high", "circuits ok");
    }

    return json(req, 200, {
      ok: true,
      source: body.source ?? null,
      creditsRemaining,
      limitRemaining,
      creditsFetchedAt,
      keyFetchedAt,
      creditsMinutes,
      keyMinutes,
      openCircuitsCount,
      thresholds: { cacheStaleMinutes, minCreditsRemaining, minKeyLimitRemaining, maxOpenCircuits },
      startedAt,
    });
  } catch (e: any) {
    ok = false;
    error_code = e?.name ?? "error";
    error_message = e?.message ?? String(e);
    return jsonError(req, e);
  } finally {
    try {
      const svc = getAdminClient();
      await safeInsertJobRunLog(svc as any, {
        job_name: jobName,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        ok,
        error_code,
        error_message,
      });
    } catch {
      // ignore
    }
  }
});
