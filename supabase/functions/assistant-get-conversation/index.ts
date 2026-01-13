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
import { loadPublicAppSettings } from "../_shared/appSettings.ts";
import { resolveAssistantIdentity } from "../_shared/assistantIdentity.ts";
import type { Database } from "../../../src/types/supabase.ts";

const FN_NAME = "assistant-get-conversation";


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

    const supabaseAdmin = getAdminClient();

    const cfg = getConfig();
    let assistant;
    try {
      assistant = await resolveAssistantIdentity(supabaseAdmin, cfg, logCtx);
    } catch (e: any) {
      const code = String(e?.message || "");
      if (code === "ASSISTANT_NOT_FOUND") return jsonError("Assistant user not found", 404, "ASSISTANT_NOT_FOUND", req);
      if (code === "ASSISTANT_NOT_CONFIGURED") return jsonError("Assistant not configured", 500, "ASSISTANT_NOT_CONFIGURED", req);
      return jsonError("Assistant lookup failed", 500, "ASSISTANT_LOOKUP_FAILED", req);
    }

    const assistantUserId = assistant.id;

// Prefer Admin Dashboard setting (public) for assistant username, then env fallback.
let assistantUsername = (cfg.assistantUsername ?? "movinesta").trim();
try {
  const pub = await loadPublicAppSettings(supabaseAdmin as any, { cacheTtlMs: 30_000 });
  const v = (pub.settings as any)?.["ux.assistant.username"];
  if (typeof v === "string" && v.trim()) assistantUsername = v.trim();
} catch {
  // best-effort: keep env/default
}

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

    // Ensure assistant exists (helpful error for setup)
    
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
          id: assistant.id,
          username: assistant.username ?? assistantUsername,
          display_name: assistant.display_name ?? "MoviNesta",
          avatar_url: assistant.avatar_url ?? null,
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
