-- Phase 3: Consolidate Media & RecSys Tables
-- Merges rec_outcomes into media_events and drops media_served (redundant with rec_impressions)
-- Safe to run: No production data exists

BEGIN;

-----------------------------------------------------------------------
-- 1. Drop rec_outcomes table (schema nearly identical to media_events)
-----------------------------------------------------------------------
-- The rec_outcomes table duplicates media_events structure.
-- Going forward, all outcomes are logged via media_events with rec_request_id populated.

DROP TABLE IF EXISTS public.rec_outcomes CASCADE;

-----------------------------------------------------------------------
-- 2. Drop media_served table (superseded by rec_impressions)
-----------------------------------------------------------------------
-- media_served has only (user_id, media_item_id, served_at)
-- rec_impressions is more detailed and serves the same purpose

DROP TABLE IF EXISTS public.media_served CASCADE;

-----------------------------------------------------------------------
-- 3. Update media_swipe_deck_v3_core to use rec_impressions instead of media_served
-- (This is handled in a separate migration file for the RPC)
-----------------------------------------------------------------------

COMMIT;

-- Note: Code references to these tables must be refactored before applying this migration:
-- - Edge Functions: Scan for "rec_outcomes" and "media_served" usage
-- - SQL Functions: media_swipe_deck_v3_core uses media_served for 30-minute suppression
