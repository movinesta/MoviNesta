// supabase/functions/assistant-message-action/index.ts
//
// Executes a structured action attached to an assistant chat message.
// The action is stored on the message `meta.ai.actions[]`.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

import { handleOptions, jsonError, jsonResponse } from "../_shared/http.ts";
import { log } from "../_shared/logger.ts";
import { getAdminClient, getUserClient } from "../_shared/supabase.ts";
import { getConfig } from "../_shared/config.ts";
import { resolveAssistantIdentity } from "../_shared/assistantIdentity.ts";
import { executeAssistantTool } from "../_shared/assistantTools.ts";

const FN_NAME = "assistant-message-action";

const ACTION_TOOL_ALLOWLIST = new Set<string>([
  // Reads / lookups
  "schema_summary",
  "db_read",
  "get_my_profile",
  "get_my_stats",
  "get_ctx_snapshot",
  "get_my_lists",
  "get_list_items",
  "get_my_library",
  "search_catalog",
  "search_my_library",
  "get_my_recent_activity",
  "get_tool_result",
  "get_trending",
  "get_recommendations",
  "resolve_title",
  "resolve_list",
  "resolve_user",
  "get_my_rating",
  "get_my_review",
  "get_relationship_status",
  "get_recent_likes",

  // Writes
  "plan_execute",
  "create_list",
  "list_add_item",
  "list_add_items",
  "list_remove_item",
  "list_set_visibility",
  "rate_title",
  "review_upsert",
  "follow_user",
  "unfollow_user",
  "block_user",
  "unblock_user",
  "notifications_mark_read",
  "conversation_mute",
  "diary_set_status",
  "message_send",
  "playbook_start",
  "playbook_end",
  "goal_start",
  "goal_end",
]);

type RequestBody = {
  conversationId?: string;
  messageId?: string;
  actionId?: string;
};

type AssistantAction = {
  id: string;
  label?: string;
  type: string;
  payload?: unknown;
};

type NormalizedAction =
  | { kind: "tool"; tool: string; args: Record<string, unknown> }
  | { kind: "navigate"; to: string }
  | { kind: "dismiss" };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
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
    return { kind: "tool", tool: String(tool).trim(), args };
  }

  return { kind: "tool", tool: type, args: (payload as any) ?? {} };
}

export async function handler(req: Request) {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  const logCtx = { fn: FN_NAME };

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
      .select("id,conversation_id,user_id,meta")
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

    const tool = normalized.tool;
    if (!ACTION_TOOL_ALLOWLIST.has(tool)) {
      return jsonError("Action not allowed", 403, "ACTION_NOT_ALLOWED", req, { tool });
    }
    // Execute tool as the current user.
    let result: unknown = null;
    try {
      const r = await executeAssistantTool(supabaseAuth, userId, {
        tool: tool as any,
        args: normalized.args ?? {},
      });
      if (!r?.ok) throw new Error((r as any)?.error || "Tool failed");
      result = (r as any).result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log(logCtx, "Tool execution failed", { tool, error: message });
      return jsonError("Action failed", 400, "ACTION_FAILED", req, { tool, error: message });
    }

    // Best-effort logging for analytics/debugging.
    try {
      await supabaseAuth.from("assistant_message_action_log").insert({
        user_id: userId,
        conversation_id: conversationId,
        message_id: messageId,
        action_id: actionId,
        action_type: tool,
        payload: (action as any).payload ?? {},
      });
    } catch (_e) {
      // ignore if migration not applied yet
    }
    const toast = summarizeResult(tool, result);

    // Insert a small assistant follow-up message so the action feels real.
    try {
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
          },
        },
      });
    } catch (e) {
      // Not fatal — we still return ok.
      const msg = e instanceof Error ? e.message : String(e);
      log(logCtx, "Failed to insert assistant follow-up", { error: msg });
    }

    return jsonResponse({ ok: true, toast, result }, 200, undefined, req);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    log({ fn: FN_NAME }, "Unexpected error", { error: message, stack });
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
    case "goal_start":
      return "Goal started ✅";
    case "goal_end":
      return "Goal updated.";
    default:
      if (typeof result === "string" && result.trim()) return result.trim().slice(0, 120);
      return "Done.";
  }
}
