// supabase/functions/update-notification-prefs/index.ts
//
// Reads and updates notification preference toggles for the authenticated user.
// GET returns the current preferences (falling back to defaults).
// POST upserts the provided preferences into the notification_preferences table.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import {
  corsHeaders,
  handleOptions,
  jsonError,
  jsonResponse,
  validateRequest,
} from "../_shared/http.ts";
import { getUserClient } from "../_shared/supabase.ts";

const DEFAULT_PREFERENCES = {
  emailActivity: true,
  emailRecommendations: true,
  inAppSocial: true,
  inAppSystem: true,
} as const;

const PreferencesSchema = z.object({
  emailActivity: z.boolean(),
  emailRecommendations: z.boolean(),
  inAppSocial: z.boolean(),
  inAppSystem: z.boolean(),
});

const logPrefix = "[update-notification-prefs]";

type PreferencesPayload = z.infer<typeof PreferencesSchema>;

type PreferencesResponse = PreferencesPayload & { updatedAt: string };

type NotificationPreferencesRow = {
  user_id: string;
  email_activity: boolean;
  email_recommendations: boolean;
  in_app_social: boolean;
  in_app_system: boolean;
  updated_at: string;
};

function mapRowToResponse(row: NotificationPreferencesRow): PreferencesResponse {
  return {
    emailActivity: row.email_activity,
    emailRecommendations: row.email_recommendations,
    inAppSocial: row.in_app_social,
    inAppSystem: row.in_app_system,
    updatedAt: row.updated_at,
  };
}

serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  let supabase;
  try {
    supabase = getUserClient(req);
  } catch (error) {
    console.error(`${logPrefix} Supabase configuration error`, error);
    return jsonError("Server misconfigured", 500, "SERVER_MISCONFIGURED");
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error(`${logPrefix} auth error`, authError);
    return jsonError("Unauthorized", 401, "UNAUTHORIZED");
  }

  if (!user) {
    console.error(`${logPrefix} no user in auth context`);
    return jsonError("Unauthorized", 401, "UNAUTHORIZED");
  }

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("notification_preferences")
      .select(
        "user_id, email_activity, email_recommendations, in_app_social, in_app_system, updated_at",
      )
      .eq("user_id", user.id)
      .maybeSingle<NotificationPreferencesRow>();

    if (error) {
      console.error(`${logPrefix} error reading preferences`, error);
      return jsonError("Failed to load preferences", 500, "PREFERENCES_LOAD_FAILED");
    }

    const preferences = data
      ? mapRowToResponse(data)
      : { ...DEFAULT_PREFERENCES, updatedAt: new Date().toISOString() };

    return jsonResponse({ ok: true, preferences });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      { ok: false, error: "Method not allowed", code: "METHOD_NOT_ALLOWED" },
      405,
      { headers: corsHeaders },
    );
  }

  const validation = await validateRequest<PreferencesPayload>(
    req,
    (body) => PreferencesSchema.parse(body),
    { logPrefix },
  );

  if (validation.errorResponse) return validation.errorResponse;

  const payload = validation.data;
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("notification_preferences")
    .upsert(
      {
        user_id: user.id,
        email_activity: payload.emailActivity,
        email_recommendations: payload.emailRecommendations,
        in_app_social: payload.inAppSocial,
        in_app_system: payload.inAppSystem,
        updated_at: now,
      },
      { onConflict: "user_id" },
    )
    .select(
      "user_id, email_activity, email_recommendations, in_app_social, in_app_system, updated_at",
    )
    .single<NotificationPreferencesRow>();

  if (error || !data) {
    console.error(`${logPrefix} error saving preferences`, error);
    return jsonError("Failed to save preferences", 500, "PREFERENCES_SAVE_FAILED");
  }

  return jsonResponse({ ok: true, preferences: mapRowToResponse(data) }, 200);
});
