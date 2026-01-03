// supabase/functions/assistant-tool-result/index.ts
//
// Fetches a logged tool result by its handle (action_id) from assistant_message_action_log.
//
// Why:
// - The assistant logs full tool results server-side to avoid re-sending huge JSON back into the model.
// - The UI (or the assistant via get_tool_result) can fetch details on-demand.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

import { handleOptions, jsonError, jsonResponse, validateRequest } from "../_shared/http.ts";
import { log } from "../_shared/logger.ts";
import { getUserClient } from "../_shared/supabase.ts";

const FN_NAME = "assistant-tool-result";

const RequestSchema = z.object({
  actionId: z.string().min(8).max(128),
  // Optional truncation settings (defensive):
  maxString: z.number().int().min(80).max(4000).optional(),
  maxArray: z.number().int().min(1).max(200).optional(),
  maxObjectKeys: z.number().int().min(5).max(200).optional(),
});

type RequestPayload = z.infer<typeof RequestSchema>;

function truncateDeep(
  v: any,
  depth: number,
  limits: { maxString: number; maxArray: number; maxObjectKeys: number },
): any {
  if (depth > 4) return null;
  if (v == null) return v;

  if (typeof v === "string") {
    return v.length > limits.maxString ? v.slice(0, limits.maxString) + "…" : v;
  }
  if (typeof v === "number" || typeof v === "boolean") return v;

  if (Array.isArray(v)) {
    return v.slice(0, limits.maxArray).map((x) => truncateDeep(x, depth + 1, limits));
  }

  if (typeof v === "object") {
    const keys = Object.keys(v).slice(0, limits.maxObjectKeys);
    const o: Record<string, any> = {};
    for (const k of keys) o[k] = truncateDeep((v as any)[k], depth + 1, limits);
    return o;
  }

  return String(v);
}

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

    const supabase = getUserClient(req);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      log(logCtx, "Authentication error", { error: authError?.message });
      return jsonError("Unauthorized", 401, "UNAUTHORIZED", req);
    }

    const { data: payload, errorResponse } = await validateRequest<RequestPayload>(
      req,
      (raw) => RequestSchema.parse(raw),
      { requireJson: true },
    );
    if (errorResponse) return errorResponse;

    const limits = {
      maxString: payload.maxString ?? 1200,
      maxArray: payload.maxArray ?? 40,
      maxObjectKeys: payload.maxObjectKeys ?? 60,
    };

    const actionId = payload.actionId.trim();

    const { data, error } = await supabase
      .from("assistant_message_action_log")
      .select("created_at,conversation_id,message_id,action_id,action_type,payload")
      .eq("action_id", actionId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      log(logCtx, "Failed to fetch tool result", { error: error.message });
      return jsonError("Database operation failed", 500, "DB_ERROR", req);
    }

    if (!data) {
      return jsonError("Not found", 404, "NOT_FOUND", req);
    }

    // RLS ensures only the owner can read it, but we still return a safe truncation.
    const safePayload = truncateDeep((data as any).payload ?? null, 0, limits);

    return jsonResponse(
      {
        ok: true,
        actionId: data.action_id,
        actionType: data.action_type,
        createdAt: data.created_at,
        conversationId: data.conversation_id,
        messageId: data.message_id,
        payload: safePayload,
      },
      200,
      undefined,
      req,
    );
  } catch (err: any) {
    const message = err instanceof Error ? err.message : String(err);
    log(logCtx, "Unexpected error", { error: message });
    return jsonError("Internal server error", 500, "INTERNAL_ERROR", req);
  }
}

serve(handler);