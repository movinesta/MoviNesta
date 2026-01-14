-- Recommender telemetry v1: request trace, impressions, outcomes
-- Safe + additive. Designed for offline evaluation and future model training.

-- 1) Trace id on media_events (tie events back to the deck request)
ALTER TABLE IF EXISTS public.media_events
  ADD COLUMN IF NOT EXISTS rec_request_id uuid;

CREATE INDEX IF NOT EXISTS media_events_rec_request_id_idx
  ON public.media_events (rec_request_id);

-- 2) Impressions (what we served)
CREATE TABLE IF NOT EXISTS public.rec_impressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rec_request_id uuid NOT NULL,
  user_id uuid NOT NULL,
  session_id uuid NOT NULL,
  deck_id uuid NOT NULL,
  media_item_id uuid NOT NULL,
  position integer NOT NULL,
  source text,
  dedupe_key text NOT NULL,
  request_context jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rec_impressions_dedupe_key_key UNIQUE (dedupe_key),
  CONSTRAINT rec_impressions_user_fk FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT rec_impressions_media_item_fk FOREIGN KEY (media_item_id) REFERENCES public.media_items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS rec_impressions_user_created_at_idx
  ON public.rec_impressions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS rec_impressions_rec_request_id_idx
  ON public.rec_impressions (rec_request_id);

CREATE INDEX IF NOT EXISTS rec_impressions_media_item_created_at_idx
  ON public.rec_impressions (media_item_id, created_at DESC);

-- 3) Outcomes (compact, stable event labels for training/eval)
CREATE TABLE IF NOT EXISTS public.rec_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rec_request_id uuid,
  user_id uuid NOT NULL,
  session_id uuid NOT NULL,
  deck_id uuid,
  position integer,
  media_item_id uuid NOT NULL,
  outcome_type text NOT NULL,
  source text,
  dwell_ms integer,
  rating_0_10 numeric,
  in_watchlist boolean,
  client_event_id uuid,
  dedupe_key text NOT NULL,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rec_outcomes_user_fk FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT rec_outcomes_media_item_fk FOREIGN KEY (media_item_id) REFERENCES public.media_items(id) ON DELETE CASCADE,
  CONSTRAINT rec_outcomes_user_dedupe_key_key UNIQUE (user_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS rec_outcomes_user_created_at_idx
  ON public.rec_outcomes (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS rec_outcomes_rec_request_id_idx
  ON public.rec_outcomes (rec_request_id);

CREATE INDEX IF NOT EXISTS rec_outcomes_media_item_created_at_idx
  ON public.rec_outcomes (media_item_id, created_at DESC);

-- 4) RLS
ALTER TABLE public.rec_impressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rec_outcomes ENABLE ROW LEVEL SECURITY;

-- Read your own rows
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='rec_impressions' AND policyname='rec_impressions_select_own'
  ) THEN
    CREATE POLICY rec_impressions_select_own
      ON public.rec_impressions
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='rec_impressions' AND policyname='rec_impressions_insert_own'
  ) THEN
    CREATE POLICY rec_impressions_insert_own
      ON public.rec_impressions
      FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='rec_outcomes' AND policyname='rec_outcomes_select_own'
  ) THEN
    CREATE POLICY rec_outcomes_select_own
      ON public.rec_outcomes
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='rec_outcomes' AND policyname='rec_outcomes_insert_own'
  ) THEN
    CREATE POLICY rec_outcomes_insert_own
      ON public.rec_outcomes
      FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- No updates/deletes for authenticated users by default (append-only telemetry)

GRANT SELECT, INSERT ON public.rec_impressions TO authenticated;
GRANT SELECT, INSERT ON public.rec_outcomes TO authenticated;
