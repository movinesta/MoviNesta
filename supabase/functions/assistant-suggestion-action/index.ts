// supabase/functions/assistant-suggestion-action/index.ts
//
// Marks suggestions as shown/dismissed or executes a stored action.

import { handleOptions, jsonError, jsonResponse, validateRequest } from "../_shared/http.ts";
import { getUserClient } from "../_shared/supabase.ts";
import {
  executeAssistantTool,
  type AssistantToolCall,
  type AssistantToolName,
} from "../_shared/assistantTools.ts";

type ActionKind = "shown" | "dismiss" | "execute";

type MemoryRow = { value: Record<string, unknown> } | null;

type StoredAction =
  | { id: string; label?: string; type: "dismiss" }
  | { id: string; label?: string; type: "navigate"; payload: { to: string } }
  | {
      id: string;
      label?: string;
      type: "toolchain";
      payload: {
        steps: AssistantToolCall[];
        // How to pick navigateTo from step results
        navigateStrategy?: "first" | "last" | "none";
      };
    }
  | {
      id: string;
      label?: string;
      type: "create_list";
      payload: {
        name: string;
        description?: string;
        isPublic?: boolean;
        items?: { titleId: string; contentType: "movie" | "series" | "anime"; note?: string }[];
      };
    }
  | {
      id: string;
      label?: string;
      type: "diary_set_status";
      payload: {
        titleId: string;
        contentType: "movie" | "series" | "anime";
        status: "want_to_watch" | "watching" | "watched" | "dropped";
      };
    }
  | {
      id: string;
      label?: string;
      type: "message_send";
      payload: {
        conversationId?: string;
        targetUserId?: string;
        text: string;
        meta?: Record<string, unknown>;
      };
    }
  | {
      id: string;
      label?: string;
      type: "list_add_item";
      payload: {
        listId: string;
        titleId: string;
        contentType: "movie" | "series" | "anime";
        note?: string;
      };
    }
  | {
      id: string;
      label?: string;
      type: "playbook_start";
      payload: {
        playbookId: string;
      };
    }
  | {
      id: string;
      label?: string;
      type: "playbook_end";
      payload?: {
        playbookId?: string;
      };
    }
  | {
      id: string;
      label?: string;
      type: "toolchain";
      payload: {
        steps: AssistantToolCall[];
        /** How to choose navigateTo for the response. Default: last */
        navigateStrategy?: "first" | "last" | "none";
      };
    };

type SuggestionRow = {
  id: string;
  surface: string;
  kind: string;
  title: string;
  body: string;
  actions: unknown;
  context: Record<string, unknown>;
  context_key: string;
};

function coerceString(x: unknown): string {
  return typeof x === "string" ? x : String(x ?? "");
}

function pickAction(actions: unknown, actionId: string): StoredAction | null {
  if (!Array.isArray(actions)) return null;
  const found = (actions as any[]).find((a) => a && typeof a === "object" && a.id === actionId);
  return found ? (found as StoredAction) : null;
}

function uuid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `assistant-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  }
}

async function upsertAssistantMemory(
  supabase: any,
  userId: string,
  key: string,
  mutate: (current: Record<string, unknown>) => Record<string, unknown>,
) {
  try {
    const { data, error } = await supabase
      .from("assistant_memory")
      .select("value")
      .eq("user_id", userId)
      .eq("key", key)
      .maybeSingle();

    // If schema isn't applied yet, degrade gracefully.
    if (error && String(error.message ?? "").includes("assistant_memory")) return;

    const current = (data as MemoryRow)?.value && typeof (data as any).value === "object" ? (data as any).value : {};
    const next = mutate(current as Record<string, unknown>);

    await supabase.from("assistant_memory").upsert(
      {
        user_id: userId,
        key,
        value: next,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,key" },
    );
  } catch {
    // Ignore memory failures.
  }
}

function inc(obj: Record<string, unknown>, path: string[], by = 1) {
  let cur: any = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const k = path[i];
    if (!cur[k] || typeof cur[k] !== "object") cur[k] = {};
    cur = cur[k];
  }
  const leaf = path[path.length - 1];
  const n = Number(cur[leaf] ?? 0);
  cur[leaf] = (Number.isFinite(n) ? n : 0) + by;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

async function insertFollowUpSuggestion(
  supabase: any,
  userId: string,
  base: SuggestionRow,
  draft: {
    kind: string;
    title: string;
    body: string;
    actions: unknown;
  },
) {
  try {
    const createdAt = new Date().toISOString();
    const { data, error } = await supabase
      .from("assistant_suggestions")
      .insert({
        user_id: userId,
        surface: base.surface,
        context: base.context ?? {},
        context_key: base.context_key,
        kind: draft.kind,
        title: draft.title,
        body: draft.body,
        actions: draft.actions,
        score: 0.2,
        created_at: createdAt,
      })
      .select("id, kind, title, body, actions, created_at")
      .single();

    if (error) return null;
    if (!data) return null;
    return {
      id: (data as any).id,
      kind: (data as any).kind,
      title: (data as any).title,
      body: (data as any).body,
      actions: ((data as any).actions ?? []) as any,
      createdAt: (data as any).created_at,
    };
  } catch {
    return null;
  }
}

// Tool execution is handled by the assistant tool registry (supabase/functions/_shared/assistantTools.ts).

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const validated = await validateRequest(
    req,
    (body) => {
      const b = body as any;
      const suggestionId = coerceString(b?.suggestionId);
      const kind = coerceString(b?.kind) as ActionKind;
      const actionId = typeof b?.actionId === "string" ? b.actionId : null;
      if (!suggestionId) throw new Error("Missing suggestionId");
      if (kind !== "shown" && kind !== "dismiss" && kind !== "execute") {
        throw new Error("Invalid kind");
      }
      return { suggestionId, kind, actionId };
    },
    { logPrefix: "[assistant-suggestion-action]", requireJson: true },
  );
  if (validated.errorResponse) return validated.errorResponse;
  const { suggestionId, kind, actionId } = validated.data;

  const supabase = getUserClient(req);
  const { data: auth, error: authError } = await supabase.auth.getUser();
  const userId = auth?.user?.id ?? null;
  if (authError || !userId) {
    return jsonError(req, "Unauthorized", 401, "UNAUTHORIZED");
  }

  // Fetch suggestion row (for ownership + actions).
  const { data: row, error: rowError } = await supabase
    .from("assistant_suggestions")
    .select("id, actions, surface, kind, title, body, context, context_key")
    .eq("id", suggestionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (rowError) {
    if (String(rowError.message ?? "").includes("assistant_suggestions")) {
      return jsonResponse(req, { ok: true });
    }
    return jsonError(req, rowError.message, 500, "DB_ERROR");
  }
  if (!row) return jsonError(req, "Not found", 404, "NOT_FOUND");

  const srow = row as any as SuggestionRow;

  if (kind === "shown") {
    const { error } = await supabase
      .from("assistant_suggestions")
      .update({ shown_at: new Date().toISOString() })
      .eq("id", suggestionId)
      .eq("user_id", userId)
      .is("shown_at", null);

    if (error) return jsonError(req, error.message, 500, "DB_ERROR");
    return jsonResponse(req, { ok: true });
  }

  if (kind === "dismiss") {
    const { error } = await supabase
      .from("assistant_suggestions")
      .update({ dismissed_at: new Date().toISOString() })
      .eq("id", suggestionId)
      .eq("user_id", userId);

    if (error) return jsonError(req, error.message, 500, "DB_ERROR");

    // Lightweight learning: record dismiss patterns (best-effort).
    const bodyLen = coerceString((srow as any).body).length;
    await upsertAssistantMemory(supabase, userId, "assistant_stats", (cur) => {
      const next = { ...cur } as Record<string, unknown>;
      inc(next, ["dismissTotal"], 1);
      inc(next, ["dismissBySurface", String((srow as any).surface ?? "unknown")], 1);
      inc(next, ["dismissByKind", String((srow as any).kind ?? "unknown")], 1);
      (next as any).lastDismissedAt = new Date().toISOString();
      return next;
    });
    await upsertAssistantMemory(supabase, userId, "assistant_style", (cur) => {
      const next = { ...cur } as any;
      const pref = Number(next.verbosityPreference ?? 0.45);
      const delta = bodyLen > 140 ? -0.08 : -0.03;
      next.verbosityPreference = clamp(pref + delta, 0.1, 0.9);
      return next;
    });
    return jsonResponse(req, { ok: true });
  }

  // kind === execute
  if (!actionId) return jsonError(req, "Missing actionId", 400, "BAD_REQUEST");
  const action = pickAction((row as any).actions, actionId);
  if (!action) return jsonError(req, "Unknown action", 400, "BAD_REQUEST");

  let result: any = null;
  let navigateTo: string | null = null;
  let followUpSuggestions: any[] = [];

  try {
    if (action.type === "navigate") {
      navigateTo = action.payload?.to ?? null;
      result = { ok: true };
    } else if (action.type === "toolchain") {
      const steps = Array.isArray((action as any).payload?.steps) ? ((action as any).payload.steps as unknown[]) : [];
      const toolCalls: AssistantToolCall[] = steps
        .filter((s) => s && typeof s === "object")
        .slice(0, 10)
        .map((s: any) => ({ tool: String(s.tool) as AssistantToolName, args: (s.args ?? {}) as any }));

      const stepResults: any[] = [];
      const navigateStrategy = ((action as any).payload?.navigateStrategy ?? "last") as "first" | "last" | "none";
      let firstNav: string | null = null;
      let lastNav: string | null = null;

      for (const call of toolCalls) {
        const r = await executeAssistantTool(supabase, userId, call);
        stepResults.push({ tool: call.tool, result: r.result ?? null, navigateTo: r.navigateTo ?? null });
        if (r.navigateTo && !firstNav) firstNav = r.navigateTo;
        if (r.navigateTo) lastNav = r.navigateTo;
      }

      result = { steps: stepResults };
      if (navigateStrategy === "first") navigateTo = firstNav;
      else if (navigateStrategy === "none") navigateTo = null;
      else navigateTo = lastNav;
    } else if (
      action.type === "create_list" ||
      action.type === "diary_set_status" ||
      action.type === "message_send" ||
      action.type === "list_add_item" ||
      action.type === "playbook_start" ||
      action.type === "playbook_end"
    ) {
      const call: AssistantToolCall = {
        tool: action.type as AssistantToolName,
        args: (action as any).payload ?? {},
      };
      const r = await executeAssistantTool(supabase, userId, call);
      result = r.result ?? null;
      navigateTo = r.navigateTo ?? null;
    } else if (action.type === "dismiss") {
      // Treat dismiss as a simple dismiss.
      await supabase
        .from("assistant_suggestions")
        .update({ dismissed_at: new Date().toISOString() })
        .eq("id", suggestionId)
        .eq("user_id", userId);
      return jsonResponse(req, { ok: true });
    } else {
      throw new Error("Unsupported action");
    }

    await supabase
      .from("assistant_suggestions")
      .update({
        accepted_at: new Date().toISOString(),
        outcome: { actionId, actionType: (action as any).type, result },
      })
      .eq("id", suggestionId)
      .eq("user_id", userId);

    // Lightweight learning: record accepts (best-effort).
    const bodyLen = coerceString((srow as any).body).length;
    await upsertAssistantMemory(supabase, userId, "assistant_stats", (cur) => {
      const next = { ...cur } as Record<string, unknown>;
      inc(next, ["acceptTotal"], 1);
      inc(next, ["acceptBySurface", String((srow as any).surface ?? "unknown")], 1);
      inc(next, ["acceptByKind", String((srow as any).kind ?? "unknown")], 1);
      (next as any).lastAcceptedAt = new Date().toISOString();
      return next;
    });
    await upsertAssistantMemory(supabase, userId, "assistant_style", (cur) => {
      const next = { ...cur } as any;
      const pref = Number(next.verbosityPreference ?? 0.45);
      const delta = bodyLen > 140 ? 0.07 : 0.02;
      next.verbosityPreference = clamp(pref + delta, 0.1, 0.9);
      return next;
    });

    // Workflow chaining: create small follow-up hints when an action succeeds.
    try {
      const aType = (action as any).type as string;
      let createdListId: string | null = null;
      let addedListId: string | null = null;
      let playbookStartedListId: string | null = null;
      let goalStarted: { goalId: string; title?: string; targetCount?: number; days?: number; listId?: string } | null = null;
      let didEndPlaybook = false;
      let didEndGoal = false;
      let didSetDiaryStatus = false;

      if (aType === "toolchain" && Array.isArray((result as any)?.steps)) {
        for (const s of (result as any).steps as any[]) {
          const tool = String(s?.tool ?? "");
          const r = s?.result ?? null;
          if (!r || typeof r !== "object") {
            if (tool === "playbook_end") didEndPlaybook = true;
            if (tool === "diary_set_status") didSetDiaryStatus = true;
            continue;
          }
          if (tool === "create_list" && (r as any).listId && !createdListId) createdListId = String((r as any).listId);
          if (tool === "list_add_item" && (r as any).listId && !addedListId) addedListId = String((r as any).listId);
          if (tool === "playbook_start" && (r as any).listId && !playbookStartedListId) {
            playbookStartedListId = String((r as any).listId);
          }
          if (tool === "goal_start" && (r as any).goalId && !goalStarted) {
            goalStarted = {
              goalId: String((r as any).goalId),
              ...(typeof (r as any).title === "string" ? { title: String((r as any).title) } : {}),
              ...(Number.isFinite(Number((r as any).targetCount)) ? { targetCount: Number((r as any).targetCount) } : {}),
              ...(Number.isFinite(Number((r as any).days)) ? { days: Number((r as any).days) } : {}),
              ...(typeof (r as any).listId === "string" ? { listId: String((r as any).listId) } : {}),
            };
          }
          if (tool === "playbook_end") didEndPlaybook = true;
          if (tool === "goal_end") didEndGoal = true;
          if (tool === "diary_set_status") didSetDiaryStatus = true;
        }
      } else {
        if (aType === "create_list" && (result as any)?.listId) createdListId = String((result as any).listId);
        if (aType === "list_add_item" && (result as any)?.listId) addedListId = String((result as any).listId);
        if (aType === "playbook_start" && (result as any)?.listId) playbookStartedListId = String((result as any).listId);
        if (aType === "playbook_end") didEndPlaybook = true;
        if (aType === "goal_end") didEndGoal = true;
        if (aType === "goal_start" && (result as any)?.goalId) {
          goalStarted = {
            goalId: String((result as any).goalId),
            ...(typeof (result as any).title === "string" ? { title: String((result as any).title) } : {}),
            ...(Number.isFinite(Number((result as any).targetCount)) ? { targetCount: Number((result as any).targetCount) } : {}),
            ...(Number.isFinite(Number((result as any).days)) ? { days: Number((result as any).days) } : {}),
            ...(typeof (result as any).listId === "string" ? { listId: String((result as any).listId) } : {}),
          };
        }
        if (aType === "diary_set_status") didSetDiaryStatus = true;
      }

      if (createdListId) {
        const listId = String(createdListId);
        const f = await insertFollowUpSuggestion(supabase, userId, srow, {
          kind: "next_step",
          title: "Next: share or pin it",
          body: "Open the list to tweak it, or jump to Messages to recommend it.",
          actions: [
            { id: "open_list", label: "Open list", type: "navigate", payload: { to: `/lists/${listId}` } },
            { id: "go_messages", label: "Messages", type: "navigate", payload: { to: "/messages" } },
            { id: "dismiss", label: "Dismiss", type: "dismiss" },
          ],
        });
        if (f) followUpSuggestions = [...followUpSuggestions, f];
      }
      if (addedListId) {
        const listId = String(addedListId);
        const f = await insertFollowUpSuggestion(supabase, userId, srow, {
          kind: "list_item_added",
          title: "Added",
          body: "It's in your list. Want to review the plan?",
          actions: [
            { id: "open_list", label: "Open list", type: "navigate", payload: { to: `/lists/${listId}` } },
            { id: "dismiss", label: "Dismiss", type: "dismiss" },
          ],
        });
        if (f) followUpSuggestions = [...followUpSuggestions, f];
      }
      if (playbookStartedListId) {
        const listId = String(playbookStartedListId);
        const f = await insertFollowUpSuggestion(supabase, userId, srow, {
          kind: "playbook_started",
          title: "Plan started",
          body: "Open your plan list to adjust it, or share it in Messages.",
          actions: [
            { id: "open_list", label: "Open plan", type: "navigate", payload: { to: `/lists/${listId}` } },
            { id: "go_messages", label: "Messages", type: "navigate", payload: { to: "/messages" } },
            { id: "end_plan", label: "End plan", type: "playbook_end", payload: { playbookId: "weekly_watch_plan" } },
            { id: "dismiss", label: "Dismiss", type: "dismiss" },
          ],
        });
        if (f) followUpSuggestions = [...followUpSuggestions, f];
      }

      if (goalStarted) {
        const title = goalStarted.title ? String(goalStarted.title) : "Goal started";
        const target = Number.isFinite(Number(goalStarted.targetCount)) ? Number(goalStarted.targetCount) : null;
        const days = Number.isFinite(Number(goalStarted.days)) ? Number(goalStarted.days) : null;
        const bodyBits = [
          target ? `Target: ${target}.` : null,
          days ? `Window: ${days} days.` : null,
        ].filter(Boolean);

        const f = await insertFollowUpSuggestion(supabase, userId, srow, {
          kind: "goal_started",
          title,
          body: bodyBits.length ? bodyBits.join(" ") : "Locked in. I’ll nudge you at the right moments.",
          actions: [
            ...(goalStarted.listId
              ? ([{ id: "open_goal_list", label: "Open plan", type: "navigate", payload: { to: `/lists/${goalStarted.listId}` } }] as any)
              : []),
            {
              id: "end_goal",
              label: "End goal",
              type: "toolchain",
              payload: {
                steps: [{ tool: "goal_end", args: { goalId: goalStarted.goalId, status: "completed" } }],
                navigateStrategy: "none",
              },
            },
            { id: "dismiss", label: "Dismiss", type: "dismiss" },
          ],
        });
        if (f) followUpSuggestions = [...followUpSuggestions, f];
      }
      if (didEndPlaybook) {
        const f = await insertFollowUpSuggestion(supabase, userId, srow, {
          kind: "playbook_ended",
          title: "Plan ended",
          body: "Done. You can start a new plan any time from Home.",
          actions: [{ id: "dismiss", label: "Dismiss", type: "dismiss" }],
        });
        if (f) followUpSuggestions = [...followUpSuggestions, f];
      }
      if (didEndGoal) {
        const f = await insertFollowUpSuggestion(supabase, userId, srow, {
          kind: "goal_ended",
          title: "Goal ended",
          body: "Done. You can start another goal any time from Home.",
          actions: [{ id: "dismiss", label: "Dismiss", type: "dismiss" }],
        });
        if (f) followUpSuggestions = [...followUpSuggestions, f];
      }
      if (didSetDiaryStatus) {
        const f = await insertFollowUpSuggestion(supabase, userId, srow, {
          kind: "next_step",
          title: "Keep the momentum",
          body: "Do a quick Swipe session to pull more titles in the same vibe.",
          actions: [
            { id: "go_swipe", label: "Go to Swipe", type: "navigate", payload: { to: "/swipe" } },
            { id: "dismiss", label: "Dismiss", type: "dismiss" },
          ],
        });
        if (f) followUpSuggestions = [...followUpSuggestions, f];
      }
    } catch {
      // ignore
    }

    return jsonResponse(req, {
      ok: true,
      result,
      navigateTo,
      ...(followUpSuggestions.length ? { followUpSuggestions } : {}),
    });
  } catch (e: any) {
    await supabase
      .from("assistant_suggestions")
      .update({
        outcome: { actionId, actionType: (action as any).type, error: e?.message ?? String(e) },
      })
      .eq("id", suggestionId)
      .eq("user_id", userId);

    return jsonError(req, e?.message ?? "Failed to execute action", 400, "ACTION_FAILED");
  }
});
