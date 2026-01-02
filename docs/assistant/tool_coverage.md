# MoviNesta AI Assistant – Tool Coverage (v3)

This doc is the **contract** between the LLM and the app/backend.

## Principles
- **Never guess.** If the user asks about their data, use `get_my_*` / `search_*` tools first.
- **ID-first writes.** If the user provides a title/list/user name, resolve to IDs via `search_catalog`, `search_my_library`, `get_my_lists`, `get_list_items` before calling write tools.
- **No silent success.** Only confirm an action after a tool returns success.

## Read tools (safe)
- `get_my_profile` – profile basics.
- `get_my_stats` – library counts + lightweight stats.
- `get_my_lists` – lists owned by the user.
- `get_list_items` – items in a specific list.
- `get_my_library` – library entries (watchlist/diary).
- `search_catalog` – search the global catalog (media_items).
- `search_my_library` – search user's library by title.
- `get_my_recent_activity` – recent likes/ratings/reviews/library updates.
- `get_recent_likes` – recent likes (compact).
- `get_trending` – trending titles.
- `get_recommendations` – basic recommendations.
- `get_tool_result` – fetch a **stored** tool result by handle (action_id), truncated.

## Write tools
### Lists
- `create_list` – create a list (name, description?, isPublic?).
- `list_add_item` – add a single title to a list (listId, titleId, contentType?, note?).
- `list_add_items` – add many titles at once (listId, titleIds[], contentType?).
- `list_remove_item` – remove by itemId or titleId (listId, itemId? | titleId?).
- `list_set_visibility` – toggle list public/private (listId, isPublic).

### Library / diary
- `diary_set_status` – upsert a library entry (titleId, status, contentType?) with timestamps.

### Ratings / reviews
- `rate_title` – upsert a rating (titleId, rating 0–10 step 0.5, comment?).
- `review_upsert` – create/update a review (titleId, body, headline?, spoiler?, rating?).

### Social
- `follow_user` / `unfollow_user` – follow/unfollow by userId.
- `block_user` / `unblock_user` – block/unblock by userId.

### Notifications / messaging
- `notifications_mark_read` – mark notifications read (ids[] or all=true).
- `conversation_mute` – mute/unmute a conversation (conversationId, muted?, mutedUntil?).
- `message_send` – send a message (conversationId or targetUserId).

### Goals / playbooks
- `goal_get_active` / `goal_start` / `goal_end`
- `playbook_start` / `playbook_end`

## Evidence handles
Tool executions are logged into `assistant_message_action_log` and the assistant message `meta.ai.toolHandles` contains the most recent handles for the UI to fetch details via `assistant-tool-result`.
