// supabase/functions/assistant-suggestion-action/index.ts
//
// Marks assistant suggestions as shown/dismissed, or executes a stored suggestion action.
//
// Key goals:
// - User-initiated only (must own suggestion)
// - Strict tool allowlist + internal-only undo tools
// - Optional confirmation gate for risky operations
// - Idempotency (locks) + safe retry

import {
  getRequestId,
  handleOptions,
  jsonError,
  jsonResponse,
  validateRequest,
} from "../_shared/http.ts";
import { getAdminClient, getUserClient } from "../_shared/supabase.ts";
import { safeInsertAssistantFailure } from "../_shared/assistantTelemetry.ts";
import { executeAssistantTool, type AssistantToolCall } from "../_shared/assistantTools.ts";
import { assertAllowedSuggestionTool, requiresConfirmation } from "../_shared/assistantPolicy.ts";
import { computeActionKey, issueConfirmToken } from "../_shared/assistantCrypto.ts";
import { deriveUndoPlan } from "../_shared/assistantUndo.ts";

const FN_NAME = "assistant-suggestion-action";

type ActionKind = "shown" | "dismiss" | "execute";

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

type StoredAction =
  | { id: string; label?: string; type: "dismiss" }
  | { id: string; label?: string; type: "navigate"; payload: { to: string } }
  | {
      id: string;
      label?: string;
      type: "toolchain";
      payload: {
        steps: Array<AssistantToolCall & { internal?: boolean }>;
        navigateStrategy?: "first" | "last" | "none";
      };
    }
  | { id: string; label?: string; type: string; payload?: Record<string, unknown> };

function coerceString(x: unknown): string {
  return typeof x === "string" ? x : String(x ?? "");
}

function asArgs(x: unknown): Record<string, unknown> {
  if (x && typeof x === "object") return x as Record<string, unknown>;
  return {};
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
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

function pickAction(actions: unknown, actionId: string): StoredAction | null {
  const arr = Array.isArray(actions) ? (actions as any[]) : [];
  for (const a of arr) {
    if (a && typeof a === "object" && String((a as any).id ?? "") === actionId) {
      return a as StoredAction;
    }
  }
  return null;
}

type ConfirmInfo = {
  needs: boolean;
  kind: "danger" | "warning" | "default";
  prompt: string;
  tool?: string;
};

function getConfirmInfoForAction(action: StoredAction): ConfirmInfo {
  try {
    if (action.type === "toolchain") {
      const steps = Array.isArray((action as any)?.payload?.steps) ? ((action as any).payload.steps as any[]) : [];
      for (const s of steps.slice(0, 10)) {
        const toolRaw = typeof s?.tool === "string" ? String(s.tool).trim() : "";
        if (!toolRaw) continue;
        const internal = Boolean(s?.internal ?? false);
        if (internal) continue;
        const args = asArgs(s?.args ?? {});
        const r = requiresConfirmation(toolRaw, args);
        if (r.needs) return { ...r, tool: toolRaw };
      }
      return { needs: false, kind: "default", prompt: "" };
    }

    if (action.type === "navigate" || action.type === "dismiss") {
      return { needs: false, kind: "default", prompt: "" };
    }

    const toolRaw = String((action as any)?.type ?? "").trim();
    const args = asArgs((action as any)?.payload ?? {});
    const r = requiresConfirmation(toolRaw, args);
    return r.needs ? { ...r, tool: toolRaw } : { needs: false, kind: "default", prompt: "" };
  } catch {
    return { needs: false, kind: "default", prompt: "" };
  }
}

function normalizeSuggestionToolCall(
  raw: any,
  actionKey: string,
  stepIndex: number,
): { tool: string; args: Record<string, unknown>; internal: boolean } {
  const toolRaw = typeof raw?.tool === "string" ? String(raw.tool).trim() : typeof raw?.type === "string" ? String(raw.type).trim() : "";
  const internal = Boolean(raw?.internal ?? false);
  const tool = assertAllowedSuggestionTool(toolRaw, internal);
  const args = asArgs(raw?.args ?? raw?.payload ?? {});

  // Ensure message_send is idempotent across retries.
  if (tool === "message_send" && typeof (args as any).clientId !== "string") {
    (args as any).clientId = `${actionKey}_s${stepIndex}`.slice(0, 120);
  }

  return { tool, args, internal };
}

async function upsertAssistantMemory(
  supabase: any,
  userId: string,
  key: string,
  mutate: (cur: Record<string, unknown>) => Record<string, unknown>,
) {
  try {
    const { data } = await supabase
      .from("assistant_memory")
      .select("value")
      .eq("user_id", userId)
      .eq("key", key)
      .maybeSingle();

    const cur = (data?.value && typeof data.value === "object" ? (data.value as Record<string, unknown>) : {}) ?? {};
    const next = mutate({ ...cur });

    await supabase
      .from("assistant_memory")
      .upsert({ user_id: userId, key, value: next }, { onConflict: "user_id,key" });
  } catch {
    // optional feature; ignore
  }
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
    const { data, error } = await supabase
      .from("assistant_suggestions")
      .insert({
        user_id: userId,
        surface: base.surface,
        kind: draft.kind,
        title: draft.title,
        body: draft.body,
        actions: draft.actions,
        context: base.context,
        context_key: base.context_key,
      })
      .select("id, kind, title, body, actions, created_at")
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: String(data.id),
      kind: String((data as any).kind ?? ""),
      title: String((data as any).title ?? ""),
      body: String((data as any).body ?? ""),
      actions: (data as any).actions ?? [],
      createdAt: String((data as any).created_at ?? new Date().toISOString()),
    };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const requestId = getRequestId(req);

  const validated = await validateRequest(
    req,
    (body) => {
      const b = body as any;
      const suggestionId = coerceString(b?.suggestionId);
      const kind = coerceString(b?.kind) as ActionKind;
      const actionId = typeof b?.actionId === "string" ? b.actionId : null;
      const confirmToken = typeof b?.confirmToken === "string" ? String(b.confirmToken) : null;

      if (!suggestionId) throw new Error("Missing suggestionId");
      if (kind !== "shown" && kind !== "dismiss" && kind !== "execute") throw new Error("Invalid kind");

      return { suggestionId, kind, actionId, confirmToken };
    },
    { logPrefix: `[${FN_NAME}]`, requireJson: true },
  );
  if (validated.errorResponse) return validated.errorResponse;

  const { suggestionId, kind, actionId, confirmToken } = validated.data as any;

  const supabase = getUserClient(req);
  const { data: auth, error: authError } = await supabase.auth.getUser();
  const userId = auth?.user?.id ?? null;
  if (authError || !userId) return jsonError(req, "Unauthorized", 401, "UNAUTHORIZED");

  // Load the suggestion.
  const { data: row, error: rowError } = await supabase
    .from("assistant_suggestions")
    .select("id, actions, surface, kind, title, body, context, context_key, accepted_at, dismissed_at, outcome")
    .eq("id", suggestionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (rowError) return jsonError(req, rowError.message, 500, "DB_ERROR");
  if (!row) return jsonError(req, "Not found", 404, "NOT_FOUND");

  const srow = row as any as SuggestionRow;

  if (kind === "shown") {
    // Best-effort mark shown.
    try {
      await supabase
        .from("assistant_suggestions")
        .update({ shown_at: new Date().toISOString() })
        .eq("id", suggestionId)
        .eq("user_id", userId);
    } catch {
      // ignore if column doesn't exist
    }
    return jsonResponse(req, { ok: true });
  }

  if (kind === "dismiss") {
    await supabase
      .from("assistant_suggestions")
      .update({ dismissed_at: new Date().toISOString() })
      .eq("id", suggestionId)
      .eq("user_id", userId);

    // Lightweight learning (best-effort).
    const bodyLen = coerceString((srow as any).body).length;
    await upsertAssistantMemory(supabase, userId, "assistant_stats", (cur) => {
      const next = { ...cur };
      inc(next, ["dismissTotal"], 1);
      inc(next, ["dismissBySurface", String((srow as any).surface ?? "unknown")], 1);
      inc(next, ["dismissByKind", String((srow as any).kind ?? "unknown")], 1);
      (next as any).lastDismissedAt = new Date().toISOString();
      return next;
    });
    await upsertAssistantMemory(supabase, userId, "assistant_style", (cur) => {
      const next: any = { ...cur };
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

  // Idempotency + stale lock handling.
  const dismissedAt = (row as any)?.dismissed_at ? String((row as any).dismissed_at) : null;
  const acceptedAt = (row as any)?.accepted_at ? String((row as any).accepted_at) : null;
  const priorOutcome = (row as any)?.outcome ?? null;

  if (dismissedAt) return jsonResponse(req, { ok: true, alreadyDismissed: true });

  if (acceptedAt) {
    const status = priorOutcome && typeof priorOutcome === "object" ? String((priorOutcome as any).status ?? "") : "";
    const startedAt = priorOutcome && typeof priorOutcome === "object" ? (priorOutcome as any).startedAt : null;
    const startedMs = typeof startedAt === "string" ? Date.parse(startedAt) : NaN;
    const ageMs = Number.isFinite(startedMs) ? Date.now() - startedMs : NaN;
    const isStale = status === "processing" && Number.isFinite(ageMs) && ageMs > 5 * 60_000;

    if (!isStale) {
      const nav = priorOutcome && typeof priorOutcome === "object" ? ((priorOutcome as any).navigateTo ?? null) : null;
      return jsonResponse(req, { ok: true, alreadyAccepted: true, navigateTo: nav });
    }

    // Clear stale lock.
    try {
      await supabase.from("assistant_suggestions").update({ accepted_at: null }).eq("id", suggestionId).eq("user_id", userId);
    } catch {
      // ignore
    }
  }

  // Stable action key for dedupe + audit.
  const actionKey = await computeActionKey({
    userId,
    suggestionId,
    actionId,
    actionType: (action as any).type,
    payload: (action as any).payload ?? null,
  });

  // Confirmation gate (best-effort, stored on the suggestion outcome).
  const confirmInfo = getConfirmInfoForAction(action);
  const now = new Date();
  const nowIso = now.toISOString();

  if (confirmInfo.needs) {
    const prior = priorOutcome && typeof priorOutcome === "object" ? (priorOutcome as any) : null;
    const existingStatus = prior ? String(prior.status ?? "") : "";
    const existingToken = prior && typeof prior.confirmToken === "string" ? String(prior.confirmToken) : "";
    const existingExp = prior && typeof prior.confirmExpiresAt === "string" ? String(prior.confirmExpiresAt) : "";
    const expMs = existingExp ? Date.parse(existingExp) : NaN;
    const notExpired = Number.isFinite(expMs) && expMs > now.getTime();

    const issueAndStore = async () => {
      const token = issueConfirmToken();
      const expiresAt = new Date(now.getTime() + 10 * 60_000).toISOString();
      try {
        await supabase
          .from("assistant_suggestions")
          .update({
            outcome: {
              status: "needs_confirm",
              actionId,
              actionType: (action as any).type,
              actionKey,
              confirmToken: token,
              confirmExpiresAt: expiresAt,
              confirmKind: confirmInfo.kind,
              confirmPrompt: confirmInfo.prompt,
              requestedAt: nowIso,
            },
          })
          .eq("id", suggestionId)
          .eq("user_id", userId);
      } catch {
        // ignore
      }
      return { token, expiresAt };
    };

    if (!confirmToken) {
      if (existingStatus === "needs_confirm" && existingToken && notExpired) {
        return jsonResponse(req, {
          ok: true,
          needsConfirm: true,
          confirmToken: existingToken,
          confirmKind: confirmInfo.kind,
          confirmPrompt: confirmInfo.prompt,
        });
      }
      const issued = await issueAndStore();
      return jsonResponse(req, {
        ok: true,
        needsConfirm: true,
        confirmToken: issued.token,
        confirmKind: confirmInfo.kind,
        confirmPrompt: confirmInfo.prompt,
      });
    }

    const isValid = existingStatus === "needs_confirm" && existingToken && notExpired && existingToken === confirmToken;
    if (!isValid) {
      const issued = await issueAndStore();
      return jsonResponse(req, {
        ok: true,
        needsConfirm: true,
        confirmToken: issued.token,
        confirmKind: confirmInfo.kind,
        confirmPrompt: confirmInfo.prompt,
      });
    }
  }

  // Acquire lock.
  const startedAtIso = new Date().toISOString();
  try {
    const { data: locked, error: lockErr } = await supabase
      .from("assistant_suggestions")
      .update({
        accepted_at: startedAtIso,
        outcome: {
          status: "processing",
          actionId,
          actionType: (action as any).type,
          actionKey,
          startedAt: startedAtIso,
          confirmedAt: confirmInfo.needs ? nowIso : null,
        },
      })
      .eq("id", suggestionId)
      .eq("user_id", userId)
      .is("accepted_at", null)
      .select("id")
      .maybeSingle();

    if (lockErr) return jsonError(req, lockErr.message, 500, "DB_ERROR");
    if (!locked) return jsonResponse(req, { ok: true, alreadyAccepted: true });
  } catch (e: any) {
    return jsonError(e?.message ?? "Failed to lock suggestion", 500, "DB_ERROR");
  }

  let result: any = null;
  let navigateTo: string | null = null;
  const followUpSuggestions: any[] = [];
  let undoPlan: any = null;

  try {
    if (action.type === "navigate") {
      navigateTo = (action as any)?.payload?.to ?? null;
      result = { ok: true };
    } else if (action.type === "toolchain") {
      const stepsRaw = Array.isArray((action as any)?.payload?.steps) ? ((action as any).payload.steps as any[]) : [];
      const navigateStrategy = (((action as any)?.payload?.navigateStrategy ?? "last") as "first" | "last" | "none");

      const normalized = stepsRaw
        .filter((s) => s && typeof s === "object")
        .slice(0, 10)
        .map((s, i) => normalizeSuggestionToolCall(s, actionKey, i));

      const stepResults: any[] = [];
      let firstNav: string | null = null;
      let lastNav: string | null = null;

      for (let i = 0; i < normalized.length; i++) {
        const call = normalized[i];
        const r = await executeAssistantTool(supabase, userId, { tool: call.tool as any, args: call.args });
        stepResults.push({ tool: call.tool, ok: true, result: (r as any).result ?? null, navigateTo: (r as any).navigateTo ?? null });
        if ((r as any).navigateTo && !firstNav) firstNav = String((r as any).navigateTo);
        if ((r as any).navigateTo) lastNav = String((r as any).navigateTo);

        const u = deriveUndoPlan(call.tool, call.args, (r as any).result ?? null);
        if (u) undoPlan = u;
      }

      result = { steps: stepResults };
      if (navigateStrategy === "first") navigateTo = firstNav;
      else if (navigateStrategy === "none") navigateTo = null;
      else navigateTo = lastNav;
    } else if (action.type === "dismiss") {
      await supabase
        .from("assistant_suggestions")
        .update({ dismissed_at: new Date().toISOString() })
        .eq("id", suggestionId)
        .eq("user_id", userId);
      return jsonResponse(req, { ok: true });
    } else {
      // Any other action is treated as a single tool call.
      const norm = normalizeSuggestionToolCall({ tool: (action as any).type, args: (action as any).payload ?? {} }, actionKey, 0);
      const r = await executeAssistantTool(supabase, userId, { tool: norm.tool as any, args: norm.args });
      result = (r as any).result ?? null;
      navigateTo = (r as any).navigateTo ?? null;
      const u = deriveUndoPlan(norm.tool, norm.args, result);
      if (u) undoPlan = u;
    }

    // Persist outcome.
    await supabase
      .from("assistant_suggestions")
      .update({
        outcome: {
          status: "done",
          actionId,
          actionType: (action as any).type,
          actionKey,
          startedAt: startedAtIso,
          finishedAt: new Date().toISOString(),
          navigateTo,
          result,
          undo: undoPlan ?? null,
        },
      })
      .eq("id", suggestionId)
      .eq("user_id", userId);

    // Undo follow-up (if available).
    if (undoPlan && typeof undoPlan === "object" && typeof (undoPlan as any).tool === "string") {
      const f = await insertFollowUpSuggestion(supabase, userId, srow, {
        kind: "undo",
        title: "Undo",
        body: "Want to undo that change?",
        actions: [
          {
            id: "undo",
            label: "Undo",
            type: "toolchain",
            payload: {
              steps: [
                {
                  tool: String((undoPlan as any).tool),
                  args: ((undoPlan as any).args ?? {}) as Record<string, unknown>,
                  internal: Boolean((undoPlan as any).internal ?? false),
                },
              ],
              navigateStrategy: "none",
            },
          },
          { id: "dismiss", label: "Dismiss", type: "dismiss" },
        ],
      });
      if (f) followUpSuggestions.push(f);
    }

    // Small workflow hints (best-effort; based on result shape).
    try {
      const aType = String((action as any).type ?? "");
      if (aType === "create_list" && result && typeof result === "object" && (result as any).listId) {
        const listId = String((result as any).listId);
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
        if (f) followUpSuggestions.push(f);
      }
      if (aType === "list_add_item" && result && typeof result === "object" && (result as any).listId) {
        const listId = String((result as any).listId);
        const f = await insertFollowUpSuggestion(supabase, userId, srow, {
          kind: "list_item_added",
          title: "Added",
          body: "It’s in your list.",
          actions: [
            { id: "open_list", label: "Open list", type: "navigate", payload: { to: `/lists/${listId}` } },
            { id: "dismiss", label: "Dismiss", type: "dismiss" },
          ],
        });
        if (f) followUpSuggestions.push(f);
      }
      if (aType === "playbook_start" && result && typeof result === "object" && (result as any).listId) {
        const listId = String((result as any).listId);
        const f = await insertFollowUpSuggestion(supabase, userId, srow, {
          kind: "playbook_started",
          title: "Plan started",
          body: "Open your plan list to adjust it, or share it in Messages.",
          actions: [
            { id: "open_plan", label: "Open plan", type: "navigate", payload: { to: `/lists/${listId}` } },
            { id: "go_messages", label: "Messages", type: "navigate", payload: { to: "/messages" } },
            { id: "dismiss", label: "Dismiss", type: "dismiss" },
          ],
        });
        if (f) followUpSuggestions.push(f);
      }
      if (aType === "diary_set_status") {
        const f = await insertFollowUpSuggestion(supabase, userId, srow, {
          kind: "next_step",
          title: "Keep the momentum",
          body: "Do a quick Swipe session to pull more titles in the same vibe.",
          actions: [
            { id: "go_swipe", label: "Go to Swipe", type: "navigate", payload: { to: "/swipe" } },
            { id: "dismiss", label: "Dismiss", type: "dismiss" },
          ],
        });
        if (f) followUpSuggestions.push(f);
      }
    } catch {
      // ignore
    }

    // Lightweight learning: record accepts (best-effort).
    const bodyLen = coerceString((srow as any).body).length;
    await upsertAssistantMemory(supabase, userId, "assistant_stats", (cur) => {
      const next = { ...cur };
      inc(next, ["acceptTotal"], 1);
      inc(next, ["acceptBySurface", String((srow as any).surface ?? "unknown")], 1);
      inc(next, ["acceptByKind", String((srow as any).kind ?? "unknown")], 1);
      (next as any).lastAcceptedAt = new Date().toISOString();
      return next;
    });
    await upsertAssistantMemory(supabase, userId, "assistant_style", (cur) => {
      const next: any = { ...cur };
      const pref = Number(next.verbosityPreference ?? 0.45);
      const delta = bodyLen > 140 ? 0.07 : 0.02;
      next.verbosityPreference = clamp(pref + delta, 0.1, 0.9);
      return next;
    });

    return jsonResponse(req, {
      ok: true,
      result,
      navigateTo,
      ...(followUpSuggestions.length ? { followUpSuggestions } : {}),
    });
  } catch (e: any) {
    // Telemetry (best-effort via service role).
    try {
      const svc = getAdminClient(req);
      await safeInsertAssistantFailure(svc, {
        fn: FN_NAME,
        request_id: requestId,
        user_id: userId,
        code: "ACTION_FAILED",
        message: e?.message ?? String(e ?? "Execution failed"),
        details: {
          suggestionId,
          actionId,
          actionType: (action as any)?.type ?? null,
        },
      });
    } catch {
      // ignore
    }

    // Release lock so the user can retry.
    try {
      await supabase
        .from("assistant_suggestions")
        .update({
          accepted_at: null,
          outcome: {
            status: "failed",
            actionId,
            actionType: (action as any).type,
            actionKey,
            startedAt: startedAtIso,
            failedAt: new Date().toISOString(),
            error: e?.message ?? String(e ?? "Execution failed"),
          },
        })
        .eq("id", suggestionId)
        .eq("user_id", userId);
    } catch {
      // ignore
    }

    return jsonError(req, e?.message ?? "Failed to execute action", 400, "ACTION_FAILED");
  }
});
