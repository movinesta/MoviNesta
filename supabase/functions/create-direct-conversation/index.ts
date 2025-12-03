// supabase/functions/create-direct-conversation/index.ts
//
// Creates (or reuses) a one-on-one conversation between the current user
// and a target user. Uses:
//  - anon client + Authorization header to get auth user
//  - service-role client (without Authorization) to bypass RLS for DB

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { log } from "../_shared/logger.ts";
import {
  corsHeaders,
  handleOptions,
  jsonError,
  jsonResponse,
} from "../_shared/http.ts";
import { getAdminClient, getUserClient } from "../_shared/supabase.ts";

type ConversationParticipantRow = {
  conversation_id: string;
};

type ConversationRow = {
  id: string;
  is_group: boolean;
  updated_at: string | null;
};

type CreateDirectConversationResponse = {
  ok: boolean;
  conversationId?: string;
  error?: string;
};

const CreateDirectConversationPayloadSchema = z.object({
  targetUserId: z.string().uuid(),
  context: z
    .object({
      titleId: z.string().uuid().optional(),
    })
    .optional(),
});

type CreateDirectConversationPayload = z.infer<
  typeof CreateDirectConversationPayloadSchema
>;

// ---------------------------------------------------------------------------
// Helper: find existing one-on-one conversation between two users
// ---------------------------------------------------------------------------

async function findExistingDirectConversation(
  supabaseAdmin: ReturnType<typeof getAdminClient>,
  myUserId: string,
  targetUserId: string,
): Promise<string | null> {
  console.log(
    "[create-direct-conversation] findExistingDirectConversation",
    { myUserId, targetUserId },
  );

  // 1) All conversations where *I* am a participant
  const { data: myRows, error: myError } = await supabaseAdmin
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", myUserId)
    .returns<ConversationParticipantRow[]>();

  if (myError) {
    console.error(
      "[create-direct-conversation] error loading my participants:",
      myError,
    );
    throw myError;
  }

  const myConversationIds = (myRows ?? []).map((row) => row.conversation_id);
  if (myConversationIds.length === 0) {
    console.log("[create-direct-conversation] no conversations for current user");
    return null;
  }

  // 2) Among those, find conversations where target user also participates
  const { data: theirRows, error: theirError } = await supabaseAdmin
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", targetUserId)
    .in("conversation_id", myConversationIds)
    .returns<ConversationParticipantRow[]>();

  if (theirError) {
    console.error(
      "[create-direct-conversation] error loading target participants:",
      theirError,
    );
    throw theirError;
  }

  const sharedIds = Array.from(
    new Set((theirRows ?? []).map((row) => row.conversation_id)),
  );

  if (sharedIds.length === 0) {
    console.log("[create-direct-conversation] no shared conversations found");
    return null;
  }

  // 3) Filter to non-group conversations and pick most recently updated
  const { data: conversations, error: convError } = await supabaseAdmin
    .from("conversations")
    .select("id, is_group, updated_at")
    .in("id", sharedIds)
    .eq("is_group", false)
    .order("updated_at", { ascending: false })
    .limit(1)
    .returns<ConversationRow[]>();

  if (convError) {
    console.error(
      "[create-direct-conversation] error loading conversations:",
      convError,
    );
    throw convError;
  }

  if (!conversations || conversations.length === 0) {
    console.log(
      "[create-direct-conversation] no non-group shared conversations found",
    );
    return null;
  }

  console.log(
    "[create-direct-conversation] reusing conversation",
    conversations[0].id,
  );
  return conversations[0].id;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  console.log("[create-direct-conversation] incoming request", {
    method: req.method,
    url: req.url,
  });

  let supabaseAuth;
  let supabaseAdmin;
  try {
    supabaseAuth = getUserClient(req);
    supabaseAdmin = getAdminClient();
  } catch (error) {
    console.error("[create-direct-conversation] Supabase configuration error", error);
    return jsonError("Server misconfigured", 500, "SERVER_MISCONFIGURED");
  }

  try {
    // 1) Auth: who is calling?
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser();

    if (authError) {
      console.error(
        "[create-direct-conversation] auth error:",
        authError.message,
      );
      return jsonError("Unauthorized", 401, "UNAUTHORIZED");
    }

    if (!user) {
      console.error("[create-direct-conversation] no user in auth context");
      return jsonError("Unauthorized", 401, "UNAUTHORIZED");
    }

    const myUserId = user.id;

    // 2) Parse body
    const rawBody = await req.json().catch((e) => {
      console.error("[create-direct-conversation] invalid JSON body:", e);
      return null;
    });

    const parsed = CreateDirectConversationPayloadSchema.safeParse(rawBody);
    if (!parsed.success) {
      console.error(
        "[create-direct-conversation] invalid payload",
        parsed.error.flatten(),
      );
      return jsonError("Invalid request body", 400, "BAD_REQUEST_INVALID_BODY");
    }

    const { targetUserId, context } = parsed.data;

    if (targetUserId === myUserId) {
      return jsonError("targetUserId cannot be yourself", 400, "BAD_REQUEST_SELF_TARGET");
    }

    // 3) Try to find existing DM
    const existingId = await findExistingDirectConversation(
      supabaseAdmin,
      myUserId,
      targetUserId,
    );

    if (existingId) {
      return jsonResponse(
        { ok: true, conversationId: existingId } satisfies CreateDirectConversationResponse,
        200,
      );
    }

    console.log("[create-direct-conversation] creating new conversation");

    // 4) Create conversation (admin client bypasses RLS)
    const { data: conv, error: convError } = await supabaseAdmin
      .from("conversations")
      .insert({
        is_group: false,
        title: null,
        created_by: myUserId,
      })
      .select("id")
      .single();

    if (convError || !conv) {
      console.error(
        "[create-direct-conversation] error creating conversation:",
        convError,
      );
      return jsonError("Failed to create conversation", 500, "CONVERSATION_CREATE_FAILED");
    }

    const conversationId = conv.id as string;

    // 5) Insert both participants (bypassing RLS)
    const { error: participantsError } = await supabaseAdmin
      .from("conversation_participants")
      .insert([
        {
          conversation_id: conversationId,
          user_id: myUserId,
          role: "member",
        },
        {
          conversation_id: conversationId,
          user_id: targetUserId,
          role: "member",
        },
      ]);

    if (participantsError) {
      console.error(
        "[create-direct-conversation] error inserting participants:",
        participantsError,
      );
      return jsonError("Failed to add participants", 500, "CONVERSATION_PARTICIPANTS_FAILED");
    }

    console.log(
      "[create-direct-conversation] success",
      { conversationId },
    );

    return jsonResponse(
      { ok: true, conversationId } satisfies CreateDirectConversationResponse,
      200,
    );
  } catch (err) {
    console.error("[create-direct-conversation] unexpected error:", err);
    return jsonError("Internal server error", 500, "INTERNAL_ERROR");
  }
});