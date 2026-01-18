-- Session 20: Backfill + guardrails for media_events.served_dedupe_key
--
-- Goals:
--   1) Provide a safe backfill path for historical media_events rows that have
--      (rec_request_id, position, media_item_id) but missing served_dedupe_key.
--   2) Add online (NOT VALID) constraints so new rows cannot violate the
--      served key format / requirement when rec_request_id exists.
--   3) Add a service_role-only violations view to debug remaining bad rows.
--
-- Background:
--   * rec_impressions.dedupe_key uses the stable served identity format:
--       <rec_request_id>:<position>:<media_item_id>
--   * media_events.dedupe_key is an event-level idempotency key.
--   * We join outcomes to impressions via media_events.served_dedupe_key.

BEGIN;

-- 1) Backfill helpers (run manually, or from a secure admin job).
--
-- Updates at most p_max_rows rows per day to avoid long transactions.
CREATE OR REPLACE FUNCTION public.media_events_backfill_served_dedupe_key_for_day_v1(
  p_day date,
  p_max_rows integer DEFAULT 50000
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated bigint := 0;
BEGIN
  WITH candidates AS (
    SELECT id
    FROM public.media_events
    WHERE event_day = p_day
      AND served_dedupe_key IS NULL
      AND rec_request_id IS NOT NULL
      AND position IS NOT NULL
      AND media_item_id IS NOT NULL
    ORDER BY created_at ASC
    LIMIT GREATEST(p_max_rows, 0)
  )
  UPDATE public.media_events e
     SET served_dedupe_key = e.rec_request_id::text || ':' || e.position::text || ':' || e.media_item_id::text
    FROM candidates c
   WHERE e.id = c.id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.media_events_backfill_served_dedupe_key_for_day_v1(date, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.media_events_backfill_served_dedupe_key_for_day_v1(date, integer) TO service_role;

COMMENT ON FUNCTION public.media_events_backfill_served_dedupe_key_for_day_v1(date, integer)
  IS 'Backfill media_events.served_dedupe_key for a single event_day partition in bounded batches.';

-- Multi-day helper.
CREATE OR REPLACE FUNCTION public.media_events_backfill_served_dedupe_key_range_v1(
  p_start_day date,
  p_end_day date,
  p_max_rows_per_day integer DEFAULT 50000
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d date;
  v_total bigint := 0;
  v_n bigint;
BEGIN
  IF p_start_day IS NULL OR p_end_day IS NULL THEN
    RETURN 0;
  END IF;

  d := LEAST(p_start_day, p_end_day);
  WHILE d <= GREATEST(p_start_day, p_end_day) LOOP
    v_n := public.media_events_backfill_served_dedupe_key_for_day_v1(d, p_max_rows_per_day);
    v_total := v_total + COALESCE(v_n, 0);
    d := d + 1;
  END LOOP;

  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.media_events_backfill_served_dedupe_key_range_v1(date, date, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.media_events_backfill_served_dedupe_key_range_v1(date, date, integer) TO service_role;

COMMENT ON FUNCTION public.media_events_backfill_served_dedupe_key_range_v1(date, date, integer)
  IS 'Backfill media_events.served_dedupe_key for a date range (inclusive), bounded per-day.';
-- 2) Online guardrails.
--
-- NOTE: We add these as NOT VALID to avoid scanning historical partitions.
-- They will still be enforced for new INSERT/UPDATE.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'media_events_served_dedupe_key_format_chk'
      AND conrelid = 'public.media_events'::regclass
  ) THEN
    EXECUTE $$
      ALTER TABLE public.media_events
        ADD CONSTRAINT media_events_served_dedupe_key_format_chk
        CHECK (
          served_dedupe_key IS NULL
          OR served_dedupe_key ~* '^[0-9a-f-]{36}:[0-9]+:[0-9a-f-]{36}$'
        )
        NOT VALID
    $$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'media_events_served_dedupe_key_required_when_rec_request_id_chk'
      AND conrelid = 'public.media_events'::regclass
  ) THEN
    EXECUTE $$
      ALTER TABLE public.media_events
        ADD CONSTRAINT media_events_served_dedupe_key_required_when_rec_request_id_chk
        CHECK (
          rec_request_id IS NULL
          OR (
            served_dedupe_key IS NOT NULL
            AND served_dedupe_key ~* '^[0-9a-f-]{36}:[0-9]+:[0-9a-f-]{36}$'
          )
        )
        NOT VALID
    $$;
  END IF;
END;
$$;


-- 3) Violations view (service_role-only) so ops can measure remaining drift.
CREATE OR REPLACE VIEW public.media_events_served_key_violations_v1
WITH (security_invoker='true')
AS
SELECT
  e.event_day,
  e.created_at,
  e.user_id,
  e.session_id,
  e.deck_id,
  e.position,
  e.media_item_id,
  e.event_type,
  e.source,
  e.rec_request_id,
  e.served_dedupe_key,
  e.dedupe_key AS event_dedupe_key,
  e.client_event_id,
  e.payload
FROM public.media_events e
WHERE e.rec_request_id IS NOT NULL
  AND (
    e.served_dedupe_key IS NULL
    OR e.served_dedupe_key !~* '^[0-9a-f-]{36}:[0-9]+:[0-9a-f-]{36}$'
  )
ORDER BY e.created_at DESC;

ALTER VIEW public.media_events_served_key_violations_v1 OWNER TO postgres;

REVOKE ALL ON TABLE public.media_events_served_key_violations_v1 FROM PUBLIC;
REVOKE ALL ON TABLE public.media_events_served_key_violations_v1 FROM anon;
REVOKE ALL ON TABLE public.media_events_served_key_violations_v1 FROM authenticated;
GRANT ALL ON TABLE public.media_events_served_key_violations_v1 TO service_role;

COMMIT;
