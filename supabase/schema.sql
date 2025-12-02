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
  role USER-DEFINED NOT NULL DEFAULT 'member'::participant_role,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT conversation_participants_pkey PRIMARY KEY (conversation_id, user_id),
  CONSTRAINT conversation_participants_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id),
  CONSTRAINT conversation_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  is_group boolean NOT NULL DEFAULT false,
  title text,
  created_by uuid,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT conversations_pkey PRIMARY KEY (id),
  CONSTRAINT conversations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.episode_progress (
  user_id uuid NOT NULL,
  episode_id uuid NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'watched'::episode_status,
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
  content_type USER-DEFINED NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'want_to_watch'::library_status,
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
  content_type USER-DEFINED NOT NULL,
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
  CONSTRAINT messages_pkey PRIMARY KEY (id),
  CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id),
  CONSTRAINT messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
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
  content_type USER-DEFINED NOT NULL,
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
  status USER-DEFINED NOT NULL DEFAULT 'open'::report_status,
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
  content_type USER-DEFINED NOT NULL,
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
CREATE TABLE public.titles (
  title_id uuid NOT NULL DEFAULT gen_random_uuid(),
  content_type USER-DEFINED NOT NULL,
  omdb_imdb_id text,
  tmdb_id integer UNIQUE,
  primary_title text,
  original_title text,
  sort_title text,
  release_year integer,
  release_date date,
  runtime_minutes integer,
  is_adult boolean DEFAULT false,
  poster_url text,
  backdrop_url text,
  plot text,
  tagline text,
  genres ARRAY,
  language text,
  country text,
  imdb_rating numeric CHECK (imdb_rating >= 0::numeric AND imdb_rating <= 10::numeric),
  imdb_votes integer CHECK (imdb_votes >= 0),
  metascore smallint CHECK (metascore >= 0 AND metascore <= 100),
  omdb_rated text,
  omdb_released text,
  omdb_runtime text,
  omdb_genre text,
  omdb_director text,
  omdb_writer text,
  omdb_actors text,
  omdb_plot text,
  omdb_language text,
  omdb_country text,
  omdb_awards text,
  omdb_poster text,
  omdb_type text,
  omdb_dvd text,
  omdb_box_office_str text,
  omdb_production text,
  omdb_website text,
  omdb_response text,
  omdb_rt_rating_pct smallint CHECK (omdb_rt_rating_pct >= 0 AND omdb_rt_rating_pct <= 100),
  omdb_box_office numeric CHECK (omdb_box_office >= 0::numeric),
  omdb_response_ok boolean,
  tmdb_adult boolean,
  tmdb_video boolean,
  tmdb_genre_ids ARRAY,
  tmdb_original_language text,
  tmdb_original_title text,
  tmdb_title text,
  tmdb_overview text,
  tmdb_popularity numeric CHECK (tmdb_popularity >= 0::numeric),
  tmdb_vote_average numeric CHECK (tmdb_vote_average >= 0::numeric AND tmdb_vote_average <= 10::numeric),
  tmdb_vote_count integer CHECK (tmdb_vote_count >= 0),
  tmdb_release_date date,
  tmdb_poster_path text,
  tmdb_backdrop_path text,
  data_source text DEFAULT 'omdb'::text,
  source_priority smallint DEFAULT 1,
  raw_payload jsonb,
  youtube_trailer_video_id text,
  youtube_trailer_title text,
  youtube_trailer_published_at timestamp with time zone,
  youtube_trailer_thumb_url text,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  omdb_runtime_minutes integer,
  omdb_genre_names ARRAY,
  omdb_raw jsonb,
  tmdb_media_type text,
  tmdb_first_air_date date,
  tmdb_runtime integer,
  tmdb_episode_run_time ARRAY,
  tmdb_genre_names ARRAY,
  tmdb_raw jsonb,
  youtube_trailer_url text,
  youtube_trailer_query text,
  youtube_raw jsonb,
  tmdb_last_synced_at timestamp with time zone,
  omdb_last_synced_at timestamp with time zone,
  youtube_last_synced_at timestamp with time zone,
  last_synced_at timestamp with time zone,
  rt_tomato_pct smallint,
  omdb_imdb_rating numeric,
  omdb_imdb_votes integer,
  omdb_metacritic_score smallint,
  omdb_poster_url text,
  omdb_title text,
  omdb_year integer,
  CONSTRAINT titles_pkey PRIMARY KEY (title_id)
);
CREATE TABLE public.user_settings (
  user_id uuid NOT NULL,
  email_notifications boolean NOT NULL DEFAULT true,
  push_notifications boolean NOT NULL DEFAULT true,
  privacy_profile USER-DEFINED NOT NULL DEFAULT 'public'::privacy_level,
  privacy_activity USER-DEFINED NOT NULL DEFAULT 'public'::privacy_level,
  privacy_lists USER-DEFINED NOT NULL DEFAULT 'public'::privacy_level,
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