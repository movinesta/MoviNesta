-- MoviNesta AI Assistant v7
-- Performance indexes used by the assistant's schema-aware, read-only db_read tool.
-- Safe to run multiple times.

-- Ratings / Reviews
create index if not exists ratings_user_updated_idx
  on public.ratings (user_id, updated_at desc);

create index if not exists reviews_user_updated_idx
  on public.reviews (user_id, updated_at desc);

-- Notifications
create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

-- Goals
create index if not exists assistant_goals_user_updated_idx
  on public.assistant_goals (user_id, updated_at desc);

-- Lists / list items
create index if not exists list_items_list_position_idx
  on public.list_items (list_id, position);

-- Social graph
create index if not exists follows_follower_created_idx
  on public.follows (follower_id, created_at desc);

create index if not exists blocked_users_blocker_created_idx
  on public.blocked_users (blocker_id, created_at desc);
