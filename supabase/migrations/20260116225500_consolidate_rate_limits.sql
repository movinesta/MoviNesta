-- Phase 4a: Consolidate Rate Limit Tables
-- Merges rate_limit_counters and rate_limit_state into a single rate_limits table

BEGIN;

-----------------------------------------------------------------------
-- 1. Create new consolidated rate_limits table
-----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rate_limits (
  key TEXT NOT NULL,
  action TEXT NOT NULL DEFAULT '',
  window_start TIMESTAMPTZ NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (key, action)
);

ALTER TABLE public.rate_limits OWNER TO postgres;

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start ON public.rate_limits(window_start);

-- Grant permissions
GRANT ALL ON TABLE public.rate_limits TO anon;
GRANT ALL ON TABLE public.rate_limits TO authenticated;
GRANT ALL ON TABLE public.rate_limits TO service_role;

-----------------------------------------------------------------------
-- 2. Update check_rate_limit RPC to use new table
-----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_rate_limit(p_key text, p_action text, p_max_per_minute integer)
 RETURNS TABLE(ok boolean, remaining integer, reset_at timestamp with time zone, retry_after_seconds integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare
  v_now timestamptz := now();
  v_window_start timestamptz := date_trunc('minute', v_now);
  v_count int;
  v_reset timestamptz;
begin
  if p_key is null or p_key = '' or p_action is null or p_action = '' then
    return query select true, null::int, v_window_start + interval '1 minute', 0;
    return;
  end if;

  if p_max_per_minute is null or p_max_per_minute <= 0 then
    return query select true, null::int, v_window_start + interval '1 minute', 0;
    return;
  end if;

  -- Use new consolidated rate_limits table
  insert into public.rate_limits (key, action, window_start, count, updated_at)
  values (p_key, p_action, v_window_start, 1, now())
  on conflict (key, action) do update
    set window_start = case
      when public.rate_limits.window_start = v_window_start
        then public.rate_limits.window_start
      else v_window_start
    end,
    count = case
      when public.rate_limits.window_start = v_window_start
        then public.rate_limits.count + 1
      else 1
    end,
    updated_at = now()
  returning count, window_start into v_count, v_window_start;

  v_reset := v_window_start + interval '1 minute';

  return query select
    (v_count <= p_max_per_minute),
    greatest(p_max_per_minute - v_count, 0),
    v_reset,
    case
      when v_count <= p_max_per_minute then 0
      else greatest(ceil(extract(epoch from (v_reset - v_now)))::int, 1)
    end;
end;
$$;

-----------------------------------------------------------------------
-- 3. Drop old tables (no data to preserve)
-----------------------------------------------------------------------
DROP TABLE IF EXISTS public.rate_limit_counters CASCADE;
DROP TABLE IF EXISTS public.rate_limit_state CASCADE;

COMMIT;

