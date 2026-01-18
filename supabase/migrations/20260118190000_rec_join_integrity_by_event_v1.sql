-- Session 19: Join integrity report by event_type and source.
--
-- Purpose:
--   Pinpoint which event types (and sources) are responsible for join gaps between
--   served impressions (rec_impressions) and outcomes/events (media_events).
--
-- Implementation notes:
--   * Uses a security-invoker view so RLS policies of the invoking role apply (Postgres 15+).
--   * Joins events to impressions on (user_id, dedupe_key).

BEGIN;

CREATE OR REPLACE VIEW public.rec_join_integrity_by_event_v1
WITH (security_invoker='true')
AS
SELECT
  e.event_day AS day,
  e.event_type,
  e.source,
  count(*) AS events,
  count(*) FILTER (
    WHERE e.dedupe_key !~* '^[0-9a-f-]{36}:[0-9]+:[0-9a-f-]{36}$'
  ) AS events_invalid_dedupe_key,
  count(*) FILTER (WHERE e.rec_request_id IS NULL) AS events_missing_rec_request_id,
  count(*) FILTER (WHERE e.deck_id IS NULL) AS events_missing_deck_id,
  count(*) FILTER (WHERE e.position IS NULL) AS events_missing_position,
  count(*) FILTER (WHERE i.id IS NOT NULL) AS events_joined_to_impression,
  count(*) FILTER (WHERE i.id IS NULL) AS events_without_impression,
  CASE
    WHEN count(*) = 0 THEN NULL
    ELSE (count(*) FILTER (WHERE i.id IS NULL))::double precision / count(*)::double precision
  END AS event_unjoinable_rate
FROM public.media_events e
LEFT JOIN public.rec_impressions i
  ON i.user_id = e.user_id
 AND i.dedupe_key = e.dedupe_key
GROUP BY e.event_day, e.event_type, e.source
ORDER BY e.event_day DESC, events_without_impression DESC, events DESC;

ALTER VIEW public.rec_join_integrity_by_event_v1 OWNER TO postgres;

REVOKE ALL ON TABLE public.rec_join_integrity_by_event_v1 FROM anon;
REVOKE ALL ON TABLE public.rec_join_integrity_by_event_v1 FROM authenticated;
GRANT SELECT ON TABLE public.rec_join_integrity_by_event_v1 TO authenticated;
GRANT ALL ON TABLE public.rec_join_integrity_by_event_v1 TO service_role;

COMMIT;
