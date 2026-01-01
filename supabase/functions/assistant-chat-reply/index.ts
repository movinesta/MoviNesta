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
    const sys = buildSystemPrompt(assistantProfile ?? null);

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

    // 5) Route models (fast -> creative fallback).
    const models = [
      cfg.openrouterModelFast ?? "openai/gpt-4o-mini",
      cfg.openrouterModelCreative ?? "openai/gpt-4o",
    ];

    const completion = await openrouterChatWithFallback({
      models,
      messages: orMessages,
      max_tokens: 500,
      temperature: 0.7,
      top_p: 1,
    });

    const replyText = sanitizeReply(completion.content);

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
          model: completion.model ?? null,
          usage: completion.usage ?? null,
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
        model: completion.model ?? null,
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

function buildSystemPrompt(assistantProfile: Pick<ProfileRow, "username" | "display_name" | "bio"> | null) {
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
