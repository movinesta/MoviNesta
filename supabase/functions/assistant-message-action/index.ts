// supabase/functions/assistant-message-action/index.ts
//
// Executes a structured action attached to an assistant chat message.
// The action is stored on the message `meta.ai.actions[]`.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

import { getRequestId, handleOptions, jsonError, jsonResponse } from "../_shared/http.ts";
import { log } from "../_shared/logger.ts";
import { getAdminClient, getUserClient } from "../_shared/supabase.ts";
import { getConfig } from "../_shared/config.ts";
import { resolveAssistantIdentity } from "../_shared/assistantIdentity.ts";
import { executeAssistantTool } from "../_shared/assistantTools.ts";
import { applyTextInferences, coerceArgString, normalizeToolArgs } from "../_shared/assistantToolArgs.ts";
import { safeInsertAssistantFailure } from "../_shared/assistantTelemetry.ts";
import { assertAllowedUserActionTool, requiresConfirmation } from "../_shared/assistantPolicy.ts";
import { computeActionKey, issueConfirmToken } from "../_shared/assistantCrypto.ts";
import { deriveUndoPlan } from "../_shared/assistantUndo.ts";

const FN_NAME = "assistant-message-action";

// Tool allowlists + confirmation rules live in _shared/assistantPolicy.ts

type RequestBody = {
  conversationId?: string;
  messageId?: string;
  actionId?: string;
  confirmToken?: string;
};

type AssistantAction = {
  id: string;
  label?: string;
  type: string;
  payload?: unknown;
};

type NormalizedAction =
  | { kind: "tool"; tool: string; args: Record<string, unknown>; internal?: boolean }
  | { kind: "navigate"; to: string }
  | { kind: "dismiss" };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function getTriggeredUserMessageId(meta: any): string {
  const aiMeta: any = meta?.ai ?? meta?.AI ?? null;
  return coerceArgString(
    aiMeta?.triggeredBy?.userMessageId ??
      aiMeta?.triggered_by?.user_message_id ??
      aiMeta?.triggered_by?.userMessageId ??
      aiMeta?.triggeredByUserMessageId ??
      aiMeta?.triggered_user_message_id ??
      meta?.triggeredBy?.userMessageId ??
      meta?.triggered_by?.user_message_id,
  );
}

function normalizeAction(action: AssistantAction): NormalizedAction | null {
  const type = String(action.type ?? "").trim();
  const payload = action.payload ?? null;

  if (!type) return null;
  if (type === "dismiss") return { kind: "dismiss" };

  if (type === "navigate") {
    const to = typeof (payload as any)?.to === "string" ? String((payload as any).to).trim() : "";
    if (!to) return null;
    return { kind: "navigate", to };
  }

  if (type === "button") {
    const raw = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
    const tool = raw
      ? [raw.tool, raw.type, raw.actionType].find(isNonEmptyString)
      : "";
    const args =
      raw && typeof raw.args === "object" && raw.args !== null
        ? (raw.args as Record<string, unknown>)
        : raw && typeof raw.payload === "object" && raw.payload !== null
          ? (raw.payload as Record<string, unknown>)
          : {};
    if (!tool) return null;
    const internal = raw ? Boolean((raw as any).internal ?? false) : false;
    return { kind: "tool", tool: String(tool).trim(), args, internal };
  }

  const internal = Boolean((payload as any)?.internal ?? false);
  return { kind: "tool", tool: type, args: (payload as any) ?? {}, internal };
}

function extractMessageText(row: any): string {
  const t = row?.text ?? row?.body?.text ?? row?.body ?? "";
  if (typeof t === "string") return t;
  try {
    return JSON.stringify(t);
  } catch {
  return String(t ?? "");
  }
}

async function fetchTriggeredUserText(
  svc: any,
  conversationId: string,
  userId: string,
  triggeredUserMessageId: string | null,
  assistantCreatedAt?: string | null,
): Promise<string> {
  if (triggeredUserMessageId) {
    const { data, error } = await svc
      .from("messages")
      .select("id,conversation_id,sender_id,text,body")
      .eq("id", triggeredUserMessageId)
      .eq("conversation_id", conversationId)
      .eq("sender_id", userId)
      .maybeSingle();

    if (!error && data) return extractMessageText(data);
  }

  const { data, error } = await svc
    .from("messages")
    .select("id,conversation_id,sender_id,text,body,created_at")
    .eq("conversation_id", conversationId)
    .eq("sender_id", userId)
    .lt("created_at", assistantCreatedAt ?? new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!error && data) return extractMessageText(data);

  return "";
}

async function resolveListIdByName(svc: any, userId: string, listName: string): Promise<string | null> {
  if (!listName) return null;
  const { data: foundExact, error: exactErr } = await svc
    .from("lists")
    .select("id")
    .eq("user_id", userId)
    .ilike("name", listName)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (exactErr) throw new Error(exactErr.message);
  if (foundExact?.id) return String(foundExact.id);

  const pattern = listName.includes("%") ? listName : `%${listName}%`;
  const { data: foundFuzzy, error: fuzzyErr } = await svc
    .from("lists")
    .select("id")
    .eq("user_id", userId)
    .ilike("name", pattern)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (fuzzyErr) throw new Error(fuzzyErr.message);
  return foundFuzzy?.id ? String(foundFuzzy.id) : null;
}

async function resolveListIdByTitleId(svc: any, userId: string, titleId: string): Promise<string | null> {
  if (!titleId) return null;
  const { data: hit, error: hitErr } = await svc
    .from("list_items")
    .select("list_id, lists!inner(id,user_id)")
    .eq("title_id", titleId)
    .eq("lists.user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (hitErr) throw new Error(hitErr.message);
  return hit?.list_id ? String(hit.list_id) : null;
}

export async function handler(req: Request) {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  const requestId = getRequestId(req);
  const logCtx = { fn: FN_NAME, requestId };

  try {
    if (req.method !== "POST") {
      return jsonError("Method Not Allowed", 405, "METHOD_NOT_ALLOWED", req, {
        allow: ["POST"],
      });
    }

    const supabaseAuth = getUserClient(req);
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      log(logCtx, "Authentication error", { error: authError?.message });
      return jsonError("Unauthorized", 401, "UNAUTHORIZED", req);
    }

    const body = (await req.json().catch(() => null)) as RequestBody | null;
    const conversationId = (body?.conversationId ?? "").trim();
    const messageId = (body?.messageId ?? "").trim();
    const actionId = (body?.actionId ?? "").trim();
    const confirmToken = typeof body?.confirmToken === "string" ? body.confirmToken.trim() : "";

    if (!conversationId || !messageId || !actionId) {
      return jsonError("Missing required fields", 400, "BAD_REQUEST", req, {
        conversationId: Boolean(conversationId),
        messageId: Boolean(messageId),
        actionId: Boolean(actionId),
      });
    }

    const userId = user.id;

    // Ensure the user is a participant in the conversation.
    const { data: part, error: partErr } = await supabaseAuth
      .from("conversation_participants")
      .select("conversation_id,user_id")
      .eq("conversation_id", conversationId)
      .eq("user_id", userId)
      .maybeSingle();

    if (partErr) {
      log(logCtx, "Failed to check conversation membership", { error: partErr.message });
      return jsonError("Database operation failed", 500, "DB_ERROR", req);
    }

    if (!part) {
      return jsonError("Forbidden", 403, "FORBIDDEN", req);
    }


    const svc = getAdminClient();

    const cfg = getConfig();
    let assistant;
    try {
      assistant = await resolveAssistantIdentity(svc, cfg, logCtx);
    } catch (e: any) {
      const code = String(e?.message || "");
      if (code === "ASSISTANT_NOT_FOUND") return jsonError("Assistant user not found", 404, "ASSISTANT_NOT_FOUND", req);
      if (code === "ASSISTANT_NOT_CONFIGURED") return jsonError("Assistant not configured", 500, "ASSISTANT_NOT_CONFIGURED", req);
      return jsonError("Assistant lookup failed", 500, "ASSISTANT_LOOKUP_FAILED", req);
    }
    const assistantUserId = assistant.id;

    // Fetch the source message (RLS should allow reading messages in the conversation).
    const { data: msg, error: msgErr } = await supabaseAuth
      .from("messages")
      .select("id,conversation_id,user_id,meta,created_at")
      .eq("id", messageId)
      .eq("conversation_id", conversationId)
      .eq("user_id", assistantUserId)
      .maybeSingle();

    if (msgErr) {
      log(logCtx, "Failed to fetch message", { error: msgErr.message });
      return jsonError("Database operation failed", 500, "DB_ERROR", req);
    }

    if (!msg) {
      return jsonError("Message not found", 404, "NOT_FOUND", req);
    }

    const ai = (msg as any)?.meta?.ai;
    const actions = Array.isArray(ai?.actions) ? (ai.actions as AssistantAction[]) : [];
    const action = actions.find((a) => a && String((a as any).id) === actionId) ?? null;

    if (!action) {
      return jsonError("Action not found", 404, "ACTION_NOT_FOUND", req);
    }

    const normalized = normalizeAction(action);
    if (!normalized) {
      return jsonError("Invalid action", 400, "INVALID_ACTION", req);
    }

    if (normalized.kind === "dismiss") {
      return jsonResponse({ ok: true, toast: "Dismissed." }, 200, undefined, req);
    }

    if (normalized.kind === "navigate") {
      return jsonResponse(
        {
          ok: true,
          toast: "Opening…",
          navigateTo: normalized.to,
        },
        200,
        undefined,
        req,
      );
    }

    let normalizedArgs = normalizeToolArgs(normalized.tool, normalized.args ?? {});

    const toolName = String(normalized.tool ?? "");
    const needsListContext =
      (toolName.startsWith("list_") || toolName === "list_set_visibility") &&
      !isNonEmptyString((normalizedArgs as any).listId) &&
      !isNonEmptyString((normalizedArgs as any).listName);
    const needsTitleContext = [
      "list_add_item",
      "list_add_items",
      "list_remove_item",
      "diary_set_status",
      "rate_title",
      "review_upsert",
    ].includes(toolName) && !isNonEmptyString((normalizedArgs as any).titleId);
    const needsListItems =
      toolName === "list_add_items" &&
      (!Array.isArray((normalizedArgs as any).items) || (normalizedArgs as any).items.length === 0) &&
      (!Array.isArray((normalizedArgs as any).titleIds) || (normalizedArgs as any).titleIds.length === 0);

    if (needsListContext || needsTitleContext || needsListItems) {
      try {
        const triggeredUserMessageId = getTriggeredUserMessageId((msg as any)?.meta ?? null);
        const userText = await fetchTriggeredUserText(svc, conversationId, userId, triggeredUserMessageId, (msg as any)?.created_at ?? null);
        if (userText) {
          normalizedArgs = applyTextInferences(toolName, normalizedArgs, userText);
          normalizedArgs = normalizeToolArgs(toolName, normalizedArgs);
        }
      } catch (_e) {
        // Best-effort only.
      }
    }

    // Resolve listId when possible (helps confirm buttons for list tools).
    if (toolName.startsWith("list_") || toolName === "list_set_visibility") {
      try {
        const listId = coerceArgString((normalizedArgs as any).listId);
        const listName = coerceArgString((normalizedArgs as any).listName);
        const titleId = coerceArgString((normalizedArgs as any).titleId);
        if (!listId && listName) {
          const resolved = await resolveListIdByName(svc, userId, listName);
          if (resolved) (normalizedArgs as any).listId = resolved;
        }
        if (!coerceArgString((normalizedArgs as any).listId) && toolName === "list_remove_item" && titleId) {
          const resolved = await resolveListIdByTitleId(svc, userId, titleId);
          if (resolved) (normalizedArgs as any).listId = resolved;
        }
      } catch (_e) {
        // Best-effort only.
      }
    }

    normalized.args = normalizedArgs;

    const tool = assertAllowedUserActionTool(normalized.tool, Boolean((normalized as any).internal));

    // ------------------------------------------------------------------
    // Idempotency + confirmation
    //
    // - action_id is the UI button id, unique per assistant message.
    // - action_key is a stable hash used for retries (and optional dedupe).
    // - For high-risk tools, we require an explicit confirm token.
    // ------------------------------------------------------------------
    const internal = Boolean((normalized as any).internal ?? false);
    const actionKey = await computeActionKey({ userId, conversationId, messageId, actionId, tool, args: normalized.args ?? {}, internal });
    const confirmRule = internal ? { needs: false, kind: "default" as const, prompt: "" } : requiresConfirmation(tool, normalized.args);

    const now = new Date();
    const nowIso = now.toISOString();

    let existingLog: any = null;
    try {
      const { data, error } = await supabaseAuth
        .from("assistant_message_action_log")
        .select("id,created_at,status,confirm_token,confirm_expires_at,payload,undo_tool,undo_args")
        .eq("user_id", userId)
        .eq("conversation_id", conversationId)
        .eq("message_id", messageId)
        .eq("action_id", actionId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!error && data) existingLog = data;
    } catch (_e) {
      // ignore
    }

    const existingStatus = typeof existingLog?.status === "string" ? String(existingLog.status) : "";
    if (existingLog && existingStatus === "done") {
      const prevToast = typeof existingLog?.payload?.toast === "string" ? String(existingLog.payload.toast) : "Already applied.";
      const prevResult = existingLog?.payload?.result ?? null;
      return jsonResponse({ ok: true, toast: prevToast, alreadyExecuted: true, result: prevResult }, 200, undefined, req);
    }
    if (existingLog && existingStatus === "processing") {
      return jsonResponse({ ok: true, toast: "Working…", alreadyProcessing: true }, 200, undefined, req);
    }

    // Confirmation step for high-risk tools.
    if (confirmRule.needs) {
      const exp = existingLog?.confirm_expires_at ? new Date(String(existingLog.confirm_expires_at)) : null;
      const notExpired = exp ? exp.getTime() > now.getTime() : false;
      const existingToken = typeof existingLog?.confirm_token === "string" ? String(existingLog.confirm_token) : "";

      if (!confirmToken) {
        if (existingLog && existingStatus === "needs_confirm" && existingToken && notExpired) {
          return jsonResponse(
            {
              ok: true,
              needsConfirm: true,
              confirmToken: existingToken,
              confirmKind: confirmRule.kind,
              confirmPrompt: confirmRule.prompt,
            },
            200,
            undefined,
            req,
          );
        }

        const token = issueConfirmToken();
        const expiresAt = new Date(now.getTime() + 10 * 60_000);

        const payload = {
          ...(typeof (action as any).payload === "object" && (action as any).payload !== null ? (action as any).payload : {}),
          tool,
          args: normalized.args ?? {},
          actionKey,
          status: "needs_confirm",
          confirmKind: confirmRule.kind,
          confirmPrompt: confirmRule.prompt,
          confirmIssuedAt: nowIso,
          confirmExpiresAt: expiresAt.toISOString(),
        };

        try {
          if (existingLog?.id) {
            await supabaseAuth
              .from("assistant_message_action_log")
              .update({
                action_key: actionKey,
                status: "needs_confirm",
                request_id: requestId,
                confirm_token: token,
                confirm_expires_at: expiresAt.toISOString(),
                payload,
              })
              .eq("id", existingLog.id)
              .eq("user_id", userId);
          } else {
            await supabaseAuth.from("assistant_message_action_log").insert({
              user_id: userId,
              conversation_id: conversationId,
              message_id: messageId,
              action_id: actionId,
              action_type: tool,
              action_key: actionKey,
              status: "needs_confirm",
              request_id: requestId,
              confirm_token: token,
              confirm_expires_at: expiresAt.toISOString(),
              payload,
            });
          }
        } catch (_e) {
          // ignore
        }

        return jsonResponse(
          {
            ok: true,
            needsConfirm: true,
            confirmToken: token,
            confirmKind: confirmRule.kind,
            confirmPrompt: confirmRule.prompt,
          },
          200,
          undefined,
          req,
        );
      }

      // confirmToken provided -> validate
      if (!existingLog || existingStatus !== "needs_confirm" || !existingToken || !notExpired || existingToken !== confirmToken) {
        // Token invalid/expired: re-issue a new token instead of hard-failing.
        const token = issueConfirmToken();
        const expiresAt = new Date(now.getTime() + 10 * 60_000);
        try {
          if (existingLog?.id) {
            await supabaseAuth
              .from("assistant_message_action_log")
              .update({
                action_key: actionKey,
                status: "needs_confirm",
                request_id: requestId,
                confirm_token: token,
                confirm_expires_at: expiresAt.toISOString(),
                payload: {
                  ...(typeof (action as any).payload === "object" && (action as any).payload !== null ? (action as any).payload : {}),
                  tool,
                  args: normalized.args ?? {},
                  actionKey,
                  status: "needs_confirm",
                  confirmKind: confirmRule.kind,
                  confirmPrompt: confirmRule.prompt,
                  confirmIssuedAt: nowIso,
                  confirmExpiresAt: expiresAt.toISOString(),
                },
              })
              .eq("id", existingLog.id)
              .eq("user_id", userId);
          }
        } catch (_e) {
          // ignore
        }

        return jsonResponse(
          {
            ok: true,
            needsConfirm: true,
            confirmToken: token,
            confirmKind: confirmRule.kind,
            confirmPrompt: confirmRule.prompt,
          },
          200,
          undefined,
          req,
        );
      }
    }

    // Ensure an action log row exists and mark it as processing.
    let actionLogId: string | null = existingLog?.id ?? null;
    try {
      if (actionLogId) {
        await supabaseAuth
          .from("assistant_message_action_log")
          .update({
            action_key: actionKey,
            status: "processing",
            request_id: requestId,
            started_at: nowIso,
            confirm_token: null,
            confirm_expires_at: null,
            payload: {
              ...(typeof (action as any).payload === "object" && (action as any).payload !== null ? (action as any).payload : {}),
              tool,
              args: normalized.args ?? {},
              actionKey,
              status: "processing",
              startedAt: nowIso,
            },
          })
          .eq("id", actionLogId)
          .eq("user_id", userId);
      } else {
        const { data: inserted } = await supabaseAuth
          .from("assistant_message_action_log")
          .insert({
            user_id: userId,
            conversation_id: conversationId,
            message_id: messageId,
            action_id: actionId,
            action_type: tool,
            action_key: actionKey,
            status: "processing",
            request_id: requestId,
            started_at: nowIso,
            payload: {
              ...(typeof (action as any).payload === "object" && (action as any).payload !== null ? (action as any).payload : {}),
              tool,
              args: normalized.args ?? {},
              actionKey,
              status: "processing",
              startedAt: nowIso,
            },
          })
          .select("id")
          .maybeSingle();
        actionLogId = (inserted as any)?.id ?? null;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log(logCtx, "Failed to mark action as processing", { error: msg });
    }

    // Execute tool as the current user.
    let result: unknown = null;
    let navigateTo: string | null = null;
    const toolArgs: Record<string, unknown> = { ...(normalized.args ?? {}) };
    if (tool === "message_send" && typeof (toolArgs as any).clientId !== "string") {
      (toolArgs as any).clientId = actionKey;
    }

    try {
      const r = await executeAssistantTool(supabaseAuth, userId, {
        tool: tool as any,
        args: toolArgs,
      });
      if (!r?.ok) throw new Error((r as any)?.message || (r as any)?.error || "Tool failed");
      result = (r as any).result;
      navigateTo = (r as any).navigateTo ?? null;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log(logCtx, "Tool execution failed", { tool, error: message });

      if (actionLogId) {
        try {
          await supabaseAuth
            .from("assistant_message_action_log")
            .update({
              status: "failed",
              finished_at: new Date().toISOString(),
              payload: {
                ...(typeof (action as any).payload === "object" && (action as any).payload !== null ? (action as any).payload : {}),
                tool,
                args: toolArgs,
                actionKey,
                status: "failed",
                error: message,
                finishedAt: new Date().toISOString(),
              },
            })
            .eq("id", actionLogId)
            .eq("user_id", userId);
        } catch (_e) {
          // ignore
        }
      }

      return jsonError("Action failed", 400, "ACTION_FAILED", req, { tool, error: message });
    }

    const toast = summarizeResult(tool, result);
    const undo = deriveUndoPlan(tool, toolArgs, result);
    const finishedIso = new Date().toISOString();

    // Update action log row with a compact outcome.
    if (actionLogId) {
      try {
        await supabaseAuth
          .from("assistant_message_action_log")
          .update({
            action_key: actionKey,
            status: "done",
            finished_at: finishedIso,
            undo_tool: undo ? undo.tool : null,
            undo_args: undo ? undo.args : null,
            payload: {
              ...(typeof (action as any).payload === "object" && (action as any).payload !== null ? (action as any).payload : {}),
              tool,
              args: toolArgs,
              actionKey,
              ok: true,
              status: "done",
              toast,
              finishedAt: finishedIso,
              undo: undo ?? null,
              result: safeTruncateForLog(result),
            },
          })
          .eq("id", actionLogId)
          .eq("user_id", userId);
      } catch (_e) {
        // ignore
      }
    }

    // Insert a small assistant follow-up message so the action feels real.
    try {
      const undoAction = undo
        ? {
            id: crypto.randomUUID(),
            label: undo.label ?? "Undo",
            type: "button",
            payload: {
              tool: undo.tool,
              args: undo.args,
              internal: Boolean(undo.internal ?? false),
            },
          }
        : null;

      await svc.from("messages").insert({
        conversation_id: conversationId,
        user_id: assistantUserId,
        sender_id: assistantUserId,
        body: { type: "text", text: toast },
        message_type: "text",
        text: toast,
        client_id: null,
        attachment_url: null,
        meta: {
          ai: {
            kind: "action_result",
            tool,
            actionId,
            ok: true,
            ...(undoAction ? { actions: [undoAction] } : {}),
          },
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log(logCtx, "Failed to insert assistant follow-up", { error: msg });
    }

    return jsonResponse({ ok: true, toast, result, ...(navigateTo ? { navigateTo } : {}) }, 200, undefined, req);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    log(logCtx, "Unexpected error", { error: message, stack });

    // Best-effort telemetry.
    try {
      const svc = getAdminClient(req);
      await safeInsertAssistantFailure(svc, {
        fn: FN_NAME,
        request_id: requestId,
        code: "INTERNAL_ERROR",
        message,
        details: { stack: stack ?? null },
      });
    } catch {
      // ignore
    }
    return jsonError("Internal server error", 500, "INTERNAL_ERROR", req);
  }
}

serve(handler);

function summarizeResult(tool: string, result: unknown): string {
  // Keep this short: it shows in the UI as a toast and as a follow-up message.
  switch (tool) {
    case "diary_set_status":
      return "Done — updated your diary.";
    case "create_list":
      return "Done — list created.";
    case "list_add_item":
      return "Done — added to the list.";
    case "message_send":
      return "Sent.";
    case "playbook_start":
      return "Plan started ✅";
    case "playbook_end":
      return "Plan ended.";
    case "goal_start":
      return "Goal started ✅";
    case "goal_end":
      return "Goal updated.";
    default:
      if (typeof result === "string" && result.trim()) return result.trim().slice(0, 120);
      return "Done.";
  }
}

function safeTruncateForLog(v: unknown): unknown {
  // Keep action logs compact and safe to store in JSONB.
  const seen = new WeakSet<object>();

  const walk = (x: any, depth: number): any => {
    if (depth > 3) return null;
    if (x === null || x === undefined) return x;
    if (typeof x === 'string') return x.length > 800 ? x.slice(0, 800) + '…' : x;
    if (typeof x === 'number' || typeof x === 'boolean') return x;
    if (Array.isArray(x)) return x.slice(0, 20).map((y) => walk(y, depth + 1));
    if (typeof x === 'object') {
      if (seen.has(x)) return '[circular]';
      seen.add(x);
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(x).slice(0, 30)) {
        out[k] = walk((x as any)[k], depth + 1);
      }
      return out;
    }
    return String(x);
  };

  return walk(v as any, 0);
}
