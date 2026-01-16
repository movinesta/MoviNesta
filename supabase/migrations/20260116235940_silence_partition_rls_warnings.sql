-- Migration: 20260116235940_silence_partition_rls_warnings.sql
-- Description: Explicitly apply RLS policies to partitions to satisfy Supabase security linter.

BEGIN;

-----------------------------------------------------------------------
-- 1. Explicitly apply policies to partitions
-- Even though PostgreSQL inherits parent policies, the Supabase audit
-- requires explicit declaration to clear "RLS Enabled No Policy" warnings.
-----------------------------------------------------------------------

DO $$
DECLARE
    partition_name text;
BEGIN
    -- Fix media_events partitions
    FOR partition_name IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND (tablename LIKE 'media_events_%' OR tablename = 'media_events_default')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Partition users can insert" ON public.%I', partition_name);
        EXECUTE format('CREATE POLICY "Partition users can insert" ON public.%I FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()))', partition_name);
        
        EXECUTE format('DROP POLICY IF EXISTS "Partition users can view" ON public.%I', partition_name);
        EXECUTE format('CREATE POLICY "Partition users can view" ON public.%I FOR SELECT USING (user_id = (SELECT auth.uid()))', partition_name);
    END LOOP;

    -- Fix rec_impressions partitions
    FOR partition_name IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND (tablename LIKE 'rec_impressions_%' OR tablename = 'rec_impressions_default')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Partition users can insert" ON public.%I', partition_name);
        EXECUTE format('CREATE POLICY "Partition users can insert" ON public.%I FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()))', partition_name);
        
        EXECUTE format('DROP POLICY IF EXISTS "Partition users can view" ON public.%I', partition_name);
        EXECUTE format('CREATE POLICY "Partition users can view" ON public.%I FOR SELECT USING (user_id = (SELECT auth.uid()))', partition_name);
    END LOOP;
END $$;

COMMIT;
