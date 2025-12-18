// supabase/functions/create-direct-conversation/index.ts
//
// Creates (or reuses) a one-on-one conversation between the current user
// and a target user.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

import { handleOptions, jsonError, jsonResponse, validateRequest } from "../_shared/http.ts";
import { log } from "../_shared/logger.ts";
import { getAdminClient, getUserClient } from "../_shared/supabase.ts";
import type { Database } from "../../../src/types/supabase.ts";

const FN_NAME = "create-direct-conversation";

// ============================================================================
// Type Definitions
// ============================================================================

type Conversation = Database["public"]["Tables"]["conversations"]["Row"];

const RequestPayloadSchema = z.object({
  targetUserId: z.string().uuid("Invalid target user ID"),
});

type RequestPayload = z.infer<typeof RequestPayloadSchema>;

// ============================================================================
// Main Request Handler
// ============================================================================

export async function handler(req: Request) {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  const logCtx = { fn: FN_NAME };

  try {
    const supabaseAuth = getUserClient(req);
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      log(logCtx, "Authentication error", { error: authError?.message });
      return jsonError("Unauthorized", 401, "UNAUTHORIZED");
    }

    const { data: payload, errorResponse } = await validateRequest<RequestPayload>(req, (raw) =>
      RequestPayloadSchema.parse(raw)
    );
    if (errorResponse) return errorResponse;

    const myUserId = user.id;
    const { targetUserId } = payload;

    if (targetUserId === myUserId) {
      return jsonError("Cannot start a conversation with yourself", 400, "BAD_REQUEST_SELF_TARGET");
    }

    const blockStatus = await getBlockStatus(supabaseAuth, myUserId, targetUserId);
    if (blockStatus.youBlocked) {
      return jsonError("You have blocked this user.", 403, "BLOCKED_BY_SELF");
    }
    if (blockStatus.blockedYou) {
      return jsonError("This user has blocked you.", 403, "BLOCKED_BY_OTHER");
    }

    const supabaseAdmin = getAdminClient();
    const directPair = [myUserId, targetUserId].sort();

    // Find or create the conversation in one step.
    const conversation = await findOrCreateConversation(supabaseAdmin, myUserId, directPair);

    // Ensure participants are correctly linked.
    await ensureParticipants(supabaseAdmin, conversation.id, directPair);

    log(logCtx, "Successfully found or created conversation", {
      userId: myUserId,
      conversationId: conversation.id,
    });

    return jsonResponse({ ok: true, conversationId: conversation.id });
  } catch (err) {
    log(logCtx, "Unexpected error", { error: err.message, stack: err.stack });
    return jsonError("Internal server error", 500, "INTERNAL_ERROR");
  }
}

serve(handler);

// ============================================================================
// Helper Functions
// ============================================================================

async function getBlockStatus(
  supabase: SupabaseClient<Database>,
  myUserId: string,
  targetUserId: string,
) {
  const { data, error } = await supabase
    .from("blocked_users")
    .select("blocker_id,blocked_id")
    .or(`and(blocker_id.eq.${myUserId},blocked_id.eq.${targetUserId}),and(blocker_id.eq.${targetUserId},blocked_id.eq.${myUserId})`);

  if (error) {
    log({ fn: FN_NAME }, "Block lookup failed", { error: error.message });
    throw new Error("Failed to check block status");
  }

  const youBlocked = data.some((r) => r.blocker_id === myUserId);
  const blockedYou = data.some((r) => r.blocker_id === targetUserId);

  return { youBlocked, blockedYou };
}

async function findOrCreateConversation(
  supabase: SupabaseClient<Database>,
  creatorId: string,
  directPair: string[],
): Promise<Conversation> {
  // Use upsert to atomically find or create the conversation.
  // The unique index on `direct_participant_ids` for non-group chats handles the conflict.
  const { data, error } = await supabase
    .from("conversations")
    .upsert(
      {
        is_group: false,
        created_by: creatorId,
        direct_participant_ids: directPair,
      },
      { onConflict: "direct_participant_ids", ignoreDuplicates: false },
    )
    .select()
    .single();

  if (error || !data) {
    log({ fn: FN_NAME }, "Failed to find or create conversation", { error: error?.message });
    throw new Error("Database operation failed");
  }

  return data;
}

async function ensureParticipants(
  supabase: SupabaseClient<Database>,
  conversationId: string,
  participantIds: string[],
) {
  const { error } = await supabase.from("conversation_participants").upsert(
    participantIds.map((userId) => ({
      conversation_id: conversationId,
      user_id: userId,
      role: "member" as const,
    })),
    { onConflict: "conversation_id, user_id" },
  );

  if (error) {
    log({ fn: FN_NAME }, "Failed to ensure participants", { conversationId, error: error.message });
    // This is not ideal, but the conversation can proceed even if this fails.
    // A background job could clean this up.
  }
}
