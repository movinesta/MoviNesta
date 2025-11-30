export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      activity_events: {
        Row: {
          created_at: string;
          event_type: Database["public"]["Enums"]["activity_event_type"];
          id: string;
          payload: Json | null;
          related_user_id: string | null;
          title_id: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          event_type: Database["public"]["Enums"]["activity_event_type"];
          id?: string;
          payload?: Json | null;
          related_user_id?: string | null;
          title_id?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          event_type?: Database["public"]["Enums"]["activity_event_type"];
          id?: string;
          payload?: Json | null;
          related_user_id?: string | null;
          title_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "activity_events_related_user_id_fkey";
            columns: ["related_user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activity_events_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      blocked_users: {
        Row: {
          blocked_id: string;
          blocker_id: string;
          created_at: string;
        };
        Insert: {
          blocked_id: string;
          blocker_id: string;
          created_at?: string;
        };
        Update: {
          blocked_id?: string;
          blocker_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "blocked_users_blocked_id_fkey";
            columns: ["blocked_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "blocked_users_blocker_id_fkey";
            columns: ["blocker_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      conversation_participants: {
        Row: {
          conversation_id: string;
          created_at: string;
          role: Database["public"]["Enums"]["participant_role"];
          user_id: string;
        };
        Insert: {
          conversation_id: string;
          created_at?: string;
          role?: Database["public"]["Enums"]["participant_role"];
          user_id: string;
        };
        Update: {
          conversation_id?: string;
          created_at?: string;
          role?: Database["public"]["Enums"]["participant_role"];
          user_id?: string;
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
          created_at: string;
          created_by: string | null;
          id: string;
          is_group: boolean;
          title: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_group?: boolean;
          title?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_group?: boolean;
          title?: string | null;
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
      follows: {
        Row: {
          followed_id: string;
          follower_id: string;
          created_at: string;
        };
        Insert: {
          followed_id: string;
          follower_id: string;
          created_at?: string;
        };
        Update: {
          followed_id?: string;
          follower_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "follows_followed_id_fkey";
            columns: ["followed_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "follows_follower_id_fkey";
            columns: ["follower_id"];
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
          completed_at: string | null;
          content_type: Database["public"]["Enums"]["content_type"];
          created_at: string;
          id: string;
          notes: string | null;
          started_at: string | null;
          status: Database["public"]["Enums"]["library_status"];
          title_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          completed_at?: string | null;
          content_type: Database["public"]["Enums"]["content_type"];
          created_at?: string;
          id?: string;
          notes?: string | null;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["library_status"];
          title_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          completed_at?: string | null;
          content_type?: Database["public"]["Enums"]["content_type"];
          created_at?: string;
          id?: string;
          notes?: string | null;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["library_status"];
          title_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "library_entries_title_id_fkey";
            columns: ["title_id"];
            referencedRelation: "titles";
            referencedColumns: ["title_id"];
          },
          {
            foreignKeyName: "library_entries_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      message_delivery_receipts: {
        Row: {
          conversation_id: string;
          created_at: string;
          delivered_at: string;
          id: string;
          message_id: string;
          user_id: string;
        };
        Insert: {
          conversation_id: string;
          created_at?: string;
          delivered_at?: string;
          id?: string;
          message_id: string;
          user_id: string;
        };
        Update: {
          conversation_id?: string;
          created_at?: string;
          delivered_at?: string;
          id?: string;
          message_id?: string;
          user_id?: string;
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
          last_read_at: string;
          last_read_message_id: string | null;
          user_id: string;
        };
        Insert: {
          conversation_id: string;
          last_read_at?: string;
          last_read_message_id?: string | null;
          user_id: string;
        };
        Update: {
          conversation_id?: string;
          last_read_at?: string;
          last_read_message_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "message_read_receipts_conversation_id_fkey";
            columns: ["conversation_id"];
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_read_receipts_last_read_message_id_fkey";
            columns: ["last_read_message_id"];
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_read_receipts_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      message_reactions: {
        Row: {
          conversation_id: string;
          created_at: string;
          emoji: string;
          id: string;
          message_id: string;
          user_id: string;
        };
        Insert: {
          conversation_id: string;
          created_at?: string;
          emoji: string;
          id?: string;
          message_id: string;
          user_id: string;
        };
        Update: {
          conversation_id?: string;
          created_at?: string;
          emoji?: string;
          id?: string;
          message_id?: string;
          user_id?: string;
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
      messages: {
        Row: {
          attachment_url: string | null;
          body: string;
          conversation_id: string;
          created_at: string;
          id: string;
          user_id: string;
        };
        Insert: {
          attachment_url?: string | null;
          body: string;
          conversation_id: string;
          created_at?: string;
          id?: string;
          user_id: string;
        };
        Update: {
          attachment_url?: string | null;
          body?: string;
          conversation_id?: string;
          created_at?: string;
          id?: string;
          user_id?: string;
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
      profiles: {
        Row: {
          avatar_url: string | null;
          bio: string | null;
          created_at: string;
          display_name: string | null;
          email: string;
          id: string;
          updated_at: string;
          username: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          display_name?: string | null;
          email: string;
          id: string;
          updated_at?: string;
          username?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          display_name?: string | null;
          email?: string;
          id?: string;
          updated_at?: string;
          username?: string | null;
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
          comment: string | null;
          content_type: Database["public"]["Enums"]["content_type"];
          created_at: string;
          id: string;
          rating: number;
          title_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          comment?: string | null;
          content_type: Database["public"]["Enums"]["content_type"];
          created_at?: string;
          id?: string;
          rating: number;
          title_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          comment?: string | null;
          content_type?: Database["public"]["Enums"]["content_type"];
          created_at?: string;
          id?: string;
          rating?: number;
          title_id?: string;
          updated_at?: string;
          user_id?: string;
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
      title_genres: {
        Row: {
          genre_id: number;
          title_id: string;
        };
        Insert: {
          genre_id: number;
          title_id: string;
        };
        Update: {
          genre_id?: number;
          title_id?: string;
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
      titles: {
        Row: {
          backdrop_url: string | null;
          content_type: Database["public"]["Enums"]["content_type"];
          country: string | null;
          created_at: string;
          data_source: string | null;
          deleted_at: string | null;
          genres: string[] | null;
          imdb_rating: number | null;
          imdb_votes: number | null;
          is_adult: boolean | null;
          language: string | null;
          metascore: number | null;
          omdb_actors: string | null;
          omdb_awards: string | null;
          omdb_box_office: number | null;
          omdb_box_office_str: string | null;
          omdb_country: string | null;
          omdb_director: string | null;
          omdb_dvd: string | null;
          omdb_genre: string | null;
          omdb_imdb_id: string | null;
          omdb_language: string | null;
          omdb_plot: string | null;
          omdb_poster: string | null;
          omdb_production: string | null;
          omdb_rated: string | null;
          omdb_released: string | null;
          omdb_response: string | null;
          omdb_response_ok: boolean | null;
          omdb_runtime: string | null;
          omdb_rt_rating_pct: number | null;
          omdb_type: string | null;
          omdb_website: string | null;
          omdb_writer: string | null;
          original_title: string | null;
          plot: string | null;
          poster_url: string | null;
          primary_title: string | null;
          raw_payload: Json | null;
          release_date: string | null;
          release_year: number | null;
          runtime_minutes: number | null;
          sort_title: string | null;
          source_priority: number | null;
          tagline: string | null;
          title_id: string;
          tmdb_adult: boolean | null;
          tmdb_backdrop_path: string | null;
          tmdb_genre_ids: number[] | null;
          tmdb_id: number | null;
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
          updated_at: string;
          youtube_trailer_published_at: string | null;
          youtube_trailer_thumb_url: string | null;
          youtube_trailer_title: string | null;
          youtube_trailer_video_id: string | null;
        };
        Insert: {
          backdrop_url?: string | null;
          content_type: Database["public"]["Enums"]["content_type"];
          country?: string | null;
          created_at?: string;
          data_source?: string | null;
          deleted_at?: string | null;
          genres?: string[] | null;
          imdb_rating?: number | null;
          imdb_votes?: number | null;
          is_adult?: boolean | null;
          language?: string | null;
          metascore?: number | null;
          omdb_actors?: string | null;
          omdb_awards?: string | null;
          omdb_box_office?: number | null;
          omdb_box_office_str?: string | null;
          omdb_country?: string | null;
          omdb_director?: string | null;
          omdb_dvd?: string | null;
          omdb_genre?: string | null;
          omdb_imdb_id?: string | null;
          omdb_language?: string | null;
          omdb_plot?: string | null;
          omdb_poster?: string | null;
          omdb_production?: string | null;
          omdb_rated?: string | null;
          omdb_released?: string | null;
          omdb_response?: string | null;
          omdb_response_ok?: boolean | null;
          omdb_runtime?: string | null;
          omdb_rt_rating_pct?: number | null;
          omdb_type?: string | null;
          omdb_website?: string | null;
          omdb_writer?: string | null;
          original_title?: string | null;
          plot?: string | null;
          poster_url?: string | null;
          primary_title?: string | null;
          raw_payload?: Json | null;
          release_date?: string | null;
          release_year?: number | null;
          runtime_minutes?: number | null;
          sort_title?: string | null;
          source_priority?: number | null;
          tagline?: string | null;
          title_id?: string;
          tmdb_adult?: boolean | null;
          tmdb_backdrop_path?: string | null;
          tmdb_genre_ids?: number[] | null;
          tmdb_id?: number | null;
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
          updated_at?: string;
          youtube_trailer_published_at?: string | null;
          youtube_trailer_thumb_url?: string | null;
          youtube_trailer_title?: string | null;
          youtube_trailer_video_id?: string | null;
        };
        Update: {
          backdrop_url?: string | null;
          content_type?: Database["public"]["Enums"]["content_type"];
          country?: string | null;
          created_at?: string;
          data_source?: string | null;
          deleted_at?: string | null;
          genres?: string[] | null;
          imdb_rating?: number | null;
          imdb_votes?: number | null;
          is_adult?: boolean | null;
          language?: string | null;
          metascore?: number | null;
          omdb_actors?: string | null;
          omdb_awards?: string | null;
          omdb_box_office?: number | null;
          omdb_box_office_str?: string | null;
          omdb_country?: string | null;
          omdb_director?: string | null;
          omdb_dvd?: string | null;
          omdb_genre?: string | null;
          omdb_imdb_id?: string | null;
          omdb_language?: string | null;
          omdb_plot?: string | null;
          omdb_poster?: string | null;
          omdb_production?: string | null;
          omdb_rated?: string | null;
          omdb_released?: string | null;
          omdb_response?: string | null;
          omdb_response_ok?: boolean | null;
          omdb_runtime?: string | null;
          omdb_rt_rating_pct?: number | null;
          omdb_type?: string | null;
          omdb_website?: string | null;
          omdb_writer?: string | null;
          original_title?: string | null;
          plot?: string | null;
          poster_url?: string | null;
          primary_title?: string | null;
          raw_payload?: Json | null;
          release_date?: string | null;
          release_year?: number | null;
          runtime_minutes?: number | null;
          sort_title?: string | null;
          source_priority?: number | null;
          tagline?: string | null;
          title_id?: string;
          tmdb_adult?: boolean | null;
          tmdb_backdrop_path?: string | null;
          tmdb_genre_ids?: number[] | null;
          tmdb_id?: number | null;
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
          updated_at?: string;
          youtube_trailer_published_at?: string | null;
          youtube_trailer_thumb_url?: string | null;
          youtube_trailer_title?: string | null;
          youtube_trailer_video_id?: string | null;
        };
        Relationships: [];
      };
      user_stats: {
        Row: {
          comments_count: number | null;
          followers_count: number | null;
          following_count: number | null;
          last_active_at: string | null;
          lists_count: number | null;
          messages_sent_count: number | null;
          ratings_count: number | null;
          reviews_count: number | null;
          user_id: string;
          watchlist_count: number | null;
        };
        Insert: {
          comments_count?: number | null;
          followers_count?: number | null;
          following_count?: number | null;
          last_active_at?: string | null;
          lists_count?: number | null;
          messages_sent_count?: number | null;
          ratings_count?: number | null;
          reviews_count?: number | null;
          user_id: string;
          watchlist_count?: number | null;
        };
        Update: {
          comments_count?: number | null;
          followers_count?: number | null;
          following_count?: number | null;
          last_active_at?: string | null;
          lists_count?: number | null;
          messages_sent_count?: number | null;
          ratings_count?: number | null;
          reviews_count?: number | null;
          user_id?: string;
          watchlist_count?: number | null;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      activity_event_type:
        | "rating_created"
        | "review_created"
        | "watchlist_added"
        | "watchlist_removed"
        | "follow_created"
        | "comment_created"
        | "reply_created"
        | "list_created"
        | "list_item_added"
        | "message_sent";
      content_type: "movie" | "series" | "anime";
      episode_status: "watching" | "watched" | "skipped";
      library_status: "want_to_watch" | "watching" | "watched" | "dropped";
      participant_role: "member" | "admin" | "owner";
    };
    CompositeTypes: Record<string, never>;
  };
}
