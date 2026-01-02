-- MoviNesta AI Assistant (Final)
-- Extensions + core indexes used by assistant tools.
-- Safe to run multiple times.

-- ----------------------------------------------------------------------------
-- Extensions
-- ----------------------------------------------------------------------------
create extension if not exists pg_trgm;

-- ----------------------------------------------------------------------------
-- assistant_message_action_log: keep ONE canonical handle index
-- ----------------------------------------------------------------------------
-- Older iterations created similar indexes under different names.
-- Drop legacy names (if any) then create the canonical one.
drop index if exists public.assistant_message_action_log_user_action_id_created_at_idx;
drop index if exists public.assistant_message_action_log_user_action_created_idx;

create index if not exists assistant_message_action_log_user_action_created_idx
  on public.assistant_message_action_log using btree (user_id, action_id, created_at desc);

-- ----------------------------------------------------------------------------
-- list_items: faster de-dupe / membership checks
-- ----------------------------------------------------------------------------
create index if not exists idx_list_items_list_id_title_id
  on public.list_items using btree (list_id, title_id);

-- ----------------------------------------------------------------------------
-- reviews: faster upsert / latest lookup per (user,title)
-- ----------------------------------------------------------------------------
create index if not exists reviews_user_title_updated_idx
  on public.reviews using btree (user_id, title_id, updated_at desc);
