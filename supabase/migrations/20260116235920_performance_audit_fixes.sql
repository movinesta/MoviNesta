-- Migration: 20260116235920_performance_audit_fixes.sql
-- Description: Optimize RLS performance and prune duplicate indexes.

BEGIN;

-----------------------------------------------------------------------
-- 1. Optimize RLS Policies (auth_rls_initplan)
-- Wrapping auth.uid() and auth.role() in (SELECT ...) prevents
-- re-evaluation for every row, improving performance at scale.
-----------------------------------------------------------------------

-- user_preferences
DROP POLICY IF EXISTS "Users can view their own preferences" ON public.user_preferences;
CREATE POLICY "Users can view their own preferences" 
    ON public.user_preferences FOR SELECT 
    USING (auth.uid() = user_id);
-- Re-applying with performance fix
ALTER POLICY "Users can view their own preferences" ON public.user_preferences 
    USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update their own preferences" ON public.user_preferences;
CREATE POLICY "Users can update their own preferences" 
    ON public.user_preferences FOR UPDATE 
    USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own preferences" ON public.user_preferences;
CREATE POLICY "Users can insert their own preferences" 
    ON public.user_preferences FOR INSERT 
    WITH CHECK (user_id = (SELECT auth.uid()));

-- media_embeddings
DROP POLICY IF EXISTS "Embeddings are viewable by authenticated users" ON public.media_embeddings;
CREATE POLICY "Embeddings are viewable by authenticated users" 
    ON public.media_embeddings FOR SELECT 
    USING ((SELECT auth.role()) = 'authenticated');

-- media_events (parent table policies apply to partitions)
DROP POLICY IF EXISTS "Users can insert their own events" ON public.media_events;
CREATE POLICY "Users can insert their own events" 
    ON public.media_events FOR INSERT 
    WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can view their own events" ON public.media_events;
CREATE POLICY "Users can view their own events" 
    ON public.media_events FOR SELECT 
    USING (user_id = (SELECT auth.uid()));

-- rec_impressions (parent table policies apply to partitions)
DROP POLICY IF EXISTS "Users can insert their own impressions" ON public.rec_impressions;
CREATE POLICY "Users can insert their own impressions" 
    ON public.rec_impressions FOR INSERT 
    WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can view their own impressions" ON public.rec_impressions;
CREATE POLICY "Users can view their own impressions" 
    ON public.rec_impressions FOR SELECT 
    USING (user_id = (SELECT auth.uid()));

-----------------------------------------------------------------------
-- 2. Internal Cache Security (rls_enabled_no_policy)
-- Adding explicit "deny all" for public/authenticated to silence linter
-- and document that only service_role (which bypasses RLS) can access these.
-----------------------------------------------------------------------
DROP POLICY IF EXISTS "Internal only" ON public.external_api_cache;
CREATE POLICY "Internal only" ON public.external_api_cache FOR ALL USING (false);

DROP POLICY IF EXISTS "Internal only" ON public.media_metadata_cache;
CREATE POLICY "Internal only" ON public.media_metadata_cache FOR ALL USING (false);

DROP POLICY IF EXISTS "Internal only" ON public.rate_limits;
CREATE POLICY "Internal only" ON public.rate_limits FOR ALL USING (false);

-----------------------------------------------------------------------
-- 3. Prune Duplicate Indexes
-- Removing redundant indexes identified by the linter.
-----------------------------------------------------------------------

-- media_trending_mv duplicate indexes
DROP INDEX IF EXISTS public.media_trending_mv_wilson_score_idx1;
DROP INDEX IF EXISTS public.media_trending_mv_wilson_score_idx2;
DROP INDEX IF EXISTS public.media_trending_mv_wilson_score_idx3;
DROP INDEX IF EXISTS public.media_trending_mv_wilson_score_idx4;
DROP INDEX IF EXISTS public.media_trending_mv_wilson_score_idx5;

DROP INDEX IF EXISTS public.media_trending_mv_media_item_id_idx1;
DROP INDEX IF EXISTS public.media_trending_mv_media_item_id_idx2;
DROP INDEX IF EXISTS public.media_trending_mv_media_item_id_idx3;
DROP INDEX IF EXISTS public.media_trending_mv_media_item_id_idx4;
DROP INDEX IF EXISTS public.media_trending_mv_media_item_id_idx5;

-- user_stats_mv duplicate indexes
DROP INDEX IF EXISTS public.user_stats_mv_user_id_idx1;
DROP INDEX IF EXISTS public.user_stats_mv_user_id_idx2;
DROP INDEX IF EXISTS public.user_stats_mv_user_id_idx3;
DROP INDEX IF EXISTS public.user_stats_mv_user_id_idx4;
DROP INDEX IF EXISTS public.user_stats_mv_user_id_idx5;

-- follows duplicate indexes
-- follows_followed_id_idx and idx_follows_followed are identical
DROP INDEX IF EXISTS public.follows_followed_id_idx;

-- messages duplicate indexes
-- idx_messages_conversation_time and messages_conversation_id_created_at_idx are identical
DROP INDEX IF EXISTS public.messages_conversation_id_created_at_idx;

-- notifications duplicate indexes
-- idx_notifications_user_unread and notifications_user_unread_created_at_idx are identical
DROP INDEX IF EXISTS public.notifications_user_unread_created_at_idx;

COMMIT;
