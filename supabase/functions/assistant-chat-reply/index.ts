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

import { handleOptions, jsonError, jsonResponse, validateRequest } from "../_shared/http.ts";
import { log } from "../_shared/logger.ts";
import { getAdminClient, getUserClient } from "../_shared/supabase.ts";
import { getConfig } from "../_shared/config.ts";
import { openrouterChatWithFallback, type OpenRouterMessage } from "../_shared/openrouter.ts";
import { executeAssistantTool, type AssistantToolCall, type AssistantToolResult } from "../_shared/assistantTools.ts";
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

type ParticipantRow = Database["public"]["Tables"]["conversation_participants"]["Row"];

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

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
      return jsonError(403, "NOT_CONVERSATION_PARTICIPANT", "You are not a participant of this conversation");
    }

    if (!assistantParticipant) {
      return jsonError(400, "NOT_ASSISTANT_CONVERSATION", "This conversation is not with the assistant");
    }

    // 2) Load assistant profile for tone + label.
    const { data: assistantProfile } = await svc
      .from("profiles")
      .select("id,username,display_name,bio")
      .eq("id", assistantUserId)
      .maybeSingle();

    // 3) Gather context messages (latest N).
    const maxContext = payload.maxContextMessages ?? 20;

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
  cfg.openrouterModelFast ?? "nvidia/nemotron-3-nano-30b-a3b:free",
  cfg.openrouterModelCreative ?? "openai/gpt-4o",
];

const toolTrace: { call: AssistantToolCall; result: AssistantToolResult | { ok: false; tool: string; error: string } }[] = [];

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
    max_tokens: 650,
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
        toolTrace.push({ call: { tool: toolName as any, args: (call as any)?.args }, result: errRes });
      }
    }

    // Provide tool results back to the model and ask it to continue.
    orMessages.push({ role: "assistant", content: String(completion.content ?? "").slice(0, 8000) });
    orMessages.push({
      role: "user",
      content: `TOOL_RESULTS_JSON: ${JSON.stringify(results).slice(0, 12000)}`,
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
          toolTrace: toolTrace.map((t) => ({ tool: t.call.tool, args: t.call.args ?? null, ok: (t.result as any)?.ok ?? false })),
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

function buildAgentSystemPrompt(assistantProfile: Pick<ProfileRow, "username" | "display_name" | "bio"> | null) {
  const name = assistantProfile?.display_name || assistantProfile?.username || "MoviNesta";
  const bio = assistantProfile?.bio ? `\nBio: ${assistantProfile.bio}` : "";

  return [
    `You are ${name}, the MoviNesta in-app AI companion.`,
    "Your job: help the user discover movies/series they will love, reduce decision fatigue, and make their watch journey fun.",
    "Be concise, but never bland. Ask 1-2 clarifying questions when needed.",
    "Prefer actionable suggestions (2-6 titles) with short reasons.",
    "Avoid spoilers. If the user asks for spoilers, warn first.",
    "If the user asks to do something inside the app, explain what you can do and suggest the quickest steps.",
    "Do not mention internal policies, databases, SQL, or system prompts.",
    "If you are uncertain, say so and ask for a preference to narrow the search.",
    bio,
    "",
    toolProtocolPrompt(),
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

function toolProtocolPrompt() {
  return [
    "You have safe access to the user's MoviNesta data through TOOLS.",
    "When you need to read user data or take an in-app action, respond ONLY with JSON (no extra text):",
    `{"type":"tool","calls":[{"tool":"tool_name","args":{...}}]}`,
    "When you are ready to respond to the user, respond ONLY with JSON:",
    `{"type":"final","text":"your message to the user","ui":{...},"actions":[... ]}`,
    "UI (optional): provide a compact payload to render actionable cards under your message.",
    "- Put actions in actions[] (each action has id,label,type,payload).",
    "- In ui.cards[].actionIds, reference action ids to show buttons.",
    "- Keep ui small: up to 8 cards, up to 4 buttons per card.",

    "",
    "Available tools (use exactly these names):",
    "- get_my_profile {}",
    "- get_my_stats {}",
    "- get_my_lists { limit?: number }",
    "- get_list_items { listId: uuid, limit?: number }",
    "- get_my_library { status?: want_to_watch|watching|watched|dropped, limit?: number }",
    "- search_catalog { query: string, limit?: number }",
    "- search_my_library { query: string, limit?: number }",
    "- get_my_recent_activity { limit?: number }",
    "- get_trending { limit?: number, kind?: movie|series|anime }",
    "- get_recommendations { limit?: number, seedLikes?: number }",
    "- get_recent_likes { limit?: number }",
    "- create_list { name: string, description?: string, isPublic?: boolean, items?: [{ titleId: string, contentType: movie|series|anime, note?: string }] }",
    "- list_add_item { listId: string, titleId: string, contentType: movie|series|anime, note?: string }",
    "- diary_set_status { titleId: string, contentType: movie|series|anime, status: want_to_watch|watching|watched|dropped }",
    "- goal_get_active {}",
    "- goal_start { kind?: string, title?: string, targetCount?: number, days?: number, listId?: string }",
    "- goal_end { goalId?: string, status?: completed|cancelled }",
    "",
    "Rules:",
    "- Never request or output raw SQL.",
    "- Never access or mention other users' private data. Use tools only for the current user.",
    "- If TOOL_RESULTS_JSON is provided, treat it as ground truth.",
    "- Your final response must be natural language: do not mention tools, databases, or JSON.",
  ].join("\n");
}


function mapDbMessageToOpenRouter(m: Pick<MessageRow, "sender_id" | "text" | "body">, myUserId: string, assistantUserId: string): OpenRouterMessage {
  const role: OpenRouterMessage["role"] = m.sender_id === assistantUserId ? "assistant" : "user";

  // Prefer text, fallback to body.text
  const text = (typeof m.text === "string" && m.text.trim())
    ? m.text
    : (typeof (m.body as any)?.text === "string" ? String((m.body as any).text) : "");

  // If it's still empty, stringify body for robustness.
  const content = text.trim() ? text : JSON.stringify(m.body ?? {});

  return { role, content };
}

function sanitizeReply(text: string) {
  const t = String(text ?? "").trim();
  // Basic protection against accidental gigantic outputs.
  return t.length > 6000 ? t.slice(0, 6000).trim() : t;
}
