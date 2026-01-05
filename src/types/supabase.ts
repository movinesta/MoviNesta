export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      activity_events: {
        Row: {
          id: string;
          created_at: string;
          user_id: string;
          event_type: Database["public"]["Enums"]["activity_event_type"];
          title_id: string | null;
          related_user_id: string | null;
          payload: Json | null;
          media_item_id: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          user_id: string;
          event_type: Database["public"]["Enums"]["activity_event_type"];
          title_id?: string | null;
          related_user_id?: string | null;
          payload?: Json | null;
          media_item_id?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          user_id?: string;
          event_type?: Database["public"]["Enums"]["activity_event_type"];
          title_id?: string | null;
          related_user_id?: string | null;
          payload?: Json | null;
          media_item_id?: string | null;
        };
        Relationships: [
        ];
      };
      embedding_settings: {
        Row: {
          id: number;
          active_provider: string;
          active_model: string;
          active_dimensions: number;
          active_task: string;
          updated_at: string;
          rerank_swipe_enabled: boolean;
          rerank_search_enabled: boolean;
          rerank_top_k: number;
        };
        Insert: {
          id: number;
          active_provider?: string;
          active_model?: string;
          active_dimensions?: number;
          active_task?: string;
          updated_at?: string;
          rerank_swipe_enabled?: boolean;
          rerank_search_enabled?: boolean;
          rerank_top_k?: number;
        };
        Update: {
          id?: number;
          active_provider?: string;
          active_model?: string;
          active_dimensions?: number;
          active_task?: string;
          updated_at?: string;
          rerank_swipe_enabled?: boolean;
          rerank_search_enabled?: boolean;
          rerank_top_k?: number;
        };
        Relationships: [
        ];
      };
      admin_audit_log: {
        Row: {
          id: string;
          created_at: string;
          admin_user_id: string | null;
          action: string;
          target: string;
          details: Json;
        };
        Insert: {
          id?: string;
          created_at?: string;
          admin_user_id?: string | null;
          action: string;
          target: string;
          details?: Json;
        };
        Update: {
          id?: string;
          created_at?: string;
          admin_user_id?: string | null;
          action?: string;
          target?: string;
          details?: Json;
        };
        Relationships: [
        ];
      };
      admin_costs_settings: {
        Row: {
          id: number;
          total_daily_budget: number | null;
          by_provider_budget: Json;
          updated_at: string;
        };
        Insert: {
          id: number;
          total_daily_budget?: number | null;
          by_provider_budget?: Json;
          updated_at?: string;
        };
        Update: {
          id?: number;
          total_daily_budget?: number | null;
          by_provider_budget?: Json;
          updated_at?: string;
        };
        Relationships: [
        ];
      };
      admin_cron_registry: {
        Row: {
          jobname: string;
          schedule: string;
          command: string;
          updated_at: string;
        };
        Insert: {
          jobname: string;
          schedule: string;
          command: string;
          updated_at?: string;
        };
        Update: {
          jobname?: string;
          schedule?: string;
          command?: string;
          updated_at?: string;
        };
        Relationships: [
        ];
      };
      app_admins: {
        Row: {
          user_id: string;
          role: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          role?: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          role?: string;
          created_at?: string;
        };
        Relationships: [
        ];
      };
      assistant_cron_requests: {
        Row: {
          id: number;
          job_name: string;
          request_id: number | null;
          created_at: string;
        };
        Insert: {
          id: number;
          job_name: string;
          request_id?: number | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          job_name?: string;
          request_id?: number | null;
          created_at?: string;
        };
        Relationships: [
        ];
      };
      assistant_goal_events: {
        Row: {
          id: string;
          goal_id: string;
          user_id: string;
          title_id: string;
          event_type: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          goal_id: string;
          user_id: string;
          title_id: string;
          event_type: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          goal_id?: string;
          user_id?: string;
          title_id?: string;
          event_type?: string;
          created_at?: string;
        };
        Relationships: [
        ];
      };
      assistant_goal_state: {
        Row: {
          goal_id: string;
          target_count: number;
          progress_count: number;
          last_event_at: string | null;
          updated_at: string;
        };
        Insert: {
          goal_id: string;
          target_count?: number;
          progress_count?: number;
          last_event_at?: string | null;
          updated_at?: string;
        };
        Update: {
          goal_id?: string;
          target_count?: number;
          progress_count?: number;
          last_event_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
        ];
      };
      assistant_goals: {
        Row: {
          id: string;
          user_id: string;
          kind: string;
          title: string;
          description: string | null;
          status: string;
          start_at: string;
          end_at: string | null;
          meta: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          kind: string;
          title: string;
          description?: string | null;
          status?: string;
          start_at?: string;
          end_at?: string | null;
          meta?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          kind?: string;
          title?: string;
          description?: string | null;
          status?: string;
          start_at?: string;
          end_at?: string | null;
          meta?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
        ];
      };
      assistant_memory: {
        Row: {
          id: string;
          user_id: string;
          key: string;
          value: Json;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          key: string;
          value?: Json;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          key?: string;
          value?: Json;
          updated_at?: string;
        };
        Relationships: [
        ];
      };
      assistant_message_action_log: {
        Row: {
          id: string;
          created_at: string;
          user_id: string;
          conversation_id: string;
          message_id: string;
          action_id: string;
          action_type: string;
          payload: Json;
        };
        Insert: {
          id?: string;
          created_at?: string;
          user_id: string;
          conversation_id: string;
          message_id: string;
          action_id: string;
          action_type: string;
          payload?: Json;
        };
        Update: {
          id?: string;
          created_at?: string;
          user_id?: string;
          conversation_id?: string;
          message_id?: string;
          action_id?: string;
          action_type?: string;
          payload?: Json;
        };
        Relationships: [
        ];
      };
      assistant_metrics_daily: {
        Row: {
          day: string;
          surface: string;
          kind: string;
          created_count: number;
          shown_count: number;
          accepted_count: number;
          dismissed_count: number;
          unique_users: number;
          total_tokens: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          day: string;
          surface: string;
          kind: string;
          created_count?: number;
          shown_count?: number;
          accepted_count?: number;
          dismissed_count?: number;
          unique_users?: number;
          total_tokens?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          day?: string;
          surface?: string;
          kind?: string;
          created_count?: number;
          shown_count?: number;
          accepted_count?: number;
          dismissed_count?: number;
          unique_users?: number;
          total_tokens?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
        ];
      };
      assistant_prefs: {
        Row: {
          user_id: string;
          enabled: boolean;
          proactivity_level: number;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          enabled?: boolean;
          proactivity_level?: number;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          enabled?: boolean;
          proactivity_level?: number;
          updated_at?: string;
        };
        Relationships: [
        ];
      };
      assistant_suggestions: {
        Row: {
          id: string;
          user_id: string;
          surface: string;
          context_key: string;
          context: Json;
          kind: string;
          title: string;
          body: string;
          actions: Json;
          score: number;
          model: string | null;
          usage: Json | null;
          created_at: string;
          shown_at: string | null;
          dismissed_at: string | null;
          accepted_at: string | null;
          outcome: Json | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          surface: string;
          context_key?: string;
          context?: Json;
          kind: string;
          title: string;
          body: string;
          actions?: Json;
          score?: number;
          model?: string | null;
          usage?: Json | null;
          created_at?: string;
          shown_at?: string | null;
          dismissed_at?: string | null;
          accepted_at?: string | null;
          outcome?: Json | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          surface?: string;
          context_key?: string;
          context?: Json;
          kind?: string;
          title?: string;
          body?: string;
          actions?: Json;
          score?: number;
          model?: string | null;
          usage?: Json | null;
          created_at?: string;
          shown_at?: string | null;
          dismissed_at?: string | null;
          accepted_at?: string | null;
          outcome?: Json | null;
        };
        Relationships: [
        ];
      };
      assistant_trigger_fires: {
        Row: {
          id: string;
          trigger_id: string;
          user_id: string;
          surface: string;
          fired_at: string;
          fired_day: string;
          context: Json;
          reason: Json;
        };
        Insert: {
          id?: string;
          trigger_id: string;
          user_id: string;
          surface: string;
          fired_at?: string;
          fired_day?: string;
          context?: Json;
          reason?: Json;
        };
        Update: {
          id?: string;
          trigger_id?: string;
          user_id?: string;
          surface?: string;
          fired_at?: string;
          fired_day?: string;
          context?: Json;
          reason?: Json;
        };
        Relationships: [
        ];
      };
      assistant_triggers: {
        Row: {
          id: string;
          name: string;
          enabled: boolean;
          surfaces: string[];
          rule: Json;
          cooldown_minutes: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          enabled?: boolean;
          surfaces?: string[];
          rule?: Json;
          cooldown_minutes?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          enabled?: boolean;
          surfaces?: string[];
          rule?: Json;
          cooldown_minutes?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
        ];
      };
      blocked_users: {
        Row: {
          blocker_id: string;
          blocked_id: string;
          created_at: string;
        };
        Insert: {
          blocker_id: string;
          blocked_id: string;
          created_at?: string;
        };
        Update: {
          blocker_id?: string;
          blocked_id?: string;
          created_at?: string;
        };
        Relationships: [
        ];
      };
      comment_likes: {
        Row: {
          comment_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          comment_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          comment_id?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [
        ];
      };
      comments: {
        Row: {
          id: string;
          user_id: string;
          review_id: string | null;
          parent_comment_id: string | null;
          body: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          review_id?: string | null;
          parent_comment_id?: string | null;
          body: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          review_id?: string | null;
          parent_comment_id?: string | null;
          body?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
        ];
      };
      conversation_participants: {
        Row: {
          conversation_id: string;
          user_id: string;
          role: Database["public"]["Enums"]["participant_role"];
          created_at: string;
        };
        Insert: {
          conversation_id: string;
          user_id: string;
          role?: Database["public"]["Enums"]["participant_role"];
          created_at?: string;
        };
        Update: {
          conversation_id?: string;
          user_id?: string;
          role?: Database["public"]["Enums"]["participant_role"];
          created_at?: string;
        };
        Relationships: [
        ];
      };
      conversation_prefs: {
        Row: {
          user_id: string;
          conversation_id: string;
          muted: boolean;
          hidden: boolean;
          created_at: string;
          updated_at: string;
          muted_until: string | null;
        };
        Insert: {
          user_id?: string;
          conversation_id: string;
          muted?: boolean;
          hidden?: boolean;
          created_at?: string;
          updated_at?: string;
          muted_until?: string | null;
        };
        Update: {
          user_id?: string;
          conversation_id?: string;
          muted?: boolean;
          hidden?: boolean;
          created_at?: string;
          updated_at?: string;
          muted_until?: string | null;
        };
        Relationships: [
        ];
      };
      conversations: {
        Row: {
          id: string;
          created_at: string;
          is_group: boolean;
          title: string | null;
          created_by: string | null;
          updated_at: string;
          direct_participant_ids: string[] | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          is_group?: boolean;
          title?: string | null;
          created_by?: string | null;
          updated_at?: string;
          direct_participant_ids?: string[] | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          is_group?: boolean;
          title?: string | null;
          created_by?: string | null;
          updated_at?: string;
          direct_participant_ids?: string[] | null;
        };
        Relationships: [
        ];
      };
      follows: {
        Row: {
          follower_id: string;
          followed_id: string;
          created_at: string;
        };
        Insert: {
          follower_id: string;
          followed_id: string;
          created_at?: string;
        };
        Update: {
          follower_id?: string;
          followed_id?: string;
          created_at?: string;
        };
        Relationships: [
        ];
      };
      genres: {
        Row: {
          id: number;
          name: string;
          slug: string;
        };
        Insert: {
          id: number;
          name: string;
          slug: string;
        };
        Update: {
          id?: number;
          name?: string;
          slug?: string;
        };
        Relationships: [
        ];
      };
      job_run_log: {
        Row: {
          id: string;
          created_at: string;
          started_at: string;
          finished_at: string | null;
          job_name: string;
          provider: string | null;
          model: string | null;
          ok: boolean;
          scanned: number | null;
          embedded: number | null;
          skipped_existing: number | null;
          total_tokens: number | null;
          error_code: string | null;
          error_message: string | null;
          meta: Json;
        };
        Insert: {
          id?: string;
          created_at?: string;
          started_at?: string;
          finished_at?: string | null;
          job_name: string;
          provider?: string | null;
          model?: string | null;
          ok?: boolean;
          scanned?: number | null;
          embedded?: number | null;
          skipped_existing?: number | null;
          total_tokens?: number | null;
          error_code?: string | null;
          error_message?: string | null;
          meta?: Json;
        };
        Update: {
          id?: string;
          created_at?: string;
          started_at?: string;
          finished_at?: string | null;
          job_name?: string;
          provider?: string | null;
          model?: string | null;
          ok?: boolean;
          scanned?: number | null;
          embedded?: number | null;
          skipped_existing?: number | null;
          total_tokens?: number | null;
          error_code?: string | null;
          error_message?: string | null;
          meta?: Json;
        };
        Relationships: [
        ];
      };
      library_entries: {
        Row: {
          id: string;
          user_id: string;
          title_id: string;
          content_type: Database["public"]["Enums"]["content_type"];
          status: Database["public"]["Enums"]["library_status"];
          notes: string | null;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title_id: string;
          content_type: Database["public"]["Enums"]["content_type"];
          status?: Database["public"]["Enums"]["library_status"];
          notes?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title_id?: string;
          content_type?: Database["public"]["Enums"]["content_type"];
          status?: Database["public"]["Enums"]["library_status"];
          notes?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
        ];
      };
      list_items: {
        Row: {
          id: string;
          list_id: string;
          title_id: string;
          content_type: Database["public"]["Enums"]["content_type"];
          position: number;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          list_id: string;
          title_id: string;
          content_type: Database["public"]["Enums"]["content_type"];
          position?: number;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          list_id?: string;
          title_id?: string;
          content_type?: Database["public"]["Enums"]["content_type"];
          position?: number;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
        ];
      };
      lists: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          is_public: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          is_public?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
          is_public?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
        ];
      };
      media_items: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          kind: Database["public"]["Enums"]["media_kind"];
          omdb_raw: Json | null;
          tmdb_raw: Json | null;
          omdb_title: string | null;
          omdb_year: string | null;
          omdb_rated: string | null;
          omdb_released: string | null;
          omdb_runtime: string | null;
          omdb_genre: string | null;
          omdb_director: string | null;
          omdb_writer: string | null;
          omdb_actors: string | null;
          omdb_plot: string | null;
          omdb_language: string | null;
          omdb_country: string | null;
          omdb_awards: string | null;
          omdb_poster: string | null;
          omdb_metascore: string | null;
          omdb_imdb_rating: number | null;
          omdb_imdb_votes: string | null;
          omdb_imdb_id: string | null;
          omdb_type: string | null;
          omdb_dvd: string | null;
          omdb_box_office: string | null;
          omdb_production: string | null;
          omdb_website: string | null;
          omdb_total_seasons: number | null;
          omdb_response: boolean | null;
          omdb_rating_internet_movie_database: string | null;
          omdb_rating_rotten_tomatoes: string | null;
          omdb_rating_metacritic: string | null;
          tmdb_id: number | null;
          tmdb_adult: boolean | null;
          tmdb_backdrop_path: string | null;
          tmdb_genre_ids: number[] | null;
          tmdb_original_language: string | null;
          tmdb_original_title: string | null;
          tmdb_overview: string | null;
          tmdb_popularity: number | null;
          tmdb_poster_path: string | null;
          tmdb_release_date: string | null;
          tmdb_title: string | null;
          tmdb_video: boolean | null;
          tmdb_vote_average: number | null;
          tmdb_vote_count: number | null;
          tmdb_name: string | null;
          tmdb_original_name: string | null;
          tmdb_first_air_date: string | null;
          tmdb_media_type: string | null;
          tmdb_origin_country: string[] | null;
          tmdb_fetched_at: string | null;
          tmdb_status: string | null;
          tmdb_error: string | null;
          omdb_fetched_at: string | null;
          omdb_status: string | null;
          omdb_error: string | null;
          filled_count: number | null;
          missing_count: number | null;
          completeness: number | null;
          omdb_ratings: Json | null;
          tmdb_budget: number | null;
          tmdb_revenue: number | null;
          tmdb_runtime: number | null;
          tmdb_tagline: string | null;
          tmdb_homepage: string | null;
          tmdb_imdb_id: string | null;
          tmdb_genres: Json | null;
          tmdb_spoken_languages: Json | null;
          tmdb_production_companies: Json | null;
          tmdb_production_countries: Json | null;
          tmdb_belongs_to_collection: Json | null;
          tmdb_source: string | null;
          tmdb_release_status: string | null;
          tmdb_origin_country_raw: Json | null;
          search_vector: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          kind?: Database["public"]["Enums"]["media_kind"];
          omdb_raw?: Json | null;
          tmdb_raw?: Json | null;
          omdb_title?: string | null;
          omdb_year?: string | null;
          omdb_rated?: string | null;
          omdb_released?: string | null;
          omdb_runtime?: string | null;
          omdb_genre?: string | null;
          omdb_director?: string | null;
          omdb_writer?: string | null;
          omdb_actors?: string | null;
          omdb_plot?: string | null;
          omdb_language?: string | null;
          omdb_country?: string | null;
          omdb_awards?: string | null;
          omdb_poster?: string | null;
          omdb_metascore?: string | null;
          omdb_imdb_rating?: number | null;
          omdb_imdb_votes?: string | null;
          omdb_imdb_id?: string | null;
          omdb_type?: string | null;
          omdb_dvd?: string | null;
          omdb_box_office?: string | null;
          omdb_production?: string | null;
          omdb_website?: string | null;
          omdb_total_seasons?: number | null;
          omdb_response?: boolean | null;
          omdb_rating_internet_movie_database?: string | null;
          omdb_rating_rotten_tomatoes?: string | null;
          omdb_rating_metacritic?: string | null;
          tmdb_id?: number | null;
          tmdb_adult?: boolean | null;
          tmdb_backdrop_path?: string | null;
          tmdb_genre_ids?: number[] | null;
          tmdb_original_language?: string | null;
          tmdb_original_title?: string | null;
          tmdb_overview?: string | null;
          tmdb_popularity?: number | null;
          tmdb_poster_path?: string | null;
          tmdb_release_date?: string | null;
          tmdb_title?: string | null;
          tmdb_video?: boolean | null;
          tmdb_vote_average?: number | null;
          tmdb_vote_count?: number | null;
          tmdb_name?: string | null;
          tmdb_original_name?: string | null;
          tmdb_first_air_date?: string | null;
          tmdb_media_type?: string | null;
          tmdb_origin_country?: string[] | null;
          tmdb_fetched_at?: string | null;
          tmdb_status?: string | null;
          tmdb_error?: string | null;
          omdb_fetched_at?: string | null;
          omdb_status?: string | null;
          omdb_error?: string | null;
          filled_count?: number | null;
          missing_count?: number | null;
          completeness?: number | null;
          omdb_ratings?: Json | null;
          tmdb_budget?: number | null;
          tmdb_revenue?: number | null;
          tmdb_runtime?: number | null;
          tmdb_tagline?: string | null;
          tmdb_homepage?: string | null;
          tmdb_imdb_id?: string | null;
          tmdb_genres?: Json | null;
          tmdb_spoken_languages?: Json | null;
          tmdb_production_companies?: Json | null;
          tmdb_production_countries?: Json | null;
          tmdb_belongs_to_collection?: Json | null;
          tmdb_source?: string | null;
          tmdb_release_status?: string | null;
          tmdb_origin_country_raw?: Json | null;
          search_vector?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          kind?: Database["public"]["Enums"]["media_kind"];
          omdb_raw?: Json | null;
          tmdb_raw?: Json | null;
          omdb_title?: string | null;
          omdb_year?: string | null;
          omdb_rated?: string | null;
          omdb_released?: string | null;
          omdb_runtime?: string | null;
          omdb_genre?: string | null;
          omdb_director?: string | null;
          omdb_writer?: string | null;
          omdb_actors?: string | null;
          omdb_plot?: string | null;
          omdb_language?: string | null;
          omdb_country?: string | null;
          omdb_awards?: string | null;
          omdb_poster?: string | null;
          omdb_metascore?: string | null;
          omdb_imdb_rating?: number | null;
          omdb_imdb_votes?: string | null;
          omdb_imdb_id?: string | null;
          omdb_type?: string | null;
          omdb_dvd?: string | null;
          omdb_box_office?: string | null;
          omdb_production?: string | null;
          omdb_website?: string | null;
          omdb_total_seasons?: number | null;
          omdb_response?: boolean | null;
          omdb_rating_internet_movie_database?: string | null;
          omdb_rating_rotten_tomatoes?: string | null;
          omdb_rating_metacritic?: string | null;
          tmdb_id?: number | null;
          tmdb_adult?: boolean | null;
          tmdb_backdrop_path?: string | null;
          tmdb_genre_ids?: number[] | null;
          tmdb_original_language?: string | null;
          tmdb_original_title?: string | null;
          tmdb_overview?: string | null;
          tmdb_popularity?: number | null;
          tmdb_poster_path?: string | null;
          tmdb_release_date?: string | null;
          tmdb_title?: string | null;
          tmdb_video?: boolean | null;
          tmdb_vote_average?: number | null;
          tmdb_vote_count?: number | null;
          tmdb_name?: string | null;
          tmdb_original_name?: string | null;
          tmdb_first_air_date?: string | null;
          tmdb_media_type?: string | null;
          tmdb_origin_country?: string[] | null;
          tmdb_fetched_at?: string | null;
          tmdb_status?: string | null;
          tmdb_error?: string | null;
          omdb_fetched_at?: string | null;
          omdb_status?: string | null;
          omdb_error?: string | null;
          filled_count?: number | null;
          missing_count?: number | null;
          completeness?: number | null;
          omdb_ratings?: Json | null;
          tmdb_budget?: number | null;
          tmdb_revenue?: number | null;
          tmdb_runtime?: number | null;
          tmdb_tagline?: string | null;
          tmdb_homepage?: string | null;
          tmdb_imdb_id?: string | null;
          tmdb_genres?: Json | null;
          tmdb_spoken_languages?: Json | null;
          tmdb_production_companies?: Json | null;
          tmdb_production_countries?: Json | null;
          tmdb_belongs_to_collection?: Json | null;
          tmdb_source?: string | null;
          tmdb_release_status?: string | null;
          tmdb_origin_country_raw?: Json | null;
          search_vector?: string | null;
        };
        Relationships: [
        ];
      };
      media_embeddings: {
        Row: {
          media_item_id: string;
          embedding: unknown;
          model: string;
          task: string;
          updated_at: string;
          provider: string;
          dimensions: number;
        };
        Insert: {
          media_item_id: string;
          embedding: unknown;
          model?: string;
          task?: string;
          updated_at?: string;
          provider?: string;
          dimensions?: number;
        };
        Update: {
          media_item_id?: string;
          embedding?: unknown;
          model?: string;
          task?: string;
          updated_at?: string;
          provider?: string;
          dimensions?: number;
        };
        Relationships: [
        ];
      };
      media_events: {
        Row: {
          id: string;
          user_id: string;
          session_id: string;
          deck_id: string | null;
          position: number | null;
          media_item_id: string;
          event_type: Database["public"]["Enums"]["media_event_type"];
          source: string | null;
          dwell_ms: number | null;
          payload: Json | null;
          created_at: string;
          client_event_id: string | null;
          rating_0_10: number | null;
          in_watchlist: boolean | null;
          event_day: string;
          dedupe_key: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          session_id: string;
          deck_id?: string | null;
          position?: number | null;
          media_item_id: string;
          event_type: Database["public"]["Enums"]["media_event_type"];
          source?: string | null;
          dwell_ms?: number | null;
          payload?: Json | null;
          created_at?: string;
          client_event_id?: string | null;
          rating_0_10?: number | null;
          in_watchlist?: boolean | null;
          event_day?: string;
          dedupe_key: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          session_id?: string;
          deck_id?: string | null;
          position?: number | null;
          media_item_id?: string;
          event_type?: Database["public"]["Enums"]["media_event_type"];
          source?: string | null;
          dwell_ms?: number | null;
          payload?: Json | null;
          created_at?: string;
          client_event_id?: string | null;
          rating_0_10?: number | null;
          in_watchlist?: boolean | null;
          event_day?: string;
          dedupe_key?: string;
        };
        Relationships: [
        ];
      };
      media_feedback: {
        Row: {
          user_id: string;
          media_item_id: string;
          last_action: Database["public"]["Enums"]["media_event_type"] | null;
          last_action_at: string;
          rating_0_10: number | null;
          in_watchlist: boolean | null;
          last_dwell_ms: number | null;
          updated_at: string;
          last_impression_at: string | null;
          impressions_7d: number;
          seen_count_total: number;
          last_dwell_at: string | null;
          dwell_ms_ema: number;
          positive_ema: number;
          negative_ema: number;
          last_why: string | null;
          last_rank_score: number | null;
        };
        Insert: {
          user_id: string;
          media_item_id: string;
          last_action?: Database["public"]["Enums"]["media_event_type"] | null;
          last_action_at?: string;
          rating_0_10?: number | null;
          in_watchlist?: boolean | null;
          last_dwell_ms?: number | null;
          updated_at?: string;
          last_impression_at?: string | null;
          impressions_7d?: number;
          seen_count_total?: number;
          last_dwell_at?: string | null;
          dwell_ms_ema?: number;
          positive_ema?: number;
          negative_ema?: number;
          last_why?: string | null;
          last_rank_score?: number | null;
        };
        Update: {
          user_id?: string;
          media_item_id?: string;
          last_action?: Database["public"]["Enums"]["media_event_type"] | null;
          last_action_at?: string;
          rating_0_10?: number | null;
          in_watchlist?: boolean | null;
          last_dwell_ms?: number | null;
          updated_at?: string;
          last_impression_at?: string | null;
          impressions_7d?: number;
          seen_count_total?: number;
          last_dwell_at?: string | null;
          dwell_ms_ema?: number;
          positive_ema?: number;
          negative_ema?: number;
          last_why?: string | null;
          last_rank_score?: number | null;
        };
        Relationships: [
        ];
      };
      media_genres: {
        Row: {
          media_item_id: string;
          genre_id: number;
          created_at: string;
        };
        Insert: {
          media_item_id: string;
          genre_id: number;
          created_at?: string;
        };
        Update: {
          media_item_id?: string;
          genre_id?: number;
          created_at?: string;
        };
        Relationships: [
        ];
      };
      media_item_daily: {
        Row: {
          day: string;
          media_item_id: string;
          impressions: number;
          dwell_events: number;
          dwell_ms_sum: number;
          likes: number;
          dislikes: number;
          skips: number;
          watchlist_events: number;
          rating_events: number;
          unique_users: number;
          updated_at: string;
        };
        Insert: {
          day: string;
          media_item_id: string;
          impressions?: number;
          dwell_events?: number;
          dwell_ms_sum?: number;
          likes?: number;
          dislikes?: number;
          skips?: number;
          watchlist_events?: number;
          rating_events?: number;
          unique_users?: number;
          updated_at?: string;
        };
        Update: {
          day?: string;
          media_item_id?: string;
          impressions?: number;
          dwell_events?: number;
          dwell_ms_sum?: number;
          likes?: number;
          dislikes?: number;
          skips?: number;
          watchlist_events?: number;
          rating_events?: number;
          unique_users?: number;
          updated_at?: string;
        };
        Relationships: [
        ];
      };
      media_item_daily_users: {
        Row: {
          day: string;
          media_item_id: string;
          user_id: string;
        };
        Insert: {
          day: string;
          media_item_id: string;
          user_id: string;
        };
        Update: {
          day?: string;
          media_item_id?: string;
          user_id?: string;
        };
        Relationships: [
        ];
      };
      media_job_state: {
        Row: {
          job_name: string;
          cursor: string | null;
          updated_at: string;
        };
        Insert: {
          job_name: string;
          cursor?: string | null;
          updated_at?: string;
        };
        Update: {
          job_name?: string;
          cursor?: string | null;
          updated_at?: string;
        };
        Relationships: [
        ];
      };
      media_rank_feature_log: {
        Row: {
          id: string;
          created_at: string;
          user_id: string;
          session_id: string;
          deck_id: string | null;
          media_item_id: string;
          position: number | null;
          mode: string | null;
          kind_filter: string | null;
          source: string | null;
          features: Json;
          label: Json;
        };
        Insert: {
          id?: string;
          created_at?: string;
          user_id: string;
          session_id: string;
          deck_id?: string | null;
          media_item_id: string;
          position?: number | null;
          mode?: string | null;
          kind_filter?: string | null;
          source?: string | null;
          features?: Json;
          label?: Json;
        };
        Update: {
          id?: string;
          created_at?: string;
          user_id?: string;
          session_id?: string;
          deck_id?: string | null;
          media_item_id?: string;
          position?: number | null;
          mode?: string | null;
          kind_filter?: string | null;
          source?: string | null;
          features?: Json;
          label?: Json;
        };
        Relationships: [
        ];
      };
      media_rank_models: {
        Row: {
          model_name: string;
          version: number;
          is_active: boolean;
          weights: Json;
          intercept: number;
          updated_at: string;
        };
        Insert: {
          model_name: string;
          version?: number;
          is_active?: boolean;
          weights?: Json;
          intercept?: number;
          updated_at?: string;
        };
        Update: {
          model_name?: string;
          version?: number;
          is_active?: boolean;
          weights?: Json;
          intercept?: number;
          updated_at?: string;
        };
        Relationships: [
        ];
      };
      media_rerank_cache: {
        Row: {
          key: string;
          user_id: string;
          order_ids: Json;
          meta: Json;
          expires_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          key: string;
          user_id: string;
          order_ids?: Json;
          meta?: Json;
          expires_at: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          key?: string;
          user_id?: string;
          order_ids?: Json;
          meta?: Json;
          expires_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
        ];
      };
      media_served: {
        Row: {
          user_id: string;
          media_item_id: string;
          served_at: string;
        };
        Insert: {
          user_id: string;
          media_item_id: string;
          served_at?: string;
        };
        Update: {
          user_id?: string;
          media_item_id?: string;
          served_at?: string;
        };
        Relationships: [
        ];
      };
      media_session_vectors: {
        Row: {
          user_id: string;
          session_id: string;
          taste: unknown | null;
          updated_at: string;
          provider: string;
          model: string;
          dimensions: number;
          task: string;
        };
        Insert: {
          user_id: string;
          session_id: string;
          taste?: unknown | null;
          updated_at?: string;
          provider?: string;
          model?: string;
          dimensions?: number;
          task?: string;
        };
        Update: {
          user_id?: string;
          session_id?: string;
          taste?: unknown | null;
          updated_at?: string;
          provider?: string;
          model?: string;
          dimensions?: number;
          task?: string;
        };
        Relationships: [
        ];
      };
      media_trending_scores: {
        Row: {
          media_item_id: string;
          score_72h: number;
          computed_at: string;
        };
        Insert: {
          media_item_id: string;
          score_72h: number;
          computed_at?: string;
        };
        Update: {
          media_item_id?: string;
          score_72h?: number;
          computed_at?: string;
        };
        Relationships: [
        ];
      };
      media_user_centroids: {
        Row: {
          user_id: string;
          centroid: number;
          exemplar_media_item_id: string;
          taste: unknown | null;
          updated_at: string;
          provider: string;
          model: string;
          dimensions: number;
          task: string;
        };
        Insert: {
          user_id: string;
          centroid: number;
          exemplar_media_item_id: string;
          taste?: unknown | null;
          updated_at?: string;
          provider?: string;
          model?: string;
          dimensions?: number;
          task?: string;
        };
        Update: {
          user_id?: string;
          centroid?: number;
          exemplar_media_item_id?: string;
          taste?: unknown | null;
          updated_at?: string;
          provider?: string;
          model?: string;
          dimensions?: number;
          task?: string;
        };
        Relationships: [
        ];
      };
      media_user_vectors: {
        Row: {
          user_id: string;
          taste: unknown | null;
          updated_at: string;
          provider: string;
          model: string;
          dimensions: number;
          task: string;
        };
        Insert: {
          user_id: string;
          taste?: unknown | null;
          updated_at?: string;
          provider?: string;
          model?: string;
          dimensions?: number;
          task?: string;
        };
        Update: {
          user_id?: string;
          taste?: unknown | null;
          updated_at?: string;
          provider?: string;
          model?: string;
          dimensions?: number;
          task?: string;
        };
        Relationships: [
        ];
      };
      message_delivery_receipts: {
        Row: {
          id: string;
          created_at: string;
          conversation_id: string;
          message_id: string;
          user_id: string;
          delivered_at: string;
        };
        Insert: {
          id?: string;
          created_at?: string;
          conversation_id: string;
          message_id: string;
          user_id: string;
          delivered_at?: string;
        };
        Update: {
          id?: string;
          created_at?: string;
          conversation_id?: string;
          message_id?: string;
          user_id?: string;
          delivered_at?: string;
        };
        Relationships: [
        ];
      };
      message_reactions: {
        Row: {
          id: string;
          created_at: string;
          conversation_id: string;
          message_id: string;
          user_id: string;
          emoji: string;
        };
        Insert: {
          id?: string;
          created_at?: string;
          conversation_id: string;
          message_id: string;
          user_id: string;
          emoji: string;
        };
        Update: {
          id?: string;
          created_at?: string;
          conversation_id?: string;
          message_id?: string;
          user_id?: string;
          emoji?: string;
        };
        Relationships: [
        ];
      };
      message_read_receipts: {
        Row: {
          conversation_id: string;
          user_id: string;
          last_read_message_id: string | null;
          last_read_at: string;
        };
        Insert: {
          conversation_id: string;
          user_id: string;
          last_read_message_id?: string | null;
          last_read_at?: string;
        };
        Update: {
          conversation_id?: string;
          user_id?: string;
          last_read_message_id?: string | null;
          last_read_at?: string;
        };
        Relationships: [
        ];
      };
      messages: {
        Row: {
          id: string;
          created_at: string;
          conversation_id: string;
          user_id: string;
          body: Json;
          attachment_url: string | null;
          message_type: Database["public"]["Enums"]["message_type"];
          text: string | null;
          client_id: string | null;
          meta: Json;
          sender_id: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          conversation_id: string;
          user_id: string;
          body: Json;
          attachment_url?: string | null;
          message_type?: Database["public"]["Enums"]["message_type"];
          text?: string | null;
          client_id?: string | null;
          meta?: Json;
          sender_id?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          conversation_id?: string;
          user_id?: string;
          body?: Json;
          attachment_url?: string | null;
          message_type?: Database["public"]["Enums"]["message_type"];
          text?: string | null;
          client_id?: string | null;
          meta?: Json;
          sender_id?: string;
          deleted_at?: string | null;
        };
        Relationships: [
        ];
      };
      notification_preferences: {
        Row: {
          user_id: string;
          email_activity: boolean;
          email_recommendations: boolean;
          in_app_social: boolean;
          in_app_system: boolean;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          email_activity?: boolean;
          email_recommendations?: boolean;
          in_app_social?: boolean;
          in_app_system?: boolean;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          email_activity?: boolean;
          email_recommendations?: boolean;
          in_app_social?: boolean;
          in_app_system?: boolean;
          updated_at?: string;
        };
        Relationships: [
        ];
      };
      notifications: {
        Row: {
          id: string;
          created_at: string;
          user_id: string;
          type: string;
          data: Json | null;
          is_read: boolean;
        };
        Insert: {
          id?: string;
          created_at?: string;
          user_id: string;
          type: string;
          data?: Json | null;
          is_read?: boolean;
        };
        Update: {
          id?: string;
          created_at?: string;
          user_id?: string;
          type?: string;
          data?: Json | null;
          is_read?: boolean;
        };
        Relationships: [
        ];
      };
      omdb_cache: {
        Row: {
          kind: Database["public"]["Enums"]["media_kind"] | null;
          imdb_id: string;
          fetched_at: string;
          raw: Json;
        };
        Insert: {
          kind?: Database["public"]["Enums"]["media_kind"] | null;
          imdb_id: string;
          fetched_at?: string;
          raw: Json;
        };
        Update: {
          kind?: Database["public"]["Enums"]["media_kind"] | null;
          imdb_id?: string;
          fetched_at?: string;
          raw?: Json;
        };
        Relationships: [
        ];
      };
      people: {
        Row: {
          id: number;
          name: string;
          tmdb_id: number | null;
          imdb_id: string | null;
        };
        Insert: {
          id: number;
          name: string;
          tmdb_id?: number | null;
          imdb_id?: string | null;
        };
        Update: {
          id?: number;
          name?: string;
          tmdb_id?: number | null;
          imdb_id?: string | null;
        };
        Relationships: [
        ];
      };
      profiles: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          username: string | null;
          display_name: string | null;
          email: string | null;
          avatar_url: string | null;
          bio: string | null;
          last_seen_at: string | null;
        };
        Insert: {
          id: string;
          created_at?: string;
          updated_at?: string;
          username?: string | null;
          display_name?: string | null;
          email?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          last_seen_at?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          username?: string | null;
          display_name?: string | null;
          email?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          last_seen_at?: string | null;
        };
        Relationships: [
        ];
      };
      profiles_public: {
        Row: {
          id: string;
          username: string | null;
          display_name: string | null;
          avatar_path: string | null;
          updated_at: string | null;
          created_at: string | null;
          avatar_url: string | null;
          bio: string | null;
          last_seen_at: string | null;
        };
        Insert: {
          id: string;
          username?: string | null;
          display_name?: string | null;
          avatar_path?: string | null;
          updated_at?: string | null;
          created_at?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          last_seen_at?: string | null;
        };
        Update: {
          id?: string;
          username?: string | null;
          display_name?: string | null;
          avatar_path?: string | null;
          updated_at?: string | null;
          created_at?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          last_seen_at?: string | null;
        };
        Relationships: [
        ];
      };
      rate_limit_state: {
        Row: {
          rl_key: string;
          action: string;
          window_start: string;
          count: number;
        };
        Insert: {
          rl_key: string;
          action: string;
          window_start: string;
          count: number;
        };
        Update: {
          rl_key?: string;
          action?: string;
          window_start?: string;
          count?: number;
        };
        Relationships: [
        ];
      };
      ratings: {
        Row: {
          id: string;
          user_id: string;
          title_id: string;
          content_type: Database["public"]["Enums"]["content_type"];
          rating: number;
          comment: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title_id: string;
          content_type: Database["public"]["Enums"]["content_type"];
          rating: number;
          comment?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title_id?: string;
          content_type?: Database["public"]["Enums"]["content_type"];
          rating?: number;
          comment?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
        ];
      };
      reports: {
        Row: {
          id: string;
          reporter_id: string;
          target_type: string;
          target_id: string;
          reason: string | null;
          status: Database["public"]["Enums"]["report_status"];
          created_at: string;
          resolved_at: string | null;
          resolved_by: string | null;
          notes: string | null;
        };
        Insert: {
          id?: string;
          reporter_id: string;
          target_type: string;
          target_id: string;
          reason?: string | null;
          status?: Database["public"]["Enums"]["report_status"];
          created_at?: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          notes?: string | null;
        };
        Update: {
          id?: string;
          reporter_id?: string;
          target_type?: string;
          target_id?: string;
          reason?: string | null;
          status?: Database["public"]["Enums"]["report_status"];
          created_at?: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          notes?: string | null;
        };
        Relationships: [
        ];
      };
      review_reactions: {
        Row: {
          id: string;
          created_at: string;
          review_id: string;
          user_id: string;
          emoji: string;
        };
        Insert: {
          id?: string;
          created_at?: string;
          review_id: string;
          user_id: string;
          emoji: string;
        };
        Update: {
          id?: string;
          created_at?: string;
          review_id?: string;
          user_id?: string;
          emoji?: string;
        };
        Relationships: [
        ];
      };
      reviews: {
        Row: {
          id: string;
          user_id: string;
          title_id: string;
          content_type: Database["public"]["Enums"]["content_type"];
          rating: number | null;
          headline: string | null;
          body: string | null;
          spoiler: boolean | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title_id: string;
          content_type: Database["public"]["Enums"]["content_type"];
          rating?: number | null;
          headline?: string | null;
          body?: string | null;
          spoiler?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title_id?: string;
          content_type?: Database["public"]["Enums"]["content_type"];
          rating?: number | null;
          headline?: string | null;
          body?: string | null;
          spoiler?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
        ];
      };
      tmdb_cache: {
        Row: {
          kind: Database["public"]["Enums"]["media_kind"];
          tmdb_id: number;
          fetched_at: string;
          raw: Json;
        };
        Insert: {
          kind: Database["public"]["Enums"]["media_kind"];
          tmdb_id: number;
          fetched_at?: string;
          raw: Json;
        };
        Update: {
          kind?: Database["public"]["Enums"]["media_kind"];
          tmdb_id?: number;
          fetched_at?: string;
          raw?: Json;
        };
        Relationships: [
        ];
      };
      user_settings: {
        Row: {
          user_id: string;
          email_notifications: boolean;
          push_notifications: boolean;
          privacy_profile: Database["public"]["Enums"]["privacy_level"];
          privacy_activity: Database["public"]["Enums"]["privacy_level"];
          privacy_lists: Database["public"]["Enums"]["privacy_level"];
          updated_at: string;
        };
        Insert: {
          user_id: string;
          email_notifications?: boolean;
          push_notifications?: boolean;
          privacy_profile?: Database["public"]["Enums"]["privacy_level"];
          privacy_activity?: Database["public"]["Enums"]["privacy_level"];
          privacy_lists?: Database["public"]["Enums"]["privacy_level"];
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          email_notifications?: boolean;
          push_notifications?: boolean;
          privacy_profile?: Database["public"]["Enums"]["privacy_level"];
          privacy_activity?: Database["public"]["Enums"]["privacy_level"];
          privacy_lists?: Database["public"]["Enums"]["privacy_level"];
          updated_at?: string;
        };
        Relationships: [
        ];
      };
      user_stats: {
        Row: {
          user_id: string;
          followers_count: number | null;
          following_count: number | null;
          ratings_count: number | null;
          reviews_count: number | null;
          watchlist_count: number | null;
          comments_count: number | null;
          lists_count: number | null;
          messages_sent_count: number | null;
          last_active_at: string | null;
        };
        Insert: {
          user_id: string;
          followers_count?: number | null;
          following_count?: number | null;
          ratings_count?: number | null;
          reviews_count?: number | null;
          watchlist_count?: number | null;
          comments_count?: number | null;
          lists_count?: number | null;
          messages_sent_count?: number | null;
          last_active_at?: string | null;
        };
        Update: {
          user_id?: string;
          followers_count?: number | null;
          following_count?: number | null;
          ratings_count?: number | null;
          reviews_count?: number | null;
          watchlist_count?: number | null;
          comments_count?: number | null;
          lists_count?: number | null;
          messages_sent_count?: number | null;
          last_active_at?: string | null;
        };
        Relationships: [
        ];
      };
      user_swipe_prefs: {
        Row: {
          user_id: string;
          year_min: number | null;
          year_max: number | null;
          runtime_min: number | null;
          runtime_max: number | null;
          completeness_min: number | null;
        };
        Insert: {
          user_id: string;
          year_min?: number | null;
          year_max?: number | null;
          runtime_min?: number | null;
          runtime_max?: number | null;
          completeness_min?: number | null;
        };
        Update: {
          user_id?: string;
          year_min?: number | null;
          year_max?: number | null;
          runtime_min?: number | null;
          runtime_max?: number | null;
          completeness_min?: number | null;
        };
        Relationships: [
        ];
      };
      user_tags: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          color: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          color?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          color?: string | null;
          created_at?: string;
        };
        Relationships: [
        ];
      };
      user_title_tags: {
        Row: {
          user_id: string;
          title_id: string;
          tag_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          title_id: string;
          tag_id: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          title_id?: string;
          tag_id?: string;
          created_at?: string;
        };
        Relationships: [
        ];
      };
    };
    Views: {
      active_embedding_profile: {
        Row: {
          provider: unknown;
          model: unknown;
          dimensions: unknown;
          task: unknown;
        };
        Insert: {
          [key: string]: never;
        };
        Update: {
          [key: string]: never;
        };
        Relationships: [];
      };
      media_catalog: {
        Row: {
          media_item_id: unknown;
          kind: unknown;
          title: unknown;
          overview: unknown;
          poster_ref: unknown;
          backdrop_ref: unknown;
          year: unknown;
        };
        Insert: {
          [key: string]: never;
        };
        Update: {
          [key: string]: never;
        };
        Relationships: [];
      };
      media_embeddings_active: {
        Row: {
          media_item_id: unknown;
          embedding: unknown;
          model: unknown;
          task: unknown;
          updated_at: unknown;
          provider: unknown;
          dimensions: unknown;
        };
        Insert: {
          [key: string]: never;
        };
        Update: {
          [key: string]: never;
        };
        Relationships: [];
      };
      media_item_trending_72h: {
        Row: {
          media_item_id: unknown;
          likes: unknown;
          skips: unknown;
          dislikes: unknown;
          impressions: unknown;
          dwell_events: unknown;
          dwell_ms_sum: unknown;
          unique_users: unknown;
          updated_at: unknown;
          trend_score: unknown;
        };
        Insert: {
          [key: string]: never;
        };
        Update: {
          [key: string]: never;
        };
        Relationships: [];
      };
      media_session_vectors_active: {
        Row: {
          user_id: unknown;
          session_id: unknown;
          taste: unknown;
          updated_at: unknown;
          provider: unknown;
          model: unknown;
          dimensions: unknown;
          task: unknown;
        };
        Insert: {
          [key: string]: never;
        };
        Update: {
          [key: string]: never;
        };
        Relationships: [];
      };
      media_user_vectors_active: {
        Row: {
          user_id: unknown;
          taste: unknown;
          updated_at: unknown;
          provider: unknown;
          model: unknown;
          dimensions: unknown;
          task: unknown;
        };
        Insert: {
          [key: string]: never;
        };
        Update: {
          [key: string]: never;
        };
        Relationships: [];
      };
    };
    Functions: {
      _mv_merge_policies: {
        Args: {
          tname: string | null;
          pol_cmd: string | null;
          roles: unknown[] | null;
          new_policy: string | null;
          old_policies: string[] | null;
        };
        Returns: undefined;
      };
      _touch_updated_at: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      _trg_job_run_log_coalesce_total_tokens: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      _trg_sync_title_genres: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      admin_list_cron_jobs: {
        Args: Record<string, never>;
        Returns: Json[];
      };
      admin_run_cron_job: {
        Args: {
          p_jobname: string | null;
        };
        Returns: undefined;
      };
      admin_search_users: {
        Args: {
          p_search: string | null;
          p_limit: number | null;
          p_offset: number | null;
        };
        Returns: Json[];
      };
      admin_set_cron_active: {
        Args: {
          p_jobname: string | null;
          p_active: boolean | null;
        };
        Returns: undefined;
      };
      admin_set_cron_schedule: {
        Args: {
          p_jobname: string | null;
          p_schedule: string | null;
        };
        Returns: undefined;
      };
      apply_media_event_to_daily_rollup: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      apply_media_event_to_feedback: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      assert_admin: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      assistant_ctx_snapshot_v1: {
        Args: {
          p_limit?: number | null;
        };
        Returns: Json;
      };
      assistant_goal_refresh_state: {
        Args: {
          p_goal_id: string | null;
        };
        Returns: undefined;
      };
      assistant_goal_track_watch: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      assistant_prefs_guard_update: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      assistant_suggestions_guard_update: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      assistant_trigger_candidates_swipe_low_like_rate: {
        Args: {
          p_trigger_id: string | null;
          p_window_hours?: number | null;
          p_min_actions?: number | null;
          p_max_like_rate?: number | null;
          p_cooldown_minutes?: number | null;
        };
        Returns: Json[];
      };
      assistant_trigger_candidates_watchlist_stuck: {
        Args: {
          p_trigger_id: string | null;
          p_min_watchlist?: number | null;
          p_max_watched_days?: number | null;
          p_cooldown_minutes?: number | null;
        };
        Returns: Json[];
      };
      assistant_tx_plan_execute_v1: {
        Args: {
          p_plan: Json | null;
        };
        Returns: Json;
      };
      bump_conversation_on_participant_change: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      bump_conversation_updated_at: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      can_view_profile: {
        Args: {
          target_user_id: string | null;
        };
        Returns: boolean;
      };
      canonicalize_direct_participant_ids: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      check_rate_limit: {
        Args: {
          p_key: string | null;
          p_action: string | null;
          p_max_per_minute: number | null;
        };
        Returns: Json[];
      };
      cleanup_media_events: {
        Args: {
          p_keep_days?: number | null;
        };
        Returns: number;
      };
      cleanup_media_events_hybrid: {
        Args: {
          p_keep_days_low_signal?: number | null;
          p_keep_days_explicit?: number | null;
        };
        Returns: number;
      };
      create_direct_conversation_v1: {
        Args: {
          p_creator_id: string | null;
          p_target_user_id: string | null;
        };
        Returns: string;
      };
      cron_assistant_metrics_rollup_daily: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      cron_assistant_trigger_runner: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      enforce_message_payload_safety: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      enforce_reaction_conversation_match: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      enforce_reaction_message_scope_v1: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      get_conversation_summaries: {
        Args: {
          p_user_id: string | null;
        };
        Returns: Json[];
      };
      get_conversation_summaries_for_user: {
        Args: {
          p_user_id: string | null;
        };
        Returns: Json[];
      };
      get_conversation_summaries_for_user_v2: {
        Args: {
          p_user_id: string | null;
        };
        Returns: Json[];
      };
      get_conversation_summaries_v2: {
        Args: {
          p_user_id: string | null;
        };
        Returns: Json[];
      };
      get_diary_stats: {
        Args: {
          p_user_id: string | null;
        };
        Returns: Json[];
      };
      get_embedding_search_settings_v1: {
        Args: Record<string, never>;
        Returns: Json;
      };
      get_embedding_settings_v1: {
        Args: Record<string, never>;
        Returns: Json;
      };
      get_home_feed: {
        Args: {
          p_user_id: string | null;
          p_limit?: number | null;
          p_cursor?: string | null;
        };
        Returns: Database["public"]["Tables"]["activity_events"]["Row"][];
      };
      get_home_feed_v2: {
        Args: {
          p_user_id: string | null;
          p_limit?: number | null;
          p_cursor_created_at?: string | null;
          p_cursor_id?: string | null;
        };
        Returns: Json[];
      };
      get_personalized_recommendations_v3: {
        Args: {
          p_user_id: string | null;
          p_session_id?: string | null;
          p_section?: string | null;
          p_seed_media_id?: string | null;
          p_limit?: number | null;
          p_exclude_watched?: boolean | null;
          p_quality_floor_imdb?: number | null;
          p_quality_floor_rt?: number | null;
          p_runtime_preference?: string | null;
          p_context?: Json | null;
        };
        Returns: Json[];
      };
      get_recommendation_ctr: {
        Args: {
          p_section: string | null;
          p_context?: Json | null;
          p_days?: number | null;
        };
        Returns: number;
      };
      get_title_rating_summary_v1: {
        Args: {
          p_title_id: string | null;
        };
        Returns: Json[];
      };
      handle_auth_user_updated: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      handle_library_entry_activity: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      handle_library_entry_delete_activity: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      handle_new_auth_user: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      handle_new_user: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      handle_rating_insert_activity: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      handle_review_insert_activity: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      increment_recommendation_impressions_performance: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      invoke_assistant_goal_sweeper_with_anon_key: {
        Args: {
          p_reason?: string | null;
        };
        Returns: number;
      };
      invoke_assistant_metrics_rollup_daily_with_anon_key: {
        Args: {
          p_reason?: string | null;
          p_day?: string | null;
        };
        Returns: number;
      };
      invoke_assistant_trigger_runner_with_anon_key: {
        Args: {
          p_reason?: string | null;
          p_dry_run?: boolean | null;
        };
        Returns: number;
      };
      invoke_media_backfill_daily: {
        Args: Record<string, never>;
        Returns: number;
      };
      invoke_media_embed_backfill_edge_with_anon_key: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      invoke_media_embed_backfill_voyage_edge_with_anon_key: {
        Args: {
          batch_size?: number | null;
          reembed?: boolean | null;
          kind?: string | null;
          task?: string | null;
          dimensions?: number | null;
          model?: string | null;
          use_saved_cursor?: boolean | null;
        };
        Returns: undefined;
      };
      invoke_media_trending_refresh_with_anon_key: {
        Args: Record<string, never>;
        Returns: number;
      };
      is_app_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      is_blocked: {
        Args: {
          a: string | null;
          b: string | null;
        };
        Returns: boolean;
      };
      is_conversation_member: {
        Args: {
          conv_id: string | null;
          uid: string | null;
        };
        Returns: boolean;
      };
      is_conversation_owner: {
        Args: {
          conv_id: string | null;
          uid: string | null;
        };
        Returns: boolean;
      };
      is_follower: {
        Args: {
          target: string | null;
          candidate: string | null;
        };
        Returns: boolean;
      };
      is_service_role: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      mark_conversation_read: {
        Args: {
          p_conversation_id: string | null;
          p_last_message_id: string | null;
        };
        Returns: undefined;
      };
      mark_notifications_read: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      match_media_embeddings: {
        Args: {
          query_embedding: string | null;
          match_count?: number | null;
          completeness_min?: number | null;
          kind_filter?: string | null;
          genre_filter?: string | null;
          year_min?: number | null;
          year_max?: number | null;
        };
        Returns: Json[];
      };
      media_items_ensure_columns: {
        Args: {
          flat: Json | null;
        };
        Returns: Json[];
      };
      media_items_promote_kind: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      media_refresh_user_centroids_v1: {
        Args: {
          p_user_id?: string | null;
          p_k?: number | null;
          p_max_items?: number | null;
        };
        Returns: undefined;
      };
      media_swipe_brain_health_v1: {
        Args: {
          p_session_id: string | null;
        };
        Returns: Json;
      };
      media_swipe_deck_v2: {
        Args: {
          p_session_id: string | null;
          p_limit: number | null;
          p_mode: string | null;
          p_kind_filter: string | null;
          p_seed: string | null;
        };
        Returns: Json[];
      };
      media_swipe_deck_v3: {
        Args: {
          p_session_id: string | null;
          p_limit: number | null;
          p_mode: string | null;
          p_kind_filter: string | null;
          p_seed: string | null;
        };
        Returns: Json[];
      };
      media_swipe_deck_v3_core: {
        Args: {
          p_session_id: string | null;
          p_limit: number | null;
          p_mode: string | null;
          p_kind_filter: string | null;
          p_seed: string | null;
        };
        Returns: Json[];
      };
      media_swipe_deck_v3_safe: {
        Args: {
          p_session_id: string | null;
          p_limit: number | null;
          p_mode: string | null;
          p_kind_filter: string | null;
          p_seed: string | null;
        };
        Returns: Json[];
      };
      media_swipe_deck_v3_typed: {
        Args: {
          p_session_id: string | null;
          p_limit: number | null;
          p_mode: string | null;
          p_kind_filter: string[] | null;
          p_seed: number | null;
        };
        Returns: Json[];
      };
      media_update_taste_vectors_v1: {
        Args: {
          p_session_id: string | null;
          p_media_item_id: string | null;
          p_event_type: Database["public"]["Enums"]["media_event_type"] | null;
          p_dwell_ms?: number | null;
          p_rating_0_10?: number | null;
          p_in_watchlist?: boolean | null;
        };
        Returns: Json;
      };
      messages_set_sender_id_v1: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      prevent_message_conversation_change: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      refresh_media_feedback_impressions_7d_v1: {
        Args: {
          p_user_id?: string | null;
        };
        Returns: undefined;
      };
      refresh_media_trending_scores: {
        Args: {
          lookback_days?: number | null;
          half_life_hours?: number | null;
          completeness_min?: number | null;
        };
        Returns: undefined;
      };
      reset_media_embed_backfill_cursor: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      set_active_embedding_profile: {
        Args: {
          p_provider: string | null;
          p_model: string | null;
          p_dimensions: number | null;
          p_task: string | null;
        };
        Returns: undefined;
      };
      set_media_rerank_cache_updated_at: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      set_updated_at: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      sync_media_event_to_diary: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      sync_profiles_public: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      sync_profiles_public_delete: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      sync_title_genres_for_media_item: {
        Args: {
          p_title_id: string | null;
        };
        Returns: undefined;
      };
      thompson_sample_exploration_rate: {
        Args: {
          p_section: string | null;
          p_context?: Json | null;
        };
        Returns: number;
      };
      toggle_follow: {
        Args: {
          p_target_user_id: string | null;
        };
        Returns: undefined;
      };
      touch_conversation_updated_at: {
        Args: {
          _conversation_id: string | null;
        };
        Returns: undefined;
      };
      trg_audit_media_items_delete_func: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      trg_audit_profiles_delete_func: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      trg_media_items_fts_sync: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      update_recommendation_performance: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      validate_message_insert_v1: {
        Args: Record<string, never>;
        Returns: unknown;
      };
    };
    Enums: {
      activity_event_type: 'rating_created' | 'review_created' | 'watchlist_added' | 'watchlist_removed' | 'follow_created' | 'comment_created' | 'reply_created' | 'list_created' | 'list_item_added' | 'message_sent' | 'swipe_skipped' | 'watched';
      content_type: 'movie' | 'series' | 'anime';
      episode_status: 'watching' | 'watched' | 'skipped';
      impression_tag: 'loved_it' | 'good' | 'meh' | 'bad';
      library_status: 'want_to_watch' | 'watching' | 'watched' | 'dropped';
      media_event_type: 'impression' | 'detail_open' | 'detail_close' | 'dwell' | 'like' | 'dislike' | 'skip' | 'watchlist_add' | 'watchlist_remove' | 'rating_set' | 'share' | 'watchlist' | 'rating';
      media_kind: 'movie' | 'series' | 'episode' | 'other' | 'anime';
      message_type: 'text' | 'image' | 'text+image' | 'system';
      notification_type: 'follow' | 'comment' | 'reply' | 'reaction' | 'mention' | 'system';
      participant_role: 'member' | 'admin' | 'owner';
      privacy_level: 'public' | 'followers_only' | 'private';
      profile_visibility: 'public' | 'followers_only';
      report_status: 'open' | 'in_review' | 'resolved' | 'dismissed';
      target_type: 'feed_item' | 'review' | 'comment' | 'profile_wall';
      title_type: 'movie' | 'series' | 'anime' | 'short';
      wall_visibility: 'everyone' | 'followers' | 'none';
      watch_status: 'want_to_watch' | 'watching' | 'watched' | 'dropped';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
