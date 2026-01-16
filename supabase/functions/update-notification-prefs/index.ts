// supabase/functions/update-notification-prefs/index.ts
//
// Reads and updates notification preference toggles for the authenticated user.
// GET returns the current preferences (falling back to defaults).
// POST upserts the provided preferences into the user_preferences table (notifications column).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import type { SupabaseClient, User } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import { getRequestId, handleOptions, jsonError, jsonResponse, validateRequest } from "../_shared/http.ts";
import { log } from "../_shared/logger.ts";
import { getUserClient } from "../_shared/supabase.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import type { Database } from "../../../src/types/supabase.ts";

const FN_NAME = "update-notification-prefs";

// ============================================================================
// Type and Schema Definitions
// ============================================================================

export interface NotificationPreferences {
  email_activity: boolean;
  email_recommendations: boolean;
  in_app_social: boolean;
  in_app_system: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  email_activity: true,
  email_recommendations: true,
  in_app_social: true,
  in_app_system: true,
};


const PreferencesUpdateSchema = z.object({
  emailActivity: z.boolean().optional(),
  emailRecommendations: z.boolean().optional(),
  inAppSocial: z.boolean().optional(),
  inAppSystem: z.boolean().optional(),
});

type PreferencesUpdatePayload = z.infer<typeof PreferencesUpdateSchema>;

// ============================================================================
// Main Request Handler
// ============================================================================

export async function handler(req: Request) {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  const requestId = getRequestId(req);
  const logCtx = { fn: FN_NAME, requestId };

  try {
    const supabase = getUserClient(req);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      log(logCtx, "Auth error", { error: authError?.message });
      return jsonError(req, "Unauthorized", 401, "UNAUTHORIZED");
    }

    // Preference reads/updates are lightweight but still should be throttled.
    const rl = await enforceRateLimit(req, {
      action: req.method === "POST" ? "notification_prefs_update" : "notification_prefs_read",
      maxPerMinute: req.method === "POST" ? 60 : 240,
    });
    if (!rl.ok) {
      return jsonError(req, "Rate limit exceeded", 429, "RATE_LIMIT", { retryAfterSeconds: rl.retryAfterSeconds });
    }

    if (req.method === "GET") {
      return await handleGet(req, supabase, user);
    }
    if (req.method === "POST") {
      return await handlePost(req, supabase, user);
    }

    return jsonError(req, "Method not allowed", 405, "METHOD_NOT_ALLOWED");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    log(logCtx, "Unhandled error", { error: message, stack });
    return jsonError(req, "Internal server error", 500, "INTERNAL_ERROR");
  }
}

serve(handler);

// ============================================================================
// Method Handlers
// ============================================================================

const DEFAULT_NOTIFICATIONS = {
  emailActivity: true,
  emailRecommendations: true,
  inAppSocial: true,
  inAppSystem: true,
};

async function handleGet(req: Request, supabase: SupabaseClient<Database>, user: User): Promise<Response> {
  const { data, error } = await supabase
    .from("user_preferences")
    .select("notifications, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    log({ fn: FN_NAME }, "Failed to load preferences", { userId: user.id, error: error.message });
    return jsonError(req, "Failed to load preferences", 500, "PREFERENCES_LOAD_FAILED");
  }

  // data.notifications is JSONB (camelCase keys stored)
  const stored = (data?.notifications as any) || {};
  const preferences = {
    ...DEFAULT_NOTIFICATIONS,
    ...stored,
    updatedAt: data?.updated_at || new Date().toISOString(),
  };

  return jsonResponse(req, { ok: true, preferences });
}

async function handlePost(req: Request, supabase: SupabaseClient<Database>, user: User): Promise<Response> {
  const { data: payload, errorResponse } = await validateRequest(
    req,
    (raw) => PreferencesUpdateSchema.parse(raw),
    { requireJson: true },
  );
  if (errorResponse) return errorResponse;

  // Fetch existing to merge
  const { data: existingRow } = await supabase
    .from("user_preferences")
    .select("notifications")
    .eq("user_id", user.id)
    .maybeSingle();

  const current = (existingRow?.notifications as any) || DEFAULT_NOTIFICATIONS;

  const update = {
    ...current,
    ...payload, // overwrite with new values (undefined fields in payload are skipped by spread if undefined? No, explicit undefined overrides. Zod optional means they might be missing.)
  };

  // Zod returns undefined for missing optional fields, so we should only merge present keys.
  // Actually, spread `{ ...payload }` includes undefined if the key exists with undefined value. 
  // But Zod .parse() usually excludes missing keys? No, optional keys are present as undefined if passed explicitly, or missing if not.
  // Let's be safe and filter.
  const cleanPayload = Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined));
  const merged = { ...current, ...cleanPayload };

  const { data, error } = await supabase
    .from("user_preferences")
    .upsert(
      {
        user_id: user.id,
        notifications: merged,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )
    .select("notifications, updated_at")
    .single();

  if (error || !data) {
    log({ fn: FN_NAME }, "Failed to save preferences", { userId: user.id, error: error?.message });
    return jsonError("Failed to save preferences", 500, "PREFERENCES_SAVE_FAILED");
  }

  const result = {
    ...(data.notifications as any),
    updatedAt: data.updated_at,
  };

  return jsonResponse(req, { ok: true, preferences: result });
}
