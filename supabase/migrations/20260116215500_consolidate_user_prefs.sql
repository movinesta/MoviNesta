-- Migration: Consolidate User Preferences
-- Description: Merges 5 separate preference tables into a single 'user_preferences' table with JSONB columns.

BEGIN;

--------------------------------------------------------------------------------
-- 1. Create new table: public.user_preferences
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_preferences (
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Consolidated preference domains
    assistant jsonb DEFAULT '{}'::jsonb NOT NULL,      -- was assistant_prefs
    notifications jsonb DEFAULT '{}'::jsonb NOT NULL,  -- was notification_preferences
    recsys jsonb DEFAULT '{}'::jsonb NOT NULL,         -- was recsys_user_prefs
    swipe jsonb DEFAULT '{}'::jsonb NOT NULL,          -- was user_swipe_prefs
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,       -- was user_settings
    
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_preferences_pkey PRIMARY KEY (user_id)
);

-- Add comment
COMMENT ON TABLE public.user_preferences IS 'Consolidated user preferences (Assistant, Notifications, RecSys, etc).';

-- Create RLS policies (simple owner access)
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own preferences" ON public.user_preferences;
CREATE POLICY "Users can view their own preferences" 
    ON public.user_preferences FOR SELECT 
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own preferences" ON public.user_preferences;
CREATE POLICY "Users can update their own preferences" 
    ON public.user_preferences FOR UPDATE 
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own preferences" ON public.user_preferences;
CREATE POLICY "Users can insert their own preferences" 
    ON public.user_preferences FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

--------------------------------------------------------------------------------
-- 2. Drop old tables (DATA WILL BE LOST per plan)
--------------------------------------------------------------------------------
DROP TABLE IF EXISTS public.assistant_prefs CASCADE;
DROP TABLE IF EXISTS public.notification_preferences CASCADE;
DROP TABLE IF EXISTS public.recsys_user_prefs CASCADE;
DROP TABLE IF EXISTS public.user_swipe_prefs CASCADE;
DROP TABLE IF EXISTS public.user_settings CASCADE;

COMMIT;
