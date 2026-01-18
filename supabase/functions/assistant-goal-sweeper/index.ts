/// <reference path="../_shared/deno.d.ts" />
// supabase/functions/assistant-goal-sweeper/index.ts
//
// Step 8: Long-horizon autonomy loop.
// Runs on pg_cron via pg_net (internal job token) and:
// - expires ended goals
// - creates a lightweight recap suggestion on Home
//
// Security model:
// - verify_jwt = false
// - requires x-job-token = INTERNAL_JOB_TOKEN

import { serve } from "jsr:@std/http@0.224.0/server";
import { z } from "zod";
import { handleOptions, jsonError, jsonResponse } from "../_shared/http.ts";
import { requireInternalJob } from "../_shared/internal.ts";
import { getAdminClient } from "../_shared/supabase.ts";

const BodySchema = z
  .object({
    reason: z.string().optional(),
    dryRun: z.boolean().optional(),
    limit: z.number().int().min(1).max(500).optional(),
  })
  .optional();

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

function mkId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

type GoalRow = {
  id: string;
  user_id: string;
  title: string;
  kind: string;
  status: string;
  end_at: string | null;
  meta: Record<string, unknown> | null;
};

type GoalStateRow = {
  target_count: number;
  progress_count: number;
} | null;

serve(async (req) => {
  const cors = handleOptions(req);
  if (cors) return cors;

  const auth = requireInternalJob(req);
  if (auth) return auth;

  try {
    const parsed = BodySchema.parse(await req.json().catch(() => ({})));
    const dryRun = Boolean(parsed?.dryRun);
    const limit = parsed?.limit ?? 200;

    const svc = getAdminClient(req);

    // Find active goals that ended.
    const { data: goals, error } = await svc
      .from("assistant_goals")
      .select("id, user_id, title, kind, status, end_at, meta, target_count, progress_count")
      .eq("status", "active")
      .not("end_at", "is", null)
      .lt("end_at", new Date().toISOString())
      .order("end_at", { ascending: true })
      .limit(limit);

    if (error) {
      // If schema isn't applied yet, just no-op.
      if (String(error.message ?? "").includes("assistant_goals")) {
        return jsonResponse(req, { ok: true, dryRun, expired_count: 0, inserted_count: 0, note: "schema_missing" });
      }
      return jsonResponse(req, { ok: false, code: "DB_ERROR", error: error.message }, 500);
    }

    const expired: any[] = [];
    let inserted_count = 0;

    for (const g of (goals ?? []) as any[]) {
      const target = Number(g.target_count ?? (g.meta as any)?.targetCount ?? 0);
      const progress = Number(g.progress_count ?? 0);

      expired.push({ goalId: g.id, userId: g.user_id, progress, target });

      if (!dryRun) {
        // Mark expired.
        await svc.from("assistant_goals").update({ status: "expired", updated_at: new Date().toISOString() }).eq("id", g.id);

        const day = isoDay(new Date());
        const contextKey = `goal_sweeper:${g.id}|day:${day}`;
        const listId = (g.meta as any)?.listId ? String((g.meta as any).listId) : null;
        const pct = target > 0 ? Math.round((progress / target) * 100) : null;

        const actions: any[] = [];
        if (listId) actions.push({ id: mkId("a"), label: "Open plan", type: "navigate", payload: { to: `/lists/${listId}` } });
        actions.push({
          id: mkId("b"),
          label: "Start a new mini-goal",
          type: "toolchain",
          payload: {
            navigateStrategy: "none",
            steps: [
              {
                tool: "goal_start",
                args: {
                  kind: "weekly_watch_count",
                  title: "New weekly watch goal",
                  targetCount: Math.max(1, Math.min(5, target || 3)),
                  days: 7,
                  ...(listId ? { listId } : {}),
                },
              },
            ],
          },
        });
        actions.push({ id: mkId("c"), label: "Dismiss", type: "dismiss" });

        const body =
          target > 0
            ? `Your goal ended. You finished ${progress}/${target}${pct !== null ? ` (${pct}%)` : ""}. Want to set a new one?`
            : "Your goal ended. Want to set a new one?";

        const { error: insErr } = await svc.from("assistant_suggestions").insert({
          user_id: g.user_id,
          surface: "home",
          context: { goalId: g.id, kind: g.kind },
          context_key: contextKey,
          kind: "goal_recap",
          title: "Goal recap",
          body,
          actions,
          score: 0.8,
          model: null,
          usage: { sweeper: { reason: parsed?.reason ?? "cron" } },
          created_at: new Date().toISOString(),
        });

        if (!insErr) inserted_count += 1;
      }
    }

    return jsonResponse(req, {
      ok: true,
      dryRun,
      expired_count: expired.length,
      inserted_count,
      expired,
    });
  } catch (e: any) {
    return jsonError(req, e instanceof Error ? e.message : String(e), 500, "INTERNAL_ERROR");
  }
});
