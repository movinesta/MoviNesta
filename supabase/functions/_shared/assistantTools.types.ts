// supabase/functions/_shared/assistantTools.types.ts
//
// Central types for assistant tool execution.

export type AssistantContentType = "movie" | "series" | "anime";

export type AssistantToolName =
  | "plan_execute"
  | "schema_summary"
  | "db_read"
  | "create_list"
  | "list_add_item"
  | "list_add_items"
  | "list_remove_item"
  | "list_set_visibility"
  | "rate_title"
  | "review_upsert"
  | "follow_user"
  | "unfollow_user"
  | "block_user"
  | "unblock_user"
  | "notifications_mark_read"
  | "conversation_mute"
  | "diary_set_status"
  | "message_send"
  | "playbook_start"
  | "playbook_end"
  | "goal_start"
  | "goal_end"
  | "goal_get_active"
  // Read-only helper tools (safe):
  | "get_recent_likes"
  | "plan_watch_plan_copy"
  | "get_my_profile"
  | "get_my_stats"
  | "get_my_lists"
  | "get_list_items"
  | "get_my_library"
  | "search_catalog"
  | "search_my_library"
  | "get_my_recent_activity"
  | "get_tool_result"
  | "get_trending"
  | "get_recommendations"
  | "resolve_title"
  | "resolve_list"
  | "resolve_user"
  | "get_relationship_status"
  | "get_my_rating"
  | "get_my_review"
  | "get_ctx_snapshot"
  // Internal-only rollback helpers (not exposed to the model):
  | "list_delete"
  | "rating_delete"
  | "review_delete";

export type AssistantToolCall = {
  tool: AssistantToolName;
  args?: Record<string, unknown>;
};

export type AssistantToolSuccess = {
  ok: true;
  tool: AssistantToolName;
  result?: unknown;
  navigateTo?: string | null;
  meta?: Record<string, unknown>;
};

export type AssistantToolError = {
  ok: false;
  tool: AssistantToolName;
  code: string;
  message: string;
  error?: string;
  token?: string;
  meta?: Record<string, unknown>;
};

export type AssistantToolResult = AssistantToolSuccess | AssistantToolError;
