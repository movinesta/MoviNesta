-- Scalability Phase 2: Index Optimization
-- Removes redundant indexes and adds missing ones for common queries

BEGIN;

-----------------------------------------------------------------------
-- 1. Remove redundant indexes on media_events
-- (Covered by partitioned table's implicit indexes)
-----------------------------------------------------------------------

-- These are now on partitions, not needed on parent
DROP INDEX IF EXISTS idx_media_events_dedupe;
DROP INDEX IF EXISTS media_events_client_event_id_idx;
DROP INDEX IF EXISTS media_events_created_at_idx;

-----------------------------------------------------------------------
-- 2. Add composite indexes for common query patterns
-----------------------------------------------------------------------

-- Fast lookup for swipe suppression (find recent dislikes)
CREATE INDEX IF NOT EXISTS idx_media_events_user_dislike_recent
    ON public.media_events (user_id, created_at DESC)
    WHERE event_type = 'dislike';

-- Fast lookup for watchlist state
CREATE INDEX IF NOT EXISTS idx_library_entries_user_status
    ON public.library_entries (user_id, status)
    INCLUDE (title_id);

-- Fast follower count
CREATE INDEX IF NOT EXISTS idx_follows_followed
    ON public.follows (followed_id);

-- Fast unread notification count
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
    ON public.notifications (user_id, created_at DESC)
    WHERE is_read = false;

-- Message search by conversation
CREATE INDEX IF NOT EXISTS idx_messages_conversation_time
    ON public.messages (conversation_id, created_at DESC);

-----------------------------------------------------------------------
-- 3. Add covering indexes for hot paths
-----------------------------------------------------------------------

-- Profile lookup (avoids table fetch for common fields)
CREATE INDEX IF NOT EXISTS idx_profiles_username_covering
    ON public.profiles (username)
    INCLUDE (id, display_name, avatar_url);

-- Media item basic info
CREATE INDEX IF NOT EXISTS idx_media_items_tmdb_covering
    ON public.media_items (tmdb_id, kind)
    INCLUDE (id, tmdb_title);

-----------------------------------------------------------------------
-- 4. Partial indexes for filtered queries
-----------------------------------------------------------------------

-- Only active library entries (not dropped)
CREATE INDEX IF NOT EXISTS idx_library_entries_active
    ON public.library_entries (user_id, updated_at DESC)
    WHERE status != 'dropped';

-- Only approved verifications
CREATE INDEX IF NOT EXISTS idx_profile_verifications_approved
    ON public.profile_verifications (user_id)
    WHERE status = 'approved';

-----------------------------------------------------------------------
-- 5. Analyze tables to update statistics
-----------------------------------------------------------------------
ANALYZE public.media_events;
ANALYZE public.library_entries;
ANALYZE public.profiles;
ANALYZE public.follows;
ANALYZE public.notifications;
ANALYZE public.messages;

COMMIT;
