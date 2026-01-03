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
    if (req.method !== "POST") {
      return jsonError("Method Not Allowed", 405, "METHOD_NOT_ALLOWED", req, {
        allow: ["POST"],
      });
    }

    const supabaseAuth = getUserClient(req);
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

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
    const { targetUserId } = payload;

    if (targetUserId === myUserId) {
      return jsonError("Cannot start a conversation with yourself", 400, "BAD_REQUEST_SELF_TARGET", req);
    }

    const blockStatus = await getBlockStatus(supabaseAuth, myUserId, targetUserId);
    if (blockStatus.youBlocked) {
      return jsonError("You have blocked this user.", 403, "BLOCKED_BY_SELF", req);
    }
    if (blockStatus.blockedYou) {
      return jsonError("This user has blocked you.", 403, "BLOCKED_BY_OTHER", req);
    }

    const supabaseAdmin = getAdminClient();
    const { data: convId, error: convErr } = await supabaseAdmin.rpc(
      "create_direct_conversation_v1",
      {
        p_creator_id: myUserId,
        p_target_user_id: targetUserId,
      },
    );

    if (convErr || !convId) {
      const mappedError = mapConversationRpcError(convErr?.message ?? "");
      if (mappedError) {
        log(logCtx, "Direct conversation rejected", { reason: mappedError.code });
        return jsonError(mappedError.message, mappedError.status, mappedError.code, req);
      }

      log(logCtx, "Failed to create direct conversation", { error: convErr?.message });
      return jsonError("Database operation failed", 500, "DB_ERROR", req);
    }

    log(logCtx, "Successfully found or created conversation", {
      userId: myUserId,
      conversationId: convId,
    });

    return jsonResponse({ ok: true, conversationId: convId }, 200, undefined, req);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    log(logCtx, "Unexpected error", { error: message, stack });
    return jsonError("Internal server error", 500, "INTERNAL_ERROR", req);
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

function mapConversationRpcError(message: string) {
  const normalized = message.toUpperCase();
  if (normalized.includes("BLOCKED_BY_SELF")) {
    return { status: 403, code: "BLOCKED_BY_SELF", message: "You have blocked this user." };
  }
  if (normalized.includes("BLOCKED_BY_OTHER")) {
    return { status: 403, code: "BLOCKED_BY_OTHER", message: "This user has blocked you." };
  }
  if (normalized.includes("TARGET_NOT_FOUND")) {
    return { status: 404, code: "TARGET_NOT_FOUND", message: "Target user does not exist." };
  }
  if (normalized.includes("CREATOR_NOT_FOUND")) {
    return { status: 401, code: "UNAUTHORIZED", message: "User session is invalid." };
  }
  if (normalized.includes("SELF_CONVERSATION")) {
    return { status: 400, code: "BAD_REQUEST_SELF_TARGET", message: "Cannot start a conversation with yourself." };
  }
  if (normalized.includes("MISSING_USER_ID")) {
    return { status: 400, code: "BAD_REQUEST_MISSING_USER", message: "Missing user id." };
  }
  return null;
}

// NOTE: Conversation creation + participant linking is handled transactionally by
// the create_direct_conversation_v1() database function.
