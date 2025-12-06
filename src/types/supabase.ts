export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string | null;
          display_name: string | null;
          email: string | null;
          avatar_url: string | null;
          bio: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username?: string | null;
          display_name?: string | null;
          email?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string | null;
          display_name?: string | null;
          email?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          updated_at?: string;
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
      titles: {
        Row: {
          title_id: string;
          content_type: "movie" | "series" | "anime";
          omdb_imdb_id: string | null;
          tmdb_id: number | null;
          primary_title: string | null;
          original_title: string | null;
          sort_title: string | null;
          release_year: number | null;
          release_date: string | null;
          runtime_minutes: number | null;
          is_adult: boolean | null;
          poster_url: string | null;
          backdrop_url: string | null;
          plot: string | null;
          tagline: string | null;
          genres: string[] | null;
          language: string | null;
          country: string | null;
          imdb_rating: number | null;
          imdb_votes: number | null;
          metascore: number | null;
          omdb_rated: string | null;
          omdb_released: string | null;
          omdb_director: string | null;
          omdb_writer: string | null;
          omdb_actors: string | null;
          omdb_language: string | null;
          omdb_country: string | null;
          omdb_awards: string | null;
          omdb_dvd: string | null;
          omdb_box_office_str: string | null;
          omdb_production: string | null;
          omdb_website: string | null;
          omdb_response: string | null;
          omdb_rt_rating_pct: number | null;
          omdb_box_office: number | null;
          omdb_response_ok: boolean | null;
          tmdb_adult: boolean | null;
          tmdb_video: boolean | null;
          tmdb_genre_ids: number[] | null;
          tmdb_original_language: string | null;
          tmdb_overview: string | null;
          tmdb_popularity: number | null;
          tmdb_vote_average: number | null;
          tmdb_vote_count: number | null;
          tmdb_release_date: string | null;
          tmdb_poster_path: string | null;
          data_source: string;
          source_priority: number;
          raw_payload: Json | null;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
          omdb_raw: Json | null;
          tmdb_first_air_date: string | null;
          tmdb_runtime: number | null;
          tmdb_episode_run_time: number[] | null;
          tmdb_genre_names: string[] | null;
          tmdb_raw: Json | null;
          tmdb_last_synced_at: string | null;
          omdb_last_synced_at: string | null;
          last_synced_at: string | null;
          rt_tomato_pct: number | null;
        };
        Insert: {
          title_id?: string;
          content_type: "movie" | "series" | "anime";
          omdb_imdb_id?: string | null;
          tmdb_id?: number | null;
          primary_title?: string | null;
          original_title?: string | null;
          sort_title?: string | null;
          release_year?: number | null;
          release_date?: string | null;
          runtime_minutes?: number | null;
          is_adult?: boolean | null;
          poster_url?: string | null;
          backdrop_url?: string | null;
          plot?: string | null;
          tagline?: string | null;
          genres?: string[] | null;
          language?: string | null;
          country?: string | null;
          imdb_rating?: number | null;
          imdb_votes?: number | null;
          metascore?: number | null;
          omdb_rated?: string | null;
          omdb_released?: string | null;
          omdb_director?: string | null;
          omdb_writer?: string | null;
          omdb_actors?: string | null;
          omdb_language?: string | null;
          omdb_country?: string | null;
          omdb_awards?: string | null;
          omdb_dvd?: string | null;
          omdb_box_office_str?: string | null;
          omdb_production?: string | null;
          omdb_website?: string | null;
          omdb_response?: string | null;
          omdb_rt_rating_pct?: number | null;
          omdb_box_office?: number | null;
          omdb_response_ok?: boolean | null;
          tmdb_adult?: boolean | null;
          tmdb_video?: boolean | null;
          tmdb_genre_ids?: number[] | null;
          tmdb_original_language?: string | null;
          tmdb_overview?: string | null;
          tmdb_popularity?: number | null;
          tmdb_vote_average?: number | null;
          tmdb_vote_count?: number | null;
          tmdb_release_date?: string | null;
          tmdb_poster_path?: string | null;
          data_source?: string;
          source_priority?: number;
          raw_payload?: Json | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
          omdb_raw?: Json | null;
          tmdb_first_air_date?: string | null;
          tmdb_runtime?: number | null;
          tmdb_episode_run_time?: number[] | null;
          tmdb_genre_names?: string[] | null;
          tmdb_raw?: Json | null;
          tmdb_last_synced_at?: string | null;
          omdb_last_synced_at?: string | null;
          last_synced_at?: string | null;
          rt_tomato_pct?: number | null;
        };
        Update: {
          title_id?: string;
          content_type?: "movie" | "series" | "anime";
          omdb_imdb_id?: string | null;
          tmdb_id?: number | null;
          primary_title?: string | null;
          original_title?: string | null;
          sort_title?: string | null;
          release_year?: number | null;
          release_date?: string | null;
          runtime_minutes?: number | null;
          is_adult?: boolean | null;
          poster_url?: string | null;
          backdrop_url?: string | null;
          plot?: string | null;
          tagline?: string | null;
          genres?: string[] | null;
          language?: string | null;
          country?: string | null;
          imdb_rating?: number | null;
          imdb_votes?: number | null;
          metascore?: number | null;
          omdb_rated?: string | null;
          omdb_released?: string | null;
          omdb_director?: string | null;
          omdb_writer?: string | null;
          omdb_actors?: string | null;
          omdb_language?: string | null;
          omdb_country?: string | null;
          omdb_awards?: string | null;
          omdb_dvd?: string | null;
          omdb_box_office_str?: string | null;
          omdb_production?: string | null;
          omdb_website?: string | null;
          omdb_response?: string | null;
          omdb_rt_rating_pct?: number | null;
          omdb_box_office?: number | null;
          omdb_response_ok?: boolean | null;
          tmdb_adult?: boolean | null;
          tmdb_video?: boolean | null;
          tmdb_genre_ids?: number[] | null;
          tmdb_original_language?: string | null;
          tmdb_overview?: string | null;
          tmdb_popularity?: number | null;
          tmdb_vote_average?: number | null;
          tmdb_vote_count?: number | null;
          tmdb_release_date?: string | null;
          tmdb_poster_path?: string | null;
          data_source?: string;
          source_priority?: number;
          raw_payload?: Json | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
          omdb_raw?: Json | null;
          tmdb_first_air_date?: string | null;
          tmdb_runtime?: number | null;
          tmdb_episode_run_time?: number[] | null;
          tmdb_genre_names?: string[] | null;
          tmdb_raw?: Json | null;
          tmdb_last_synced_at?: string | null;
          omdb_last_synced_at?: string | null;
          last_synced_at?: string | null;
          rt_tomato_pct?: number | null;
        };
        Relationships: [];
      };
      movies: {
        Row: {
          title_id: string;
          box_office: number | null;
          budget: number | null;
          dvd_release: string | null;
          blu_ray_release: string | null;
          streaming_release: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          title_id: string;
          box_office?: number | null;
          budget?: number | null;
          dvd_release?: string | null;
          blu_ray_release?: string | null;
          streaming_release?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title_id?: string;
          box_office?: number | null;
          budget?: number | null;
          dvd_release?: string | null;
          blu_ray_release?: string | null;
          streaming_release?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "movies_title_id_fkey";
            columns: ["title_id"];
            referencedRelation: "titles";
            referencedColumns: ["title_id"];
          },
        ];
      };
      series: {
        Row: {
          title_id: string;
          total_seasons: number | null;
          total_episodes: number | null;
          in_production: boolean | null;
          first_air_date: string | null;
          last_air_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          title_id: string;
          total_seasons?: number | null;
          total_episodes?: number | null;
          in_production?: boolean | null;
          first_air_date?: string | null;
          last_air_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title_id?: string;
          total_seasons?: number | null;
          total_episodes?: number | null;
          in_production?: boolean | null;
          first_air_date?: string | null;
          last_air_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "series_title_id_fkey";
            columns: ["title_id"];
            referencedRelation: "titles";
            referencedColumns: ["title_id"];
          },
        ];
      };
      anime: {
        Row: {
          title_id: string;
          season_count: number | null;
          episode_count: number | null;
          studio: string | null;
          source: string | null;
          demographic: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          title_id: string;
          season_count?: number | null;
          episode_count?: number | null;
          studio?: string | null;
          source?: string | null;
          demographic?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title_id?: string;
          season_count?: number | null;
          episode_count?: number | null;
          studio?: string | null;
          source?: string | null;
          demographic?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "anime_title_id_fkey";
            columns: ["title_id"];
            referencedRelation: "titles";
            referencedColumns: ["title_id"];
          },
        ];
      };
      seasons: {
        Row: {
          id: string;
          title_id: string;
          season_number: number;
          name: string | null;
          overview: string | null;
          air_date: string | null;
          poster_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title_id: string;
          season_number: number;
          name?: string | null;
          overview?: string | null;
          air_date?: string | null;
          poster_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title_id?: string;
          season_number?: number;
          name?: string | null;
          overview?: string | null;
          air_date?: string | null;
          poster_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "seasons_title_id_fkey";
            columns: ["title_id"];
            referencedRelation: "titles";
            referencedColumns: ["title_id"];
          },
        ];
      };
      episodes: {
        Row: {
          id: string;
          title_id: string;
          season_id: string | null;
          episode_number: number;
          name: string | null;
          overview: string | null;
          air_date: string | null;
          runtime_minutes: number | null;
          still_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title_id: string;
          season_id?: string | null;
          episode_number: number;
          name?: string | null;
          overview?: string | null;
          air_date?: string | null;
          runtime_minutes?: number | null;
          still_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title_id?: string;
          season_id?: string | null;
          episode_number?: number;
          name?: string | null;
          overview?: string | null;
          air_date?: string | null;
          runtime_minutes?: number | null;
          still_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "episodes_title_id_fkey";
            columns: ["title_id"];
            referencedRelation: "titles";
            referencedColumns: ["title_id"];
          },
          {
            foreignKeyName: "episodes_season_id_fkey";
            columns: ["season_id"];
            referencedRelation: "seasons";
            referencedColumns: ["id"];
          },
        ];
      };
      ratings: {
        Row: {
          id: string;
          user_id: string;
          title_id: string;
          content_type: "movie" | "series" | "anime";
          rating: number;
          comment: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title_id: string;
          content_type: "movie" | "series" | "anime";
          rating: number;
          comment?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title_id?: string;
          content_type?: "movie" | "series" | "anime";
          rating?: number;
          comment?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ratings_title_id_fkey";
            columns: ["title_id"];
            referencedRelation: "titles";
            referencedColumns: ["title_id"];
          },
          {
            foreignKeyName: "ratings_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      library_entries: {
        Row: {
          id: string;
          user_id: string;
          title_id: string;
          content_type: "movie" | "series" | "anime";
          status: "want_to_watch" | "watching" | "watched" | "dropped";
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
          content_type: "movie" | "series" | "anime";
          status?: "want_to_watch" | "watching" | "watched" | "dropped";
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
          content_type?: "movie" | "series" | "anime";
          status?: "want_to_watch" | "watching" | "watched" | "dropped";
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
          {
            foreignKeyName: "library_entries_title_id_fkey";
            columns: ["title_id"];
            referencedRelation: "titles";
            referencedColumns: ["title_id"];
          },
        ];
      };
      reviews: {
        Row: {
          id: string;
          user_id: string;
          title_id: string;
          content_type: "movie" | "series" | "anime";
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
          content_type: "movie" | "series" | "anime";
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
          content_type?: "movie" | "series" | "anime";
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
          {
            foreignKeyName: "reviews_title_id_fkey";
            columns: ["title_id"];
            referencedRelation: "titles";
            referencedColumns: ["title_id"];
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
      list_items: {
        Row: {
          id: string;
          list_id: string;
          title_id: string;
          content_type: "movie" | "series" | "anime";
          position: number;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          list_id: string;
          title_id: string;
          content_type: "movie" | "series" | "anime";
          position?: number;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          list_id?: string;
          title_id?: string;
          content_type?: "movie" | "series" | "anime";
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
          {
            foreignKeyName: "list_items_title_id_fkey";
            columns: ["title_id"];
            referencedRelation: "titles";
            referencedColumns: ["title_id"];
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
      conversations: {
        Row: {
          id: string;
          created_at: string;
          is_group: boolean;
          title: string | null;
          created_by: string | null;
          direct_participant_ids: string[] | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          created_at?: string;
          is_group?: boolean;
          title?: string | null;
          created_by?: string | null;
          direct_participant_ids?: string[] | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          created_at?: string;
          is_group?: boolean;
          title?: string | null;
          created_by?: string | null;
          direct_participant_ids?: string[] | null;
          updated_at?: string;
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
      conversation_participants: {
        Row: {
          conversation_id: string;
          user_id: string;
          role: "member" | "admin" | "owner";
          created_at: string;
        };
        Insert: {
          conversation_id: string;
          user_id: string;
          role?: "member" | "admin" | "owner";
          created_at?: string;
        };
        Update: {
          conversation_id?: string;
          user_id?: string;
          role?: "member" | "admin" | "owner";
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
      title_stats: {
        Row: {
          title_id: string;
          avg_rating: number | null;
          ratings_count: number | null;
          reviews_count: number | null;
          watch_count: number | null;
          last_updated_at: string;
        };
        Insert: {
          title_id: string;
          avg_rating?: number | null;
          ratings_count?: number | null;
          reviews_count?: number | null;
          watch_count?: number | null;
          last_updated_at?: string;
        };
        Update: {
          title_id?: string;
          avg_rating?: number | null;
          ratings_count?: number | null;
          reviews_count?: number | null;
          watch_count?: number | null;
          last_updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "title_stats_title_id_fkey";
            columns: ["title_id"];
            referencedRelation: "titles";
            referencedColumns: ["title_id"];
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
      title_genres: {
        Row: {
          title_id: string;
          genre_id: number;
        };
        Insert: {
          title_id: string;
          genre_id: number;
        };
        Update: {
          title_id?: string;
          genre_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "title_genres_genre_id_fkey";
            columns: ["genre_id"];
            referencedRelation: "genres";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "title_genres_title_id_fkey";
            columns: ["title_id"];
            referencedRelation: "titles";
            referencedColumns: ["title_id"];
          },
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
      title_credits: {
        Row: {
          id: number;
          title_id: string;
          person_id: number;
          job: string | null;
          character: string | null;
          order: number | null;
        };
        Insert: {
          id?: number;
          title_id: string;
          person_id: number;
          job?: string | null;
          character?: string | null;
          order?: number | null;
        };
        Update: {
          id?: number;
          title_id?: string;
          person_id?: number;
          job?: string | null;
          character?: string | null;
          order?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "title_credits_person_id_fkey";
            columns: ["person_id"];
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "title_credits_title_id_fkey";
            columns: ["title_id"];
            referencedRelation: "titles";
            referencedColumns: ["title_id"];
          },
        ];
      };
      episode_progress: {
        Row: {
          user_id: string;
          episode_id: string;
          status: "watched" | "skipped";
          watched_at: string;
        };
        Insert: {
          user_id: string;
          episode_id: string;
          status?: "watched" | "skipped";
          watched_at?: string;
        };
        Update: {
          user_id?: string;
          episode_id?: string;
          status?: "watched" | "skipped";
          watched_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "episode_progress_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "episode_progress_episode_id_fkey";
            columns: ["episode_id"];
            referencedRelation: "episodes";
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
          {
            foreignKeyName: "user_title_tags_title_id_fkey";
            columns: ["title_id"];
            referencedRelation: "titles";
            referencedColumns: ["title_id"];
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
      user_settings: {
        Row: {
          user_id: string;
          email_notifications: boolean;
          push_notifications: boolean;
          privacy_profile: "public" | "followers_only" | "private";
          privacy_activity: "public" | "followers_only" | "private";
          privacy_lists: "public" | "followers_only" | "private";
          updated_at: string;
        };
        Insert: {
          user_id: string;
          email_notifications?: boolean;
          push_notifications?: boolean;
          privacy_profile?: "public" | "followers_only" | "private";
          privacy_activity?: "public" | "followers_only" | "private";
          privacy_lists?: "public" | "followers_only" | "private";
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          email_notifications?: boolean;
          push_notifications?: boolean;
          privacy_profile?: "public" | "followers_only" | "private";
          privacy_activity?: "public" | "followers_only" | "private";
          privacy_lists?: "public" | "followers_only" | "private";
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
      reports: {
        Row: {
          id: string;
          reporter_id: string;
          target_type: string;
          target_id: string;
          reason: string | null;
          status: "open" | "in_review" | "resolved" | "dismissed";
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
          status?: "open" | "in_review" | "resolved" | "dismissed";
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
          status?: "open" | "in_review" | "resolved" | "dismissed";
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
        };
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
      episode_status: "watched" | "skipped";
      library_status: "want_to_watch" | "watching" | "watched" | "dropped";
      participant_role: "member" | "admin" | "owner";
      privacy_level: "public" | "followers_only" | "private";
      report_status: "open" | "in_review" | "resolved" | "dismissed";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
