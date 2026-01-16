-- Migration: 20260116235930_final_audit_cleanup.sql
-- Description: Prune leftover duplicate indexes from multiple regeneration attempts.

BEGIN;

-----------------------------------------------------------------------
-- 1. Prune Remaining Duplicate Indexes
-----------------------------------------------------------------------

-- media_trending_mv leftover duplicates
DROP INDEX IF EXISTS public.media_trending_mv_wilson_score_idx6;
DROP INDEX IF EXISTS public.media_trending_mv_media_item_id_idx6;

-- user_stats_mv leftover duplicate
DROP INDEX IF EXISTS public.user_stats_mv_user_id_idx6;

-----------------------------------------------------------------------
-- 2. Global RLS Synchronization for Partitions
-- Ensures every current partition explicitly has RLS enabled.
-- (Note: Policies are inherited from the parent and don't need to be 
--  duplicated, which is why the linter might show INFO/WARN about 
--  "no policies", but the inheritance is functionally active.)
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
