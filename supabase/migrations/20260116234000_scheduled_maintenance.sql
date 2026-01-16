-- Scalability Phase 2: Scheduled Maintenance Jobs
-- Configures pg_cron for automated maintenance

BEGIN;

-----------------------------------------------------------------------
-- 1. Register maintenance jobs (requires pg_cron extension)
-----------------------------------------------------------------------

-- Enable pg_cron if not already enabled
-- Note: This requires Supabase Pro plan or higher
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-----------------------------------------------------------------------
-- 2. Master scheduler function
-----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.run_scheduled_maintenance()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result jsonb := '{}';
    retention_result jsonb;
BEGIN
    -- 1. Data retention cleanup
    retention_result := public.run_data_retention_cleanup();
    result := result || jsonb_build_object('retention', retention_result);
    
    -- 2. Refresh materialized views
    PERFORM public.refresh_user_stats_mv();
    result := result || jsonb_build_object('user_stats_refreshed', true);
    
    PERFORM public.refresh_media_trending_mv();
    result := result || jsonb_build_object('media_trending_refreshed', true);
    
    -- 3. Create next month's partitions
    PERFORM public.create_media_events_partition_if_needed();
    result := result || jsonb_build_object('partitions_checked', true);
    
    -- 4. Vacuum analyze high-churn tables
    -- Note: VACUUM ANALYZE runs automatically but we force it for key tables
    ANALYZE public.media_events;
    ANALYZE public.rec_impressions;
    ANALYZE public.notifications;
    result := result || jsonb_build_object('analyze_ran', true);
    
    result := result || jsonb_build_object('completed_at', now());
    
    -- Log the run
    INSERT INTO public.job_run_log (job_name, status, details, ran_at)
    VALUES ('scheduled_maintenance', 'success', result, now())
    ON CONFLICT DO NOTHING;
    
    RETURN result;
EXCEPTION WHEN OTHERS THEN
    -- Log failure
    INSERT INTO public.job_run_log (job_name, status, details, ran_at)
    VALUES ('scheduled_maintenance', 'error', jsonb_build_object('error', SQLERRM), now())
    ON CONFLICT DO NOTHING;
    RAISE;
END;
$$;

-----------------------------------------------------------------------
-- 3. Individual refresh functions for hourly jobs
-----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refresh_trending_hourly()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    PERFORM public.refresh_media_trending_mv();
END;
$$;

-----------------------------------------------------------------------
-- 4. Cron schedule commands (run these manually or via Supabase dashboard)
-----------------------------------------------------------------------

-- Daily maintenance at 3 AM UTC
-- SELECT cron.schedule('daily-maintenance', '0 3 * * *', 'SELECT public.run_scheduled_maintenance()');

-- Hourly trending refresh
-- SELECT cron.schedule('hourly-trending', '0 * * * *', 'SELECT public.refresh_trending_hourly()');

-- Weekly full vacuum (Sunday 4 AM UTC) - requires superuser
-- SELECT cron.schedule('weekly-vacuum', '0 4 * * 0', 'VACUUM ANALYZE');

COMMIT;
