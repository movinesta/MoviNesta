-- Session 16: Add rec_requests parent table to store per-request context once.
-- This reduces duplication vs storing request_context on every rec_impressions row.

BEGIN;

CREATE TABLE IF NOT EXISTS public.rec_requests (
  rec_request_id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_day date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  user_id uuid NOT NULL,
  session_id uuid NOT NULL,
  deck_id uuid,
  mode text,
  requested_mode text,
  kind_filter text,
  seed text,
  "limit" integer,
  source text,
  request_context jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.rec_requests OWNER TO postgres;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS rec_requests_user_day_idx ON public.rec_requests (user_id, created_day DESC);
CREATE INDEX IF NOT EXISTS rec_requests_day_idx ON public.rec_requests (created_day DESC);

-- Security: keep table private by default.
ALTER TABLE public.rec_requests ENABLE ROW LEVEL SECURITY;

-- No public policies. Edge Functions use service_role when writing/reading.
REVOKE ALL ON TABLE public.rec_requests FROM PUBLIC;
REVOKE ALL ON TABLE public.rec_requests FROM anon;
REVOKE ALL ON TABLE public.rec_requests FROM authenticated;
GRANT ALL ON TABLE public.rec_requests TO service_role;

COMMIT;
