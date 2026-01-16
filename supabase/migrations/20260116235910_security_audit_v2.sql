-- Migration: 20260116235910_security_audit_v2.sql
-- Description: Fix mutable search paths for functions and restrict public access to materialized views.

BEGIN;

-----------------------------------------------------------------------
-- 1. Fix Mutable Search Paths for Maintenance Functions
-- Setting an explicit search_path prevents search path hijacking.
-----------------------------------------------------------------------

-- Functions from scheduled_maintenance.sql
ALTER FUNCTION public.run_scheduled_maintenance() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.refresh_trending_hourly() SET search_path = public, extensions, pg_temp;

-- Functions from retention_policies.sql
ALTER FUNCTION public.cleanup_old_media_events_partitions() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.cleanup_old_rec_impressions_partitions() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.cleanup_old_notifications() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.cleanup_stale_session_vectors() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.run_data_retention_cleanup() SET search_path = public, extensions, pg_temp;

-- Functions from partition migrations
ALTER FUNCTION public.create_media_events_partition_if_needed() SET search_path = public, extensions, pg_temp;

-- Functions from materialized_views.sql
ALTER FUNCTION public.refresh_user_stats_mv() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.refresh_media_trending_mv() SET search_path = public, extensions, pg_temp;

-----------------------------------------------------------------------
-- 2. Restrict Direct Access to Materialized Views
-- These views are meant for internal metrics or pre-computation.
-- To expose them securely, wrap them in SECURITY DEFINER RPCs.
-----------------------------------------------------------------------

REVOKE ALL ON public.user_stats_mv FROM public;
REVOKE ALL ON public.user_stats_mv FROM anon;
REVOKE ALL ON public.user_stats_mv FROM authenticated;
GRANT SELECT ON public.user_stats_mv TO service_role;

REVOKE ALL ON public.media_trending_mv FROM public;
REVOKE ALL ON public.media_trending_mv FROM anon;
REVOKE ALL ON public.media_trending_mv FROM authenticated;
GRANT SELECT ON public.media_trending_mv TO service_role;

COMMIT;
