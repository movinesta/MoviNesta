// supabase/functions/assistant-message-action/index.ts
//
// Executes a structured action attached to an assistant chat message.
// The action is stored on the message `meta.ai.actions[]`.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

import { handleOptions, jsonError, jsonResponse } from "../_shared/http.ts";
import { log } from "../_shared/logger.ts";
import { getAdminClient, getUserClient } from "../_shared/supabase.ts";
import { getConfig } from "../_shared/config.ts";
import { executeAssistantTool } from "../_shared/assistantTools.ts";

const FN_NAME = "assistant-message-action";

const FALLBACK_ASSISTANT_USER_ID = "31661b41-efc0-4f29-ba72-1a3e48cb1c80";

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

    // Fetch the source message (RLS should allow reading messages in the conversation).
    const { data: msg, error: msgErr } = await supabaseAuth
      .from("messages")
      .select("id,conversation_id,user_id,meta")
      .eq("id", messageId)
      .eq("conversation_id", conversationId)
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

    const tool = String((action as any).type ?? "").trim();
    if (!tool) {
      return jsonError("Invalid action", 400, "INVALID_ACTION", req);
    }

    // Execute tool as the current user.
    let result: unknown = null;
    try {
      const r = await executeAssistantTool(supabaseAuth, userId, { tool: tool as any, args: (action as any).payload ?? {} });
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

    const cfg = getConfig();
    const assistantUserId = (cfg.assistantUserId ?? FALLBACK_ASSISTANT_USER_ID).trim();

    const toast = summarizeResult(tool, result);

    // Insert a small assistant follow-up message so the action feels real.
    try {
      const admin = getAdminClient();
      await admin.from("messages").insert({
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
