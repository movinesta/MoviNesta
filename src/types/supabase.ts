export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      activity_events: {
        Row: {
          id: string;
          created_at: string;
          user_id: string;
          event_type: string;
          title_id: string | null;
          related_user_id: string | null;
          payload: Json | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          user_id: string;
          event_type: string;
          title_id?: string | null;
          related_user_id?: string | null;
          payload?: Json | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          user_id?: string;
          event_type?: string;
          title_id?: string | null;
          related_user_id?: string | null;
          payload?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "activity_events_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activity_events_related_user_id_fkey";
            columns: ["related_user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
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
          {
            foreignKeyName: "blocked_users_blocker_id_fkey";
            columns: ["blocker_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "blocked_users_blocked_id_fkey";
            columns: ["blocked_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
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
          {
            foreignKeyName: "comment_likes_comment_id_fkey";
            columns: ["comment_id"];
            referencedRelation: "comments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comment_likes_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
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
          {
            foreignKeyName: "comments_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_review_id_fkey";
            columns: ["review_id"];
            referencedRelation: "reviews";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_parent_comment_id_fkey";
            columns: ["parent_comment_id"];
            referencedRelation: "comments";
            referencedColumns: ["id"];
          },
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
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey";
            columns: ["conversation_id"];
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversation_participants_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
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
          {
            foreignKeyName: "conversations_created_by_fkey";
            columns: ["created_by"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
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
          {
            foreignKeyName: "follows_follower_id_fkey";
            columns: ["follower_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "follows_followed_id_fkey";
            columns: ["followed_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      genres: {
        Row: {
          id: number;
          name: string;
          slug: string;
        };
        Insert: {
          id?: number;
          name: string;
          slug: string;
        };
        Update: {
          id?: number;
          name?: string;
          slug?: string;
        };
        Relationships: [];
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
          {
            foreignKeyName: "library_entries_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
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
          {
            foreignKeyName: "list_items_list_id_fkey";
            columns: ["list_id"];
            referencedRelation: "lists";
            referencedColumns: ["id"];
          },
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
          {
            foreignKeyName: "lists_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      media_embeddings: {
        Row: {
          media_item_id: string;
          embedding: unknown;
          model: string;
          task: string;
          updated_at: string;
        };
        Insert: {
          media_item_id: string;
          embedding: unknown;
          model?: string;
          task?: string;
          updated_at?: string;
        };
        Update: {
          media_item_id?: string;
          embedding?: unknown;
          model?: string;
          task?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "media_embeddings_media_item_id_fkey";
            columns: ["media_item_id"];
            referencedRelation: "media_items";
            referencedColumns: ["id"];
          },
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
          dedupe_key: string | null;
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
          dedupe_key?: string | null;
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
          dedupe_key?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "media_events_media_item_id_fkey";
            columns: ["media_item_id"];
            referencedRelation: "media_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "media_events_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      media_feedback: {
        Row: {
          user_id: string;
          media_item_id: string;
          last_action: string | null;
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
          last_action?: string | null;
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
          last_action?: string | null;
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
          {
            foreignKeyName: "media_feedback_media_item_id_fkey";
            columns: ["media_item_id"];
            referencedRelation: "media_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "media_feedback_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
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
          {
            foreignKeyName: "media_item_daily_media_item_id_fkey";
            columns: ["media_item_id"];
            referencedRelation: "media_items";
            referencedColumns: ["id"];
          },
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
          {
            foreignKeyName: "media_item_daily_users_media_item_id_fkey";
            columns: ["media_item_id"];
            referencedRelation: "media_items";
            referencedColumns: ["id"];
          },
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
        };
        Relationships: [];
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
        Relationships: [];
      };
      media_session_vectors: {
        Row: {
          user_id: string;
          session_id: string;
          taste: unknown;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          session_id: string;
          taste?: unknown;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          session_id?: string;
          taste?: unknown;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "media_session_vectors_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
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
          {
            foreignKeyName: "media_trending_scores_media_item_id_fkey";
            columns: ["media_item_id"];
            referencedRelation: "media_items";
            referencedColumns: ["id"];
          },
        ];
      };
      media_user_vectors: {
        Row: {
          user_id: string;
          taste: unknown;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          taste?: unknown;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          taste?: unknown;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "media_user_vectors_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
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
          {
            foreignKeyName: "message_delivery_receipts_conversation_id_fkey";
            columns: ["conversation_id"];
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_delivery_receipts_message_id_fkey";
            columns: ["message_id"];
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_delivery_receipts_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
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
          {
            foreignKeyName: "message_reactions_conversation_id_fkey";
            columns: ["conversation_id"];
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_reactions_message_id_fkey";
            columns: ["message_id"];
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_reactions_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
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
          {
            foreignKeyName: "message_read_receipts_conversation_id_fkey";
            columns: ["conversation_id"];
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_read_receipts_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_read_receipts_last_read_message_id_fkey";
            columns: ["last_read_message_id"];
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          id: string;
          created_at: string;
          conversation_id: string;
          user_id: string;
          body: string;
          attachment_url: string | null;
          sender_id: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          conversation_id: string;
          user_id: string;
          body: string;
          attachment_url?: string | null;
          sender_id?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          conversation_id?: string;
          user_id?: string;
          body?: string;
          attachment_url?: string | null;
          sender_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey";
            columns: ["conversation_id"];
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_sender_id_fkey";
            columns: ["sender_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
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
          {
            foreignKeyName: "notification_preferences_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
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
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      omdb_cache: {
        Row: {
          kind: string | null;
          imdb_id: string;
          fetched_at: string;
          raw: Json;
        };
        Insert: {
          kind?: string | null;
          imdb_id: string;
          fetched_at?: string;
          raw: Json;
        };
        Update: {
          kind?: string | null;
          imdb_id?: string;
          fetched_at?: string;
          raw?: Json;
        };
        Relationships: [];
      };
      people: {
        Row: {
          id: number;
          name: string;
          tmdb_id: number | null;
          imdb_id: string | null;
        };
        Insert: {
          id?: number;
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
        Relationships: [];
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
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
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
          {
            foreignKeyName: "ratings_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
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
          {
            foreignKeyName: "reports_reporter_id_fkey";
            columns: ["reporter_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_resolved_by_fkey";
            columns: ["resolved_by"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
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
          {
            foreignKeyName: "review_reactions_review_id_fkey";
            columns: ["review_id"];
            referencedRelation: "reviews";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "review_reactions_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
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
          {
            foreignKeyName: "reviews_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      tmdb_cache: {
        Row: {
          kind: string;
          tmdb_id: number;
          fetched_at: string;
          raw: Json;
        };
        Insert: {
          kind: string;
          tmdb_id: number;
          fetched_at?: string;
          raw: Json;
        };
        Update: {
          kind?: string;
          tmdb_id?: number;
          fetched_at?: string;
          raw?: Json;
        };
        Relationships: [];
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
          {
            foreignKeyName: "user_settings_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
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
          {
            foreignKeyName: "user_stats_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
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
          {
            foreignKeyName: "user_swipe_prefs_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
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
          {
            foreignKeyName: "user_tags_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
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
          {
            foreignKeyName: "user_title_tags_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_title_tags_tag_id_fkey";
            columns: ["tag_id"];
            referencedRelation: "user_tags";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_conversation_summaries: {
        Args: {
          p_user_id: string;
        };
        Returns: {
          conversation_id: string;
          is_group: boolean;
          title: string | null;
          created_at: string;
          updated_at: string;
          last_message_id: string | null;
          last_message_body: string | null;
          last_message_created_at: string | null;
          last_message_user_id: string | null;
          last_message_display_name: string | null;
          last_message_username: string | null;
          participants: Json;
          self_last_read_message_id: string | null;
          self_last_read_at: string | null;
          participant_receipts: Json;
        }[];
      };
      get_diary_stats: {
        Args: {
          p_user_id: string;
        };
        Returns: {
          total_rated: number;
          total_watched: number;
          average_rating: number;
          rating_distribution: Json;
          top_genres: Json;
          watch_count_by_month: Json;
        }[];
      };
      get_home_feed: {
        Args: {
          p_user_id: string;
          p_limit?: number;
          p_cursor?: string | null;
        };
        Returns: {
          id: string;
          created_at: string;
          user_id: string;
          event_type: string;
          title_id: string | null;
          related_user_id: string | null;
          payload: Json | null;
        }[];
      };
    };
    Enums: {
      content_type: "movie" | "series" | "anime";
      library_status: "want_to_watch" | "watching" | "watched" | "dropped";
      media_kind: "movie" | "series" | "anime" | "other" | "unknown";
      media_event_type:
        | "impression"
        | "dwell"
        | "like"
        | "dislike"
        | "skip"
        | "watchlist"
        | "rating"
        | "open"
        | "seen"
        | "share";
      participant_role: "member" | "admin" | "owner";
      privacy_level: "public" | "followers_only" | "private";
      report_status: "open" | "in_review" | "resolved" | "dismissed";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
