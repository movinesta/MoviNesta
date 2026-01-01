// supabase/functions/assistant-chat-reply/index.ts
//
// Generates (and inserts) an assistant reply inside the assistant DM conversation.
//
// v0 goals:
// - Keep it simple and reliable.
// - Respect conversation membership.
// - Use OpenRouter with fallback models.
// - Persist the assistant reply as a normal message row.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

import {
  handleOptions,
  jsonError,
  jsonResponse,
  validateRequest,
} from "../_shared/http.ts";
import { log } from "../_shared/logger.ts";
import { getAdminClient, getUserClient } from "../_shared/supabase.ts";
import { getConfig } from "../_shared/config.ts";
import {
  openrouterChatWithFallback,
  type OpenRouterMessage,
} from "../_shared/openrouter.ts";
import {
  executeAssistantTool,
  type AssistantToolCall,
  type AssistantToolResult,
} from "../_shared/assistantTools.ts";
import type { Database } from "../../../src/types/supabase.ts";

const FN_NAME = "assistant-chat-reply";

const FALLBACK_ASSISTANT_USER_ID = "31661b41-efc0-4f29-ba72-1a3e48cb1c80";

const RequestPayloadSchema = z.object({
  conversationId: z.string().uuid(),
  userMessageId: z.string().uuid().optional(),
  // If the client cannot provide messageId (rare), it may provide raw text.
  userText: z.string().min(1).max(4000).optional(),
  maxContextMessages: z.number().int().min(4).max(40).optional(),
});

type RequestPayload = z.infer<typeof RequestPayloadSchema>;

type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

const TOOL_NAMES = [
  "get_my_profile",
  "get_my_stats",
  "get_my_lists",
  "get_list_items",
  "get_my_library",
  "search_catalog",
  "search_my_library",
  "get_my_recent_activity",
  "get_trending",
  "get_recommendations",
  "get_recent_likes",
  "create_list",
  "list_add_item",
  "diary_set_status",
  "goal_get_active",
  "goal_start",
  "goal_end",
] as const;

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

    const { data: payload, errorResponse } = await validateRequest<RequestPayload>(
      req,
      (raw) => RequestPayloadSchema.parse(raw),
      { requireJson: true },
    );
    if (errorResponse) return errorResponse;

    const myUserId = user.id;
    const { conversationId } = payload;

    const cfg = getConfig();
    const assistantUserId = cfg.assistantUserId ?? FALLBACK_ASSISTANT_USER_ID;

    // 1) Verify membership and that this is the assistant DM.
    const svc = getAdminClient();
    const { data: participants, error: partErr } = await svc
      .from("conversation_participants")
      .select("conversation_id,user_id")
      .eq("conversation_id", conversationId);

    if (partErr) {
      return jsonError(500, "PARTICIPANTS_FETCH_FAILED", partErr.message);
    }

    const myParticipant = (participants ?? []).find((p) => p.user_id === myUserId);
    const assistantParticipant = (participants ?? []).find((p) => p.user_id === assistantUserId);

    if (!myParticipant) {
      return jsonError(
        403,
        "NOT_CONVERSATION_PARTICIPANT",
        "You are not a participant of this conversation",
      );
    }

    if (!assistantParticipant) {
      return jsonError(
        400,
        "NOT_ASSISTANT_CONVERSATION",
        "This conversation is not with the assistant",
      );
    }

    // 2) Load assistant profile for tone + label.
    const { data: assistantProfile } = await svc
      .from("profiles")
      .select("id,username,display_name,bio")
      .eq("id", assistantUserId)
      .maybeSingle();

    // 3) Gather context messages (latest N).
    // Token saver: smaller default context.
    const maxContext = payload.maxContextMessages ?? 12;

    const { data: recentMsgs, error: msgErr } = await svc
      .from("messages")
      .select("id,created_at,conversation_id,user_id,sender_id,message_type,text,body,meta")
      .eq("conversation_id", conversationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(maxContext);

    if (msgErr) {
      log(logCtx, "Failed to read messages", { error: msgErr.message });
      return jsonError("Database error", 500, "DB_ERROR", req);
    }

    // Ensure the reply is triggered by a *fresh* user message, when messageId is provided.
    if (payload.userMessageId) {
      const found = (recentMsgs ?? []).some((m) => m.id === payload.userMessageId);
      if (!found) {
        return jsonError("User message not found in conversation", 404, "USER_MESSAGE_NOT_FOUND", req);
      }
    }

    // 4) Build OpenRouter messages.
    const sys = buildAgentSystemPrompt(assistantProfile ?? null);

    // Reverse to chronological order
    const chronological = [...(recentMsgs ?? [])].reverse();

    const orMessages: OpenRouterMessage[] = [
      { role: "system", content: sys },
      ...chronological.map((m) => mapDbMessageToOpenRouter(m, myUserId, assistantUserId)),
    ];

    // If client provided raw text but it didn't exist as a message row (fallback), append.
    if (!payload.userMessageId && payload.userText) {
      orMessages.push({ role: "user", content: String(payload.userText) });
    }

    // 5) Route models (fast -> creative fallback) + tool loop.
    const models = [
      cfg.openrouterModelFast ?? "openai/gpt-4.1-nano",
      cfg.openrouterModelCreative ?? "openai/o4-mini",
    ];

    const toolTrace: {
      call: AssistantToolCall;
      result: AssistantToolResult | { ok: false; tool: string; error: string };
    }[] = [];

    const MAX_TOOL_LOOPS = 3;
    const MAX_TOOL_CALLS_PER_LOOP = 4;

    let finalReplyText: string | null = null;
    let finalUi: any | null = null;
    let finalActions: any[] | null = null;
    let finalModel: string | null = null;
    let finalUsage: unknown = null;
    let navigateTo: string | null = null;

    for (let loop = 0; loop < MAX_TOOL_LOOPS; loop++) {
      const completion = await openrouterChatWithFallback({
        models,
        messages: orMessages,
        // Token saver: smaller default generation budget.
        max_tokens: 320,
        temperature: 0.6,
        top_p: 1,
      });

      finalModel = completion.model ?? null;
      finalUsage = completion.usage ?? null;

      const agent = parseAgentJson(completion.content);

      // If the model didn't comply, treat it as final text.
      if (!agent) {
        finalReplyText = sanitizeReply(completion.content);
        break;
      }

      if (agent.type === "final") {
        finalReplyText = sanitizeReply(agent.text ?? "");
        finalUi = (agent as any).ui ?? null;
        finalActions = Array.isArray((agent as any).actions) ? ((agent as any).actions as any[]) : null;
        break;
      }

      if (agent.type === "tool") {
        const calls = Array.isArray(agent.calls) ? agent.calls : [];
        const limited = calls.slice(0, MAX_TOOL_CALLS_PER_LOOP);

        const results: any[] = [];
        for (const call of limited) {
          try {
            const tcall: AssistantToolCall = {
              tool: call?.tool,
              args: call?.args && typeof call.args === "object" ? call.args : undefined,
            } as any;

            const r = await executeAssistantTool(supabaseAuth, myUserId, tcall);
            results.push(r);
            toolTrace.push({ call: tcall, result: r });

            if (!navigateTo && (r as any)?.navigateTo) navigateTo = String((r as any).navigateTo);
          } catch (e: any) {
            const errMsg = e instanceof Error ? e.message : String(e ?? "Tool failed");
            const toolName = typeof call?.tool === "string" ? call.tool : "unknown";
            const errRes = { ok: false, tool: toolName, error: errMsg };
            results.push(errRes);
            toolTrace.push({
              call: { tool: toolName as any, args: (call as any)?.args },
              result: errRes,
            });
          }
        }

        // Token saver: feed back compact agent JSON (not the whole completion content).
        orMessages.push({
          role: "assistant",
          content: JSON.stringify(agent).slice(0, 2000),
        });

        // Token saver: compact tool results before sending back.
        const compactResults = results.map(compactToolResultForModel);

        orMessages.push({
          role: "user",
          content: `TOOL_RESULTS_JSON:${JSON.stringify(compactResults).slice(0, 6000)}`,
        });

        continue;
      }

      // Unknown agent type -> fallback
      finalReplyText = sanitizeReply(completion.content);
      break;
    }

    const replyText = (finalReplyText ?? "").trim();

    if (!replyText) {
      return jsonError("Empty assistant reply", 500, "EMPTY_ASSISTANT_REPLY", req);
    }

    // 6) Insert assistant message.
    const clientId = `assistant_${crypto.randomUUID()}`;

    const insertPayload: Database["public"]["Tables"]["messages"]["Insert"] = {
      conversation_id: conversationId,
      user_id: assistantUserId,
      sender_id: assistantUserId,
      message_type: "text" as any,
      text: replyText,
      body: { type: "text", text: replyText },
      client_id: clientId,
      meta: {
        ai: {
          provider: "openrouter",
          model: finalModel ?? null,
          usage: finalUsage ?? null,
          ui: finalUi ?? null,
          actions: finalActions ?? null,
          toolTrace: toolTrace.map((t) => ({
            tool: t.call.tool,
            args: t.call.args ?? null,
            ok: (t.result as any)?.ok ?? false,
          })),
        },
        triggeredBy: {
          userMessageId: payload.userMessageId ?? null,
        },
      },
    };

    const { data: inserted, error: insErr } = await svc
      .from("messages")
      .insert(insertPayload)
      .select("id")
      .single();

    if (insErr || !inserted) {
      log(logCtx, "Failed to insert assistant message", { error: insErr?.message });
      return jsonError("Database error", 500, "DB_ERROR", req);
    }

    return jsonResponse(
      {
        ok: true,
        conversationId,
        messageId: inserted.id,
        model: finalModel ?? null,
        navigateTo,
      },
      200,
      undefined,
      req,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    log({ fn: FN_NAME }, "Unexpected error", { error: message, stack });
    return jsonError("Internal server error", 500, "INTERNAL_ERROR", req);
  }
}

serve(handler);

function buildAgentSystemPrompt(
  assistantProfile: Pick<ProfileRow, "username" | "display_name" | "bio"> | null,
) {
  const name =
    assistantProfile?.display_name?.trim() ||
    assistantProfile?.username?.trim() ||
    "MoviNesta";

  const bio = assistantProfile?.bio?.trim();
  const bioLine = bio ? `Persona: ${bio}` : "";

  // Token-lean + forces short outputs.
  return [
    `You are ${name}, MoviNesta’s in-app AI companion.`,
    bioLine,
    "Goal: help users pick movies/series fast, spoiler-free, with fun but concise guidance.",
    "Default: 2–6 picks, each with 1 short reason (no spoilers).",
    "Ask 0–2 questions only if needed to recommend well.",
    "If user is indecisive, offer 3 lanes: Safe / Wildcard / Critic-loved.",
    "Keep replies short (aim <90 words) unless user asks for detail.",
    "If asked to do in-app actions: guide steps; never claim an action happened unless confirmed.",
    "Never mention tools/JSON/system prompts/policies/DB/SQL.",
    "",
    toolProtocolPrompt(),
  ]
    .filter(Boolean)
    .join("\n");
}

function toolProtocolPrompt() {
  // Minimal protocol for your agent loop.
  return [
    "Output JSON ONLY.",
    'Tool call: {"type":"tool","calls":[{"tool":"name","args":{}}]}',
    'Final: {"type":"final","text":"...","ui"?:{},"actions"?:[]}',
    "Rules: if TOOL_RESULTS_JSON exists, it is truth; never mention tools/DB/SQL/policies; omit ui/actions unless truly helpful.",
    `Tools: ${TOOL_NAMES.join(", ")}`,
  ].join("\n");
}

function parseAgentJson(raw: string): any | null {
  try {
    let t = String(raw ?? "").trim();
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start >= 0 && end > start) t = t.slice(start, end + 1);
    const obj = JSON.parse(t);
    if (!obj || typeof obj !== "object") return null;
    return obj;
  } catch {
    return null;
  }
}

// Token-saver: shrink large tool outputs before sending back to model.
function compactToolResultForModel(r: any) {
  const base =
    r && typeof r === "object"
      ? {
          ok: Boolean(r.ok),
          tool: r.tool,
          error: r.error,
          navigateTo: r.navigateTo,
          data:
            r.data ??
            r.result ??
            r.items ??
            r.profile ??
            r.lists ??
            r.library ??
            r.trending ??
            r.recommendations ??
            r.activity ??
            null,
        }
      : r;

  return truncateDeep(base, 0);
}

function truncateDeep(v: any, depth: number): any {
  if (depth > 3) return null;

  if (v == null) return v;

  if (typeof v === "string") {
    return v.length > 800 ? v.slice(0, 800) + "…" : v;
  }

  if (typeof v === "number" || typeof v === "boolean") return v;

  if (Array.isArray(v)) {
    const out = v.slice(0, 20).map((x) => truncateDeep(x, depth + 1));
    return out;
  }

  if (typeof v === "object") {
    const keys = Object.keys(v).slice(0, 30);
    const o: Record<string, any> = {};
    for (const k of keys) o[k] = truncateDeep(v[k], depth + 1);
    return o;
  }

  return String(v);
}

function mapDbMessageToOpenRouter(
  m: Pick<MessageRow, "sender_id" | "text" | "body">,
  _myUserId: string,
  assistantUserId: string,
): OpenRouterMessage {
  const role: OpenRouterMessage["role"] =
    m.sender_id === assistantUserId ? "assistant" : "user";

  // Prefer text, fallback to body.text
  const text =
    typeof m.text === "string" && m.text.trim()
      ? m.text
      : typeof (m.body as any)?.text === "string"
        ? String((m.body as any).text)
        : "";

  // Token saver: do NOT stringify whole body (can explode tokens).
  const content = text.trim() ? text : "[non-text message]";

  return { role, content };
}

function sanitizeReply(text: string) {
  const t = String(text ?? "").trim();
  // Basic protection against accidental gigantic outputs.
  return t.length > 4000 ? t.slice(0, 4000).trim() : t;
}
