-- Session 19 (hotfix): make join integrity reports use media_events.served_dedupe_key.
--
-- Why:
--   rec_impressions.dedupe_key is the stable per-served-item identity:
--     <rec_request_id>:<position>:<media_item_id>
--   media_events.dedupe_key is an event-level idempotency key, so joining on it
--   creates false "unjoinable" signals. We instead join on media_events.served_dedupe_key.

BEGIN;

-- Daily join integrity report.
CREATE OR REPLACE VIEW public.rec_join_integrity_report_v1
WITH (security_invoker='true')
AS
WITH
  imp AS (
    SELECT
      i.created_day AS day,
      count(*) AS impressions,
      count(*) FILTER (
        WHERE i.dedupe_key !~* '^[0-9a-f-]{36}:[0-9]+:[0-9a-f-]{36}$'
      ) AS impressions_invalid_dedupe_key
    FROM public.rec_impressions i
    GROUP BY i.created_day
  ),
  ev AS (
    SELECT
      e.event_day AS day,
      count(*) AS events,
      count(*) FILTER (
        WHERE e.served_dedupe_key IS NULL
           OR e.served_dedupe_key !~* '^[0-9a-f-]{36}:[0-9]+:[0-9a-f-]{36}$'
      ) AS events_invalid_dedupe_key,
      count(*) FILTER (WHERE e.rec_request_id IS NULL) AS events_missing_rec_request_id,
      count(*) FILTER (WHERE e.deck_id IS NULL) AS events_missing_deck_id,
      count(*) FILTER (WHERE e.position IS NULL) AS events_missing_position
    FROM public.media_events e
    GROUP BY e.event_day
  ),
  ev_join AS (
    SELECT
      e.event_day AS day,
      count(*) FILTER (WHERE i.id IS NOT NULL) AS events_joined_to_impression,
      count(*) FILTER (WHERE i.id IS NULL) AS events_without_impression
    FROM public.media_events e
    LEFT JOIN public.rec_impressions i
      ON i.user_id = e.user_id
     AND i.dedupe_key = e.served_dedupe_key
    GROUP BY e.event_day
  ),
  imp_same_day_event AS (
    SELECT
      i.created_day AS day,
      count(*) FILTER (
        WHERE EXISTS (
          SELECT 1
          FROM public.media_events e
          WHERE e.event_day = i.created_day
            AND e.user_id = i.user_id
            AND e.served_dedupe_key = i.dedupe_key
        )
      ) AS impressions_with_event_same_day
    FROM public.rec_impressions i
    GROUP BY i.created_day
  ),
  days AS (
    SELECT day FROM imp
    UNION
    SELECT day FROM ev
  )
SELECT
  d.day,
  COALESCE(imp.impressions, 0) AS impressions,
  COALESCE(imp.impressions_invalid_dedupe_key, 0) AS impressions_invalid_dedupe_key,
  COALESCE(imp_same_day_event.impressions_with_event_same_day, 0) AS impressions_with_event_same_day,
  COALESCE(ev.events, 0) AS events,
  COALESCE(ev.events_invalid_dedupe_key, 0) AS events_invalid_dedupe_key,
  COALESCE(ev.events_missing_rec_request_id, 0) AS events_missing_rec_request_id,
  COALESCE(ev.events_missing_deck_id, 0) AS events_missing_deck_id,
  COALESCE(ev.events_missing_position, 0) AS events_missing_position,
  COALESCE(ev_join.events_joined_to_impression, 0) AS events_joined_to_impression,
  COALESCE(ev_join.events_without_impression, 0) AS events_without_impression,
  CASE
    WHEN COALESCE(ev.events, 0) = 0 THEN NULL
    ELSE (COALESCE(ev_join.events_without_impression, 0)::double precision / ev.events::double precision)
  END AS event_unjoinable_rate
FROM days d
LEFT JOIN imp USING (day)
LEFT JOIN ev USING (day)
LEFT JOIN ev_join USING (day)
LEFT JOIN imp_same_day_event USING (day)
ORDER BY d.day DESC;

-- By event_type + source.
CREATE OR REPLACE VIEW public.rec_join_integrity_by_event_v1
WITH (security_invoker='true')
AS
SELECT
  e.event_day AS day,
  e.event_type,
  e.source,
  count(*) AS events,
  count(*) FILTER (
    WHERE e.served_dedupe_key IS NULL
       OR e.served_dedupe_key !~* '^[0-9a-f-]{36}:[0-9]+:[0-9a-f-]{36}$'
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
 AND i.dedupe_key = e.served_dedupe_key
GROUP BY e.event_day, e.event_type, e.source
ORDER BY e.event_day DESC, events_without_impression DESC, events DESC;

-- Samples to debug.
CREATE OR REPLACE VIEW public.rec_unjoinable_events_samples_v1
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
  e.dwell_ms,
  e.rating_0_10,
  e.in_watchlist,
  e.payload
FROM public.media_events e
LEFT JOIN public.rec_impressions i
  ON i.user_id = e.user_id
 AND i.dedupe_key = e.served_dedupe_key
WHERE i.id IS NULL
ORDER BY e.created_at DESC
LIMIT 500;

ALTER VIEW public.rec_unjoinable_events_samples_v1 OWNER TO postgres;

REVOKE ALL ON TABLE public.rec_unjoinable_events_samples_v1 FROM PUBLIC;
REVOKE ALL ON TABLE public.rec_unjoinable_events_samples_v1 FROM anon;
REVOKE ALL ON TABLE public.rec_unjoinable_events_samples_v1 FROM authenticated;
GRANT ALL ON TABLE public.rec_unjoinable_events_samples_v1 TO service_role;

ALTER VIEW public.rec_join_integrity_report_v1 OWNER TO postgres;

REVOKE ALL ON TABLE public.rec_join_integrity_report_v1 FROM anon;
REVOKE ALL ON TABLE public.rec_join_integrity_report_v1 FROM authenticated;
GRANT SELECT ON TABLE public.rec_join_integrity_report_v1 TO authenticated;
GRANT ALL ON TABLE public.rec_join_integrity_report_v1 TO service_role;

ALTER VIEW public.rec_join_integrity_by_event_v1 OWNER TO postgres;

REVOKE ALL ON TABLE public.rec_join_integrity_by_event_v1 FROM anon;
REVOKE ALL ON TABLE public.rec_join_integrity_by_event_v1 FROM authenticated;
GRANT SELECT ON TABLE public.rec_join_integrity_by_event_v1 TO authenticated;
GRANT ALL ON TABLE public.rec_join_integrity_by_event_v1 TO service_role;

COMMIT;
