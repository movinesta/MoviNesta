// supabase/functions/assistant-chat-reply/request.ts
//
// Request payload validation + tool allowlist for assistant-chat-reply.

import { z } from "zod";


export const RequestPayloadSchema = z
  .object({
    conversationId: z.string().uuid(),
    userMessageId: z.string().uuid().optional(),
    // If the client cannot provide messageId (rare), it may provide raw text.
    userText: z.string().min(1).max(4000).optional(),
    maxContextMessages: z.number().int().min(4).max(40).optional(),
    stream: z.boolean().optional(),

    // Internal job mode (x-job-token) can provide a userId explicitly.
    // This enables durable background execution when the client disconnects.
    userId: z.string().uuid().optional(),
  })
  .refine((v) => Boolean(v.userMessageId) || Boolean(v.userText), {
    message: "Provide userMessageId or userText",
  });

export type RequestPayload = z.infer<typeof RequestPayloadSchema>;

export const TOOL_NAMES = [
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
  "plan_execute",
  "create_list",
  "list_add_item",
  "list_add_items",
  "list_remove_item",
  "list_set_visibility",
  "rate_title",
  "review_upsert",
  "follow_user",
  "unfollow_user",
  "block_user",
  "unblock_user",
  "notifications_mark_read",
  "conversation_mute",
  "diary_set_status",
  "message_send",
  "playbook_start",
  "playbook_end",
  "goal_get_active",
  "goal_start",
  "goal_end",
] as const;
