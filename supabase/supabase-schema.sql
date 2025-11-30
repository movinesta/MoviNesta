-- ============================================================================
-- MoviNesta merged schema (canonical content + social + analytics)
-- This file is idempotent and safe to re-run.
-- Built by combining 2.sql (canonical content schema) with additional
-- social / analytics / settings tables and stricter RLS from 1.sql.
-- ============================================================================

begin;

-- ============================================================================
-- FINAL CLEAN SCHEMA (idempotent + lint fixes)
-- Canonical titles + movies/series/anime + seasons/episodes + lists + RLS
-- ============================================================================

-- ============================================================================
-- 1. EXTENSIONS
-- ============================================================================

create extension if not exists "pgcrypto";

create schema if not exists extensions;

-- Move pgcrypto to `extensions` schema if it exists
do $$
begin
  if exists (
    select 1 from pg_extension
    where extname = 'pgcrypto'
  ) then
    -- Ensure the schema exists
    execute 'create schema if not exists extensions';

    -- Move the extension to the extensions schema
    execute 'alter extension pgcrypto set schema extensions';
  end if;
end;
$$;


-- Move pg_trgm to `extensions` schema if it exists in `public`
do $$
begin
  if exists (
    select 1 from pg_extension
    where extname = 'pg_trgm'
  ) then
    -- Ensure the schema exists
    execute 'create schema if not exists extensions';

    -- Move the extension to the extensions schema
    execute 'alter extension pg_trgm set schema extensions';
  end if;
end;
$$;

-- Install pg_trgm in `extensions` if not already installed
do $$
begin
  if not exists (
    select 1 from pg_extension
    where extname = 'pg_trgm'
  ) then
    execute 'create extension pg_trgm with schema extensions';
  end if;
end;
$$;

-- ============================================================================
-- 2. TYPES
-- ============================================================================

-- Content type enum
do $$
begin
  if not exists (select 1 from pg_type where typname = 'content_type') then
    create type public.content_type as enum ('movie', 'series', 'anime');
  end if;
end $$;

-- Library status
do $$
begin
  if not exists (select 1 from pg_type where typname = 'library_status') then
    create type public.library_status as enum ('want_to_watch', 'watching', 'watched', 'dropped');
  end if;
end $$;

-- ============================================================================
-- 3. FUNCTIONS
-- ============================================================================

-- Updated-at trigger (fixed search_path)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- AUTH → PROFILES sync
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

-- Only create the trigger if auth.users exists
do $$
begin
  if to_regclass('auth.users') is not null then
    drop trigger if exists on_auth_user_created on auth.users;

    create trigger on_auth_user_created
    after insert on auth.users
    for each row
    execute function public.handle_new_user();
  end if;
end;
$$;

-- ============================================================================
-- 4. BASE TABLES (PROFILES, TITLES, CONTENT, LISTS)
-- ============================================================================

-- PROFILES
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text unique,
  display_name text,
  email        text not null,
  avatar_url   text,
  bio          text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.profiles
  add column if not exists id           uuid,
  add column if not exists username     text,
  add column if not exists display_name text,
  add column if not exists email        text,
  add column if not exists avatar_url   text,
  add column if not exists bio          text,
  add column if not exists created_at   timestamptz default now(),
  add column if not exists updated_at   timestamptz default now();

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create index if not exists profiles_username_idx on public.profiles(username);
create index if not exists profiles_email_idx on public.profiles(email);

-- ============================================================================
-- 5. CANONICAL TITLES
-- ============================================================================

create table if not exists public.titles (
  title_id      uuid primary key default gen_random_uuid(),
  content_type  public.content_type not null,

  omdb_imdb_id  text,
  tmdb_id       integer,

  primary_title   text,
  original_title  text,
  sort_title      text,

  release_year    integer,
  release_date    date,

  runtime_minutes integer,
  is_adult        boolean default false,

  poster_url   text,
  backdrop_url text,

  plot          text,
  tagline       text,
  genres        text[],

  language      text,
  country       text,

  imdb_rating    numeric(3,1) check (imdb_rating between 0 and 10),
  imdb_votes     integer      check (imdb_votes >= 0),

  metascore      smallint     check (metascore between 0 and 100),

  omdb_rated     text,
  omdb_released  text,
  omdb_runtime   text,
  omdb_genre     text,
  omdb_director  text,
  omdb_writer    text,
  omdb_actors    text,
  omdb_plot      text,
  omdb_language  text,
  omdb_country   text,
  omdb_awards    text,
  omdb_poster    text,
  omdb_type      text,
  omdb_dvd       text,
  omdb_box_office_str text,
  omdb_production    text,
  omdb_website       text,
  omdb_response      text,

  omdb_rt_rating_pct  smallint     check (omdb_rt_rating_pct between 0 and 100),
  omdb_box_office     numeric(12,2) check (omdb_box_office >= 0),
  omdb_response_ok    boolean,

  tmdb_adult              boolean,
  tmdb_video              boolean,
  tmdb_genre_ids          integer[],

  tmdb_original_language  text,
  tmdb_original_title     text,
  tmdb_title              text,

  tmdb_overview           text,
  tmdb_popularity         numeric(8,4) check (tmdb_popularity >= 0),
  tmdb_vote_average       numeric(3,2)  check (tmdb_vote_average between 0 and 10),
  tmdb_vote_count         integer       check (tmdb_vote_count >= 0),

  tmdb_release_date       date,
  tmdb_poster_path        text,
  tmdb_backdrop_path      text,

  data_source      text default 'omdb',
  source_priority  smallint default 1,
  raw_payload      jsonb,

  youtube_trailer_video_id      text,
  youtube_trailer_title         text,
  youtube_trailer_published_at  timestamptz,
  youtube_trailer_thumb_url     text,

  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Alter for idempotency / evolution
alter table public.titles
  add column if not exists title_id      uuid default gen_random_uuid(),
  add column if not exists content_type  public.content_type,
  add column if not exists omdb_imdb_id  text,
  add column if not exists tmdb_id       integer,
  add column if not exists primary_title text,
  add column if not exists original_title  text,
  add column if not exists sort_title      text,
  add column if not exists release_year    integer,
  add column if not exists release_date    date,
  add column if not exists runtime_minutes integer,
  add column if not exists is_adult        boolean default false,
  add column if not exists poster_url   text,
  add column if not exists backdrop_url text,
  add column if not exists plot          text,
  add column if not exists tagline       text,
  add column if not exists genres        text[],
  add column if not exists language      text,
  add column if not exists country       text,
  add column if not exists imdb_rating    numeric(3,1),
  add column if not exists imdb_votes     integer,
  add column if not exists metascore      smallint,
  add column if not exists omdb_rated     text,
  add column if not exists omdb_released  text,
  add column if not exists omdb_runtime   text,
  add column if not exists omdb_genre     text,
  add column if not exists omdb_director  text,
  add column if not exists omdb_writer    text,
  add column if not exists omdb_actors    text,
  add column if not exists omdb_plot      text,
  add column if not exists omdb_language  text,
  add column if not exists omdb_country   text,
  add column if not exists omdb_awards    text,
  add column if not exists omdb_poster    text,
  add column if not exists omdb_type      text,
  add column if not exists omdb_dvd       text,
  add column if not exists omdb_box_office_str text,
  add column if not exists omdb_production text,
  add column if not exists omdb_website    text,
  add column if not exists omdb_response   text,
  add column if not exists omdb_rt_rating_pct  smallint,
  add column if not exists omdb_box_office     numeric(12,2),
  add column if not exists omdb_response_ok    boolean,
  add column if not exists tmdb_adult              boolean,
  add column if not exists tmdb_video              boolean,
  add column if not exists tmdb_genre_ids          integer[],
  add column if not exists tmdb_original_language  text,
  add column if not exists tmdb_original_title     text,
  add column if not exists tmdb_title              text,
  add column if not exists tmdb_overview           text,
  add column if not exists tmdb_popularity         numeric(8,4),
  add column if not exists tmdb_vote_average       numeric(3,2),
  add column if not exists tmdb_vote_count         integer,
  add column if not exists tmdb_release_date       date,
  add column if not exists tmdb_poster_path        text,
  add column if not exists tmdb_backdrop_path      text,
  add column if not exists data_source      text default 'omdb',
  add column if not exists source_priority  smallint default 1,
  add column if not exists raw_payload      jsonb,
  add column if not exists youtube_trailer_video_id      text,
  add column if not exists youtube_trailer_title         text,
  add column if not exists youtube_trailer_published_at  timestamptz,
  add column if not exists youtube_trailer_thumb_url     text,
  add column if not exists deleted_at      timestamptz,
  add column if not exists created_at      timestamptz default now(),
  add column if not exists updated_at      timestamptz default now();

alter table public.titles
  alter column title_id set default gen_random_uuid();

alter table public.titles drop constraint if exists titles_pkey;
alter table public.titles add constraint titles_pkey primary key (title_id);

drop trigger if exists set_titles_updated_at on public.titles;
create trigger set_titles_updated_at
before update on public.titles
for each row
execute function public.set_updated_at();

create index if not exists titles_content_type_idx
  on public.titles(content_type);

create index if not exists titles_primary_title_trgm_idx
  on public.titles using gin (primary_title gin_trgm_ops);

create index if not exists titles_release_date_idx
  on public.titles(release_date);

-- ============================================================================
-- 6. MOVIES / SERIES / ANIME DETAIL TABLES
-- ============================================================================

create table if not exists public.movies (
  title_id      uuid primary key references public.titles(title_id) on delete cascade,
  box_office    numeric(12,2),
  budget        numeric(12,2),
  dvd_release   date,
  blu_ray_release date,
  streaming_release date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.movies
  add column if not exists title_id      uuid,
  add column if not exists box_office   numeric(12,2),
  add column if not exists budget       numeric(12,2),
  add column if not exists dvd_release  date,
  add column if not exists blu_ray_release date,
  add column if not exists streaming_release date,
  add column if not exists created_at   timestamptz default now(),
  add column if not exists updated_at   timestamptz default now();

alter table public.movies
  drop constraint if exists movies_pkey,
  add constraint movies_pkey primary key (title_id);

alter table public.movies
  drop constraint if exists movies_title_id_fkey,
  add constraint movies_title_id_fkey foreign key (title_id) references public.titles(title_id) on delete cascade;

drop trigger if exists set_movies_updated_at on public.movies;
create trigger set_movies_updated_at
before update on public.movies
for each row
execute function public.set_updated_at();

create table if not exists public.series (
  title_id      uuid primary key references public.titles(title_id) on delete cascade,
  total_seasons integer,
  total_episodes integer,
  in_production boolean,
  first_air_date date,
  last_air_date  date,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.series
  add column if not exists title_id       uuid,
  add column if not exists total_seasons  integer,
  add column if not exists total_episodes integer,
  add column if not exists in_production  boolean,
  add column if not exists first_air_date date,
  add column if not exists last_air_date  date,
  add column if not exists created_at     timestamptz default now(),
  add column if not exists updated_at     timestamptz default now();

alter table public.series
  drop constraint if exists series_pkey,
  add constraint series_pkey primary key (title_id);

alter table public.series
  drop constraint if exists series_title_id_fkey,
  add constraint series_title_id_fkey foreign key (title_id) references public.titles(title_id) on delete cascade;

drop trigger if exists set_series_updated_at on public.series;
create trigger set_series_updated_at
before update on public.series
for each row
execute function public.set_updated_at();

create table if not exists public.anime (
  title_id       uuid primary key references public.titles(title_id) on delete cascade,
  season_count   integer,
  episode_count  integer,
  studio         text,
  source         text,
  demographic    text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.anime
  add column if not exists title_id       uuid,
  add column if not exists season_count   integer,
  add column if not exists episode_count  integer,
  add column if not exists studio         text,
  add column if not exists source         text,
  add column if not exists demographic    text,
  add column if not exists created_at     timestamptz default now(),
  add column if not exists updated_at     timestamptz default now();

alter table public.anime
  drop constraint if exists anime_pkey,
  add constraint anime_pkey primary key (title_id);

alter table public.anime
  drop constraint if exists anime_title_id_fkey,
  add constraint anime_title_id_fkey foreign key (title_id) references public.titles(title_id) on delete cascade;

drop trigger if exists set_anime_updated_at on public.anime;
create trigger set_anime_updated_at
before update on public.anime
for each row
execute function public.set_updated_at();

-- ============================================================================
-- 7. SEASONS & EPISODES
-- ============================================================================

create table if not exists public.seasons (
  id            uuid primary key default gen_random_uuid(),
  title_id      uuid not null references public.titles(title_id) on delete cascade,
  season_number integer not null,
  name          text,
  overview      text,
  air_date      date,
  poster_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.seasons
  add column if not exists id            uuid default gen_random_uuid(),
  add column if not exists title_id      uuid,
  add column if not exists season_number integer,
  add column if not exists name          text,
  add column if not exists overview      text,
  add column if not exists air_date      date,
  add column if not exists poster_url    text,
  add column if not exists created_at    timestamptz default now(),
  add column if not exists updated_at    timestamptz default now();

alter table public.seasons
  drop constraint if exists seasons_pkey,
  add constraint seasons_pkey primary key (id);

create index if not exists seasons_title_id_idx on public.seasons(title_id);
create index if not exists seasons_title_season_unique_idx on public.seasons(title_id, season_number);

drop trigger if exists set_seasons_updated_at on public.seasons;
create trigger set_seasons_updated_at
before update on public.seasons
for each row
execute function public.set_updated_at();

create table if not exists public.episodes (
  id             uuid primary key default gen_random_uuid(),
  title_id       uuid not null references public.titles(title_id) on delete cascade,
  season_id      uuid references public.seasons(id) on delete cascade,
  episode_number integer not null,
  name           text,
  overview       text,
  air_date       date,
  runtime_minutes integer,
  still_url      text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.episodes
  add column if not exists id             uuid default gen_random_uuid(),
  add column if not exists title_id       uuid,
  add column if not exists season_id      uuid,
  add column if not exists episode_number integer,
  add column if not exists name           text,
  add column if not exists overview       text,
  add column if not exists air_date       date,
  add column if not exists runtime_minutes integer,
  add column if not exists still_url      text,
  add column if not exists created_at     timestamptz default now(),
  add column if not exists updated_at     timestamptz default now();

alter table public.episodes
  drop constraint if exists episodes_pkey,
  add constraint episodes_pkey primary key (id);

create index if not exists episodes_title_id_idx
  on public.episodes(title_id);

create index if not exists episodes_season_episode_unique_idx
  on public.episodes(season_id, episode_number);

drop trigger if exists set_episodes_updated_at on public.episodes;
create trigger set_episodes_updated_at
before update on public.episodes
for each row
execute function public.set_updated_at();

-- ============================================================================
-- 8. USER-GENERATED CONTENT: RATINGS, LIBRARY, REVIEWS, COMMENTS, LISTS
-- ============================================================================

create table if not exists public.ratings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title_id    uuid not null references public.titles(title_id) on delete cascade,
  content_type public.content_type not null,
  rating      numeric(2,1) not null check (rating >= 0 and rating <= 10 and (rating * 2) % 1 = 0),
  comment     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.ratings
  add column if not exists id          uuid default gen_random_uuid(),
  add column if not exists user_id     uuid,
  add column if not exists title_id    uuid,
  add column if not exists content_type public.content_type,
  add column if not exists rating      numeric(2,1),
  add column if not exists comment     text,
  add column if not exists created_at  timestamptz default now(),
  add column if not exists updated_at  timestamptz default now();

alter table public.ratings
  drop constraint if exists ratings_pkey,
  add constraint ratings_pkey primary key (id);

alter table public.ratings
  drop constraint if exists ratings_user_title_unique;
create unique index if not exists ratings_user_title_unique
  on public.ratings(user_id, title_id);

drop trigger if exists set_ratings_updated_at on public.ratings;
create trigger set_ratings_updated_at
before update on public.ratings
for each row
execute function public.set_updated_at();

create table if not exists public.library_entries (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  title_id     uuid not null references public.titles(title_id) on delete cascade,
  content_type public.content_type not null,
  status       public.library_status not null default 'want_to_watch',
  notes        text,
  started_at   timestamptz,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.library_entries
  add column if not exists id           uuid default gen_random_uuid(),
  add column if not exists user_id      uuid,
  add column if not exists title_id     uuid,
  add column if not exists content_type public.content_type,
  add column if not exists status       public.library_status default 'want_to_watch',
  add column if not exists notes        text,
  add column if not exists started_at   timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists created_at   timestamptz default now(),
  add column if not exists updated_at   timestamptz default now();

alter table public.library_entries
  drop constraint if exists library_entries_pkey,
  add constraint library_entries_pkey primary key (id);

create unique index if not exists library_entries_user_title_unique
  on public.library_entries(user_id, title_id);

drop trigger if exists set_library_entries_updated_at on public.library_entries;
create trigger set_library_entries_updated_at
before update on public.library_entries
for each row
execute function public.set_updated_at();

create table if not exists public.reviews (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  title_id   uuid not null references public.titles(title_id) on delete cascade,
  content_type public.content_type not null,
  rating     numeric(2,1) check (rating >= 0 and rating <= 10 and (rating * 2) % 1 = 0),
  headline   text,
  body       text,
  spoiler    boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.reviews
  add column if not exists id         uuid default gen_random_uuid(),
  add column if not exists user_id    uuid,
  add column if not exists title_id   uuid,
  add column if not exists content_type public.content_type,
  add column if not exists rating     numeric(2,1),
  add column if not exists headline   text,
  add column if not exists body       text,
  add column if not exists spoiler    boolean default false,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table public.reviews
  drop constraint if exists reviews_pkey,
  add constraint reviews_pkey primary key (id);

create index if not exists reviews_title_id_idx on public.reviews(title_id);
create index if not exists reviews_user_id_idx  on public.reviews(user_id);

drop trigger if exists set_reviews_updated_at on public.reviews;
create trigger set_reviews_updated_at
before update on public.reviews
for each row
execute function public.set_updated_at();

create table if not exists public.comments (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  review_id          uuid references public.reviews(id) on delete cascade,
  parent_comment_id  uuid references public.comments(id) on delete cascade,
  body               text not null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table public.comments
  add column if not exists id                 uuid default gen_random_uuid(),
  add column if not exists user_id            uuid,
  add column if not exists review_id          uuid,
  add column if not exists parent_comment_id  uuid,
  add column if not exists body               text,
  add column if not exists created_at         timestamptz default now(),
  add column if not exists updated_at         timestamptz default now();

drop trigger if exists set_comments_updated_at on public.comments;
create trigger set_comments_updated_at
before update on public.comments
for each row
execute function public.set_updated_at();

create index if not exists comments_review_id_idx         on public.comments(review_id);
create index if not exists comments_parent_comment_id_idx on public.comments(parent_comment_id);

create table if not exists public.lists (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  description text,
  is_public   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.lists
  add column if not exists id          uuid default gen_random_uuid(),
  add column if not exists user_id     uuid,
  add column if not exists name        text,
  add column if not exists description text,
  add column if not exists is_public   boolean default false,
  add column if not exists created_at  timestamptz default now(),
  add column if not exists updated_at  timestamptz default now();

alter table public.lists
  drop constraint if exists lists_pkey,
  add constraint lists_pkey primary key (id);

drop trigger if exists set_lists_updated_at on public.lists;
create trigger set_lists_updated_at
before update on public.lists
for each row
execute function public.set_updated_at();

create index if not exists lists_user_id_idx on public.lists(user_id);
create index if not exists lists_is_public_idx on public.lists(is_public);

create table if not exists public.list_items (
  id         uuid primary key default gen_random_uuid(),
  list_id    uuid not null references public.lists(id) on delete cascade,
  title_id   uuid not null references public.titles(title_id) on delete cascade,
  content_type public.content_type not null,
  position   integer not null default 0,
  note       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.list_items
  add column if not exists id         uuid default gen_random_uuid(),
  add column if not exists list_id    uuid,
  add column if not exists title_id   uuid,
  add column if not exists content_type public.content_type,
  add column if not exists position   integer default 0,
  add column if not exists note       text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table public.list_items
  drop constraint if exists list_items_pkey,
  add constraint list_items_pkey primary key (id);

drop trigger if exists set_list_items_updated_at on public.list_items;
create trigger set_list_items_updated_at
before update on public.list_items
for each row
execute function public.set_updated_at();

create index if not exists list_items_list_id_idx
  on public.list_items(list_id);

create index if not exists list_items_list_position_idx
  on public.list_items(list_id, position);

-- ============================================================================
-- 9. ROW LEVEL SECURITY (RLS) FOR EXISTING CANONICAL TABLES
-- ============================================================================

-- PROFILES
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all"
on public.profiles
for select
using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

-- CONTENT TABLES
alter table public.titles enable row level security;

drop policy if exists "titles_select_non_deleted" on public.titles;
create policy "titles_select_non_deleted"
on public.titles
for select
using (deleted_at is null);

alter table public.movies  enable row level security;
alter table public.series  enable row level security;
alter table public.anime   enable row level security;
alter table public.seasons enable row level security;
alter table public.episodes enable row level security;

drop policy if exists "movies_select_all" on public.movies;
create policy "movies_select_all"
on public.movies
for select
using (true);

drop policy if exists "series_select_all" on public.series;
create policy "series_select_all"
on public.series
for select
using (true);

drop policy if exists "anime_select_all" on public.anime;
create policy "anime_select_all"
on public.anime
for select
using (true);

drop policy if exists "seasons_select_all" on public.seasons;
create policy "seasons_select_all"
on public.seasons
for select
using (true);

drop policy if exists "episodes_select_all" on public.episodes;
create policy "episodes_select_all"
on public.episodes
for select
using (true);

-- RATINGS
alter table public.ratings enable row level security;

drop policy if exists "ratings_select_all" on public.ratings;
create policy "ratings_select_all"
on public.ratings
for select
using (true);

drop policy if exists "ratings_write_own" on public.ratings;
create policy "ratings_write_own"
on public.ratings
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- LIBRARY ENTRIES
alter table public.library_entries enable row level security;

drop policy if exists "library_entries_select_own" on public.library_entries;
create policy "library_entries_select_own"
on public.library_entries
for select
using (auth.uid() = user_id);

drop policy if exists "library_entries_write_own" on public.library_entries;
create policy "library_entries_write_own"
on public.library_entries
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- REVIEWS
alter table public.reviews enable row level security;

drop policy if exists "reviews_select_all" on public.reviews;
create policy "reviews_select_all"
on public.reviews
for select
using (true);

drop policy if exists "reviews_write_own" on public.reviews;
create policy "reviews_write_own"
on public.reviews
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- COMMENTS
alter table public.comments enable row level security;

drop policy if exists "comments_select_all" on public.comments;
create policy "comments_select_all"
on public.comments
for select
using (true);

drop policy if exists "comments_write_own" on public.comments;
create policy "comments_write_own"
on public.comments
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- LISTS
alter table public.lists enable row level security;

drop policy if exists "lists_select_public_or_own" on public.lists;
create policy "lists_select_public_or_own"
on public.lists
for select
using (is_public or auth.uid() = user_id);

drop policy if exists "lists_write_own" on public.lists;
create policy "lists_write_own"
on public.lists
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- LIST ITEMS
alter table public.list_items enable row level security;

drop policy if exists "list_items_select_public_or_own" on public.list_items;
create policy "list_items_select_public_or_own"
on public.list_items
for select
using (
  exists (
    select 1
    from public.lists l
    where l.id = list_items.list_id
      and (l.is_public or l.user_id = auth.uid())
  )
);

drop policy if exists "list_items_write_own" on public.list_items;
create policy "list_items_write_own"
on public.list_items
for all
using (
  exists (
    select 1
    from public.lists l
    where l.id = list_items.list_id
      and l.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.lists l
    where l.id = list_items.list_id
      and l.user_id = auth.uid()
  )
);

-- ============================================================================
-- 10. ADDITIONAL TYPES FROM SOCIAL / ANALYTICS SCHEMA
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'title_type') then
    create type public.title_type as enum ('movie', 'series', 'anime', 'short');
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

-- ============================================================================
-- 11. EXTRA TABLES FROM SOCIAL / ANALYTICS SCHEMA
-- ============================================================================

-- 3.1 Follows
create table if not exists public.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  followed_id uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  constraint follows_pkey primary key (follower_id, followed_id)
);

create index if not exists idx_follows_followed_id on public.follows(followed_id);
create index if not exists idx_follows_follower_id on public.follows(follower_id);

-- 3.2 Review reactions
create table if not exists public.review_reactions (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table public.review_reactions
  add column if not exists review_id uuid not null references public.reviews(id) on delete cascade,
  add column if not exists user_id   uuid not null references auth.users(id) on delete cascade,
  add column if not exists emoji     text not null;

create index if not exists idx_review_reactions_review_id on public.review_reactions(review_id);
create index if not exists idx_review_reactions_user_id   on public.review_reactions(user_id);

-- 3.3 Comment likes
create table if not exists public.comment_likes (
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint comment_likes_pkey primary key (comment_id, user_id)
);

create index if not exists idx_comment_likes_comment_id on public.comment_likes(comment_id);
create index if not exists idx_comment_likes_user_id    on public.comment_likes(user_id);

-- 3.4 Activity events
create table if not exists public.activity_events (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table public.activity_events
  add column if not exists user_id         uuid not null references auth.users(id) on delete cascade,
  add column if not exists event_type      public.activity_event_type not null,
  add column if not exists title_id        text,
  add column if not exists related_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists payload         jsonb;

create index if not exists idx_activity_user_id          on public.activity_events(user_id);
create index if not exists idx_activity_created_at       on public.activity_events(created_at);
create index if not exists idx_activity_user_created_at  on public.activity_events(user_id, created_at desc);

-- 3.5 Notifications
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table public.notifications
  add column if not exists user_id uuid not null references auth.users(id) on delete cascade,
  add column if not exists type    text not null,
  add column if not exists data    jsonb,
  add column if not exists is_read boolean not null default false;

create index if not exists idx_notifications_user_id     on public.notifications(user_id);
create index if not exists idx_notifications_is_read     on public.notifications(is_read);
create index if not exists idx_notifications_user_unread
  on public.notifications(user_id)
  where is_read = false;

-- 3.6 Conversations & direct messages
create table if not exists public.conversations (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table public.conversations
  add column if not exists is_group   boolean not null default false,
  add column if not exists title      text,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  role            text not null default 'member',
  created_at      timestamptz not null default now(),
  constraint conversation_participants_pkey primary key (conversation_id, user_id)
);

create index if not exists idx_conv_participants_user_id
  on public.conversation_participants(user_id);

-- Migrate role column to participant_role enum where possible
alter table public.conversation_participants
  alter column role drop default;

alter table public.conversation_participants
  alter column role type public.participant_role
  using case lower(role::text)
    when 'owner'  then 'owner'::public.participant_role
    when 'admin'  then 'admin'::public.participant_role
    else 'member'::public.participant_role
  end;

alter table public.conversation_participants
  alter column role set default 'member';

create table if not exists public.messages (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now()
);

alter table public.messages
  add column if not exists conversation_id uuid not null references public.conversations(id) on delete cascade,
  add column if not exists user_id         uuid not null references auth.users(id) on delete cascade,
  add column if not exists body            text not null,
  add column if not exists attachment_url  text;

create index if not exists idx_messages_conversation_id on public.messages(conversation_id);
create index if not exists idx_messages_created_at      on public.messages(created_at);

create table if not exists public.message_reactions (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table public.message_reactions
  add column if not exists conversation_id uuid not null references public.conversations(id) on delete cascade,
  add column if not exists message_id      uuid not null references public.messages(id) on delete cascade,
  add column if not exists user_id         uuid not null references auth.users(id) on delete cascade,
  add column if not exists emoji           text not null;

create index if not exists idx_message_reactions_conv
  on public.message_reactions(conversation_id);
create index if not exists idx_message_reactions_msg
  on public.message_reactions(message_id);

create table if not exists public.message_delivery_receipts (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  message_id    uuid not null references public.messages(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  delivered_at  timestamptz not null default now()
);

create index if not exists idx_message_delivery_conv
  on public.message_delivery_receipts(conversation_id);
create index if not exists idx_message_delivery_msg
  on public.message_delivery_receipts(message_id);
create index if not exists idx_message_delivery_user
  on public.message_delivery_receipts(user_id);

create table if not exists public.message_read_receipts (
  conversation_id      uuid not null references public.conversations(id) on delete cascade,
  user_id              uuid not null references auth.users(id) on delete cascade,
  last_read_message_id uuid references public.messages(id) on delete set null,
  last_read_at         timestamptz not null default now(),
  constraint message_read_receipts_pkey primary key (conversation_id, user_id)
);

create index if not exists idx_read_receipts_conv
  on public.message_read_receipts(conversation_id);

-- 3.7 Aggregate & analytic tables
create table if not exists public.title_stats (
  title_id uuid primary key,
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
  watchlist_count int default 0,
  comments_count int default 0,
  lists_count int default 0,
  messages_sent_count int default 0,
  last_active_at timestamptz
);

-- 3.8 Domain tables: genres & credits
create table if not exists public.genres (
  id bigserial primary key,
  name text not null unique,
  slug text not null unique
);

create table if not exists public.title_genres (
  title_id uuid not null,
  genre_id bigint not null references public.genres(id) on delete cascade,
  primary key (title_id, genre_id)
);

create table if not exists public.people (
  id bigserial primary key,
  name text not null,
  tmdb_id int,
  imdb_id text
);

create table if not exists public.title_credits (
  id bigserial primary key,
  title_id uuid not null,
  person_id bigint not null references public.people(id) on delete cascade,
  job text,
  character text,
  "order" int
);

create index if not exists idx_title_credits_title_id on public.title_credits(title_id);
create index if not exists idx_title_credits_person_id on public.title_credits(person_id);

-- 3.9 Episode progress (per-user)
create table if not exists public.episode_progress (
  user_id    uuid not null references auth.users(id) on delete cascade,
  episode_id uuid not null references public.episodes(id) on delete cascade,
  status     public.episode_status not null default 'watched',
  watched_at timestamptz not null default now(),
  primary key (user_id, episode_id)
);

-- 3.10 Tags, blocking, settings, moderation
create table if not exists public.user_tags (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references auth.users(id) on delete cascade,
  name      text not null,
  color     text,
  created_at timestamptz not null default now(),
  constraint user_tags_unique_name_per_user unique (user_id, name)
);

create table if not exists public.user_title_tags (
  user_id  uuid not null references auth.users(id) on delete cascade,
  title_id uuid not null,

  tag_id   uuid not null references public.user_tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, title_id, tag_id)
);

create index if not exists idx_user_title_tags_title_id on public.user_title_tags(title_id);
create index if not exists idx_user_title_tags_tag_id   on public.user_title_tags(tag_id);

create table if not exists public.blocked_users (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

create index if not exists idx_blocked_users_blocker_id on public.blocked_users(blocker_id);
create index if not exists idx_blocked_users_blocked_id on public.blocked_users(blocked_id);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_notifications boolean not null default true,
  push_notifications boolean not null default true,
  privacy_profile public.privacy_level not null default 'public',
  privacy_activity public.privacy_level not null default 'public',
  privacy_lists public.privacy_level not null default 'public',
  updated_at timestamptz not null default now()
);

create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null,
  target_id   text not null,
  reason      text,
  status      public.report_status not null default 'open',
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id),
  notes       text
);

create index if not exists idx_reports_status on public.reports(status);
create index if not exists idx_reports_target on public.reports(target_type, target_id);

-- ============================================================================
-- 12. STRICTER RLS FOR NEW TABLES
-- ============================================================================

-- 4.1 Follows: anyone can read; only follower can modify
alter table public.follows enable row level security;

drop policy if exists "follows_select_all" on public.follows;
create policy "follows_select_all"
on public.follows
for select
using (true);

drop policy if exists "follows_write_own" on public.follows;
create policy "follows_write_own"
on public.follows
for all
using (auth.uid() = follower_id)
with check (auth.uid() = follower_id);

-- 4.2 Review reactions: readable for all, write/delete own
alter table public.review_reactions enable row level security;

drop policy if exists "review_reactions_select_all" on public.review_reactions;
create policy "review_reactions_select_all"
on public.review_reactions
for select
using (true);

drop policy if exists "review_reactions_write_own" on public.review_reactions;
create policy "review_reactions_write_own"
on public.review_reactions
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- 4.3 Comment likes: readable for all, write/delete own
alter table public.comment_likes enable row level security;

drop policy if exists "comment_likes_select_all" on public.comment_likes;
create policy "comment_likes_select_all"
on public.comment_likes
for select
using (true);

drop policy if exists "comment_likes_write_own" on public.comment_likes;
create policy "comment_likes_write_own"
on public.comment_likes
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- 4.4 Activity events: only actor or related user sees the row
alter table public.activity_events enable row level security;

drop policy if exists "activity_events_select_actor_or_related" on public.activity_events;
create policy "activity_events_select_actor_or_related"
on public.activity_events
for select
using (
  auth.uid() = user_id
  or auth.uid() = related_user_id
);

drop policy if exists "activity_events_write_own" on public.activity_events;
create policy "activity_events_write_own"
on public.activity_events
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- 4.5 Notifications: only owning user can see / modify
alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
on public.notifications
for select
using (auth.uid() = user_id);

drop policy if exists "notifications_write_own" on public.notifications;
create policy "notifications_write_own"
on public.notifications
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- 4.6 Conversations: visible only to participants
alter table public.conversations enable row level security;

drop policy if exists "conversations_select_participant" on public.conversations;
create policy "conversations_select_participant"
on public.conversations
for select
using (
  exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = conversations.id
      and cp.user_id = auth.uid()
  )
);

drop policy if exists "conversations_write_creator_or_participant" on public.conversations;
create policy "conversations_write_creator_or_participant"
on public.conversations
for all
using (
  created_by = auth.uid()
  or exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = conversations.id
      and cp.user_id = auth.uid()
  )
)
with check (
  created_by = auth.uid()
  or exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = conversations.id
      and cp.user_id = auth.uid()
  )
);

-- 4.7 Conversation participants: each user controls their own membership row
alter table public.conversation_participants enable row level security;

drop policy if exists "conversation_participants_select_own" on public.conversation_participants;
create policy "conversation_participants_select_own"
on public.conversation_participants
for select
using (auth.uid() = user_id);

drop policy if exists "conversation_participants_write_own" on public.conversation_participants;
drop policy if exists "conversation_participants_write_controlled" on public.conversation_participants;
create policy "conversation_participants_write_controlled"
on public.conversation_participants
for all
using (
  auth.uid() = user_id
  and exists (
    select 1
    from public.conversations c
    where c.id = conversation_participants.conversation_id
      and c.created_by = auth.uid()
  )
)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.conversations c
    where c.id = conversation_participants.conversation_id
      and c.created_by = auth.uid()
  )
);

-- 4.8 Messages: participant-only visibility; only sender can write
alter table public.messages enable row level security;

drop policy if exists "messages_select_participant" on public.messages;
create policy "messages_select_participant"
on public.messages
for select
using (
  exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = messages.conversation_id
      and cp.user_id = auth.uid()
  )
);

drop policy if exists "messages_write_sender" on public.messages;
create policy "messages_write_sender"
on public.messages
for all
using (
  auth.uid() = user_id
  and exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = messages.conversation_id
      and cp.user_id = auth.uid()
  )
)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = messages.conversation_id
      and cp.user_id = auth.uid()
  )
);

-- 4.9 Message reactions: only participants; only reactor can write
alter table public.message_reactions enable row level security;

drop policy if exists "message_reactions_select_participant" on public.message_reactions;
create policy "message_reactions_select_participant"
on public.message_reactions
for select
using (
  exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = message_reactions.conversation_id
      and cp.user_id = auth.uid()
  )
);

drop policy if exists "message_reactions_write_own" on public.message_reactions;
create policy "message_reactions_write_own"
on public.message_reactions
for all
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = message_reactions.conversation_id
      and cp.user_id = auth.uid()
  )
);

-- 4.10 Message delivery receipts: only the user owning the receipt
alter table public.message_delivery_receipts enable row level security;

drop policy if exists "message_delivery_receipts_select_own" on public.message_delivery_receipts;
create policy "message_delivery_receipts_select_own"
on public.message_delivery_receipts
for select
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = message_delivery_receipts.conversation_id
      and cp.user_id = auth.uid()
  )
);
drop policy if exists "message_delivery_receipts_write_own" on public.message_delivery_receipts;
create policy "message_delivery_receipts_write_own"
on public.message_delivery_receipts
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- 4.11 Message read receipts: only per-user, per-conversation
alter table public.message_read_receipts enable row level security;

drop policy if exists "message_read_receipts_select_own" on public.message_read_receipts;
create policy "message_read_receipts_select_own"
on public.message_read_receipts
for select
using (auth.uid() = user_id);

drop policy if exists "message_read_receipts_write_own" on public.message_read_receipts;
create policy "message_read_receipts_write_own"
on public.message_read_receipts
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- 4.12 Title stats & user stats
-- Title stats: read-only for clients; no write policy
alter table public.title_stats enable row level security;

drop policy if exists "title_stats_select_all" on public.title_stats;
create policy "title_stats_select_all"
on public.title_stats
for select
using (true);

-- User stats: readable by everyone; client updates allowed only on own row (if you ever do)
alter table public.user_stats enable row level security;

drop policy if exists "user_stats_select_all" on public.user_stats;
create policy "user_stats_select_all"
on public.user_stats
for select
using (true);

drop policy if exists "user_stats_write_own" on public.user_stats;
create policy "user_stats_write_own"
on public.user_stats
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- 4.13 Genres, title_genres, people, title_credits
-- These are global metadata: read-only from clients
alter table public.genres enable row level security;
alter table public.title_genres enable row level security;
alter table public.people enable row level security;
alter table public.title_credits enable row level security;

drop policy if exists "genres_select_all" on public.genres;
create policy "genres_select_all"
on public.genres
for select
using (true);

drop policy if exists "title_genres_select_all" on public.title_genres;
create policy "title_genres_select_all"
on public.title_genres
for select
using (true);

drop policy if exists "people_select_all" on public.people;
create policy "people_select_all"
on public.people
for select
using (true);

drop policy if exists "title_credits_select_all" on public.title_credits;
create policy "title_credits_select_all"
on public.title_credits
for select
using (true);

-- 4.14 Episode progress: strictly per-user
alter table public.episode_progress enable row level security;

drop policy if exists "episode_progress_select_own" on public.episode_progress;
create policy "episode_progress_select_own"
on public.episode_progress
for select
using (auth.uid() = user_id);

drop policy if exists "episode_progress_write_own" on public.episode_progress;
create policy "episode_progress_write_own"
on public.episode_progress
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- 4.15 User tags, user_title_tags, blocked_users, user_settings, reports

-- USER_TAGS & USER_TITLE_TAGS (per-user tags)
alter table public.user_tags enable row level security;
alter table public.user_title_tags enable row level security;

drop policy if exists "user_tags_select_own" on public.user_tags;
create policy "user_tags_select_own"
on public.user_tags
for select
using (auth.uid() = user_id);

drop policy if exists "user_tags_write_own" on public.user_tags;
create policy "user_tags_write_own"
on public.user_tags
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "user_title_tags_select_own" on public.user_title_tags;
create policy "user_title_tags_select_own"
on public.user_title_tags
for select
using (auth.uid() = user_id);

drop policy if exists "user_title_tags_write_own" on public.user_title_tags;
create policy "user_title_tags_write_own"
on public.user_title_tags
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- BLOCKED_USERS
alter table public.blocked_users enable row level security;

drop policy if exists "blocked_users_select_own" on public.blocked_users;
create policy "blocked_users_select_own"
on public.blocked_users
for select
using (auth.uid() = blocker_id);

drop policy if exists "blocked_users_write_own" on public.blocked_users;
create policy "blocked_users_write_own"
on public.blocked_users
for all
using (auth.uid() = blocker_id)
with check (auth.uid() = blocker_id);

-- USER_SETTINGS
alter table public.user_settings enable row level security;

drop policy if exists "user_settings_select_own" on public.user_settings;
create policy "user_settings_select_own"
on public.user_settings
for select
using (auth.uid() = user_id);

drop policy if exists "user_settings_write_own" on public.user_settings;
create policy "user_settings_write_own"
on public.user_settings
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- REPORTS
alter table public.reports enable row level security;

drop policy if exists "reports_select_own" on public.reports;
create policy "reports_select_own"
on public.reports
for select
using (auth.uid() = reporter_id);

drop policy if exists "reports_write_own" on public.reports;
create policy "reports_write_own"
on public.reports
for all
using (auth.uid() = reporter_id)
with check (auth.uid() = reporter_id);



-- ============================================================================
-- GPT-ASSISTANT SCHEMA UPDATES (applied after original DDL)
-- These blocks are written to preserve idempotency as much as possible.
-- ============================================================================

-- 1) Ensure title_id columns use uuid and reference public.titles(title_id)
-- --------------------------------------------------------------------------

do $$
begin
  -- public.title_stats.title_id: text -> uuid
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'title_stats'
      and column_name  = 'title_id'
      and data_type in ('text', 'character varying')
  ) then
    alter table public.title_stats
      alter column title_id type uuid using title_id::uuid;
  end if;
end $$;

do $$
begin
  -- public.title_genres.title_id: text -> uuid
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'title_genres'
      and column_name  = 'title_id'
      and data_type in ('text', 'character varying')
  ) then
    alter table public.title_genres
      alter column title_id type uuid using title_id::uuid;
  end if;
end $$;

do $$
begin
  -- public.title_credits.title_id: text -> uuid
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'title_credits'
      and column_name  = 'title_id'
      and data_type in ('text', 'character varying')
  ) then
    alter table public.title_credits
      alter column title_id type uuid using title_id::uuid;
  end if;
end $$;

do $$
begin
  -- public.user_title_tags.title_id: text -> uuid
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'user_title_tags'
      and column_name  = 'title_id'
      and data_type in ('text', 'character varying')
  ) then
    alter table public.user_title_tags
      alter column title_id type uuid using title_id::uuid;
  end if;
end $$;

-- Add missing foreign keys from title_* tables to public.titles(title_id)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'title_stats_title_id_fkey'
      and conrelid = 'public.title_stats'::regclass
  ) then
    alter table public.title_stats
      add constraint title_stats_title_id_fkey
        foreign key (title_id)
        references public.titles(title_id)
        on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'title_genres_title_id_fkey'
      and conrelid = 'public.title_genres'::regclass
  ) then
    alter table public.title_genres
      add constraint title_genres_title_id_fkey
        foreign key (title_id)
        references public.titles(title_id)
        on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'title_credits_title_id_fkey'
      and conrelid = 'public.title_credits'::regclass
  ) then
    alter table public.title_credits
      add constraint title_credits_title_id_fkey
        foreign key (title_id)
        references public.titles(title_id)
        on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'user_title_tags_title_id_fkey'
      and conrelid = 'public.user_title_tags'::regclass
  ) then
    alter table public.user_title_tags
      add constraint user_title_tags_title_id_fkey
        foreign key (title_id)
        references public.titles(title_id)
        on delete cascade;
  end if;
end $$;

-- 2) Convert activity_events.event_type to activity_event_type enum
-- -----------------------------------------------------------------

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'activity_events'
      and column_name  = 'event_type'
      and data_type in ('text', 'character varying')
  ) then
    alter table public.activity_events
      alter column event_type type public.activity_event_type
      using event_type::public.activity_event_type;
  end if;
end $$;

-- 3) Add uniqueness constraints for reactions
-- -------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'review_reactions_unique'
      and conrelid = 'public.review_reactions'::regclass
  ) then
    alter table public.review_reactions
      add constraint review_reactions_unique
        unique (review_id, user_id, emoji);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'message_reactions_unique'
      and conrelid = 'public.message_reactions'::regclass
  ) then
    alter table public.message_reactions
      add constraint message_reactions_unique
        unique (message_id, user_id, emoji);
  end if;
end $$;

-- 4) Improve RLS for conversation_participants:
--     participants can see all participants in their conversations.
-- -----------------------------------------------------------------

alter table public.conversation_participants enable row level security;

drop policy if exists "conversation_participants_select_own"
  on public.conversation_participants;

drop policy if exists "conversation_participants_select_participant"
  on public.conversation_participants;

create policy "conversation_participants_select_participant"
on public.conversation_participants
for select
using (
  exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = conversation_participants.conversation_id
      and cp.user_id = auth.uid()
  )
);

-- 5) Helpful composite indexes
-- ----------------------------

-- Ratings
create index if not exists idx_ratings_user_id_created_at
  on public.ratings(user_id, created_at desc);

create index if not exists idx_ratings_title_id_created_at
  on public.ratings(title_id, created_at desc);

-- Library entries
create index if not exists idx_library_entries_user_status
  on public.library_entries(user_id, status);

create index if not exists idx_library_entries_user_title
  on public.library_entries(user_id, title_id);

-- Episode progress
create index if not exists idx_episode_progress_user_episode
  on public.episode_progress(user_id, episode_id);

create index if not exists idx_episode_progress_user_status
  on public.episode_progress(user_id, status);

commit;
