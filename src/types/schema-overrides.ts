import { Database as BaseDatabase } from "./supabase";

/**
 * MoviNesta Schema Overrides
 *
 * This file provides forward-compatible types for the consolidated schema.
 * After running `supabase gen types`, these overrides can eventually be removed,
 * but they are necessary during the transition from Tables to Views (e.g., profiles_public).
 */

export type Database = BaseDatabase;

// Profiles Public (Transitioned from Table to View)
export type ProfilePublicRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_verified: boolean;
  verified_type: Database["public"]["Enums"]["verification_badge_type"] | null;
  verified_label: string | null;
  verified_at: string | null;
  verified_by_org: string | null;
  updated_at?: string;
};

// User Preferences (Fixed JSONB structure)
export type UserPreferencesRow = {
  user_id: string;
  assistant: Record<string, any>;
  notifications: Record<string, any>;
  recsys: Record<string, any>;
  swipe: Record<string, any>;
  settings: Record<string, any>;
  updated_at: string;
};

// External API Cache (New consolidated cache)
export type ExternalApiCacheRow = {
  key: string;
  provider: string;
  category: string;
  value: any;
  fetched_at: string;
  expires_at?: string | null;
};
