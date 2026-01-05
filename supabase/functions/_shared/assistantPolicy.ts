// supabase/functions/_shared/assistantPolicy.ts
//
// Centralized policy for assistant tool execution.
//
// Design:
// - The chat model is allowed to run *read/grounding* tools automatically.
// - The chat model is NOT allowed to auto-run writes; it can only propose
//   confirmable actions.
// - When the user taps an action, edge functions execute it, subject to:
//     - allowlists
//     - confirmation for high-risk operations
// - Internal-only rollback helpers are never exposed to the model. They may be
//   used for server-issued undo buttons.

export type ConfirmKind = "danger" | "warning" | "default";

// Keep this list aligned with assistant-chat-reply evidence enforcement.
export const READ_EVIDENCE_TOOLS = new Set<string>([
  "schema_summary",
  "db_read",
  "get_my_profile",
  "get_my_stats",
  "get_ctx_snapshot",
  "get_my_lists",
  "get_list_items",
  "get_my_library",
  "search_catalog",
  "search_my_library",
  "get_my_recent_activity",
  "get_tool_result",
  "get_trending",
  "get_recommendations",
  "resolve_title",
  "resolve_list",
  "resolve_user",
  "get_my_rating",
  "get_my_review",
  "get_relationship_status",
  "get_recent_likes",
  "goal_get_active",
]);

// Tools that can be executed from a user-clicked action button.
// (Assistant chat model emits these as "actions"; the server executes them.)
export const USER_ACTION_TOOL_ALLOWLIST = new Set<string>([
  // Read / grounding tools can be invoked by user clicks too.
  ...READ_EVIDENCE_TOOLS,

  // Writes
  "create_list",
  "list_add_item",
  "list_add_items",
  "list_remove_item",
  "list_set_visibility",
  "diary_set_status",
  "rate_title",
  "review_upsert",
  "follow_user",
  "unfollow_user",
  "block_user",
  "unblock_user",
  "conversation_mute",
  "notifications_mark_read",
  "message_send",
  // Higher-risk tools are still user-initiated, but should be confirmed.
  "playbook_start",
  "playbook_end",
  "goal_start",
  "goal_end",
]);

// Tools that must never be suggested/executed directly unless the server
// marks the action as internal (e.g., undo/rollback).
export const INTERNAL_ONLY_TOOLS = new Set<string>([
  "list_delete",
  "rating_delete",
  "review_delete",
]);

export function assertAllowedUserActionTool(tool: unknown, internal = false): string {
  const name = String(tool ?? "").trim();
  if (internal && INTERNAL_ONLY_TOOLS.has(name)) return name;
  if (!USER_ACTION_TOOL_ALLOWLIST.has(name)) {
    throw new Error(`Tool not allowed: ${name || "(empty)"}`);
  }
  return name;
}

// Suggestion actions are also user-initiated, but stored server-side.
// We allow the same set as user actions plus some read tools.
export const SUGGESTION_TOOL_ALLOWLIST = new Set<string>([
  // Read / grounding
  ...READ_EVIDENCE_TOOLS,

  // Writes (user-initiated via suggestion acceptance)
  ...USER_ACTION_TOOL_ALLOWLIST,
]);

export function assertAllowedSuggestionTool(tool: unknown, internal = false): string {
  const name = String(tool ?? "").trim();
  if (internal && INTERNAL_ONLY_TOOLS.has(name)) return name;
  if (!SUGGESTION_TOOL_ALLOWLIST.has(name)) {
    throw new Error(`Tool not allowed in suggestion: ${name || "(empty)"}`);
  }
  return name;
}

export function requiresConfirmation(tool: string, args: any): { needs: boolean; kind: ConfirmKind; prompt: string } {
  const t = String(tool ?? "").trim();
  const a = args && typeof args === "object" ? args : {};

  // Social & messaging actions should be explicitly confirmed.
  if (t === "message_send") {
    const preview = typeof a.text === "string" ? a.text.trim().slice(0, 120) : "";
    return {
      needs: true,
      kind: "warning",
      prompt: preview ? `Send this message?\n\n“${preview}${preview.length >= 120 ? "…" : ""}”` : "Send this message?",
    };
  }
  if (t === "block_user") {
    return { needs: true, kind: "danger", prompt: "Block this user? You can undo it later." };
  }
  if (t === "unblock_user") {
    return { needs: true, kind: "warning", prompt: "Unblock this user?" };
  }

  // Visibility changes can have privacy impact.
  if (t === "list_set_visibility") {
    const isPublic = Boolean((a as any).isPublic);
    if (isPublic) {
      return { needs: true, kind: "warning", prompt: "Make this list public? Anyone with the link may be able to view it." };
    }
  }

  // Plans/goals are multi-step behaviors; confirm once.
  if (t === "playbook_start" || t === "playbook_end" || t === "goal_start" || t === "goal_end") {
    return { needs: true, kind: "default", prompt: "Confirm this assistant workflow action?" };
  }

  return { needs: false, kind: "default", prompt: "" };
}
