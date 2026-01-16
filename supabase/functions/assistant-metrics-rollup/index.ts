/// <reference path="../_shared/deno.d.ts" />
// supabase/functions/assistant-metrics-rollup/index.ts
//
// Step 7: Daily rollup of assistant_suggestions into assistant_metrics_daily.
// Security model:
// - verify_jwt = false
// - Requires x-job-token (INTERNAL_JOB_TOKEN)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { handleOptions, jsonError, jsonResponse } from "../_shared/http.ts";
import { requireInternalJob } from "../_shared/internal.ts";
import { getAdminClient } from "../_shared/supabase.ts";

const BodySchema = z
  .object({
    reason: z.string().optional(),
    day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // YYYY-MM-DD (UTC)
    dryRun: z.boolean().optional(),
  })
  .optional();

function isoDayUtc(d: Date) {
  return d.toISOString().slice(0, 10);
}

function dayRangeUtc(dayIso: string) {
  const start = new Date(`${dayIso}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

function estimateTokens(input: unknown): number {
  // Best-effort token estimator from OpenRouter usage-ish envelopes.
  // We recursively sum any numeric fields whose key includes "token".
  const seen = new Set<unknown>();
  const walk = (x: any, keyHint?: string): number => {
    if (x == null) return 0;
    if (typeof x === "number" && (keyHint?.toLowerCase().includes("token") ?? false)) return Math.max(0, Math.floor(x));
    if (typeof x !== "object") return 0;
    if (seen.has(x)) return 0;
    seen.add(x);
    let sum = 0;
    if (Array.isArray(x)) {
      for (const v of x) sum += walk(v, keyHint);
      return sum;
    }
    for (const [k, v] of Object.entries(x)) {
      if (typeof v === "number" && k.toLowerCase().includes("token")) sum += Math.max(0, Math.floor(v));
      else sum += walk(v, k);
    }
    return sum;
  };
  return walk(input);
}

serve(async (req) => {
  const cors = handleOptions(req);
  if (cors) return cors;

  const auth = requireInternalJob(req);
  if (auth) return auth;

  try {
    const body = BodySchema.parse(await req.json().catch(() => ({})));
    const dryRun = Boolean(body?.dryRun);

    const dayIso = body?.day ?? isoDayUtc(new Date(Date.now() - 24 * 60 * 60 * 1000));
    const { start, end } = dayRangeUtc(dayIso);

    const svc = getAdminClient(req);

    const { data: rows, error } = await svc
      .from("assistant_suggestions")
      .select("id, user_id, surface, kind, shown_at, dismissed_at, accepted_at, usage, created_at")
      .gte("created_at", start)
      .lt("created_at", end);

    if (error) return jsonResponse(req, { ok: false, code: "DB_ERROR", error: error.message }, 500);

    type Agg = {
      day: string;
      surface: string;
      kind: string;
      created_count: number;
      shown_count: number;
      accepted_count: number;
      dismissed_count: number;
      total_tokens: number;
      users: Set<string>;
    };

    const m = new Map<string, Agg>();

    for (const r of rows ?? []) {
      const surface = String((r as any).surface ?? "unknown");
      const kind = String((r as any).kind ?? "unknown");
      const key = `${dayIso}|${surface}|${kind}`;

      const existing =
        m.get(key) ??
        ({
          day: dayIso,
          surface,
          kind,
          created_count: 0,
          shown_count: 0,
          accepted_count: 0,
          dismissed_count: 0,
          total_tokens: 0,
          users: new Set<string>(),
        } as Agg);

      existing.created_count += 1;
      if ((r as any).shown_at) existing.shown_count += 1;
      if ((r as any).accepted_at) existing.accepted_count += 1;
      if ((r as any).dismissed_at) existing.dismissed_count += 1;
      if ((r as any).user_id) existing.users.add(String((r as any).user_id));
      existing.total_tokens += estimateTokens((r as any).usage);

      m.set(key, existing);
    }

    const upserts = Array.from(m.values()).map((a) => ({
      day: a.day,
      surface: a.surface,
      kind: a.kind,
      created_count: a.created_count,
      shown_count: a.shown_count,
      accepted_count: a.accepted_count,
      dismissed_count: a.dismissed_count,
      unique_users: a.users.size,
      total_tokens: a.total_tokens,
      updated_at: new Date().toISOString(),
    }));

    if (!dryRun && upserts.length) {
      const { error: upsertErr } = await svc.from("assistant_metrics_daily").upsert(upserts);
      if (upsertErr) return jsonResponse(req, { ok: false, code: "DB_ERROR", error: upsertErr.message }, 500);
    }

    return jsonResponse(req, { ok: true, day: dayIso, dryRun, rows: (rows ?? []).length, groups: upserts.length });
  } catch (e: any) {
    return jsonError(req, e);
  }
});
