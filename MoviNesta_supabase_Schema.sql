-- MoviNesta Final Schema & RLS (Dev-friendly)
-- This script is designed to be idempotent and avoid "column not found" errors.
-- It uses CREATE TABLE IF NOT EXISTS and ALTER TABLE ... ADD COLUMN IF NOT EXISTS
-- so it can be safely re-run as you evolve the database.

begin;

-- =====================================================================
-- 0. NEW USER HANDLER (auth.users -> public.profiles)
-- =====================================================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;

  return new;
end;
$$
language plpgsql
security definer
set search_path = public, pg_temp;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute procedure public.handle_new_user();

-- =====================================================================
-- 1. PROFILES
-- =====================================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists username text unique,
  add column if not exists display_name text,
  add column if not exists email text,
  add column if not exists avatar_url text,
  add column if not exists bio text;

-- =====================================================================
-- 2. FOLLOWS (social graph)
-- =====================================================================

create table if not exists public.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  followed_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint follows_pkey primary key (follower_id, followed_id)
);

-- =====================================================================
-- 3. TITLES (movies / series / anime / shorts)
-- =====================================================================

create table if not exists public.titles (
  id text primary key,
  created_at timestamptz not null default now()
);

alter table public.titles
  add column if not exists title text,
  add column if not exists type text,   -- movie / series / anime / short
  add column if not exists year int,
  add column if not exists poster_url text,
  add column if not exists backdrop_url text;

-- =====================================================================
-- 4. RATINGS
-- =====================================================================

create table if not exists public.ratings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table public.ratings
  add column if not exists user_id uuid not null references auth.users(id) on delete cascade,
  add column if not exists title_id text not null references public.titles(id) on delete cascade,
  add column if not exists rating numeric(2,1) not null, -- 0.0 - 5.0
  add column if not exists tagged_sentiment text,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_ratings_user_id on public.ratings(user_id);
create index if not exists idx_ratings_title_id on public.ratings(title_id);

-- =====================================================================
-- 5. LIBRARY ENTRIES (diary status)
-- =====================================================================

create table if not exists public.library_entries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table public.library_entries
  add column if not exists user_id uuid not null references auth.users(id) on delete cascade,
  add column if not exists title_id text not null references public.titles(id) on delete cascade,
  add column if not exists status text not null, -- want_to_watch / watching / watched / dropped
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_library_user_id on public.library_entries(user_id);
create index if not exists idx_library_title_id on public.library_entries(title_id);

-- =====================================================================
-- 6. REVIEWS & REACTIONS
-- =====================================================================

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table public.reviews
  add column if not exists user_id uuid not null references auth.users(id) on delete cascade,
  add column if not exists title_id text not null references public.titles(id) on delete cascade,
  add column if not exists rating numeric(2,1), -- optional; may mirror ratings table
  add column if not exists headline text,
  add column if not exists body text,
  add column if not exists is_spoiler boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_reviews_title_id on public.reviews(title_id);
create index if not exists idx_reviews_user_id on public.reviews(user_id);

create table if not exists public.review_reactions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table public.review_reactions
  add column if not exists review_id uuid not null references public.reviews(id) on delete cascade,
  add column if not exists user_id uuid not null references auth.users(id) on delete cascade,
  add column if not exists emoji text not null;

create index if not exists idx_review_reactions_review_id on public.review_reactions(review_id);
create index if not exists idx_review_reactions_user_id on public.review_reactions(user_id);

-- =====================================================================
-- 7. COMMENTS & COMMENT LIKES
-- =====================================================================

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table public.comments
  add column if not exists user_id uuid not null references auth.users(id) on delete cascade,
  add column if not exists title_id text references public.titles(id) on delete cascade,
  add column if not exists review_id uuid references public.reviews(id) on delete cascade,
  add column if not exists parent_comment_id uuid references public.comments(id) on delete cascade,
  add column if not exists body text not null;

create index if not exists idx_comments_title_id on public.comments(title_id);
create index if not exists idx_comments_review_id on public.comments(review_id);
create index if not exists idx_comments_parent_comment_id on public.comments(parent_comment_id);

create table if not exists public.comment_likes (
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint comment_likes_pkey primary key (comment_id, user_id)
);

-- =====================================================================
-- 8. ACTIVITY EVENTS
-- =====================================================================

create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table public.activity_events
  add column if not exists user_id uuid not null references auth.users(id) on delete cascade,
  add column if not exists event_type text not null, -- rating_created / review_created / watchlist_added / follow_created / etc.
  add column if not exists title_id text references public.titles(id) on delete cascade,
  add column if not exists related_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists payload jsonb;

create index if not exists idx_activity_user_id on public.activity_events(user_id);
create index if not exists idx_activity_created_at on public.activity_events(created_at);

-- =====================================================================
-- 9. NOTIFICATIONS
-- =====================================================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table public.notifications
  add column if not exists user_id uuid not null references auth.users(id) on delete cascade,
  add column if not exists type text not null, -- follow / comment / reply / reaction / mention / etc.
  add column if not exists data jsonb,
  add column if not exists is_read boolean not null default false;

create index if not exists idx_notifications_user_id on public.notifications(user_id);
create index if not exists idx_notifications_is_read on public.notifications(is_read);

-- =====================================================================
-- 10. DIRECT MESSAGES
-- =====================================================================

-- Conversations
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table public.conversations
  add column if not exists is_group boolean not null default false,
  add column if not exists title text,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

-- Participants
create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  constraint conversation_participants_pkey primary key (conversation_id, user_id)
);

create index if not exists idx_conv_participants_user_id on public.conversation_participants(user_id);

-- Messages
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table public.messages
  add column if not exists conversation_id uuid not null references public.conversations(id) on delete cascade,
  add column if not exists sender_id uuid not null references auth.users(id) on delete cascade,
  add column if not exists body text not null, -- JSON string for structured messages
  add column if not exists attachment_url text;

create index if not exists idx_messages_conversation_id on public.messages(conversation_id);
create index if not exists idx_messages_created_at on public.messages(created_at);

-- Message reactions
create table if not exists public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table public.message_reactions
  add column if not exists conversation_id uuid not null references public.conversations(id) on delete cascade,
  add column if not exists message_id uuid not null references public.messages(id) on delete cascade,
  add column if not exists user_id uuid not null references auth.users(id) on delete cascade,
  add column if not exists emoji text not null;

create index if not exists idx_message_reactions_conv on public.message_reactions(conversation_id);
create index if not exists idx_message_reactions_msg on public.message_reactions(message_id);

-- Read receipts
create table if not exists public.message_read_receipts (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_message_id uuid references public.messages(id) on delete set null,
  last_read_at timestamptz not null default now(),
  constraint message_read_receipts_pkey primary key (conversation_id, user_id)
);

create index if not exists idx_read_receipts_conv on public.message_read_receipts(conversation_id);

-- =====================================================================
-- 11. ROW LEVEL SECURITY (DEV-FRIENDLY OPEN POLICIES)
-- =====================================================================
-- NOTE: For development, these policies are intentionally permissive so the
-- frontend does not hit RLS errors. Tighten them later for production.

-- Profiles
alter table public.profiles enable row level security;
drop policy if exists "profiles open dev" on public.profiles;
create policy "profiles open dev"
on public.profiles
for all
using (true)
with check (true);

-- Follows
alter table public.follows enable row level security;
drop policy if exists "follows open dev" on public.follows;
create policy "follows open dev"
on public.follows
for all
using (true)
with check (true);

-- Titles
alter table public.titles enable row level security;
drop policy if exists "titles open dev" on public.titles;
create policy "titles open dev"
on public.titles
for all
using (true)
with check (true);

-- Ratings
alter table public.ratings enable row level security;
drop policy if exists "ratings open dev" on public.ratings;
create policy "ratings open dev"
on public.ratings
for all
using (true)
with check (true);

-- Library entries
alter table public.library_entries enable row level security;
drop policy if exists "library_entries open dev" on public.library_entries;
create policy "library_entries open dev"
on public.library_entries
for all
using (true)
with check (true);

-- Reviews
alter table public.reviews enable row level security;
drop policy if exists "reviews open dev" on public.reviews;
create policy "reviews open dev"
on public.reviews
for all
using (true)
with check (true);

-- Review reactions
alter table public.review_reactions enable row level security;
drop policy if exists "review_reactions open dev" on public.review_reactions;
create policy "review_reactions open dev"
on public.review_reactions
for all
using (true)
with check (true);

-- Comments
alter table public.comments enable row level security;
drop policy if exists "comments open dev" on public.comments;
create policy "comments open dev"
on public.comments
for all
using (true)
with check (true);

-- Comment likes
alter table public.comment_likes enable row level security;
drop policy if exists "comment_likes open dev" on public.comment_likes;
create policy "comment_likes open dev"
on public.comment_likes
for all
using (true)
with check (true);

-- Activity events
alter table public.activity_events enable row level security;
drop policy if exists "activity_events open dev" on public.activity_events;
create policy "activity_events open dev"
on public.activity_events
for all
using (true)
with check (true);

-- Notifications
alter table public.notifications enable row level security;
drop policy if exists "notifications open dev" on public.notifications;
create policy "notifications open dev"
on public.notifications
for all
using (true)
with check (true);

-- Conversations
alter table public.conversations enable row level security;
drop policy if exists "conversations open dev" on public.conversations;
create policy "conversations open dev"
on public.conversations
for all
using (true)
with check (true);

-- Conversation participants
alter table public.conversation_participants enable row level security;
drop policy if exists "conversation_participants open dev" on public.conversation_participants;
create policy "conversation_participants open dev"
on public.conversation_participants
for all
using (true)
with check (true);

-- Messages
alter table public.messages enable row level security;
drop policy if exists "messages open dev" on public.messages;
create policy "messages open dev"
on public.messages
for all
using (true)
with check (true);

-- Message reactions
alter table public.message_reactions enable row level security;
drop policy if exists "message_reactions open dev" on public.message_reactions;
create policy "message_reactions open dev"
on public.message_reactions
for all
using (true)
with check (true);

-- Message read receipts
alter table public.message_read_receipts enable row level security;
drop policy if exists "message_read_receipts open dev" on public.message_read_receipts;
create policy "message_read_receipts open dev"
on public.message_read_receipts
for all
using (true)
with check (true);

commit;

-- =====================================================================
-- 12. ADDITIONAL TYPES, TABLES & CONSTRAINTS (AI-ASSISTED IMPROVEMENTS)
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- A. ENUM TYPES
-- ---------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'title_type') then
    create type public.title_type as enum ('movie', 'series', 'anime', 'short');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'library_status') then
    create type public.library_status as enum ('want_to_watch', 'watching', 'watched', 'dropped');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'activity_event_type') then
    create type public.activity_event_type as enum (
      'rating_created',
      'review_created',
      'watchlist_added',
      'watchlist_removed',
      'follow_created',
      'comment_created',
      'reply_created',
      'list_created',
      'list_item_added',
      'message_sent'
    );
  end if;
end $$;

-- NOTE: skipped altering existing notification_type enum to avoid conflicts.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'participant_role') then
    create type public.participant_role as enum ('member', 'admin', 'owner');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'episode_status') then
    create type public.episode_status as enum ('watching', 'watched', 'skipped');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'privacy_level') then
    create type public.privacy_level as enum ('public', 'followers_only', 'private');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'report_status') then
    create type public.report_status as enum ('open', 'in_review', 'resolved', 'dismissed');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- B. STRONGER TYPING ON EXISTING TABLES
-- ---------------------------------------------------------------------

-- Titles: type -> title_type
alter table public.titles
  alter column type type public.title_type
  using case lower(type::text)
    when 'movie' then 'movie'::public.title_type
    when 'series' then 'series'::public.title_type
    when 'anime' then 'anime'::public.title_type
    when 'short' then 'short'::public.title_type
    else 'movie'::public.title_type
  end;

-- Library entries: status -> library_status
alter table public.library_entries
  alter column status type public.library_status
  using case lower(status::text)
    when 'want_to_watch' then 'want_to_watch'::public.library_status
    when 'watching' then 'watching'::public.library_status
    when 'watched' then 'watched'::public.library_status
    when 'dropped' then 'dropped'::public.library_status
    else 'want_to_watch'::public.library_status
  end;

-- Activity events: event_type -> activity_event_type
alter table public.activity_events
  alter column event_type type public.activity_event_type
  using case 
    when event_type is null then 'rating_created'::public.activity_event_type
    when event_type::text ~* 'rating' then 'rating_created'::public.activity_event_type
    when event_type::text ~* 'review' then 'review_created'::public.activity_event_type
    when event_type::text ~* 'watchlist' and event_type::text ~* 'added' then 'watchlist_added'::public.activity_event_type
    when event_type::text ~* 'watchlist' and event_type::text ~* 'removed' then 'watchlist_removed'::public.activity_event_type
    when event_type::text ~* 'follow' then 'follow_created'::public.activity_event_type
    when event_type::text ~* 'comment' then 'comment_created'::public.activity_event_type
    when event_type::text ~* 'reply' then 'reply_created'::public.activity_event_type
    when event_type::text ~* 'list_item' then 'list_item_added'::public.activity_event_type
    when event_type::text ~* 'message' then 'message_sent'::public.activity_event_type
    else 'rating_created'::public.activity_event_type
  end;

-- Notifications: left as TEXT to be compatible with existing enum values.

-- Conversation participants: role -> participant_role
-- Drop existing default first to avoid cast issues, then convert to enum and set a new default.
alter table public.conversation_participants
  alter column role drop default;

alter table public.conversation_participants
  alter column role type public.participant_role
  using case lower(role::text)
    when 'owner' then 'owner'::public.participant_role
    when 'admin' then 'admin'::public.participant_role
    else 'member'::public.participant_role
  end;

alter table public.conversation_participants
  alter column role set default 'member';
-- ---------------------------------------------------------------------
-- C. EXTRA COLUMNS ON EXISTING TABLES
-- ---------------------------------------------------------------------

-- Richer title metadata
alter table public.titles
  add column if not exists synopsis text,
  add column if not exists runtime_minutes int,
  add column if not exists release_date date,
  add column if not exists original_language text,
  add column if not exists imdb_id text unique,
  add column if not exists tmdb_id int unique,
  add column if not exists age_rating text,
  add column if not exists search_vector tsvector;

-- Update timestamps
alter table public.comments
  add column if not exists updated_at timestamptz not null default now();

alter table public.notifications
  add column if not exists updated_at timestamptz not null default now();

alter table public.messages
  add column if not exists updated_at timestamptz not null default now();

-- ---------------------------------------------------------------------
-- D. AGGREGATE & ANALYTIC TABLES
-- ---------------------------------------------------------------------

create table if not exists public.title_stats (
  title_id text primary key references public.titles(id) on delete cascade,
  avg_rating numeric(3,2),
  ratings_count int,
  reviews_count int,
  watch_count int,
  last_updated_at timestamptz not null default now()
);

create table if not exists public.user_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  followers_count int default 0,
  following_count int default 0,
  ratings_count int default 0,
  reviews_count int default 0,
  comments_count int default 0,
  watch_count int default 0,
  watch_minutes_total int default 0,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- E. DOMAIN TABLES: GENRES, PEOPLE, CREDITS
-- ---------------------------------------------------------------------

create table if not exists public.genres (
  id bigserial primary key,
  name text not null unique,
  slug text not null unique
);

create table if not exists public.title_genres (
  title_id text not null references public.titles(id) on delete cascade,
  genre_id bigint not null references public.genres(id) on delete cascade,
  primary key (title_id, genre_id)
);

create index if not exists idx_title_genres_title_id on public.title_genres(title_id);
create index if not exists idx_title_genres_genre_id on public.title_genres(genre_id);

create table if not exists public.people (
  id bigserial primary key,
  name text not null,
  profile_url text,
  imdb_id text unique,
  biography text,
  birth_date date,
  death_date date
);

create index if not exists idx_people_name on public.people(name);

create table if not exists public.title_credits (
  id bigserial primary key,
  title_id text not null references public.titles(id) on delete cascade,
  person_id bigint not null references public.people(id) on delete cascade,
  job text,
  department text,
  character_name text,
  billing_order int
);

create index if not exists idx_title_credits_title_id on public.title_credits(title_id);
create index if not exists idx_title_credits_person_id on public.title_credits(person_id);

-- ---------------------------------------------------------------------
-- F. SERIES SUPPORT: SEASONS & EPISODES
-- ---------------------------------------------------------------------

create table if not exists public.seasons (
  id bigserial primary key,
  title_id text not null references public.titles(id) on delete cascade,
  season_number int not null,
  name text,
  overview text,
  poster_url text,
  air_date date
);

create unique index if not exists idx_seasons_unique on public.seasons(title_id, season_number);

create table if not exists public.episodes (
  id bigserial primary key,
  title_id text not null references public.titles(id) on delete cascade,
  season_id bigint references public.seasons(id) on delete cascade,
  episode_number int not null,
  name text,
  overview text,
  air_date date,
  runtime_minutes int
);

create unique index if not exists idx_episodes_unique on public.episodes(season_id, episode_number);

-- Per-user episode progress
create table if not exists public.episode_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  episode_id bigint not null references public.episodes(id) on delete cascade,
  status public.episode_status not null default 'watched',
  watched_at timestamptz not null default now(),
  primary key (user_id, episode_id)
);

-- ---------------------------------------------------------------------
-- G. SOCIAL FEATURES: LISTS, TAGS, BLOCKING
-- ---------------------------------------------------------------------

create table if not exists public.lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  is_public boolean not null default true,
  is_collaborative boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_lists_user_id on public.lists(user_id);

create table if not exists public.list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists(id) on delete cascade,
  title_id text not null references public.titles(id) on delete cascade,
  position int,
  note text,
  added_at timestamptz not null default now()
);

create index if not exists idx_list_items_list_id on public.list_items(list_id);
create index if not exists idx_list_items_title_id on public.list_items(title_id);

create table if not exists public.user_tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text,
  created_at timestamptz not null default now(),
  constraint user_tags_unique_name_per_user unique (user_id, name)
);

create table if not exists public.user_title_tags (
  user_id uuid not null references auth.users(id) on delete cascade,
  title_id text not null references public.titles(id) on delete cascade,
  tag_id uuid not null references public.user_tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, title_id, tag_id)
);

create table if not exists public.blocked_users (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

create index if not exists idx_blocked_users_blocker on public.blocked_users(blocker_id);

-- ---------------------------------------------------------------------
-- H. USER SETTINGS & MODERATION
-- ---------------------------------------------------------------------

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  privacy_profile public.privacy_level not null default 'public',
  privacy_activity public.privacy_level not null default 'public',
  language text,
  timezone text,
  email_notifications boolean not null default true,
  push_notifications boolean not null default true,
  notify_on_follow boolean not null default true,
  notify_on_comment boolean not null default true,
  notify_on_reply boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null,
  target_id text not null,
  reason text,
  status public.report_status not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id),
  notes text
);

-- ---------------------------------------------------------------------
-- I. CONSTRAINTS & INDEXES ON EXISTING TABLES
-- ---------------------------------------------------------------------

-- Rating range
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ratings_rating_range'
      and conrelid = 'public.ratings'::regclass
  ) then
    alter table public.ratings
      add constraint ratings_rating_range
      check (rating >= 0.0 and rating <= 5.0);
  end if;
end $$;

-- One rating per user/title
create unique index if not exists idx_ratings_user_title_unique
  on public.ratings(user_id, title_id);

-- One library entry per user/title
create unique index if not exists idx_library_entries_user_title_unique
  on public.library_entries(user_id, title_id);

-- One reaction per user/review/emoji
create unique index if not exists idx_review_reactions_unique
  on public.review_reactions(review_id, user_id, emoji);

-- One reaction per user/message/emoji
create unique index if not exists idx_message_reactions_unique
  on public.message_reactions(message_id, user_id, emoji);

-- ---------------------------------------------------------------------
-- J. FULL TEXT SEARCH SUPPORT FOR TITLES
-- ---------------------------------------------------------------------

create or replace function public.titles_tsvector_trigger()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  new.search_vector :=
    setweight(pg_catalog.to_tsvector('simple', coalesce(new.title, '')), 'A') ||
    setweight(pg_catalog.to_tsvector('simple', coalesce(new.synopsis, '')), 'B');
  return new;
end;
$$;

drop trigger if exists titles_tsvector_update on public.titles;

create trigger titles_tsvector_update
before insert or update on public.titles
for each row execute procedure public.titles_tsvector_trigger();

create index if not exists idx_titles_search_vector
  on public.titles using gin (search_vector);

-- ---------------------------------------------------------------------
-- K. DEV-OPEN RLS FOR NEW TABLES (MATCHING EXISTING STYLE)
-- ---------------------------------------------------------------------

-- Lists
alter table public.lists enable row level security;
drop policy if exists "lists open dev" on public.lists;
create policy "lists open dev"
on public.lists
for all
using (true)
with check (true);

-- List items
alter table public.list_items enable row level security;
drop policy if exists "list_items open dev" on public.list_items;
create policy "list_items open dev"
on public.list_items
for all
using (true)
with check (true);

-- User tags
alter table public.user_tags enable row level security;
drop policy if exists "user_tags open dev" on public.user_tags;
create policy "user_tags open dev"
on public.user_tags
for all
using (true)
with check (true);

-- User title tags
alter table public.user_title_tags enable row level security;
drop policy if exists "user_title_tags open dev" on public.user_title_tags;
create policy "user_title_tags open dev"
on public.user_title_tags
for all
using (true)
with check (true);

-- Blocked users
alter table public.blocked_users enable row level security;
drop policy if exists "blocked_users open dev" on public.blocked_users;
create policy "blocked_users open dev"
on public.blocked_users
for all
using (true)
with check (true);

-- Episode progress
alter table public.episode_progress enable row level security;
drop policy if exists "episode_progress open dev" on public.episode_progress;
create policy "episode_progress open dev"
on public.episode_progress
for all
using (true)
with check (true);

-- User settings
alter table public.user_settings enable row level security;
drop policy if exists "user_settings open dev" on public.user_settings;
create policy "user_settings open dev"
on public.user_settings
for all
using (true)
with check (true);

-- Reports
alter table public.reports enable row level security;
drop policy if exists "reports open dev" on public.reports;
create policy "reports open dev"
on public.reports
for all
using (true)
with check (true);

commit;

-- =====================================================================
-- L. RLS FOR NEW PUBLIC TABLES (LINT FIXES)
-- =====================================================================

-- Enable RLS with permissive SELECT for lookup/analytics tables.
-- These tables are safe to expose read-only to all authenticated users,
-- but we still enable RLS to satisfy Supabase security lints.

-- title_stats
alter table public.title_stats enable row level security;
drop policy if exists "title_stats_select_all" on public.title_stats;
create policy "title_stats_select_all"
  on public.title_stats
  for select
  using (true);

-- user_stats
alter table public.user_stats enable row level security;
drop policy if exists "user_stats_select_all" on public.user_stats;
create policy "user_stats_select_all"
  on public.user_stats
  for select
  using (true);

-- genres
alter table public.genres enable row level security;
drop policy if exists "genres_select_all" on public.genres;
create policy "genres_select_all"
  on public.genres
  for select
  using (true);

-- title_genres
alter table public.title_genres enable row level security;
drop policy if exists "title_genres_select_all" on public.title_genres;
create policy "title_genres_select_all"
  on public.title_genres
  for select
  using (true);

-- people
alter table public.people enable row level security;
drop policy if exists "people_select_all" on public.people;
create policy "people_select_all"
  on public.people
  for select
  using (true);

-- title_credits
alter table public.title_credits enable row level security;
drop policy if exists "title_credits_select_all" on public.title_credits;
create policy "title_credits_select_all"
  on public.title_credits
  for select
  using (true);

-- seasons
alter table public.seasons enable row level security;
drop policy if exists "seasons_select_all" on public.seasons;
create policy "seasons_select_all"
  on public.seasons
  for select
  using (true);

-- episodes
alter table public.episodes enable row level security;
drop policy if exists "episodes_select_all" on public.episodes;
create policy "episodes_select_all"
  on public.episodes
  for select
  using (true);
