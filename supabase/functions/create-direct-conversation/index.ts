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
  validateRequest,
} from "../_shared/http.ts";
import { getAdminClient, getUserClient } from "../_shared/supabase.ts";

type ConversationParticipantRow = {
  conversation_id: string;
};

type ConversationRow = {
  id: string;
  is_group: boolean;
  direct_participant_ids: string[] | null;
  updated_at: string | null;
};

type CreateDirectConversationResponse = {
  ok: boolean;
  conversationId?: string;
  error?: string;
};

type BlockStatus = {
  youBlocked: boolean;
  blockedYou: boolean;
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

async function getBlockStatus(
  supabaseAuth: ReturnType<typeof getUserClient>,
  myUserId: string,
  targetUserId: string,
): Promise<BlockStatus> {
  const { data, error } = await supabaseAuth
    .from("blocked_users")
    .select("blocker_id, blocked_id")
    .or(
      `and(blocker_id.eq.${myUserId},blocked_id.eq.${targetUserId}),and(blocker_id.eq.${targetUserId},blocked_id.eq.${myUserId})`,
    )
    .returns<{ blocker_id: string; blocked_id: string }[]>();

  if (error) {
    console.error("[create-direct-conversation] block lookup failed", error);
    throw error;
  }

  const youBlocked = (data ?? []).some(
    (row) => row.blocker_id === myUserId && row.blocked_id === targetUserId,
  );
  const blockedYou = (data ?? []).some(
    (row) => row.blocker_id === targetUserId && row.blocked_id === myUserId,
  );

  return { youBlocked, blockedYou } satisfies BlockStatus;
}

// ---------------------------------------------------------------------------
// Helper: find existing one-on-one conversation between two users
// ---------------------------------------------------------------------------

async function findExistingDirectConversation(
  supabaseAdmin: ReturnType<typeof getAdminClient>,
  myUserId: string,
  targetUserId: string,
): Promise<string | null> {
  const directPair = [myUserId, targetUserId].sort();
  console.log(
    "[create-direct-conversation] findExistingDirectConversation",
    { myUserId, targetUserId, directPair },
  );

  const { data: directRows, error: directError } = await supabaseAdmin
    .from("conversations")
    .select("id, updated_at")
    .eq("is_group", false)
    .contains("direct_participant_ids", directPair)
    .order("updated_at", { ascending: false })
    .limit(1)
    .returns<ConversationRow[]>();

  if (directError) {
    console.error(
      "[create-direct-conversation] error searching by direct pair:",
      directError,
    );
    throw directError;
  }

  if (directRows && directRows.length > 0) {
    console.log(
      "[create-direct-conversation] found conversation by pair",
      directRows[0].id,
    );
    return directRows[0].id;
  }

  console.log(
    "[create-direct-conversation] no direct pair match; fallback to participant overlap",
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
    const validation = await validateRequest<CreateDirectConversationPayload>(
      req,
      (raw) => CreateDirectConversationPayloadSchema.parse(raw),
      { logPrefix: "[create-direct-conversation]" },
    );

    if (validation.errorResponse) return validation.errorResponse;

    const { targetUserId, context } = validation.data;

    if (targetUserId === myUserId) {
      return jsonError("targetUserId cannot be yourself", 400, "BAD_REQUEST_SELF_TARGET");
    }

    const directPair = [myUserId, targetUserId].sort();

    const blockStatus = await getBlockStatus(
      supabaseAuth,
      myUserId,
      targetUserId,
    );

    if (blockStatus.youBlocked) {
      return jsonError(
        "You have blocked this user. Unblock them to start a conversation.",
        403,
        "BLOCKED_BY_SELF",
      );
    }

    if (blockStatus.blockedYou) {
      return jsonError(
        "You cannot message this user because they have blocked you.",
        403,
        "BLOCKED_BY_OTHER",
      );
    }

    // 3) Try to find existing DM
    const existingId = await findExistingDirectConversation(supabaseAdmin, myUserId, targetUserId);

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
      .insert(
        {
          is_group: false,
          title: null,
          created_by: myUserId,
          direct_participant_ids: directPair,
        },
        { onConflict: "direct_participant_ids" },
      )
      .select("id")
      .single();

    if (convError || !conv) {
      if (convError?.code === "23505") {
        const reusedId = await findExistingDirectConversation(
          supabaseAdmin,
          myUserId,
          targetUserId,
        );

        if (reusedId) {
          console.log("[create-direct-conversation] reused existing due to conflict", reusedId);
          return jsonResponse(
            { ok: true, conversationId: reusedId } satisfies CreateDirectConversationResponse,
            200,
          );
        }
      }

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