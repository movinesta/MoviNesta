CREATE SEQUENCE IF NOT EXISTS public.genres_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.people_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.title_credits_id_seq;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.activity_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  event_type USER-DEFINED NOT NULL,
  title_id text,
  related_user_id uuid,
  payload jsonb,
  CONSTRAINT activity_events_pkey PRIMARY KEY (id),
  CONSTRAINT activity_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT activity_events_related_user_id_fkey FOREIGN KEY (related_user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.anime (
  title_id uuid NOT NULL,
  season_count integer,
  episode_count integer,
  studio text,
  source text,
  demographic text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT anime_pkey PRIMARY KEY (title_id),
  CONSTRAINT anime_title_id_fkey FOREIGN KEY (title_id) REFERENCES public.titles(title_id)
);
CREATE TABLE public.blocked_users (
  blocker_id uuid NOT NULL,
  blocked_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT blocked_users_pkey PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT blocked_users_blocker_id_fkey FOREIGN KEY (blocker_id) REFERENCES auth.users(id),
  CONSTRAINT blocked_users_blocked_id_fkey FOREIGN KEY (blocked_id) REFERENCES auth.users(id)
);
CREATE TABLE public.comment_likes (
  comment_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT comment_likes_pkey PRIMARY KEY (comment_id, user_id),
  CONSTRAINT comment_likes_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.comments(id),
  CONSTRAINT comment_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.comments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  review_id uuid,
  parent_comment_id uuid,
  body text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT comments_pkey PRIMARY KEY (id),
  CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT comments_review_id_fkey FOREIGN KEY (review_id) REFERENCES public.reviews(id),
  CONSTRAINT comments_parent_comment_id_fkey FOREIGN KEY (parent_comment_id) REFERENCES public.comments(id)
);
CREATE TABLE public.conversation_participants (
  conversation_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role participant_role NOT NULL DEFAULT 'member'::participant_role,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT conversation_participants_pkey PRIMARY KEY (conversation_id, user_id),
  CONSTRAINT conversation_participants_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id),
  CONSTRAINT conversation_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE INDEX IF NOT EXISTS conversation_participants_user_id_idx
  ON public.conversation_participants USING btree (user_id);
CREATE TABLE public.conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  is_group boolean NOT NULL DEFAULT false,
  title text,
  created_by uuid,
  direct_participant_ids uuid[],
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT conversations_pkey PRIMARY KEY (id),
  CONSTRAINT conversations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT direct_conversations_require_pair CHECK (
    is_group
    OR (
      direct_participant_ids IS NOT NULL
      AND array_length(direct_participant_ids, 1) = 2
    )
  )
);
CREATE UNIQUE INDEX conversations_direct_pair_unique
  ON public.conversations USING btree (direct_participant_ids)
  WHERE (NOT is_group);
CREATE TABLE public.episode_progress (
  user_id uuid NOT NULL,
  episode_id uuid NOT NULL,
  status episode_status NOT NULL DEFAULT 'watched'::episode_status,
  watched_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT episode_progress_pkey PRIMARY KEY (user_id, episode_id),
  CONSTRAINT episode_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT episode_progress_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.episodes(id)
);
CREATE TABLE public.episodes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title_id uuid NOT NULL,
  season_id uuid,
  episode_number integer NOT NULL,
  name text,
  overview text,
  air_date date,
  runtime_minutes integer,
  still_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT episodes_pkey PRIMARY KEY (id),
  CONSTRAINT episodes_title_id_fkey FOREIGN KEY (title_id) REFERENCES public.titles(title_id),
  CONSTRAINT episodes_season_id_fkey FOREIGN KEY (season_id) REFERENCES public.seasons(id)
);
CREATE TABLE public.follows (
  follower_id uuid NOT NULL,
  followed_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT follows_pkey PRIMARY KEY (follower_id, followed_id),
  CONSTRAINT follows_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES auth.users(id),
  CONSTRAINT follows_followed_id_fkey FOREIGN KEY (followed_id) REFERENCES auth.users(id)
);
CREATE TABLE public.genres (
  id bigint NOT NULL DEFAULT nextval('genres_id_seq'::regclass),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  CONSTRAINT genres_pkey PRIMARY KEY (id)
);
CREATE TABLE public.library_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title_id uuid NOT NULL,
  content_type public.content_type NOT NULL,
  status library_status NOT NULL DEFAULT 'want_to_watch'::library_status,
  notes text,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT library_entries_pkey PRIMARY KEY (id),
  CONSTRAINT library_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT library_entries_title_id_fkey FOREIGN KEY (title_id) REFERENCES public.titles(title_id)
);
CREATE TABLE public.list_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL,
  title_id uuid NOT NULL,
  content_type public.content_type NOT NULL,
  position integer NOT NULL DEFAULT 0,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT list_items_pkey PRIMARY KEY (id),
  CONSTRAINT list_items_list_id_fkey FOREIGN KEY (list_id) REFERENCES public.lists(id),
  CONSTRAINT list_items_title_id_fkey FOREIGN KEY (title_id) REFERENCES public.titles(title_id)
);
CREATE TABLE public.lists (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT lists_pkey PRIMARY KEY (id),
  CONSTRAINT lists_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.message_delivery_receipts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  conversation_id uuid NOT NULL,
  message_id uuid NOT NULL,
  user_id uuid NOT NULL,
  delivered_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT message_delivery_receipts_pkey PRIMARY KEY (id),
  CONSTRAINT message_delivery_receipts_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id),
  CONSTRAINT message_delivery_receipts_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id),
  CONSTRAINT message_delivery_receipts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.message_reactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  conversation_id uuid NOT NULL,
  message_id uuid NOT NULL,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  CONSTRAINT message_reactions_pkey PRIMARY KEY (id),
  CONSTRAINT message_reactions_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id),
  CONSTRAINT message_reactions_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id),
  CONSTRAINT message_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.message_read_receipts (
  conversation_id uuid NOT NULL,
  user_id uuid NOT NULL,
  last_read_message_id uuid,
  last_read_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT message_read_receipts_pkey PRIMARY KEY (conversation_id, user_id),
  CONSTRAINT message_read_receipts_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id),
  CONSTRAINT message_read_receipts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT message_read_receipts_last_read_message_id_fkey FOREIGN KEY (last_read_message_id) REFERENCES public.messages(id)
);
CREATE TABLE public.messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  conversation_id uuid NOT NULL,
  user_id uuid NOT NULL,
  body text NOT NULL,
  attachment_url text,
  sender_id uuid,
  CONSTRAINT messages_pkey PRIMARY KEY (id),
  CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id),
  CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id),
  CONSTRAINT messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE INDEX IF NOT EXISTS messages_conversation_id_created_at_idx
  ON public.messages USING btree (conversation_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.get_conversation_summaries(p_user_id uuid)
RETURNS TABLE (
  conversation_id uuid,
  is_group boolean,
  title text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  last_message_id uuid,
  last_message_body text,
  last_message_created_at timestamp with time zone,
  last_message_user_id uuid,
  last_message_display_name text,
  last_message_username text,
  participants jsonb,
  self_last_read_message_id uuid,
  self_last_read_at timestamp with time zone,
  participant_receipts jsonb
)
LANGUAGE sql
STABLE
AS $$
WITH user_conversations AS (
  SELECT c.*
  FROM public.conversations c
  INNER JOIN public.conversation_participants cp ON cp.conversation_id = c.id
  WHERE cp.user_id = p_user_id
),
last_messages AS (
  SELECT DISTINCT ON (m.conversation_id)
    m.id,
    m.conversation_id,
    m.user_id,
    m.body,
    m.created_at
  FROM public.messages m
  INNER JOIN user_conversations uc ON uc.id = m.conversation_id
  ORDER BY m.conversation_id, m.created_at DESC
),
participants AS (
  SELECT
    cp.conversation_id,
    jsonb_agg(
      jsonb_build_object(
        'id', cp.user_id,
        'displayName', COALESCE(pr.display_name, pr.username, 'Unknown user'),
        'username', pr.username,
        'avatarUrl', pr.avatar_url,
        'isSelf', cp.user_id = p_user_id
      )
      ORDER BY cp.created_at
    ) AS participants
  FROM public.conversation_participants cp
  LEFT JOIN public.profiles pr ON pr.id = cp.user_id
  WHERE cp.conversation_id IN (SELECT id FROM user_conversations)
  GROUP BY cp.conversation_id
),
receipt_summaries AS (
  SELECT
    r.conversation_id,
    MAX(CASE WHEN r.user_id = p_user_id THEN r.last_read_message_id END) AS self_last_read_message_id,
    MAX(CASE WHEN r.user_id = p_user_id THEN r.last_read_at END) AS self_last_read_at,
    jsonb_agg(
      jsonb_build_object(
        'userId', r.user_id,
        'lastReadMessageId', r.last_read_message_id,
        'lastReadAt', r.last_read_at
      )
      ORDER BY r.last_read_at DESC
    ) AS participant_receipts
  FROM public.message_read_receipts r
  WHERE r.conversation_id IN (SELECT id FROM user_conversations)
  GROUP BY r.conversation_id
),
last_message_profiles AS (
  SELECT lm.id, lm.conversation_id, pr.display_name, pr.username
  FROM last_messages lm
  LEFT JOIN public.profiles pr ON pr.id = lm.user_id
)
SELECT
  uc.id AS conversation_id,
  uc.is_group,
  uc.title,
  uc.created_at,
  uc.updated_at,
  lm.id AS last_message_id,
  lm.body AS last_message_body,
  lm.created_at AS last_message_created_at,
  lm.user_id AS last_message_user_id,
  lmp.display_name AS last_message_display_name,
  lmp.username AS last_message_username,
  COALESCE(p.participants, '[]'::jsonb) AS participants,
  rs.self_last_read_message_id,
  rs.self_last_read_at,
  COALESCE(rs.participant_receipts, '[]'::jsonb) AS participant_receipts
FROM user_conversations uc
LEFT JOIN last_messages lm ON lm.conversation_id = uc.id
LEFT JOIN last_message_profiles lmp ON lmp.id = lm.id
LEFT JOIN participants p ON p.conversation_id = uc.id
LEFT JOIN receipt_summaries rs ON rs.conversation_id = uc.id
ORDER BY COALESCE(lm.created_at, uc.updated_at, uc.created_at) DESC;
$$;
CREATE TABLE public.movies (
  title_id uuid NOT NULL,
  box_office numeric,
  budget numeric,
  dvd_release date,
  blu_ray_release date,
  streaming_release date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT movies_pkey PRIMARY KEY (title_id),
  CONSTRAINT movies_title_id_fkey FOREIGN KEY (title_id) REFERENCES public.titles(title_id)
);
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  data jsonb,
  is_read boolean NOT NULL DEFAULT false,
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.notification_preferences (
  user_id uuid NOT NULL,
  email_activity boolean NOT NULL DEFAULT true,
  email_recommendations boolean NOT NULL DEFAULT true,
  in_app_social boolean NOT NULL DEFAULT true,
  in_app_system boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notification_preferences_pkey PRIMARY KEY (user_id),
  CONSTRAINT notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.people (
  id bigint NOT NULL DEFAULT nextval('people_id_seq'::regclass),
  name text NOT NULL,
  tmdb_id integer,
  imdb_id text,
  CONSTRAINT people_pkey PRIMARY KEY (id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  username text UNIQUE,
  display_name text,
  email text,
  avatar_url text,
  bio text,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.ratings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title_id uuid NOT NULL,
  content_type public.content_type NOT NULL,
  rating numeric NOT NULL CHECK (rating >= 0::numeric AND rating <= 10::numeric AND (rating * 2::numeric % 1::numeric) = 0::numeric),
  comment text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ratings_pkey PRIMARY KEY (id),
  CONSTRAINT ratings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT ratings_title_id_fkey FOREIGN KEY (title_id) REFERENCES public.titles(title_id)
);
CREATE TABLE public.reports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  reason text,
  status report_status NOT NULL DEFAULT 'open'::report_status,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  resolved_at timestamp with time zone,
  resolved_by uuid,
  notes text,
  CONSTRAINT reports_pkey PRIMARY KEY (id),
  CONSTRAINT reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES auth.users(id),
  CONSTRAINT reports_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES auth.users(id)
);
CREATE TABLE public.review_reactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  review_id uuid NOT NULL,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  CONSTRAINT review_reactions_pkey PRIMARY KEY (id),
  CONSTRAINT review_reactions_review_id_fkey FOREIGN KEY (review_id) REFERENCES public.reviews(id),
  CONSTRAINT review_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title_id uuid NOT NULL,
  content_type public.content_type NOT NULL,
  rating numeric CHECK (rating >= 0::numeric AND rating <= 10::numeric AND (rating * 2::numeric % 1::numeric) = 0::numeric),
  headline text,
  body text,
  spoiler boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT reviews_pkey PRIMARY KEY (id),
  CONSTRAINT reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT reviews_title_id_fkey FOREIGN KEY (title_id) REFERENCES public.titles(title_id)
);
CREATE TABLE public.seasons (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title_id uuid NOT NULL,
  season_number integer NOT NULL,
  name text,
  overview text,
  air_date date,
  poster_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT seasons_pkey PRIMARY KEY (id),
  CONSTRAINT seasons_title_id_fkey FOREIGN KEY (title_id) REFERENCES public.titles(title_id)
);
CREATE TABLE public.series (
  title_id uuid NOT NULL,
  total_seasons integer,
  total_episodes integer,
  in_production boolean,
  first_air_date date,
  last_air_date date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT series_pkey PRIMARY KEY (title_id),
  CONSTRAINT series_title_id_fkey FOREIGN KEY (title_id) REFERENCES public.titles(title_id)
);
CREATE TABLE public.title_credits (
  id bigint NOT NULL DEFAULT nextval('title_credits_id_seq'::regclass),
  title_id uuid NOT NULL,
  person_id bigint NOT NULL,
  job text,
  character text,
  order integer,
  CONSTRAINT title_credits_pkey PRIMARY KEY (id),
  CONSTRAINT title_credits_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.people(id),
  CONSTRAINT title_credits_title_id_fkey FOREIGN KEY (title_id) REFERENCES public.titles(title_id)
);
CREATE TABLE public.title_genres (
  title_id uuid NOT NULL,
  genre_id bigint NOT NULL,
  CONSTRAINT title_genres_pkey PRIMARY KEY (title_id, genre_id),
  CONSTRAINT title_genres_genre_id_fkey FOREIGN KEY (genre_id) REFERENCES public.genres(id),
  CONSTRAINT title_genres_title_id_fkey FOREIGN KEY (title_id) REFERENCES public.titles(title_id)
);
CREATE TABLE public.title_stats (
  title_id uuid NOT NULL,
  avg_rating numeric,
  ratings_count integer,
  reviews_count integer,
  watch_count integer,
  last_updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT title_stats_pkey PRIMARY KEY (title_id),
  CONSTRAINT title_stats_title_id_fkey FOREIGN KEY (title_id) REFERENCES public.titles(title_id)
);
create table public.titles (
  title_id uuid not null default gen_random_uuid (),
  content_type public.content_type not null,
  omdb_imdb_id text null,
  tmdb_id integer null,
  primary_title text null,
  original_title text null,
  sort_title text null,
  release_year integer null,
  release_date date null,
  runtime_minutes integer null,
  is_adult boolean null default false,
  poster_url text null,
  backdrop_url text null,
  plot text null,
  tagline text null,
  genres text[] null,
  language text null,
  country text null,
  imdb_rating numeric(3, 1) null,
  imdb_votes integer null,
  metascore smallint null,
  omdb_rated text null,
  omdb_released text null,
  omdb_director text null,
  omdb_writer text null,
  omdb_actors text null,
  omdb_language text null,
  omdb_country text null,
  omdb_awards text null,
  omdb_dvd text null,
  omdb_box_office_str text null,
  omdb_production text null,
  omdb_website text null,
  omdb_response text null,
  omdb_rt_rating_pct smallint null,
  omdb_box_office numeric(12, 2) null,
  omdb_response_ok boolean null,
  tmdb_adult boolean null,
  tmdb_video boolean null,
  tmdb_genre_ids integer[] null,
  tmdb_original_language text null,
  tmdb_overview text null,
  tmdb_popularity numeric(8, 4) null,
  tmdb_vote_average numeric(3, 2) null,
  tmdb_vote_count integer null,
  tmdb_release_date date null,
  tmdb_poster_path text null,
  data_source text null default 'omdb'::text,
  source_priority smallint null default 1,
  raw_payload jsonb null,
  deleted_at timestamp with time zone null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  omdb_raw jsonb null,
  tmdb_first_air_date date null,
  tmdb_runtime integer null,
  tmdb_episode_run_time integer[] null,
  tmdb_genre_names text[] null,
  tmdb_raw jsonb null,
  tmdb_last_synced_at timestamp with time zone null,
  omdb_last_synced_at timestamp with time zone null,
  last_synced_at timestamp with time zone null,
  rt_tomato_pct smallint null,
  constraint titles_pkey primary key (title_id),
  constraint titles_tmdb_id_key unique (tmdb_id),
  constraint titles_metascore_check check (
    (
      (metascore >= 0)
      and (metascore <= 100)
    )
  ),
  constraint titles_omdb_box_office_check check ((omdb_box_office >= (0)::numeric)),
  constraint titles_omdb_rt_rating_pct_check check (
    (
      (omdb_rt_rating_pct >= 0)
      and (omdb_rt_rating_pct <= 100)
    )
  ),
  constraint titles_tmdb_popularity_check check ((tmdb_popularity >= (0)::numeric)),
  constraint titles_tmdb_vote_average_check check (
    (
      (tmdb_vote_average >= (0)::numeric)
      and (tmdb_vote_average <= (10)::numeric)
    )
  ),
  constraint titles_imdb_rating_check check (
    (
      (imdb_rating >= (0)::numeric)
      and (imdb_rating <= (10)::numeric)
    )
  ),
  constraint titles_tmdb_vote_count_check check ((tmdb_vote_count >= 0)),
  constraint titles_imdb_votes_check check ((imdb_votes >= 0))
) TABLESPACE pg_default;

create index IF not exists titles_content_type_idx on public.titles using btree (content_type) TABLESPACE pg_default;

create index IF not exists titles_primary_title_trgm_idx on public.titles using gin (primary_title extensions.gin_trgm_ops) TABLESPACE pg_default;

create index IF not exists titles_release_date_idx on public.titles using btree (release_date) TABLESPACE pg_default;

create trigger set_titles_updated_at BEFORE
update on titles for EACH row
execute FUNCTION set_updated_at ();


create index IF not exists titles_content_type_idx on public.titles using btree (content_type) TABLESPACE pg_default;

create index IF not exists titles_primary_title_trgm_idx on public.titles using gin (primary_title extensions.gin_trgm_ops) TABLESPACE pg_default;

create index IF not exists titles_release_date_idx on public.titles using btree (release_date) TABLESPACE pg_default;



CREATE TABLE public.user_settings (
  user_id uuid NOT NULL,
  email_notifications boolean NOT NULL DEFAULT true,
  push_notifications boolean NOT NULL DEFAULT true,
  privacy_profile privacy_level NOT NULL DEFAULT 'public'::privacy_level,
  privacy_activity privacy_level NOT NULL DEFAULT 'public'::privacy_level,
  privacy_lists privacy_level NOT NULL DEFAULT 'public'::privacy_level,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_settings_pkey PRIMARY KEY (user_id),
  CONSTRAINT user_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_stats (
  user_id uuid NOT NULL,
  followers_count integer DEFAULT 0,
  following_count integer DEFAULT 0,
  ratings_count integer DEFAULT 0,
  reviews_count integer DEFAULT 0,
  watchlist_count integer DEFAULT 0,
  comments_count integer DEFAULT 0,
  lists_count integer DEFAULT 0,
  messages_sent_count integer DEFAULT 0,
  last_active_at timestamp with time zone,
  CONSTRAINT user_stats_pkey PRIMARY KEY (user_id),
  CONSTRAINT user_stats_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_tags (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  color text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_tags_pkey PRIMARY KEY (id),
  CONSTRAINT user_tags_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_title_tags (
  user_id uuid NOT NULL,
  title_id uuid NOT NULL,
  tag_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_title_tags_pkey PRIMARY KEY (user_id, title_id, tag_id),
  CONSTRAINT user_title_tags_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT user_title_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.user_tags(id),
  CONSTRAINT user_title_tags_title_id_fkey FOREIGN KEY (title_id) REFERENCES public.titles(title_id)
);

-- ---------------------------------------------
-- Row Level Security
-- ---------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_select_self ON public.profiles
  FOR SELECT USING (id = auth.uid());
CREATE POLICY profiles_insert_self ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY profiles_update_self ON public.profiles
  FOR UPDATE USING (id = auth.uid());

ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY ratings_owner_only ON public.ratings
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY reviews_owner_only ON public.reviews
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.review_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY review_reactions_participant_only ON public.review_reactions
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.library_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY library_entries_owner_only ON public.library_entries
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.episode_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY episode_progress_owner_only ON public.episode_progress
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY activity_events_owner_only ON public.activity_events
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY follows_self_visibility ON public.follows
  FOR SELECT USING (auth.uid() IN (follower_id, followed_id));
CREATE POLICY follows_manage_own ON public.follows
  FOR ALL USING (follower_id = auth.uid()) WITH CHECK (follower_id = auth.uid());

ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY blocked_users_view_related ON public.blocked_users
  FOR SELECT USING (auth.uid() IN (blocker_id, blocked_id));
CREATE POLICY blocked_users_manage_self ON public.blocked_users
  FOR ALL USING (blocker_id = auth.uid()) WITH CHECK (blocker_id = auth.uid());

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY conversations_member_access ON public.conversations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = id AND cp.user_id = auth.uid()
    )
  );
CREATE POLICY conversations_member_manage ON public.conversations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = id AND cp.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = id AND cp.user_id = auth.uid()
    )
  );

ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY conversation_participants_self ON public.conversation_participants
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY messages_member_read ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversation_id AND cp.user_id = auth.uid()
    )
  );
CREATE POLICY messages_member_write ON public.messages
  FOR ALL USING (
    user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversation_id AND cp.user_id = auth.uid()
    )
  ) WITH CHECK (
    user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversation_id AND cp.user_id = auth.uid()
    )
  );

ALTER TABLE public.message_read_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY message_read_receipts_member ON public.message_read_receipts
  FOR ALL USING (
    user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversation_id AND cp.user_id = auth.uid()
    )
  ) WITH CHECK (
    user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversation_id AND cp.user_id = auth.uid()
    )
  );

ALTER TABLE public.message_delivery_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY message_delivery_receipts_member ON public.message_delivery_receipts
  FOR ALL USING (
    user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversation_id AND cp.user_id = auth.uid()
    )
  ) WITH CHECK (
    user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversation_id AND cp.user_id = auth.uid()
    )
  );

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS message_reactions_member ON public.message_reactions;
CREATE POLICY message_reactions_select ON public.message_reactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversation_id AND cp.user_id = auth.uid()
    )
  );
CREATE POLICY message_reactions_write ON public.message_reactions
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversation_id AND cp.user_id = auth.uid()
    )
  );
CREATE POLICY message_reactions_owner_only ON public.message_reactions
  FOR UPDATE USING (
    user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversation_id AND cp.user_id = auth.uid()
    )
  ) WITH CHECK (
    user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversation_id AND cp.user_id = auth.uid()
    )
  );
CREATE POLICY message_reactions_delete ON public.message_reactions
  FOR DELETE USING (
    user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversation_id AND cp.user_id = auth.uid()
    )
  );

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_owner_only ON public.notifications
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY notification_preferences_owner_only ON public.notification_preferences
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY reports_owner_only ON public.reports
  FOR ALL USING (reporter_id = auth.uid()) WITH CHECK (reporter_id = auth.uid());

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_settings_owner_only ON public.user_settings
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.user_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_tags_owner_only ON public.user_tags
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.user_title_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_title_tags_owner_only ON public.user_title_tags
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------
-- Performance indexes for frequent access paths
-- ---------------------------------------------

CREATE INDEX IF NOT EXISTS ratings_user_id_idx
  ON public.ratings USING btree (user_id);

CREATE INDEX IF NOT EXISTS message_reactions_conversation_message_idx
  ON public.message_reactions USING btree (conversation_id, message_id);
CREATE UNIQUE INDEX IF NOT EXISTS message_reactions_user_unique_idx
  ON public.message_reactions USING btree (conversation_id, message_id, user_id, emoji);

CREATE INDEX IF NOT EXISTS library_entries_user_id_idx
  ON public.library_entries USING btree (user_id);

CREATE INDEX IF NOT EXISTS activity_events_user_id_created_at_idx
  ON public.activity_events USING btree (user_id, created_at);

-- ----------------------
-- Home feed RPC
-- ----------------------

CREATE OR REPLACE FUNCTION public.get_home_feed(
  p_user_id uuid,
  p_limit integer DEFAULT 40,
  p_cursor timestamptz DEFAULT NULL
)
RETURNS SETOF public.activity_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  effective_limit integer := LEAST(COALESCE(p_limit, 40), 200);
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT e.*
  FROM public.activity_events e
  WHERE (
      e.user_id = p_user_id
      OR e.user_id IN (
        SELECT f.followed_id
        FROM public.follows f
        WHERE f.follower_id = p_user_id
      )
    )
    AND (p_cursor IS NULL OR e.created_at < p_cursor)
  ORDER BY e.created_at DESC
  LIMIT effective_limit + 1;
END;
$$;

CREATE INDEX IF NOT EXISTS follows_follower_id_idx
  ON public.follows USING btree (follower_id);
CREATE INDEX IF NOT EXISTS follows_followed_id_idx
  ON public.follows USING btree (followed_id);

CREATE INDEX IF NOT EXISTS blocked_users_blocker_id_idx
  ON public.blocked_users USING btree (blocker_id);
CREATE INDEX IF NOT EXISTS blocked_users_blocked_id_idx
  ON public.blocked_users USING btree (blocked_id);

CREATE INDEX IF NOT EXISTS conversation_participants_conversation_id_idx
  ON public.conversation_participants USING btree (conversation_id);

CREATE INDEX IF NOT EXISTS message_read_receipts_user_conversation_idx
  ON public.message_read_receipts USING btree (user_id, conversation_id);
CREATE INDEX IF NOT EXISTS message_read_receipts_conversation_last_read_idx
  ON public.message_read_receipts USING btree (conversation_id, last_read_at DESC);
CREATE INDEX IF NOT EXISTS message_read_receipts_conversation_message_idx
  ON public.message_read_receipts USING btree (conversation_id, last_read_message_id);

CREATE INDEX IF NOT EXISTS message_delivery_receipts_conversation_created_idx
  ON public.message_delivery_receipts USING btree (conversation_id, created_at);

-- ----------------------
-- Diary stats aggregation
-- ----------------------

CREATE OR REPLACE FUNCTION public.get_diary_stats(p_user_id uuid)
RETURNS TABLE (
  total_rated integer,
  total_watched integer,
  average_rating numeric,
  rating_distribution jsonb,
  top_genres jsonb,
  watch_count_by_month jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  WITH rating_buckets AS (
    SELECT
      round(r.rating * 2) / 2 AS bucket,
      count(*) AS bucket_count
    FROM public.ratings r
    WHERE r.user_id = p_user_id
    GROUP BY bucket
  ),
  watched_entries AS (
    SELECT le.title_id, le.updated_at
    FROM public.library_entries le
    WHERE le.user_id = p_user_id AND le.status = 'watched'
  ),
  genre_counts AS (
    SELECT g.name AS genre, count(*) AS genre_count
    FROM watched_entries w
    JOIN public.title_genres tg ON tg.title_id = w.title_id
    JOIN public.genres g ON g.id = tg.genre_id
    GROUP BY g.name
    ORDER BY genre_count DESC, g.name
    LIMIT 8
  ),
  watch_months AS (
    SELECT
      to_char(date_trunc('month', w.updated_at), 'YYYY-MM') AS month,
      count(*) AS month_count
    FROM watched_entries w
    GROUP BY month
    ORDER BY month
  )
  SELECT
    (SELECT count(*) FROM public.ratings r WHERE r.user_id = p_user_id) AS total_rated,
    (SELECT count(*) FROM watched_entries) AS total_watched,
    (SELECT avg(r.rating) FROM public.ratings r WHERE r.user_id = p_user_id) AS average_rating,
    COALESCE(
      (
        SELECT jsonb_agg(jsonb_build_object('rating', bucket, 'count', bucket_count) ORDER BY bucket)
        FROM rating_buckets
      ),
      '[]'::jsonb
    ) AS rating_distribution,
    COALESCE(
      (
        SELECT jsonb_agg(jsonb_build_object('genre', genre, 'count', genre_count) ORDER BY genre_count DESC, genre)
        FROM genre_counts
      ),
      '[]'::jsonb
    ) AS top_genres,
    COALESCE(
      (
        SELECT jsonb_agg(jsonb_build_object('month', month, 'count', month_count) ORDER BY month)
        FROM watch_months
      ),
      '[]'::jsonb
    ) AS watch_count_by_month;
END;
$$;

COMMENT ON FUNCTION public.get_diary_stats IS
  'Aggregates diary statistics for the authenticated user with rating buckets, top genres, and watch counts.';

CREATE POLICY get_diary_stats_owner_only ON public.ratings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY get_diary_stats_library_owner_only ON public.library_entries
  FOR SELECT USING (auth.uid() = user_id);

-- ---------------------------------------------
-- Diary stats performance indexes
-- ---------------------------------------------

CREATE INDEX IF NOT EXISTS ratings_user_id_created_at_idx
  ON public.ratings USING btree (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS library_entries_user_status_updated_idx
  ON public.library_entries USING btree (user_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS title_genres_title_id_idx
  ON public.title_genres USING btree (title_id);


------------------------------------------------------------
-- Final polish: indexes, helper functions, minimal extra RLS
------------------------------------------------------------

-- 1) High-value indexes

CREATE INDEX IF NOT EXISTS comments_review_id_created_at_idx
  ON public.comments (review_id, created_at);

CREATE INDEX IF NOT EXISTS comments_parent_comment_id_created_at_idx
  ON public.comments (parent_comment_id, created_at);

CREATE INDEX IF NOT EXISTS comment_likes_comment_id_idx
  ON public.comment_likes (comment_id);

CREATE INDEX IF NOT EXISTS reviews_title_id_created_at_idx
  ON public.reviews (title_id, created_at);

CREATE INDEX IF NOT EXISTS ratings_title_id_idx
  ON public.ratings (title_id);

CREATE INDEX IF NOT EXISTS lists_user_id_created_at_idx
  ON public.lists (user_id, created_at);

CREATE INDEX IF NOT EXISTS list_items_list_id_position_idx
  ON public.list_items (list_id, position);

CREATE INDEX IF NOT EXISTS episodes_season_episode_idx
  ON public.episodes (season_id, episode_number);

CREATE INDEX IF NOT EXISTS notifications_user_unread_created_at_idx
  ON public.notifications (user_id, created_at DESC)
  WHERE is_read = false;


-- 2) Small helper functions (RPCs)

CREATE OR REPLACE FUNCTION public.toggle_follow(p_target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.follows
    WHERE follower_id = auth.uid()
      AND followed_id = p_target_user_id
  ) THEN
    DELETE FROM public.follows
    WHERE follower_id = auth.uid()
      AND followed_id = p_target_user_id;
  ELSE
    INSERT INTO public.follows (follower_id, followed_id)
    VALUES (auth.uid(), p_target_user_id);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_conversation_read(
  p_conversation_id uuid,
  p_last_message_id uuid
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.message_read_receipts (
    conversation_id, user_id, last_read_message_id, last_read_at
  )
  VALUES (p_conversation_id, auth.uid(), p_last_message_id, now())
  ON CONFLICT (conversation_id, user_id)
  DO UPDATE SET
    last_read_message_id = EXCLUDED.last_read_message_id,
    last_read_at = EXCLUDED.last_read_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_notifications_read()
RETURNS void
LANGUAGE sql
AS $$
  UPDATE public.notifications
  SET is_read = true
  WHERE user_id = auth.uid()
    AND is_read = false;
$$;


-- 3) Minimal extra RLS (comments + comment_likes)

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY comments_read_all ON public.comments
  FOR SELECT
  USING (true);

CREATE POLICY comments_insert_self ON public.comments
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY comments_owner_update_delete ON public.comments
  FOR UPDATE, DELETE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY comment_likes_read_all ON public.comment_likes
  FOR SELECT
  USING (true);

CREATE POLICY comment_likes_owner_only ON public.comment_likes
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

