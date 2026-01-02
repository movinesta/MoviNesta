-- MoviNesta Assistant hardening (RLS policies)
-- Apply this in Supabase SQL editor.

-- assistant_metrics_daily: Edge Functions need to insert/update rollups.
DO $$
BEGIN
  IF to_regclass('public.assistant_metrics_daily') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'assistant_metrics_daily'
        AND policyname = 'rls_assistant_metrics_daily_service_role_all'
    ) THEN
      EXECUTE 'CREATE POLICY rls_assistant_metrics_daily_service_role_all ON public.assistant_metrics_daily TO service_role USING (true) WITH CHECK (true)';
    END IF;
  END IF;
END
$$;

-- assistant_trigger_fires: Edge Functions need to insert/update trigger fire records.
DO $$
BEGIN
  IF to_regclass('public.assistant_trigger_fires') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'assistant_trigger_fires'
        AND policyname = 'rls_assistant_trigger_fires_service_role_all'
    ) THEN
      EXECUTE 'CREATE POLICY rls_assistant_trigger_fires_service_role_all ON public.assistant_trigger_fires TO service_role USING (true) WITH CHECK (true)';
    END IF;
  END IF;
END
$$;
