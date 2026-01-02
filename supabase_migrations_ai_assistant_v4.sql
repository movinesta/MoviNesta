-- MoviNesta AI Assistant v4 migrations
-- Date: 2026-01-02
--
-- Apply in Supabase SQL editor (safe to re-run).

-- -----------------------------------------------------------------------------
-- 0) Extensions (for fuzzy search)
-- -----------------------------------------------------------------------------
create extension if not exists pg_trgm;

-- -----------------------------------------------------------------------------
-- 1) assistant_message_action_log: de-dupe + perf
-- -----------------------------------------------------------------------------
-- Prior versions used different index names for the same keys; drop both then recreate one.
drop index if exists public.assistant_message_action_log_user_action_id_created_at_idx;
drop index if exists public.assistant_message_action_log_user_action_created_idx;

create index if not exists assistant_message_action_log_user_action_created_idx
  on public.assistant_message_action_log using btree (user_id, action_id, created_at desc);

create index if not exists assistant_message_action_log_conversation_id_idx
  on public.assistant_message_action_log using btree (conversation_id);

create index if not exists assistant_message_action_log_message_id_idx
  on public.assistant_message_action_log using btree (message_id);

-- -----------------------------------------------------------------------------
-- 2) Faster list item de-dupe / lookups
-- -----------------------------------------------------------------------------
create index if not exists idx_list_items_list_id_title_id
  on public.list_items using btree (list_id, title_id);

-- -----------------------------------------------------------------------------
-- 3) Faster review upsert lookup (user+title)
-- -----------------------------------------------------------------------------
create index if not exists reviews_user_title_updated_idx
  on public.reviews using btree (user_id, title_id, updated_at desc);

-- -----------------------------------------------------------------------------
-- 4) Fuzzy search support for anti-hallucination resolvers
-- -----------------------------------------------------------------------------
create index if not exists profiles_username_trgm_idx
  on public.profiles using gin (username gin_trgm_ops);

create index if not exists profiles_display_name_trgm_idx
  on public.profiles using gin (display_name gin_trgm_ops);

create index if not exists lists_name_trgm_idx
  on public.lists using gin (name gin_trgm_ops);
