/**
 * Shared select list for message rows.
 * Keep this in one place so inserts/updates/queries stay in sync.
 */
export const MESSAGE_SELECT = "id, conversation_id, user_id, body, attachment_url, created_at" as const;
