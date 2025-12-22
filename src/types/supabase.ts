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
          title_id: string;
          related_user_id: string;
          payload: Json;
        };
        Insert: {
          id: string;
          created_at: string;
          user_id: string;
          event_type: string;
          title_id: string;
          related_user_id: string;
          payload: Json;
        };
        Update: {
          id?: string;
          created_at?: string;
          user_id?: string;
          event_type?: string;
          title_id?: string;
          related_user_id?: string;
          payload?: Json;
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
          created_at: string;
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
          created_at: string;
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
          review_id: string;
          parent_comment_id: string;
          body: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          review_id: string;
          parent_comment_id: string;
          body: string;
          created_at: string;
          updated_at: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          review_id?: string;
          parent_comment_id?: string;
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
          role: Database["public"]["Enums"]["participant_role"];
          created_at: string;
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
          title: string;
          created_by: string;
          updated_at: string;
          direct_participant_ids: unknown;
        };
        Insert: {
          id: string;
          created_at: string;
          is_group: boolean;
          title: string;
          created_by: string;
          updated_at: string;
          direct_participant_ids: unknown;
        };
        Update: {
          id?: string;
          created_at?: string;
          is_group?: boolean;
          title?: string;
          created_by?: string;
          updated_at?: string;
          direct_participant_ids?: unknown;
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
          created_at: string;
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
          id: unknown;
          name: string;
          slug: string;
        };
        Insert: {
          id: unknown;
          name: string;
          slug: string;
        };
        Update: {
          id?: unknown;
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
          notes: string;
          started_at: string;
          completed_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          title_id: string;
          content_type: Database["public"]["Enums"]["content_type"];
          status: Database["public"]["Enums"]["library_status"];
          notes: string;
          started_at: string;
          completed_at: string;
          created_at: string;
          updated_at: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title_id?: string;
          content_type?: Database["public"]["Enums"]["content_type"];
          status?: Database["public"]["Enums"]["library_status"];
          notes?: string;
          started_at?: string;
          completed_at?: string;
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
          position: unknown;
          note: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          list_id: string;
          title_id: string;
          content_type: Database["public"]["Enums"]["content_type"];
          position: unknown;
          note: string;
          created_at: string;
          updated_at: string;
        };
        Update: {
          id?: string;
          list_id?: string;
          title_id?: string;
          content_type?: Database["public"]["Enums"]["content_type"];
          position?: unknown;
          note?: string;
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
          description: string;
          is_public: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          name: string;
          description: string;
          is_public: boolean;
          created_at: string;
          updated_at: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string;
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
          model: string;
          task: string;
          updated_at: string;
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
          deck_id: string;
          position: unknown;
          media_item_id: string;
          event_type: Database["public"]["Enums"]["media_event_type"];
          source: string;
          dwell_ms: unknown;
          payload: Json;
          created_at: string;
          client_event_id: string;
          rating_0_10: unknown;
          in_watchlist: boolean;
          event_day: string;
          dedupe_key: string;
        };
        Insert: {
          id: string;
          user_id: string;
          session_id: string;
          deck_id: string;
          position: unknown;
          media_item_id: string;
          event_type: Database["public"]["Enums"]["media_event_type"];
          source: string;
          dwell_ms: unknown;
          payload: Json;
          created_at: string;
          client_event_id: string;
          rating_0_10: unknown;
          in_watchlist: boolean;
          event_day: string;
          dedupe_key: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          session_id?: string;
          deck_id?: string;
          position?: unknown;
          media_item_id?: string;
          event_type?: Database["public"]["Enums"]["media_event_type"];
          source?: string;
          dwell_ms?: unknown;
          payload?: Json;
          created_at?: string;
          client_event_id?: string;
          rating_0_10?: unknown;
          in_watchlist?: boolean;
          event_day?: string;
          dedupe_key?: string;
        };
        Relationships: [
          {
            foreignKeyName: "media_events_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "media_events_media_item_id_fkey";
            columns: ["media_item_id"];
            referencedRelation: "media_items";
            referencedColumns: ["id"];
          },
        ];
      };
      media_feedback: {
        Row: {
          user_id: string;
          media_item_id: string;
          last_action: Database["public"]["Enums"]["media_event_type"];
          last_action_at: string;
          rating_0_10: unknown;
          in_watchlist: boolean;
          last_dwell_ms: unknown;
          updated_at: string;
          last_impression_at: string;
          impressions_7d: unknown;
          seen_count_total: unknown;
          last_dwell_at: string;
          dwell_ms_ema: unknown;
          positive_ema: unknown;
          negative_ema: unknown;
          last_why: string;
          last_rank_score: unknown;
        };
        Insert: {
          user_id: string;
          media_item_id: string;
          last_action: Database["public"]["Enums"]["media_event_type"];
          last_action_at: string;
          rating_0_10: unknown;
          in_watchlist: boolean;
          last_dwell_ms: unknown;
          updated_at: string;
          last_impression_at: string;
          impressions_7d: unknown;
          seen_count_total: unknown;
          last_dwell_at: string;
          dwell_ms_ema: unknown;
          positive_ema: unknown;
          negative_ema: unknown;
          last_why: string;
          last_rank_score: unknown;
        };
        Update: {
          user_id?: string;
          media_item_id?: string;
          last_action?: Database["public"]["Enums"]["media_event_type"];
          last_action_at?: string;
          rating_0_10?: unknown;
          in_watchlist?: boolean;
          last_dwell_ms?: unknown;
          updated_at?: string;
          last_impression_at?: string;
          impressions_7d?: unknown;
          seen_count_total?: unknown;
          last_dwell_at?: string;
          dwell_ms_ema?: unknown;
          positive_ema?: unknown;
          negative_ema?: unknown;
          last_why?: string;
          last_rank_score?: unknown;
        };
        Relationships: [
          {
            foreignKeyName: "media_feedback_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "media_feedback_media_item_id_fkey";
            columns: ["media_item_id"];
            referencedRelation: "media_items";
            referencedColumns: ["id"];
          },
        ];
      };
      media_item_daily: {
        Row: {
          day: string;
          media_item_id: string;
          impressions: unknown;
          dwell_events: unknown;
          dwell_ms_sum: unknown;
          likes: unknown;
          dislikes: unknown;
          skips: unknown;
          watchlist_events: unknown;
          rating_events: unknown;
          unique_users: unknown;
          updated_at: string;
        };
        Insert: {
          day: string;
          media_item_id: string;
          impressions: unknown;
          dwell_events: unknown;
          dwell_ms_sum: unknown;
          likes: unknown;
          dislikes: unknown;
          skips: unknown;
          watchlist_events: unknown;
          rating_events: unknown;
          unique_users: unknown;
          updated_at: string;
        };
        Update: {
          day?: string;
          media_item_id?: string;
          impressions?: unknown;
          dwell_events?: unknown;
          dwell_ms_sum?: unknown;
          likes?: unknown;
          dislikes?: unknown;
          skips?: unknown;
          watchlist_events?: unknown;
          rating_events?: unknown;
          unique_users?: unknown;
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
          omdb_raw: Json;
          tmdb_raw: Json;
          omdb_title: string;
          omdb_year: string;
          omdb_rated: string;
          omdb_released: string;
          omdb_runtime: string;
          omdb_genre: string;
          omdb_director: string;
          omdb_writer: string;
          omdb_actors: string;
          omdb_plot: string;
          omdb_language: string;
          omdb_country: string;
          omdb_awards: string;
          omdb_poster: string;
          omdb_metascore: string;
          omdb_imdb_rating: unknown;
          omdb_imdb_votes: string;
          omdb_imdb_id: string;
          omdb_type: string;
          omdb_dvd: string;
          omdb_box_office: string;
          omdb_production: string;
          omdb_website: string;
          omdb_total_seasons: unknown;
          omdb_response: boolean;
          omdb_rating_internet_movie_database: string;
          omdb_rating_rotten_tomatoes: string;
          omdb_rating_metacritic: string;
          tmdb_id: unknown;
          tmdb_adult: boolean;
          tmdb_backdrop_path: string;
          tmdb_genre_ids: unknown;
          tmdb_original_language: string;
          tmdb_original_title: string;
          tmdb_overview: string;
          tmdb_popularity: unknown;
          tmdb_poster_path: string;
          tmdb_release_date: string;
          tmdb_title: string;
          tmdb_video: boolean;
          tmdb_vote_average: unknown;
          tmdb_vote_count: unknown;
          tmdb_name: string;
          tmdb_original_name: string;
          tmdb_first_air_date: string;
          tmdb_media_type: string;
          tmdb_origin_country: unknown;
          tmdb_fetched_at: string;
          tmdb_status: string;
          tmdb_error: string;
          omdb_fetched_at: string;
          omdb_status: string;
          omdb_error: string;
          filled_count: unknown;
          missing_count: unknown;
          completeness: unknown;
          omdb_ratings: Json;
          tmdb_budget: unknown;
          tmdb_revenue: unknown;
          tmdb_runtime: unknown;
          tmdb_tagline: string;
          tmdb_homepage: string;
          tmdb_imdb_id: string;
          tmdb_genres: Json;
          tmdb_spoken_languages: Json;
          tmdb_production_companies: Json;
          tmdb_production_countries: Json;
          tmdb_belongs_to_collection: Json;
          tmdb_source: string;
          tmdb_release_status: string;
          tmdb_origin_country_raw: Json;
        };
        Insert: {
          id: string;
          created_at: string;
          updated_at: string;
          kind: Database["public"]["Enums"]["media_kind"];
          omdb_raw: Json;
          tmdb_raw: Json;
          omdb_title: string;
          omdb_year: string;
          omdb_rated: string;
          omdb_released: string;
          omdb_runtime: string;
          omdb_genre: string;
          omdb_director: string;
          omdb_writer: string;
          omdb_actors: string;
          omdb_plot: string;
          omdb_language: string;
          omdb_country: string;
          omdb_awards: string;
          omdb_poster: string;
          omdb_metascore: string;
          omdb_imdb_rating: unknown;
          omdb_imdb_votes: string;
          omdb_imdb_id: string;
          omdb_type: string;
          omdb_dvd: string;
          omdb_box_office: string;
          omdb_production: string;
          omdb_website: string;
          omdb_total_seasons: unknown;
          omdb_response: boolean;
          omdb_rating_internet_movie_database: string;
          omdb_rating_rotten_tomatoes: string;
          omdb_rating_metacritic: string;
          tmdb_id: unknown;
          tmdb_adult: boolean;
          tmdb_backdrop_path: string;
          tmdb_genre_ids: unknown;
          tmdb_original_language: string;
          tmdb_original_title: string;
          tmdb_overview: string;
          tmdb_popularity: unknown;
          tmdb_poster_path: string;
          tmdb_release_date: string;
          tmdb_title: string;
          tmdb_video: boolean;
          tmdb_vote_average: unknown;
          tmdb_vote_count: unknown;
          tmdb_name: string;
          tmdb_original_name: string;
          tmdb_first_air_date: string;
          tmdb_media_type: string;
          tmdb_origin_country: unknown;
          tmdb_fetched_at: string;
          tmdb_status: string;
          tmdb_error: string;
          omdb_fetched_at: string;
          omdb_status: string;
          omdb_error: string;
          filled_count: unknown;
          missing_count: unknown;
          completeness: unknown;
          omdb_ratings: Json;
          tmdb_budget: unknown;
          tmdb_revenue: unknown;
          tmdb_runtime: unknown;
          tmdb_tagline: string;
          tmdb_homepage: string;
          tmdb_imdb_id: string;
          tmdb_genres: Json;
          tmdb_spoken_languages: Json;
          tmdb_production_companies: Json;
          tmdb_production_countries: Json;
          tmdb_belongs_to_collection: Json;
          tmdb_source: string;
          tmdb_release_status: string;
          tmdb_origin_country_raw: Json;
        };
        Update: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          kind?: Database["public"]["Enums"]["media_kind"];
          omdb_raw?: Json;
          tmdb_raw?: Json;
          omdb_title?: string;
          omdb_year?: string;
          omdb_rated?: string;
          omdb_released?: string;
          omdb_runtime?: string;
          omdb_genre?: string;
          omdb_director?: string;
          omdb_writer?: string;
          omdb_actors?: string;
          omdb_plot?: string;
          omdb_language?: string;
          omdb_country?: string;
          omdb_awards?: string;
          omdb_poster?: string;
          omdb_metascore?: string;
          omdb_imdb_rating?: unknown;
          omdb_imdb_votes?: string;
          omdb_imdb_id?: string;
          omdb_type?: string;
          omdb_dvd?: string;
          omdb_box_office?: string;
          omdb_production?: string;
          omdb_website?: string;
          omdb_total_seasons?: unknown;
          omdb_response?: boolean;
          omdb_rating_internet_movie_database?: string;
          omdb_rating_rotten_tomatoes?: string;
          omdb_rating_metacritic?: string;
          tmdb_id?: unknown;
          tmdb_adult?: boolean;
          tmdb_backdrop_path?: string;
          tmdb_genre_ids?: unknown;
          tmdb_original_language?: string;
          tmdb_original_title?: string;
          tmdb_overview?: string;
          tmdb_popularity?: unknown;
          tmdb_poster_path?: string;
          tmdb_release_date?: string;
          tmdb_title?: string;
          tmdb_video?: boolean;
          tmdb_vote_average?: unknown;
          tmdb_vote_count?: unknown;
          tmdb_name?: string;
          tmdb_original_name?: string;
          tmdb_first_air_date?: string;
          tmdb_media_type?: string;
          tmdb_origin_country?: unknown;
          tmdb_fetched_at?: string;
          tmdb_status?: string;
          tmdb_error?: string;
          omdb_fetched_at?: string;
          omdb_status?: string;
          omdb_error?: string;
          filled_count?: unknown;
          missing_count?: unknown;
          completeness?: unknown;
          omdb_ratings?: Json;
          tmdb_budget?: unknown;
          tmdb_revenue?: unknown;
          tmdb_runtime?: unknown;
          tmdb_tagline?: string;
          tmdb_homepage?: string;
          tmdb_imdb_id?: string;
          tmdb_genres?: Json;
          tmdb_spoken_languages?: Json;
          tmdb_production_companies?: Json;
          tmdb_production_countries?: Json;
          tmdb_belongs_to_collection?: Json;
          tmdb_source?: string;
          tmdb_release_status?: string;
          tmdb_origin_country_raw?: Json;
        };
        Relationships: [];
      };
      media_job_state: {
        Row: {
          job_name: string;
          cursor: string;
          updated_at: string;
        };
        Insert: {
          job_name: string;
          cursor: string;
          updated_at: string;
        };
        Update: {
          job_name?: string;
          cursor?: string;
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
          taste: unknown;
          updated_at: string;
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
          score_72h: unknown;
          computed_at: string;
        };
        Insert: {
          media_item_id: string;
          score_72h: unknown;
          computed_at: string;
        };
        Update: {
          media_item_id?: string;
          score_72h?: unknown;
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
          taste: unknown;
          updated_at: string;
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
          id: string;
          created_at: string;
          conversation_id: string;
          message_id: string;
          user_id: string;
          delivered_at: string;
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
          id: string;
          created_at: string;
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
          last_read_message_id: string;
          last_read_at: string;
        };
        Insert: {
          conversation_id: string;
          user_id: string;
          last_read_message_id: string;
          last_read_at: string;
        };
        Update: {
          conversation_id?: string;
          user_id?: string;
          last_read_message_id?: string;
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
          body: any;
          attachment_url: string | null;
          sender_id: string | null;
          message_type: string;
          text: string | null;
          client_id: string | null;
          meta: any;
        };
        Insert: {
          id?: string;
          created_at?: string;
          conversation_id: string;
          user_id: string;
          body: any;
          attachment_url?: string | null;
          sender_id?: string | null;
          message_type?: string;
          text?: string | null;
          client_id?: string | null;
          meta?: any;
        };
        Update: {
          id?: string;
          created_at?: string;
          conversation_id?: string;
          user_id?: string;
          body?: any;
          attachment_url?: string | null;
          sender_id?: string | null;
          message_type?: string;
          text?: string | null;
          client_id?: string | null;
          meta?: any;
        };
        Relationships: [
          {
            foreignKeyName: "messages_sender_id_fkey";
            columns: ["sender_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
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
          email_activity: boolean;
          email_recommendations: boolean;
          in_app_social: boolean;
          in_app_system: boolean;
          updated_at: string;
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
          data: Json;
          is_read: boolean;
        };
        Insert: {
          id: string;
          created_at: string;
          user_id: string;
          type: string;
          data: Json;
          is_read: boolean;
        };
        Update: {
          id?: string;
          created_at?: string;
          user_id?: string;
          type?: string;
          data?: Json;
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
          kind: Database["public"]["Enums"]["media_kind"];
          imdb_id: string;
          fetched_at: string;
          raw: Json;
        };
        Insert: {
          kind: Database["public"]["Enums"]["media_kind"];
          imdb_id: string;
          fetched_at: string;
          raw: Json;
        };
        Update: {
          kind?: Database["public"]["Enums"]["media_kind"];
          imdb_id?: string;
          fetched_at?: string;
          raw?: Json;
        };
        Relationships: [];
      };
      people: {
        Row: {
          id: unknown;
          name: string;
          tmdb_id: unknown;
          imdb_id: string;
        };
        Insert: {
          id: unknown;
          name: string;
          tmdb_id: unknown;
          imdb_id: string;
        };
        Update: {
          id?: unknown;
          name?: string;
          tmdb_id?: unknown;
          imdb_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          username: string;
          display_name: string;
          email: string;
          avatar_url: string;
          bio: string;
        };
        Insert: {
          id: string;
          created_at: string;
          updated_at: string;
          username: string;
          display_name: string;
          email: string;
          avatar_url: string;
          bio: string;
        };
        Update: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          username?: string;
          display_name?: string;
          email?: string;
          avatar_url?: string;
          bio?: string;
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
          rating: unknown;
          comment: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          title_id: string;
          content_type: Database["public"]["Enums"]["content_type"];
          rating: unknown;
          comment: string;
          created_at: string;
          updated_at: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title_id?: string;
          content_type?: Database["public"]["Enums"]["content_type"];
          rating?: unknown;
          comment?: string;
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
          reason: string;
          status: Database["public"]["Enums"]["report_status"];
          created_at: string;
          resolved_at: string;
          resolved_by: string;
          notes: string;
        };
        Insert: {
          id: string;
          reporter_id: string;
          target_type: string;
          target_id: string;
          reason: string;
          status: Database["public"]["Enums"]["report_status"];
          created_at: string;
          resolved_at: string;
          resolved_by: string;
          notes: string;
        };
        Update: {
          id?: string;
          reporter_id?: string;
          target_type?: string;
          target_id?: string;
          reason?: string;
          status?: Database["public"]["Enums"]["report_status"];
          created_at?: string;
          resolved_at?: string;
          resolved_by?: string;
          notes?: string;
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
          id: string;
          created_at: string;
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
          rating: unknown;
          headline: string;
          body: string;
          spoiler: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          title_id: string;
          content_type: Database["public"]["Enums"]["content_type"];
          rating: unknown;
          headline: string;
          body: string;
          spoiler: boolean;
          created_at: string;
          updated_at: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title_id?: string;
          content_type?: Database["public"]["Enums"]["content_type"];
          rating?: unknown;
          headline?: string;
          body?: string;
          spoiler?: boolean;
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
          kind: Database["public"]["Enums"]["media_kind"];
          tmdb_id: unknown;
          fetched_at: string;
          raw: Json;
        };
        Insert: {
          kind: Database["public"]["Enums"]["media_kind"];
          tmdb_id: unknown;
          fetched_at: string;
          raw: Json;
        };
        Update: {
          kind?: Database["public"]["Enums"]["media_kind"];
          tmdb_id?: unknown;
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
          email_notifications: boolean;
          push_notifications: boolean;
          privacy_profile: Database["public"]["Enums"]["privacy_level"];
          privacy_activity: Database["public"]["Enums"]["privacy_level"];
          privacy_lists: Database["public"]["Enums"]["privacy_level"];
          updated_at: string;
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
          followers_count: unknown;
          following_count: unknown;
          ratings_count: unknown;
          reviews_count: unknown;
          watchlist_count: unknown;
          comments_count: unknown;
          lists_count: unknown;
          messages_sent_count: unknown;
          last_active_at: string;
        };
        Insert: {
          user_id: string;
          followers_count: unknown;
          following_count: unknown;
          ratings_count: unknown;
          reviews_count: unknown;
          watchlist_count: unknown;
          comments_count: unknown;
          lists_count: unknown;
          messages_sent_count: unknown;
          last_active_at: string;
        };
        Update: {
          user_id?: string;
          followers_count?: unknown;
          following_count?: unknown;
          ratings_count?: unknown;
          reviews_count?: unknown;
          watchlist_count?: unknown;
          comments_count?: unknown;
          lists_count?: unknown;
          messages_sent_count?: unknown;
          last_active_at?: string;
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
          year_min: unknown;
          year_max: unknown;
          runtime_min: unknown;
          runtime_max: unknown;
          completeness_min: unknown;
        };
        Insert: {
          user_id: string;
          year_min: unknown;
          year_max: unknown;
          runtime_min: unknown;
          runtime_max: unknown;
          completeness_min: unknown;
        };
        Update: {
          user_id?: string;
          year_min?: unknown;
          year_max?: unknown;
          runtime_min?: unknown;
          runtime_max?: unknown;
          completeness_min?: unknown;
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
          color: string;
          created_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          name: string;
          color: string;
          created_at: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          color?: string;
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
          created_at: string;
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
      get_home_feed_v2: {
        Args: {
          p_user_id: string;
          p_limit?: number;
          p_cursor_created_at?: string | null;
          p_cursor_id?: string | null;
        };
        Returns: {
          id: string;
          created_at: string;
          user_id: string;
          event_type: string;
          media_item_id: string | null;
          related_user_id: string | null;
          payload: any;
          actor_profile: any;
          media_item: any;
        }[];
      };
      media_swipe_deck_v3: {
        Args: {
          p_session_id: string;
          p_limit?: number;
          p_mode?: string;
          p_kind_filter?: string | null;
          p_seed?: number;
        };
        Returns: {
          media_item_id: string;
          source: string;
          score: number;
          position: number;
        }[];
      };
      media_update_taste_vectors_v1: {
        Args: { p_user_id: string };
        Returns: void;
      };
      media_refresh_user_centroids_v1: {
        Args: { p_user_id: string };
        Returns: void;
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
