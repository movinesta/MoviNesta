-- Scalability Phase 1: Data Retention Policies
-- Automatic cleanup of old data to control storage growth

BEGIN;

-----------------------------------------------------------------------
-- 1. Function to delete old media_events partitions (>90 days)
-----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_old_media_events_partitions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    partition_record record;
    cutoff_date date;
    deleted_count integer := 0;
BEGIN
    cutoff_date := (now() - interval '90 days')::date;
    
    FOR partition_record IN
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
          AND tablename LIKE 'media_events_20%'
          AND tablename != 'media_events_default'
    LOOP
        -- Extract date from partition name (media_events_YYYY_MM)
        IF partition_record.tablename ~ '^media_events_[0-9]{4}_[0-9]{2}$' THEN
            IF to_date(replace(partition_record.tablename, 'media_events_', ''), 'YYYY_MM') < cutoff_date THEN
                EXECUTE format('DROP TABLE IF EXISTS public.%I', partition_record.tablename);
                deleted_count := deleted_count + 1;
            END IF;
        END IF;
    END LOOP;
    
    RETURN deleted_count;
END;
$$;

-----------------------------------------------------------------------
-- 2. Function to delete old rec_impressions partitions (>30 days)
-----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_old_rec_impressions_partitions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    partition_record record;
    cutoff_date date;
    deleted_count integer := 0;
BEGIN
    cutoff_date := (now() - interval '30 days')::date;
    
    FOR partition_record IN
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
          AND tablename LIKE 'rec_impressions_20%'
          AND tablename != 'rec_impressions_default'
    LOOP
        IF partition_record.tablename ~ '^rec_impressions_[0-9]{4}_[0-9]{2}$' THEN
            IF to_date(replace(partition_record.tablename, 'rec_impressions_', ''), 'YYYY_MM') < cutoff_date THEN
                EXECUTE format('DROP TABLE IF EXISTS public.%I', partition_record.tablename);
                deleted_count := deleted_count + 1;
            END IF;
        END IF;
    END LOOP;
    
    RETURN deleted_count;
END;
$$;

-----------------------------------------------------------------------
-- 3. Cleanup old notifications (read >30d, unread >90d)
-----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count integer;
BEGIN
    WITH deleted AS (
        DELETE FROM public.notifications
        WHERE 
            (is_read AND created_at < now() - interval '30 days')
            OR (NOT is_read AND created_at < now() - interval '90 days')
        RETURNING id
    )
    SELECT count(*) INTO deleted_count FROM deleted;
    
    RETURN deleted_count;
END;
$$;

-----------------------------------------------------------------------
-- 4. Cleanup stale session vectors (>24h)
-----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_stale_session_vectors()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count integer;
BEGIN
    WITH deleted AS (
        DELETE FROM public.media_session_vectors
        WHERE updated_at < now() - interval '24 hours'
        RETURNING user_id
    )
    SELECT count(*) INTO deleted_count FROM deleted;
    
    RETURN deleted_count;
END;
$$;

-----------------------------------------------------------------------
-- 5. Combined maintenance function (call from cron)
-----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.run_data_retention_cleanup()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result jsonb;
BEGIN
    result := jsonb_build_object(
        'notifications_deleted', public.cleanup_old_notifications(),
        'session_vectors_deleted', public.cleanup_stale_session_vectors(),
        'ran_at', now()
    );
    
    -- Also ensure next month's partitions exist
    PERFORM public.create_media_events_partition_if_needed();
    
    RETURN result;
END;
$$;

-----------------------------------------------------------------------
-- 6. Register in cron registry (if using pg_cron)
-----------------------------------------------------------------------
-- Run daily at 3 AM UTC:
-- SELECT cron.schedule('data-retention-cleanup', '0 3 * * *', 'SELECT public.run_data_retention_cleanup()');

COMMIT;
