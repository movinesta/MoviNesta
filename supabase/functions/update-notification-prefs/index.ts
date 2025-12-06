// supabase/functions/update-notification-prefs/index.ts
//
// Reads and updates notification preference toggles for the authenticated user.
// GET returns the current preferences (falling back to defaults).
// POST upserts the provided preferences into the notification_preferences table.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import type { SupabaseClient, User } from "https://esm.sh/@supabase/supabase-js@2";

import { handleOptions, jsonError, jsonResponse, validateRequest } from "../_shared/http.ts";
import { log } from "../_shared/logger.ts";
import { getUserClient } from "../_shared/supabase.ts";
import type { Database } from "../../../src/types/supabase.ts";

const FN_NAME = "update-notification-prefs";

// ============================================================================
// Type and Schema Definitions
// ============================================================================

type NotificationPreferences = Database["public"]["Tables"]["notification_preferences"]["Row"];

const DEFAULT_PREFERENCES: Omit<NotificationPreferences, "user_id" | "updated_at"> = {
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

serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  const logCtx = { fn: FN_NAME };

  try {
    const supabase = getUserClient(req);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      log(logCtx, "Auth error", { error: authError?.message });
      return jsonError("Unauthorized", 401, "UNAUTHORIZED");
    }

    if (req.method === "GET") {
      return await handleGet(supabase, user);
    }
    if (req.method === "POST") {
      return await handlePost(req, supabase, user);
    }

    return jsonError("Method not allowed", 405, "METHOD_NOT_ALLOWED");
  } catch (err) {
    log(logCtx, "Unhandled error", { error: err.message, stack: err.stack });
    return jsonError("Internal server error", 500, "INTERNAL_ERROR");
  }
});

// ============================================================================
// Method Handlers
// ============================================================================

async function handleGet(supabase: SupabaseClient<Database>, user: User): Promise<Response> {
  const { data, error } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    log({ fn: FN_NAME }, "Failed to load preferences", { userId: user.id, error: error.message });
    return jsonError("Failed to load preferences", 500, "PREFERENCES_LOAD_FAILED");
  }

  const preferences = data ?? {
    ...DEFAULT_PREFERENCES,
    user_id: user.id,
    updated_at: new Date().toISOString(),
  };

  return jsonResponse({ ok: true, preferences });
}

async function handlePost(req: Request, supabase: SupabaseClient<Database>, user: User): Promise<Response> {
  const { data: payload, errorResponse } = await validateRequest(req, (raw) =>
    PreferencesUpdateSchema.parse(raw)
  );
  if (errorResponse) return errorResponse;

  const { data: existing } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const update: Partial<NotificationPreferences> = {
    email_activity: payload.emailActivity,
    email_recommendations: payload.emailRecommendations,
    in_app_social: payload.inAppSocial,
    in_app_system: payload.inAppSystem,
  };

  // Filter out any undefined values so we only update what's provided.
  const finalUpdate = Object.fromEntries(Object.entries(update).filter(([, v]) => v !== undefined));

  if (Object.keys(finalUpdate).length === 0) {
    return jsonResponse({ ok: true, preferences: existing ?? DEFAULT_PREFERENCES });
  }

  const { data, error } = await supabase
    .from("notification_preferences")
    .upsert(
      {
        user_id: user.id,
        ...DEFAULT_PREFERENCES,
        ...(existing ?? {}),
        ...finalUpdate,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )
    .select()
    .single();

  if (error || !data) {
    log({ fn: FN_NAME }, "Failed to save preferences", { userId: user.id, error: error?.message });
    return jsonError("Failed to save preferences", 500, "PREFERENCES_SAVE_FAILED");
  }

  return jsonResponse({ ok: true, preferences: data });
}
