/// <reference path="../_shared/deno.d.ts" />
// supabase/functions/assistant-trigger-runner/index.ts
//
// Step 7: Event-driven proactivity.
// Runs on pg_cron via pg_net. Security model:
// - verify_jwt = false
// - Requires x-job-token header (INTERNAL_JOB_TOKEN)
//
// It evaluates assistant_triggers and inserts assistant_suggestions + assistant_trigger_fires.

import { serve } from "jsr:@std/http@0.224.0/server";
import { z } from "zod";
import { handleOptions, jsonError, jsonResponse } from "../_shared/http.ts";
import { requireInternalJob } from "../_shared/internal.ts";
import { getAdminClient } from "../_shared/supabase.ts";

const BodySchema = z
  .object({
    reason: z.string().optional(),
    dryRun: z.boolean().optional(),
    limitPerTrigger: z.number().int().min(1).max(500).optional(),
  })
  .optional();

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

type TriggerRow = {
  id: string;
  name: string;
  enabled: boolean;
  surfaces: string[] | null;
  rule: Record<string, unknown> | null;
  cooldown_minutes: number;
};

type CandidateSwipeLowLike = { user_id: string; actions: number; likes: number; like_rate: number };
type CandidateWatchlistStuck = { user_id: string; watchlist_count: number; days_since_watched: number };

function mkId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

function triggerContextKey(triggerId: string, surface: string) {
  return `trigger:${triggerId}|surface:${surface}|day:${isoDay(new Date())}`;
}

function buildSwipeLowLikeSuggestion(c: CandidateSwipeLowLike) {
  const likePct = Math.round((Number(c.like_rate) || 0) * 100);
  return {
    surface: "swipe",
    kind: "coach",
    title: "Quick deck tune-up",
    body:
      `Your recent swipe like-rate is about ${likePct}%. ` +
      "Want to tighten the deck so it matches your mood faster?",
    score: 0.9,
    actions: [
      { id: mkId("a"), label: "Try Search instead", type: "navigate", payload: { to: "/search" } },
      { id: mkId("b"), label: "Start a watch plan", type: "playbook_start", payload: { playbookId: "weekly_watch_plan" } },
      { id: mkId("c"), label: "Not now", type: "dismiss" },
    ],
  };
}

function buildWatchlistStuckSuggestion(c: CandidateWatchlistStuck) {
  return {
    surface: "home",
    kind: "plan",
    title: "Turn your watchlist into a real plan",
    body:
      `You have ${c.watchlist_count} items saved, but it’s been a while since you marked something watched. ` +
      "Want me to turn this into a simple weekly watch plan?",
    score: 0.95,
    actions: [
      { id: mkId("a"), label: "Start plan", type: "playbook_start", payload: { playbookId: "weekly_watch_plan" } },
      {
        id: mkId("g"),
        label: "Set a mini-goal (2 this week)",
        type: "toolchain",
        payload: {
          navigateStrategy: "none",
          steps: [
            {
              tool: "goal_start",
              args: { kind: "weekly_watch_count", title: "Watch 2 this week", targetCount: 2, days: 7 },
            },
          ],
        },
      },
      { id: mkId("b"), label: "Not now", type: "dismiss" },
    ],
  };
}

serve(async (req) => {
  const cors = handleOptions(req);
  if (cors) return cors;

  const auth = requireInternalJob(req);
  if (auth) return auth;

  try {
    const parsed = BodySchema.parse(await req.json().catch(() => ({})));
    const dryRun = Boolean(parsed?.dryRun);
    const limitPerTrigger = parsed?.limitPerTrigger ?? 200;

    const svc = getAdminClient(req);

    const { data: triggers, error: trigErr } = await svc
      .from("assistant_triggers")
      .select("id, name, enabled, surfaces, rule, cooldown_minutes")
      .eq("enabled", true);

    if (trigErr) return jsonResponse(req, { ok: false, code: "DB_ERROR", error: trigErr.message }, 500);

    const inserted: any[] = [];
    const fired: any[] = [];

    for (const t of (triggers ?? []) as TriggerRow[]) {
      const rule = (t.rule ?? {}) as Record<string, unknown>;
      const type = String(rule.type ?? t.name);

      if (type === "swipe_low_like_rate") {
        const windowHours = Number(rule.window_hours ?? 36);
        const minActions = Number(rule.min_actions ?? 20);
        const maxLikeRate = Number(rule.max_like_rate ?? 0.12);

        const { data: candidates, error: candErr } = await svc.rpc("assistant_trigger_candidates_swipe_low_like_rate", {
          p_trigger_id: t.id,
          p_window_hours: windowHours,
          p_min_actions: minActions,
          p_max_like_rate: maxLikeRate,
          p_cooldown_minutes: t.cooldown_minutes ?? 240,
        });

        if (candErr) continue;

        const list = (candidates ?? []) as CandidateSwipeLowLike[];
        for (const c of list.slice(0, limitPerTrigger)) {
          const s = buildSwipeLowLikeSuggestion(c);
          const contextKey = triggerContextKey(t.id, s.surface);

          const fireRow = {
            trigger_id: t.id,
            user_id: c.user_id,
            surface: s.surface,
            context: { windowHours, minActions, maxLikeRate, actions: c.actions, likes: c.likes, likeRate: c.like_rate },
            reason: { reason: parsed?.reason ?? "cron", type },
          };

          if (!dryRun) {
            const { error: fireErr } = await svc.from("assistant_trigger_fires").insert(fireRow);
            if (fireErr) {
              // Dedup violations are ok.
              if (!String(fireErr.message ?? "").toLowerCase().includes("duplicate")) continue;
            }

            const { error: insErr } = await svc.from("assistant_suggestions").insert({
              user_id: c.user_id,
              surface: s.surface,
              context: {},
              context_key: contextKey,
              kind: s.kind,
              title: s.title,
              body: s.body,
              actions: s.actions,
              score: s.score,
              model: null,
              usage: { trigger: { id: t.id, name: t.name, type } },
              created_at: new Date().toISOString(),
            });

            if (!insErr) inserted.push({ trigger: t.name, user_id: c.user_id, surface: s.surface });
          } else {
            inserted.push({ trigger: t.name, user_id: c.user_id, surface: s.surface, dryRun: true });
          }

          fired.push({ trigger: t.name, user_id: c.user_id });
        }
      } else if (type === "watchlist_stuck") {
        const minWatchlist = Number(rule.min_watchlist ?? 15);
        const maxWatchedDays = Number(rule.max_watched_days ?? 14);
        const cooldownMinutes = t.cooldown_minutes ?? 720;

        const { data: candidates, error: candErr } = await svc.rpc("assistant_trigger_candidates_watchlist_stuck", {
          p_trigger_id: t.id,
          p_min_watchlist: minWatchlist,
          p_max_watched_days: maxWatchedDays,
          p_cooldown_minutes: cooldownMinutes,
        });

        if (candErr) continue;

        const list = (candidates ?? []) as CandidateWatchlistStuck[];
        for (const c of list.slice(0, limitPerTrigger)) {
          const s = buildWatchlistStuckSuggestion(c);
          const contextKey = triggerContextKey(t.id, s.surface);

          const fireRow = {
            trigger_id: t.id,
            user_id: c.user_id,
            surface: s.surface,
            context: { minWatchlist, maxWatchedDays, watchlistCount: c.watchlist_count, daysSinceWatched: c.days_since_watched },
            reason: { reason: parsed?.reason ?? "cron", type },
          };

          if (!dryRun) {
            const { error: fireErr } = await svc.from("assistant_trigger_fires").insert(fireRow);
            if (fireErr) {
              if (!String(fireErr.message ?? "").toLowerCase().includes("duplicate")) continue;
            }

            const { error: insErr } = await svc.from("assistant_suggestions").insert({
              user_id: c.user_id,
              surface: s.surface,
              context: {},
              context_key: contextKey,
              kind: s.kind,
              title: s.title,
              body: s.body,
              actions: s.actions,
              score: s.score,
              model: null,
              usage: { trigger: { id: t.id, name: t.name, type } },
              created_at: new Date().toISOString(),
            });

            if (!insErr) inserted.push({ trigger: t.name, user_id: c.user_id, surface: s.surface });
          } else {
            inserted.push({ trigger: t.name, user_id: c.user_id, surface: s.surface, dryRun: true });
          }

          fired.push({ trigger: t.name, user_id: c.user_id });
        }
      }
    }

    return jsonResponse(req, {
      ok: true,
      dryRun,
      inserted_count: inserted.length,
      fired_count: fired.length,
      inserted,
    });
  } catch (e: any) {
    return jsonError(req, e);
  }
});
