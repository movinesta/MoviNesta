// supabase/functions/_shared/assistantIdentity.ts
//
// Resolve the "MoviNesta Assistant" identity in a robust way.
//
// Why this exists:
// - Avoid hardcoding a UUID in both frontend + backend.
// - Let environments configure the assistant by ID *or* username.
// - Provide a single source of truth for assistant DM checks in edge functions.

import { log } from "./logger.ts";

export type AssistantIdentity = {
  id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
};

export async function resolveAssistantIdentity(
  svc: any,
  cfg: { assistantUserId?: string | null; assistantUsername?: string | null },
  logCtx: Record<string, unknown>,
): Promise<AssistantIdentity> {
  // Prefer explicit ID (most reliable).
  const assistantUserId = (cfg.assistantUserId ?? "").trim();
  if (assistantUserId) {
    const { data, error } = await svc
      .from("profiles")
      .select("id,username,display_name,bio,avatar_url")
      .eq("id", assistantUserId)
      .maybeSingle();

    if (error) {
      log(logCtx, "Failed to look up assistant profile by ID", { error: error.message });
      throw new Error("ASSISTANT_LOOKUP_FAILED");
    }
    if (!data?.id) {
      throw new Error("ASSISTANT_NOT_FOUND");
    }
    return data as AssistantIdentity;
  }

  // Fallback to username lookup (still deterministic, avoids hardcoded UUIDs).
  const uname = (cfg.assistantUsername ?? "movinesta").trim().toLowerCase();
  if (!uname) {
    throw new Error("ASSISTANT_NOT_CONFIGURED");
  }

  const { data, error } = await svc
    .from("profiles")
    .select("id,username,display_name,bio,avatar_url")
    .ilike("username", uname) // usernames are usually stored lower-case; ilike keeps it forgiving
    .maybeSingle();

  if (error) {
    log(logCtx, "Failed to look up assistant profile by username", { error: error.message });
    throw new Error("ASSISTANT_LOOKUP_FAILED");
  }
  if (!data?.id) {
    throw new Error("ASSISTANT_NOT_FOUND");
  }
  return data as AssistantIdentity;
}
