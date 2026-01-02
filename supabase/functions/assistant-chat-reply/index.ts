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

    // Collect tool calls (both preflight and model-initiated) for debugging/analytics.
    const toolTrace: {
      call: AssistantToolCall;
      result: AssistantToolResult | { ok: false; tool: string; error: string };
    }[] = [];

    const evidenceHandles: string[] = [];

    // 4.5) Preflight: run obvious read-only tools when the user is clearly asking for facts.
    // This reduces tool-loop churn and avoids hallucinations.
    const latestUserText =
      (payload.userText && String(payload.userText).trim()) ||
      findLatestUserText(chronological, myUserId) ||
      "";
    const prefetchCalls = inferPrefetchCalls(latestUserText).slice(0, 3);
    if (prefetchCalls.length) {
      const anchorMessageId =
        payload.userMessageId ??
        findLatestUserMessageId(chronological, myUserId) ??
        null;
      const mini: Array<[number, string, string | null, string]> = [];
      for (const tcall of prefetchCalls) {
        try {
          const r = await executeAssistantTool(supabaseAuth, myUserId, tcall);
          toolTrace.push({ call: tcall, result: r });

          const handleId = anchorMessageId
            ? await tryLogToolResult(supabaseAuth, {
                userId: myUserId,
                conversationId,
                messageId: anchorMessageId,
                tool: tcall.tool,
                args: tcall.args ?? null,
                result: (r as any)?.result ?? r,
              })
            : null;
          if (handleId) evidenceHandles.push(handleId);

          mini.push([
            (r as any)?.ok ? 1 : 0,
            String(tcall.tool),
            handleId,
            summarizeToolResult(String(tcall.tool), (r as any)?.result ?? r),
          ]);
        } catch (e: any) {
          const msg = e instanceof Error ? e.message : String(e ?? "Prefetch failed");
          mini.push([0, String(tcall.tool), null, msg.slice(0, 160)]);
        }
      }
      if (mini.length) {
        orMessages.push({ role: "user", content: `TOOL_RESULTS_MINI:${JSON.stringify(mini).slice(0, 3500)}` });
      }
    }

    // 5) Route models (fast -> creative fallback) + tool loop.
    // Choose Chat Completions–compatible defaults. (Some models require the Responses API and will 400 on /chat/completions.)
    const models = Array.from(
      new Set(
        [
          cfg.openrouterModelFast,
          cfg.openrouterModelCreative,
          // Always include safe chat-completions defaults as fallbacks.
          "openai/gpt-4o-mini",
          "openai/gpt-4.1-mini",
        ].filter(Boolean) as string[],
      ),
    );

    const responseFormat = buildAgentResponseFormat();
    const plugins = [{ id: "response-healing" }];

    const MAX_TOOL_LOOPS = 3;
    const MAX_TOOL_CALLS_PER_LOOP = 4;

    let finalReplyText: string | null = null;
    let finalUi: any | null = null;
    let finalActions: any[] | null = null;
    let finalModel: string | null = null;
    let finalUsage: unknown = null;
    let navigateTo: string | null = null;

    // Capability router: if the model tries to answer personal-data questions without evidence,
    // we force a minimal snapshot read once to anchor replies in ground truth.
    let forcedEvidenceOnce = false;

    // Evidence enforcement: for "my data" questions, require at least one grounding read.
    // We consider these tools as read evidence.
    const READ_EVIDENCE_TOOLS = new Set<string>([
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
    ]);

    const hasGroundingEvidence = () =>
      toolTrace.some((t) => {
        const nm = String(t?.call?.tool ?? "");
        return READ_EVIDENCE_TOOLS.has(nm);
      });

    for (let loop = 0; loop < MAX_TOOL_LOOPS; loop++) {
      let completion: any;
      try {
        completion = await openrouterChatWithFallback({
          models,
          messages: orMessages,
          // Token saver: smaller default generation budget.
          max_tokens: 320,
          temperature: 0.6,
          top_p: 1,
          response_format: responseFormat,
          plugins,
        });
      } catch (e: any) {
        const msg = e instanceof Error ? e.message : String(e ?? "OpenRouter error");
        log(logCtx, "OpenRouter call failed", { error: msg, status: (e as any)?.status, data: (e as any)?.data });
        finalReplyText =
          "I couldn’t reach the AI provider right now. Please try again in a moment (or check your OpenRouter API key / model settings).";
        break;
      }

      finalModel = completion.model ?? null;
      finalUsage = completion.usage ?? null;

      const agent = parseAgentJson(completion.content);

      // If the model didn't comply, treat it as final text.
      if (!agent) {
        finalReplyText = sanitizeReply(completion.content);
        break;
      }

      if (agent.type === "final") {
        // Server-side guard: if the user is asking about *their* data and we don't have
        // any grounding read yet, force a minimal snapshot once, then let the model answer.
        if (!forcedEvidenceOnce && needsEvidence(latestUserText) && !hasGroundingEvidence()) {
          forcedEvidenceOnce = true;

          const anchorMessageId =
            payload.userMessageId ??
            findLatestUserMessageId(chronological, myUserId) ??
            null;

          const mini: Array<[number, string, string | null, string]> = [];
          try {
            const tcall: AssistantToolCall = { tool: "get_ctx_snapshot" as any, args: { limit: 10 } };
            const r = await executeAssistantTool(supabaseAuth, myUserId, tcall);
            toolTrace.push({ call: tcall, result: r });

            const handleId = anchorMessageId
              ? await tryLogToolResult(supabaseAuth, {
                  userId: myUserId,
                  conversationId,
                  messageId: anchorMessageId,
                  tool: tcall.tool,
                  args: tcall.args ?? null,
                  result: (r as any)?.result ?? r,
                })
              : null;
            if (handleId) evidenceHandles.push(handleId);
            mini.push([
              1,
              String(tcall.tool),
              handleId,
              summarizeToolResult(String(tcall.tool), (r as any)?.result ?? r),
            ]);
          } catch (e: any) {
            const msg = e instanceof Error ? e.message : String(e ?? "Prefetch failed");
            mini.push([0, "get_ctx_snapshot", null, msg.slice(0, 160)]);
          }

          orMessages.push({ role: "user", content: `TOOL_RESULTS_MINI:${JSON.stringify(mini).slice(0, 3500)}` });
          continue;
        }
        finalReplyText = sanitizeReply(agent.text ?? "");
        finalUi = (agent as any).ui ?? null;
        finalActions = Array.isArray((agent as any).actions) ? ((agent as any).actions as any[]) : null;
        break;
      }

      if (agent.type === "tool") {
        const calls = Array.isArray(agent.calls) ? agent.calls : [];
        const limited = calls.slice(0, MAX_TOOL_CALLS_PER_LOOP);

        const results: any[] = [];
        const mini: Array<[number, string, string | null, string]> = [];

        // Anchor tool logs to the triggering user message if possible.
        const anchorMessageId =
          payload.userMessageId ??
          findLatestUserMessageId(chronological, myUserId) ??
          null;
        for (const call of limited) {
          try {
            const tcall: AssistantToolCall = {
              tool: call?.tool,
              args: call?.args && typeof call.args === "object" ? call.args : undefined,
            } as any;

            // "Never guess" enforcement:
            // If a write tool is missing required IDs, we run a resolver tool first.
            // We only proceed with the write if confidence is high; otherwise we return
            // resolver results so the model can ask the user to pick.
            const prepared = await maybePrepareToolCall({
              supabaseAuth,
              userId: myUserId,
              conversationId,
              anchorMessageId,
              call: tcall,
              evidenceHandles,
              toolTrace,
              mini,
            });

            if (!prepared) {
              // Resolver ran but could not disambiguate; skip executing the write.
              continue;
            }

            const finalCall = prepared;

            const r = await executeAssistantTool(supabaseAuth, myUserId, finalCall);
            results.push(r);
            toolTrace.push({ call: finalCall, result: r });

            const handleId = anchorMessageId
              ? await tryLogToolResult(supabaseAuth, {
                  userId: myUserId,
                  conversationId,
                  messageId: anchorMessageId,
                  tool: finalCall.tool,
                  args: finalCall.args ?? null,
                  result: (r as any)?.result ?? r,
                })
              : null;
          if (handleId) evidenceHandles.push(handleId);

            mini.push([
              (r as any)?.ok ? 1 : 0,
              String(finalCall.tool),
              handleId,
              summarizeToolResult(String(finalCall.tool), (r as any)?.result ?? r),
            ]);

            if (!navigateTo && (r as any)?.navigateTo) navigateTo = String((r as any).navigateTo);

            // Cheap read-back verification for key write tools (reduces hallucinations).
            const verify = await maybeVerifyAfterWrite({
              supabaseAuth,
              userId: myUserId,
              conversationId,
              anchorMessageId,
              call: finalCall,
              writeResult: (r as any)?.result ?? r,
            });
            if (verify) {
              toolTrace.push({ call: verify.call, result: verify.result });
              const vHandleId = anchorMessageId
                ? await tryLogToolResult(supabaseAuth, {
                    userId: myUserId,
                    conversationId,
                    messageId: anchorMessageId,
                    tool: verify.call.tool,
                    args: verify.call.args ?? null,
                    result: (verify.result as any)?.result ?? verify.result,
                  })
                : null;
              if (vHandleId) evidenceHandles.push(vHandleId);
              mini.push([
                1,
                String(verify.call.tool),
                vHandleId,
                summarizeToolResult(String(verify.call.tool), (verify.result as any)?.result ?? verify.result),
              ]);
            }
          } catch (e: any) {
            const errMsg = e instanceof Error ? e.message : String(e ?? "Tool failed");
            const toolName = typeof call?.tool === "string" ? call.tool : "unknown";
            const errRes = { ok: false, tool: toolName, error: errMsg };
            results.push(errRes);
            toolTrace.push({
              call: { tool: toolName as any, args: (call as any)?.args },
              result: errRes,
            });

            mini.push([0, toolName, null, errMsg.slice(0, 160)]);
          }
        }

        // Token saver: feed back compact agent JSON (not the whole completion content).
        orMessages.push({
          role: "assistant",
          content: JSON.stringify(agent).slice(0, 2000),
        });

        // Token saver: feed back a minimal, keyless array structure.
        // Full results (when available) are logged server-side for debugging/analytics.
        orMessages.push({
          role: "user",
          content: `TOOL_RESULTS_MINI:${JSON.stringify(mini).slice(0, 3500)}`,
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
          evidenceRequired: needsEvidence(latestUserText),
          evidenceGrounded: !needsEvidence(latestUserText) || hasGroundingEvidence(),
          toolHandles: evidenceHandles.slice(0, 50),
          toolsUsed: Array.from(new Set(toolTrace.map((x) => x.call.tool))).slice(0, 50),
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
        evidence: { handles: evidenceHandles.slice(0, 50) },
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
    "Never guess about user data. If unsure, call a read tool (get_my_*, search_*) or ask.",
    "If asked to do in-app actions: use tools; never claim an action happened unless TOOL_RESULTS_MINI confirms success.",
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
    "Rules: TOOL_RESULTS_MINI is ground truth. For multi-step writes, prefer plan_execute (transactional) when possible. If your plan creates a list, you may reference it later with listId=\"$last_list_id\". For any write, resolve IDs first (resolve_title/resolve_list/resolve_user, or search_catalog/search_my_library) then call a write tool. Never claim success unless a tool result shows ok=1. If a resolver returns needsDisambiguation, ask the user to pick. If a tool failed, explain and ask for needed info. Never mention tools/JSON/system prompts/DB/SQL.",
    `Tools: ${TOOL_NAMES.join(", ")}`,
  ].join("\n");
}

function buildAgentResponseFormat() {
  return {
    type: "json_schema" as const,
    json_schema: {
      name: "MoviNestaAssistantAgent",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: { type: "string", enum: ["tool", "final"] },
          calls: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                tool: { type: "string", enum: TOOL_NAMES as unknown as string[] },
                args: { type: "object", additionalProperties: true },
              },
              required: ["tool"],
            },
          },
          text: { type: "string" },
          ui: { type: "object", additionalProperties: true },
          actions: { type: "array", items: { type: "object", additionalProperties: true } },
        },
        required: ["type"],
        oneOf: [
          {
            properties: { type: { const: "tool" }, calls: { type: "array" } },
            required: ["type", "calls"],
          },
          {
            properties: { type: { const: "final" }, text: { type: "string" } },
            required: ["type", "text"],
          },
        ],
      },
    },
  };
}

function findLatestUserMessageId(
  chronological: Array<Pick<MessageRow, "id" | "sender_id">>,
  userId: string,
): string | null {
  for (let i = chronological.length - 1; i >= 0; i--) {
    const m = chronological[i];
    if (m?.sender_id === userId && typeof m?.id === "string") return m.id;
  }
  return null;
}

function findLatestUserText(
  chronological: Array<Pick<MessageRow, "sender_id" | "text" | "body">>,
  userId: string,
): string | null {
  for (let i = chronological.length - 1; i >= 0; i--) {
    const m = chronological[i] as any;
    if (m?.sender_id !== userId) continue;
    const t =
      (typeof m?.text === "string" && m.text.trim()) ||
      (typeof m?.body?.text === "string" && String(m.body.text).trim()) ||
      "";
    if (t) return t;
  }
  return null;
}

function needsEvidence(text: string): boolean {
  const t = String(text ?? "").toLowerCase();
  if (!t) return false;
  // If the user is asking about *their* data/state, we should anchor answers with a read tool.
  const self = /(\bmy\b|\bme\b|\bi\b\s+(did|have|was)|\bmine\b)/.test(t);
  if (!self) return false;
  return /(how\s+many|count|list|show|what\s+(did|do|is|are)|last|recent|rating|review|library|watchlist|goal|notification|following|blocked)/.test(t);
}

function inferPrefetchCalls(text: string): AssistantToolCall[] {
  const t = String(text ?? "").toLowerCase();
  const calls: AssistantToolCall[] = [];
  const seen = new Set<string>();
  const add = (tool: AssistantToolCall["tool"], args?: Record<string, unknown>) => {
    if (seen.has(tool)) return;
    seen.add(tool);
    calls.push({ tool, ...(args ? { args } : {}) });
  };

  // My data / profile
  // Use one snapshot call whenever the user is likely asking about their own state.
  if (/(my\s+profile|profile|username|display\s+name|bio|my\s+stats|stats|how\s+many|watched\s+count|want\s+to\s+watch|my\s+lists|watch\s*lists|my\s+library|library|watchlist|diary|recent\s+activity|what\s+did\s+i\s+watch|goal|challenge|weekly\s+plan)/.test(t)) {
    add("get_ctx_snapshot", { limit: 10 });
  }

  // More specific personal data (not covered by the snapshot).
  if (/(my\s+ratings|ratings\s+i\s+gave|what\s+did\s+i\s+rate)/.test(t)) {
    add("db_read", { resource: "ratings", limit: 12, includeMedia: true });
  }
  if (/(my\s+reviews|reviews\s+i\s+wrote)/.test(t)) {
    add("db_read", { resource: "reviews", limit: 8, includeMedia: true });
  }
  if (/(notifications|alerts|inbox)/.test(t)) {
    add("db_read", { resource: "notifications", limit: 12 });
  }
  if (/(who\s+am\s+i\s+following|my\s+following|following\s+list)/.test(t)) {
    add("db_read", { resource: "follows", limit: 20 });
  }
  if (/(blocked\s+users|who\s+did\s+i\s+block)/.test(t)) {
    add("db_read", { resource: "blocked_users", limit: 20 });
  }

  // Discovery
  if (/trending/.test(t)) add("get_trending", { limit: 12 });
  if (/(recommend|recommendation|suggest|something\s+like)/.test(t)) {
    add("get_recommendations", { limit: 12 });
  }

  // Tool result introspection (when user shares a handle)
  if (/(tool_|action_)[0-9a-f-]{8,}/.test(t) || /actionId\s*[:=]/i.test(text)) {
    const m = String(text).match(/(tool_[0-9a-f-]{8,}|action_[0-9a-f-]{8,})/i);
    if (m?.[1]) add("get_tool_result", { actionId: m[1] });
  }

  return calls;
}

type MiniRow = [number, string, string | null, string];

const WRITE_TOOLS = new Set<string>([
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

function coerceArgString(x: unknown): string {
  return typeof x === "string" ? x : String(x ?? "");
}

async function execAndLogTool(
  ctx: {
    supabaseAuth: any;
    userId: string;
    conversationId: string;
    anchorMessageId: string | null;
    evidenceHandles: string[];
    toolTrace: any[];
    mini: MiniRow[];
  },
  call: AssistantToolCall,
): Promise<AssistantToolResult | null> {
  const r = await executeAssistantTool(ctx.supabaseAuth, ctx.userId, call);
  ctx.toolTrace.push({ call, result: r });

  const handleId = ctx.anchorMessageId
    ? await tryLogToolResult(ctx.supabaseAuth, {
        userId: ctx.userId,
        conversationId: ctx.conversationId,
        messageId: ctx.anchorMessageId,
        tool: call.tool,
        args: call.args ?? null,
        result: (r as any)?.result ?? r,
      })
    : null;
  if (handleId) ctx.evidenceHandles.push(handleId);

  ctx.mini.push([
    1,
    String(call.tool),
    handleId,
    summarizeToolResult(String(call.tool), (r as any)?.result ?? r),
  ]);
  return r;
}

async function maybePrepareToolCall(args: {
  supabaseAuth: any;
  userId: string;
  conversationId: string;
  anchorMessageId: string | null;
  call: AssistantToolCall;
  evidenceHandles: string[];
  toolTrace: any[];
  mini: MiniRow[];
}): Promise<AssistantToolCall | null> {
  const tool = String(args.call.tool ?? "");
  const callArgs: any = args.call.args && typeof args.call.args === "object" ? { ...(args.call.args as any) } : {};

  // plan_execute is a meta-tool; resolution is handled inside the tool itself.
  if (tool === "plan_execute") return { tool: tool as any, args: callArgs };

  // If it's not a write tool, pass through untouched.
  if (!WRITE_TOOLS.has(tool)) return { tool: tool as any, args: callArgs };

  const ctx = {
    supabaseAuth: args.supabaseAuth,
    userId: args.userId,
    conversationId: args.conversationId,
    anchorMessageId: args.anchorMessageId,
    evidenceHandles: args.evidenceHandles,
    toolTrace: args.toolTrace,
    mini: args.mini,
  };

  // --- Title resolution (rate/review/diary) ---
  const needsTitleId = tool === "rate_title" || tool === "review_upsert" || tool === "diary_set_status";
  if (needsTitleId && !callArgs.titleId) {
    const q =
      coerceArgString(callArgs.titleQuery || callArgs.title || callArgs.query || callArgs.name).trim();
    if (!q) return null;

    const rr = await execAndLogTool(ctx, {
      tool: "resolve_title" as any,
      args: {
        query: q,
        year: callArgs.year ?? null,
        kind: callArgs.kind ?? callArgs.contentType ?? "",
        limit: 10,
      },
    });

    const best = (rr as any)?.result?.best;
    const conf = Number((rr as any)?.result?.confidence ?? 0);
    if (best?.id && conf >= 0.8) {
      callArgs.titleId = best.id;
      // Preserve original query (helps model explain what it did)
      callArgs.titleQuery = q;
    } else {
      return null;
    }
  }

  // --- List resolution ---
  const needsListId = tool.startsWith("list_") && tool !== "list_set_visibility" ? true : tool === "list_set_visibility";
  if (needsListId && !callArgs.listId) {
    const q = coerceArgString(callArgs.listQuery || callArgs.listName || callArgs.query).trim();
    if (q) {
      const rr = await execAndLogTool(ctx, {
        tool: "resolve_list" as any,
        args: { query: q, limit: 10 },
      });
      const best = (rr as any)?.result?.best;
      const conf = Number((rr as any)?.result?.confidence ?? 0);
      if (best?.id && conf >= 0.8) {
        callArgs.listId = best.id;
        callArgs.listQuery = q;
      } else {
        return null;
      }
    }
  }

  // --- TitleIds resolution for list_add_item(s) ---
  if ((tool === "list_add_item" || tool === "list_add_items") && !callArgs.titleId && !Array.isArray(callArgs.titleIds)) {
    const q = coerceArgString(callArgs.titleQuery || callArgs.title || callArgs.query).trim();
    if (q) {
      const rr = await execAndLogTool(ctx, {
        tool: "resolve_title" as any,
        args: { query: q, year: callArgs.year ?? null, kind: callArgs.kind ?? callArgs.contentType ?? "", limit: 10 },
      });
      const best = (rr as any)?.result?.best;
      const conf = Number((rr as any)?.result?.confidence ?? 0);
      if (best?.id && conf >= 0.8) {
        callArgs.titleId = best.id;
        callArgs.titleQuery = q;
      } else {
        return null;
      }
    }
  }

  if (tool === "list_add_items" && (!Array.isArray(callArgs.titleIds) || callArgs.titleIds.length === 0)) {
    const queries: string[] = Array.isArray(callArgs.titleQueries)
      ? callArgs.titleQueries.map((x: any) => coerceArgString(x).trim()).filter(Boolean)
      : [];
    if (queries.length) {
      const outIds: string[] = [];
      const max = Math.max(1, Math.min(8, Number(callArgs.max ?? queries.length)));
      for (const q of queries.slice(0, max)) {
        const rr = await execAndLogTool(ctx, { tool: "resolve_title" as any, args: { query: q, limit: 8 } });
        const best = (rr as any)?.result?.best;
        const conf = Number((rr as any)?.result?.confidence ?? 0);
        if (best?.id && conf >= 0.8) outIds.push(best.id);
      }
      if (!outIds.length) return null;
      callArgs.titleIds = outIds;
    }
  }

  // --- User resolution for social tools ---
  const needsTargetUser = tool === "follow_user" || tool === "unfollow_user" || tool === "block_user" || tool === "unblock_user";
  if (needsTargetUser && !callArgs.targetUserId) {
    const q = coerceArgString(callArgs.userQuery || callArgs.username || callArgs.query).trim();
    if (!q) return null;
    const rr = await execAndLogTool(ctx, { tool: "resolve_user" as any, args: { query: q, limit: 8 } });
    const best = (rr as any)?.result?.best;
    const conf = Number((rr as any)?.result?.confidence ?? 0);
    if (best?.id && conf >= 0.8) {
      callArgs.targetUserId = best.id;
      callArgs.userId = best.id;
      callArgs.userQuery = q;
    } else {
      return null;
    }
  }

  return { tool: tool as any, args: callArgs };
}

async function maybeVerifyAfterWrite(args: {
  supabaseAuth: any;
  userId: string;
  conversationId: string;
  anchorMessageId: string | null;
  call: AssistantToolCall;
  writeResult: any;
}): Promise<{ call: AssistantToolCall; result: AssistantToolResult } | null> {
  try {
    const tool = String(args.call.tool ?? "");
    const a: any = args.call.args ?? {};

    if (tool === "rate_title" && a?.titleId) {
      const call = { tool: "get_my_rating" as any, args: { titleId: a.titleId } };
      const result = await executeAssistantTool(args.supabaseAuth, args.userId, call);
      return { call, result };
    }
    if (tool === "review_upsert" && a?.titleId) {
      const call = { tool: "get_my_review" as any, args: { titleId: a.titleId } };
      const result = await executeAssistantTool(args.supabaseAuth, args.userId, call);
      return { call, result };
    }
    if ((tool.startsWith("list_") || tool === "create_list") && (a?.listId || args.writeResult?.listId)) {
      const listId = coerceArgString(a.listId || args.writeResult?.listId);
      if (listId) {
        const call = { tool: "get_list_items" as any, args: { listId, limit: 12 } };
        const result = await executeAssistantTool(args.supabaseAuth, args.userId, call);
        return { call, result };
      }
    }

    if (["follow_user", "unfollow_user", "block_user", "unblock_user"].includes(tool)) {
      const targetUserId = coerceArgString(a?.targetUserId ?? a?.userId ?? args.writeResult?.userId).trim();
      if (targetUserId) {
        const call = { tool: "get_relationship_status" as any, args: { targetUserId } };
        const result = await executeAssistantTool(args.supabaseAuth, args.userId, call);
        return { call, result };
      }
    }

    return null;
  } catch {
    return null;
  }
}

async function tryLogToolResult(
  supabaseAuth: any,
  args: {
    userId: string;
    conversationId: string;
    messageId: string;
    tool: string;
    args: unknown;
    result: unknown;
  },
): Promise<string | null> {
  try {
    const actionId = `tool_${crypto.randomUUID()}`;
    const payload = {
      tool: args.tool,
      args: args.args,
      // Guard rail: prevent truly massive payloads from being stored.
      // (jsonb can be large, but we don't want to blow up writes.)
      result: truncateDeep(args.result, 0),
    };

    await supabaseAuth.from("assistant_message_action_log").insert({
      user_id: args.userId,
      conversation_id: args.conversationId,
      message_id: args.messageId,
      action_id: actionId,
      action_type: `tool_result:${args.tool}`,
      payload,
    });

    return actionId;
  } catch {
    // ignore if migration not applied / RLS denies / etc.
    return null;
  }
}

function summarizeToolResult(tool: string, result: any): string {
  try {
    const t = String(tool);
    if (t === "schema_summary") {
      const n = Array.isArray(result?.resources) ? result.resources.length : 0;
      return `Schema: ${n} resources`;
    }
    if (t === "db_read") {
      const res = String(result?.resource ?? "");
      const rows = Array.isArray(result?.rows) ? result.rows : [];
      const n = rows.length;
      const media = Array.isArray(result?.media) ? result.media : [];
      const sample = media.slice(0, 3).map((m: any) => String(m?.title ?? "").trim()).filter(Boolean);
      const sampleStr = sample.length ? `; e.g. ${sample.join(" | ")}` : "";
      return `${res || "db"}: ${n} rows${sampleStr}`;
    }
    if (t === "get_trending") {
      const items = (result?.items ?? result?.trending ?? result?.result ?? result) as any;
      const n = Array.isArray(items) ? items.length : Number(result?.count ?? 0);
      return `Trending: ${Number.isFinite(n) ? n : 0} items`;
    }
    if (t === "get_recommendations") {
      const items = (result?.items ?? result?.recommendations ?? result?.result ?? result) as any;
      const n = Array.isArray(items) ? items.length : Number(result?.count ?? 0);
      return `Recommendations: ${Number.isFinite(n) ? n : 0} items`;
    }
    if (t === "search_catalog" || t === "search_my_library") {
      const items = (result?.items ?? result?.results ?? result?.result ?? result) as any;
      const n = Array.isArray(items) ? items.length : 0;
      return `Found: ${n}`;
    }
    if (t === "get_my_lists") {
      const items = (result?.lists ?? result?.items ?? result?.result ?? result) as any;
      const n = Array.isArray(items) ? items.length : 0;
      return `Lists: ${n}`;
    }
    if (t === "get_list_items") {
      const items = (result?.items ?? result?.result ?? result) as any;
      const n = Array.isArray(items) ? items.length : 0;
      return `List items: ${n}`;
    }
    if (t === "get_my_library") {
      const items = (result?.items ?? result?.library ?? result?.result ?? result) as any;
      const n = Array.isArray(items) ? items.length : 0;
      return `Library items: ${n}`;
    }
    if (t === "get_my_stats") {
      const watched = Number(result?.watched ?? result?.watched_count ?? 0);
      const wtw = Number(result?.want_to_watch ?? result?.want_to_watch_count ?? 0);
      if (Number.isFinite(watched) || Number.isFinite(wtw)) return `Stats: watched ${watched || 0}, want ${wtw || 0}`;
      return "Stats updated";
    }
    if (t === "get_tool_result") {
      return result ? "Fetched tool details" : "No tool result";
    }
    if (t === "resolve_title") {
      const best = result?.best;
      const conf = Number(result?.confidence ?? 0);
      if (best?.title) return conf >= 0.8 ? `Resolved: ${best.title}` : `Need pick: ${best.title}`;
      const n = Array.isArray(result?.candidates) ? result.candidates.length : 0;
      return `Resolve title: ${n} candidates`;
    }
    if (t === "resolve_list") {
      const best = result?.best;
      const conf = Number(result?.confidence ?? 0);
      if (best?.name) return conf >= 0.8 ? `Resolved list: ${best.name}` : `Need list pick: ${best.name}`;
      const n = Array.isArray(result?.candidates) ? result.candidates.length : 0;
      return `Resolve list: ${n} candidates`;
    }
    if (t === "resolve_user") {
      const best = result?.best;
      const conf = Number(result?.confidence ?? 0);
      if (best?.username) return conf >= 0.8 ? `Resolved user: @${best.username}` : `Need user pick: @${best.username}`;
      const n = Array.isArray(result?.candidates) ? result.candidates.length : 0;
      return `Resolve user: ${n} candidates`;
    }
    if (t === "get_my_rating") {
      const r = result?.rating;
      return r != null ? `Rating: ${r}` : "No rating";
    }
    if (t === "get_my_review") {
      return result?.id ? "Review verified" : "No review";
    }
    if (t === "create_list") {
      const name = String(result?.name ?? result?.listName ?? "").trim();
      return name ? `Created list: ${name}` : "Created list";
    }
    if (t === "list_add_item") {
      return "Added to list";
    }
    if (t === "list_add_items") {
      const n = Number(result?.added ?? 0);
      return `Added: ${Number.isFinite(n) ? n : 0}`;
    }
    if (t === "list_remove_item") {
      return "Removed from list";
    }
    if (t === "list_set_visibility") {
      return result?.isPublic ? "List is public" : "List is private";
    }
    if (t === "rate_title") {
      const r = result?.rating;
      return r != null ? `Rated: ${r}` : "Rated";
    }
    if (t === "review_upsert") {
      return result?.created ? "Review created" : result?.updated ? "Review updated" : "Review saved";
    }
    if (t === "follow_user") return "Followed";
    if (t === "unfollow_user") return "Unfollowed";
    if (t === "block_user") return "Blocked";
    if (t === "unblock_user") return "Unblocked";
    if (t === "notifications_mark_read") return "Notifications marked read";
    if (t === "conversation_mute") return "Muted";
    if (t === "diary_set_status") {
      const s = String(result?.status ?? "").trim();
      return s ? `Status: ${s}` : "Updated status";
    }
    if (t === "message_send") {
      return "Message sent";
    }
    if (t === "goal_start") return "Goal started";
    if (t === "goal_end") return "Goal ended";
    if (t === "goal_get_active") return result ? "Has active goal" : "No active goal";
    return "Done";
  } catch {
    return "Done";
  }
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