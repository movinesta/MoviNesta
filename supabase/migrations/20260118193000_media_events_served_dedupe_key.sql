-- Session 19 (hotfix): add a stable served_dedupe_key to media_events.
--
-- Why:
--   media_events.dedupe_key is currently used as an *event-level* idempotency key.
--   To join outcomes back to the exact served item in rec_impressions we need a
--   stable per-served-item key in the format:
--     <rec_request_id>:<position>:<media_item_id>
--
--   We store that stable key in media_events.served_dedupe_key.

BEGIN;

ALTER TABLE public.media_events
  ADD COLUMN IF NOT EXISTS served_dedupe_key text;

CREATE INDEX IF NOT EXISTS media_events_user_served_dedupe_key_idx
  ON public.media_events (user_id, served_dedupe_key);

COMMIT;
