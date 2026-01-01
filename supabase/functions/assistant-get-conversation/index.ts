// supabase/functions/assistant-get-conversation/index.ts
//
// Gets (or creates) the one-on-one conversation between the current user
// and the MoviNesta Assistant user.
//
// Why a dedicated function?
// - The assistant user id should NOT be hardcoded in the client.
// - We want a single place to enforce any future policy (rate limits, blocks, etc).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

import { handleOptions, jsonError, jsonResponse } from "../_shared/http.ts";
import { log } from "../_shared/logger.ts";
import { getAdminClient, getUserClient } from "../_shared/supabase.ts";
import { getConfig } from "../_shared/config.ts";
import type { Database } from "../../../src/types/supabase.ts";

const FN_NAME = "assistant-get-conversation";

const FALLBACK_ASSISTANT_USER_ID = "31661b41-efc0-4f29-ba72-1a3e48cb1c80";

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

    const myUserId = user.id;

    const cfg = getConfig();
    const assistantUserId = (cfg.assistantUserId ?? FALLBACK_ASSISTANT_USER_ID).trim();
    const assistantUsername = (cfg.assistantUsername ?? "movinesta").trim();

    if (!assistantUserId) {
      return jsonError(
        "Assistant user is not configured",
        500,
        "ASSISTANT_NOT_CONFIGURED",
        req,
      );
    }

    if (assistantUserId === myUserId) {
      return jsonError(
        "Assistant user id is misconfigured (cannot equal current user)",
        500,
        "ASSISTANT_MISCONFIGURED",
        req,
      );
    }

    const blockStatus = await getBlockStatus(supabaseAuth, myUserId, assistantUserId);
    if (blockStatus.youBlocked) {
      return jsonError("You have blocked the assistant.", 403, "BLOCKED_BY_SELF", req);
    }
    if (blockStatus.blockedYou) {
      return jsonError("Assistant has blocked you.", 403, "BLOCKED_BY_OTHER", req);
    }

    const supabaseAdmin = getAdminClient();

    // Ensure assistant exists (helpful error for setup)
    const { data: assistantProfile, error: assistantErr } = await supabaseAdmin
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .eq("id", assistantUserId)
      .maybeSingle();

    if (assistantErr) {
      log(logCtx, "Failed to look up assistant profile", { error: assistantErr.message });
      return jsonError("Database operation failed", 500, "DB_ERROR", req);
    }

    if (!assistantProfile) {
      return jsonError(
        "Assistant profile not found. Create the assistant user/profile first.",
        404,
        "ASSISTANT_NOT_FOUND",
        req,
      );
    }

    const { data: convId, error: convErr } = await supabaseAdmin.rpc(
      "create_direct_conversation_v1",
      {
        p_creator_id: myUserId,
        p_target_user_id: assistantUserId,
      },
    );

    if (convErr || !convId) {
      log(logCtx, "Failed to create assistant conversation", {
        error: convErr?.message,
        assistantUserId,
      });
      return jsonError("Database operation failed", 500, "DB_ERROR", req);
    }

    log(logCtx, "Assistant conversation ready", {
      userId: myUserId,
      assistantUserId,
      conversationId: convId,
    });

    return jsonResponse(
      {
        ok: true,
        conversationId: convId,
        assistant: {
          id: assistantProfile.id,
          username: assistantProfile.username ?? assistantUsername,
          display_name: assistantProfile.display_name ?? "MoviNesta",
          avatar_url: assistantProfile.avatar_url ?? null,
        },
      },
      200,
      undefined,
      req,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    log(logCtx, "Unexpected error", { error: message, stack });
    return jsonError("Internal server error", 500, "INTERNAL_ERROR", req);
  }
}

serve(handler);

async function getBlockStatus(
  supabase: SupabaseClient<Database>,
  myUserId: string,
  targetUserId: string,
) {
  const { data, error } = await supabase
    .from("blocked_users")
    .select("blocker_id,blocked_id")
    .or(
      `and(blocker_id.eq.${myUserId},blocked_id.eq.${targetUserId}),and(blocker_id.eq.${targetUserId},blocked_id.eq.${myUserId})`,
    );

  if (error) {
    log({ fn: FN_NAME }, "Block lookup failed", { error: error.message });
    throw new Error("Failed to check block status");
  }

  const youBlocked = (data ?? []).some((r) => r.blocker_id === myUserId);
  const blockedYou = (data ?? []).some((r) => r.blocker_id === targetUserId);

  return { youBlocked, blockedYou };
}
