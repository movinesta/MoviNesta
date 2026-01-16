// supabase/functions/assistant-tool-result/index.ts
//
// Fetches a logged tool result by its handle (action_id) from assistant_message_action_log.
//
// Why:
// - The assistant logs full tool results server-side to avoid re-sending huge JSON back into the model.
// - The UI (or the assistant via get_tool_result) can fetch details on-demand.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

import { getRequestId, handleOptions, jsonError, jsonResponse, validateRequest } from "../_shared/http.ts";
import { log } from "../_shared/logger.ts";
import { getAdminClient, getUserClient } from "../_shared/supabase.ts";
import { loadAppSettingsForScopes } from "../_shared/appSettings.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";

const FN_NAME = "assistant-tool-result";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// The client may send any of these keys (older builds used `actionId`,
// some use `id` or `logId`). We accept all to avoid brittle coupling.
const RequestSchema = z
  .object({
    actionId: z.string().min(8).max(128).optional(),
    id: z.string().min(8).max(128).optional(),
    logId: z.string().min(8).max(128).optional(),
  // Optional truncation settings (defensive):
  maxString: z.number().int().min(80).max(4000).optional(),
  maxArray: z.number().int().min(1).max(200).optional(),
  maxObjectKeys: z.number().int().min(5).max(200).optional(),
  })
  .refine((v) => !!(v.actionId ?? v.id ?? v.logId), {
    message: "Missing actionId",
  });

type RequestPayload = z.infer<typeof RequestSchema>;

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.trunc(n);
  if (i < min) return min;
  if (i > max) return max;
  return i;
}


function truncateDeep(
  v: any,
  depth: number,
  limits: { maxString: number; maxArray: number; maxObjectKeys: number },
  maxDepth: number,
): any {
  if (depth > maxDepth) return null;
  if (v == null) return v;

  if (typeof v === "string") {
    return v.length > limits.maxString ? v.slice(0, limits.maxString) + "…" : v;
  }
  if (typeof v === "number" || typeof v === "boolean") return v;

  if (Array.isArray(v)) {
    return v.slice(0, limits.maxArray).map((x) => truncateDeep(x, depth + 1, limits, maxDepth));
  }

  if (typeof v === "object") {
    const keys = Object.keys(v).slice(0, limits.maxObjectKeys);
    const o: Record<string, any> = {};
    for (const k of keys) o[k] = truncateDeep((v as any)[k], depth + 1, limits, maxDepth);
    return o;
  }

  return String(v);
}

export async function handler(req: Request) {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  const requestId = getRequestId(req);
  const logCtx = { fn: FN_NAME, requestId };

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

    const rl = await enforceRateLimit(req, { action: "assistant_tool_result", maxPerMinute: 120 });
    if (!rl.ok) {
      return jsonError("Rate limit exceeded", 429, "RATE_LIMIT", req, { retryAfterSeconds: rl.retryAfterSeconds });
    }

    const { data: payload, errorResponse } = await validateRequest<RequestPayload>(
      req,
      (raw) => RequestSchema.parse(raw),
      { requireJson: true },
    );
    if (errorResponse) return errorResponse;

    const supabaseAdmin = getAdminClient();

    // Server-only defaults + caps (backwards compatible if setting row is missing).
    let truncCfg: any = null;
    try {
      const env = await loadAppSettingsForScopes(supabaseAdmin as any, ["server_only"]);
      truncCfg = (env.settings as any)["assistant.tool_result_truncation"] ?? null;
    } catch {
      truncCfg = null;
    }

    const cfgDefaults = (truncCfg && typeof truncCfg === "object" ? (truncCfg as any).defaults : null) ?? {};
    const cfgCaps = (truncCfg && typeof truncCfg === "object" ? (truncCfg as any).caps : null) ?? {};

    const dMaxString = clampInt((cfgDefaults as any).maxString, 80, 4000, 1200);
    const dMaxArray = clampInt((cfgDefaults as any).maxArray, 1, 200, 40);
    const dMaxKeys = clampInt((cfgDefaults as any).maxObjectKeys, 5, 200, 60);

    let capMaxString = clampInt((cfgCaps as any).maxString, 80, 4000, 4000);
    let capMaxArray = clampInt((cfgCaps as any).maxArray, 1, 200, 200);
    let capMaxKeys = clampInt((cfgCaps as any).maxObjectKeys, 5, 200, 200);

    // Misconfig guard: caps must be >= defaults.
    if (capMaxString < dMaxString) capMaxString = dMaxString;
    if (capMaxArray < dMaxArray) capMaxArray = dMaxArray;
    if (capMaxKeys < dMaxKeys) capMaxKeys = dMaxKeys;

    const maxDepth = clampInt((truncCfg as any)?.maxDepth, 1, 8, 4);

    const limits = {
      maxString: clampInt(payload.maxString ?? dMaxString, 80, capMaxString, dMaxString),
      maxArray: clampInt(payload.maxArray ?? dMaxArray, 1, capMaxArray, dMaxArray),
      maxObjectKeys: clampInt(payload.maxObjectKeys ?? dMaxKeys, 5, capMaxKeys, dMaxKeys),
    };

    const rawId = (payload.actionId ?? payload.id ?? payload.logId)?.trim();
    if (!rawId) {
      return jsonError("Missing action id", 400, "MISSING_ACTION_ID", req);
    }

    // Use the admin client for reads because RLS / permissions may block the user
    // client from retrieving the log row, which makes "Evidence" links look like 404s.
    // We still enforce access by checking (a) the row's user_id and (b) membership in
    // the conversation.

    // Some clients send the row UUID (`id`), others send the tool `action_id`.
    // Try the most likely lookup first.
    const baseSelect =
      "id,created_at,conversation_id,message_id,action_id,action_type,payload,user_id";

    const looksLikeUuid = UUID_RE.test(rawId);

    const tryFetch = async (by: "id" | "action_id") => {
      return await supabaseAdmin
        .from("assistant_message_action_log")
        .select(baseSelect)
        .eq(by, rawId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
    };

    const first = looksLikeUuid ? "id" : "action_id";
    const second = looksLikeUuid ? "action_id" : "id";

    let { data, error } = await tryFetch(first);
    if (!error && !data) {
      const retry = await tryFetch(second);
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      log(logCtx, "Failed to fetch tool result", { error: error.message });
      return jsonError("Database operation failed", 500, "DB_ERROR", req);
    }

    if (!data) {
      return jsonError("Not found", 404, "NOT_FOUND", req);
    }

    if (data.user_id !== user.id) {
      return jsonError("Access denied", 403, "NO_ACCESS", req);
    }

    const { data: member, error: memberError } = await supabaseAdmin
      .from("conversation_participants")
      .select("conversation_id")
      .eq("conversation_id", data.conversation_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberError) {
      log(logCtx, "Failed to check conversation membership", { error: memberError.message });
      return jsonError("Database operation failed", 500, "DB_ERROR", req);
    }

    if (!member) {
      return jsonError("Access denied", 403, "NO_ACCESS", req);
    }

    // We return a safe truncation of the payload.
    const safePayload = truncateDeep((data as any).payload ?? null, 0, limits, maxDepth);

    const payloadObj =
      safePayload && typeof safePayload === "object" ? (safePayload as Record<string, unknown>) : {};

    // Frontend expects this normalized shape.
    const tool = typeof payloadObj.tool === "string" ? payloadObj.tool : "unknown";
    const args = (payloadObj.args as unknown) ?? {};
    const result = (payloadObj.result as unknown) ?? null;

    return jsonResponse(
      {
        ok: true,
        actionId: data.action_id,
        tool,
        args,
        result,
        createdAt: data.created_at,

        // Extra fields for debugging / future UI.
        id: data.id,
        actionType: data.action_type,
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
