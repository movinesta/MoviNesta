-- Migration: 20260105_130000_assistant_jobs_and_failures
-- Description: Improve assistant job observability + add a lightweight failures table.

BEGIN;

-- 1) Track when a reply job entered processing so we can detect stuck jobs and provide better dashboards.
ALTER TABLE IF EXISTS public.assistant_reply_jobs
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz;

-- 2) Update claim function to set processing_started_at and use a safe search_path.
CREATE OR REPLACE FUNCTION public.assistant_claim_reply_jobs_v1(
  p_limit integer DEFAULT 20,
  p_stuck_minutes integer DEFAULT 10
) RETURNS SETOF public.assistant_reply_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public, pg_temp'
AS $$
BEGIN
  RETURN QUERY
  WITH candidate AS (
    SELECT id
    FROM public.assistant_reply_jobs
    WHERE (
      (status = 'pending' AND next_run_at <= now())
      OR
      (status = 'processing' AND updated_at < now() - make_interval(mins => p_stuck_minutes))
    )
    ORDER BY created_at ASC
    LIMIT GREATEST(1, LEAST(p_limit, 200))
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.assistant_reply_jobs j
  SET status = 'processing',
      attempts = j.attempts + 1,
      processing_started_at = COALESCE(j.processing_started_at, now()),
      updated_at = now()
  FROM candidate c
  WHERE j.id = c.id
  RETURNING j.*;
END;
$$;

-- 3) Lightweight failure telemetry (service_role only).
CREATE TABLE IF NOT EXISTS public.assistant_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  fn text NOT NULL,
  request_id text,
  user_id uuid,
  conversation_id uuid,
  code text,
  message text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.assistant_failures ENABLE ROW LEVEL SECURITY;

-- Default deny. Only service_role should read/write.
REVOKE ALL ON TABLE public.assistant_failures FROM PUBLIC;
GRANT ALL ON TABLE public.assistant_failures TO service_role;

-- Helpful indexes for admin dashboards.
CREATE INDEX IF NOT EXISTS assistant_failures_created_at_idx
  ON public.assistant_failures (created_at DESC);
CREATE INDEX IF NOT EXISTS assistant_failures_fn_created_at_idx
  ON public.assistant_failures (fn, created_at DESC);

COMMIT;
