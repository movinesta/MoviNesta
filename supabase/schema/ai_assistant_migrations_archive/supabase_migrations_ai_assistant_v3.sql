-- MoviNesta AI Assistant v3 migrations
-- Safe / idempotent indexes for new assistant capabilities & faster tool-result lookups.

-- 1) Faster tool result handle fetch
CREATE INDEX IF NOT EXISTS assistant_message_action_log_user_action_created_idx
  ON public.assistant_message_action_log USING btree (user_id, action_id, created_at DESC);

-- 2) Faster list item de-dupe / lookups
CREATE INDEX IF NOT EXISTS idx_list_items_list_id_title_id
  ON public.list_items USING btree (list_id, title_id);

-- 3) Faster review upsert lookup (user+title)
CREATE INDEX IF NOT EXISTS reviews_user_title_updated_idx
  ON public.reviews USING btree (user_id, title_id, updated_at DESC);
