-- Migration: 20260116235900_security_audit_fixes.sql
-- Description: Enable Row Level Security (RLS) and define access policies for tables flagged by security linter.

BEGIN;

-----------------------------------------------------------------------
-- 1. System and Cache Tables
-- These tables should only be accessible by the service_role (internal).
-- Enabling RLS without adding any public/authenticated policies effectively
-- locks them down to the service_role, which bypasses RLS.
-----------------------------------------------------------------------
ALTER TABLE public.external_api_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_metadata_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-----------------------------------------------------------------------
-- 2. Media Embeddings
-- Authenticated users need to read embeddings for similarity searches.
-----------------------------------------------------------------------
ALTER TABLE public.media_embeddings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Embeddings are viewable by authenticated users" ON public.media_embeddings;
CREATE POLICY "Embeddings are viewable by authenticated users" 
    ON public.media_embeddings FOR SELECT 
    USING (auth.role() = 'authenticated');

-----------------------------------------------------------------------
-- 3. Media Events (Partitioned Table)
-- Users should only be able to see and insert their own events.
-----------------------------------------------------------------------
ALTER TABLE public.media_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own events" ON public.media_events;
CREATE POLICY "Users can insert their own events" 
    ON public.media_events FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own events" ON public.media_events;
CREATE POLICY "Users can view their own events" 
    ON public.media_events FOR SELECT 
    USING (auth.uid() = user_id);

-----------------------------------------------------------------------
-- 4. Recommendation Impressions (Partitioned Table)
-- Users should only be able to see and insert their own impressions.
-----------------------------------------------------------------------
ALTER TABLE public.rec_impressions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own impressions" ON public.rec_impressions;
CREATE POLICY "Users can insert their own impressions" 
    ON public.rec_impressions FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own impressions" ON public.rec_impressions;
CREATE POLICY "Users can view their own impressions" 
    ON public.rec_impressions FOR SELECT 
    USING (auth.uid() = user_id);

-----------------------------------------------------------------------
-- 5. Enable RLS on all existing partitions
-- Partitions in PostgreSQL must also have RLS enabled.
-----------------------------------------------------------------------
DO $$
DECLARE
    partition_name text;
BEGIN
    FOR partition_name IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND (tablename LIKE 'media_events_%' OR tablename LIKE 'rec_impressions_%')
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', partition_name);
    END LOOP;
END $$;

COMMIT;
