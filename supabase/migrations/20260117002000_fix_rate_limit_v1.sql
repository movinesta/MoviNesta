-- Update legacy v1 rate limit helpers to use consolidated rate_limits table.

CREATE OR REPLACE FUNCTION public.rate_limit_check_v1(p_key text, p_limit integer, p_window_seconds integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  now_epoch bigint;
  bucket_start bigint;
  next_epoch bigint;
  new_count integer;
  allowed boolean;
  window_start_ts timestamptz;
  stored_window_start timestamptz;
BEGIN
  p_key := COALESCE(NULLIF(trim(p_key), ''), '');
  IF p_key = '' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'BAD_KEY'
    );
  END IF;

  p_limit := GREATEST(1, COALESCE(p_limit, 1));
  p_window_seconds := GREATEST(1, COALESCE(p_window_seconds, 60));

  now_epoch := floor(extract(epoch from now()))::bigint;
  bucket_start := (now_epoch / p_window_seconds) * p_window_seconds;
  next_epoch := bucket_start + p_window_seconds;
  window_start_ts := to_timestamp(bucket_start);

  INSERT INTO public.rate_limits(key, action, window_start, count, updated_at)
  VALUES (p_key, 'v1', window_start_ts, 1, now())
  ON CONFLICT (key, action)
  DO UPDATE SET window_start = CASE
      WHEN public.rate_limits.window_start = window_start_ts
        THEN public.rate_limits.window_start
      ELSE window_start_ts
    END,
    count = CASE
      WHEN public.rate_limits.window_start = window_start_ts
        THEN public.rate_limits.count + 1
      ELSE 1
    END,
    updated_at = now()
  RETURNING count, window_start INTO new_count, stored_window_start;

  bucket_start := floor(extract(epoch from stored_window_start))::bigint;
  next_epoch := bucket_start + p_window_seconds;
  allowed := new_count <= p_limit;

  RETURN jsonb_build_object(
    'ok', true,
    'key', p_key,
    'windowStart', bucket_start,
    'windowSeconds', p_window_seconds,
    'limit', p_limit,
    'count', new_count,
    'allowed', allowed,
    'remaining', GREATEST(0, p_limit - new_count),
    'retryAfterSec', GREATEST(0, (next_epoch - now_epoch))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rate_limit_cleanup_v1(p_keep_hours integer DEFAULT 24)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH del AS (
    DELETE FROM public.rate_limits
    WHERE action = 'v1'
      AND updated_at < now() - make_interval(hours => GREATEST(1, COALESCE(p_keep_hours, 24)))
    RETURNING 1
  )
  SELECT count(*)::bigint FROM del;
$$;
