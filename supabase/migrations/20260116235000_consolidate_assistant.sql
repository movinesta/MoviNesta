-- Phase 6: Consolidate Assistant Tables
-- Merges assistant_goal_state into assistant_goals
-- Folds assistant_failures into ops_alerts

BEGIN;

-----------------------------------------------------------------------
-- 1. Extend assistant_goals with state columns
-----------------------------------------------------------------------
ALTER TABLE public.assistant_goals 
    ADD COLUMN IF NOT EXISTS target_count integer DEFAULT 0 NOT NULL,
    ADD COLUMN IF NOT EXISTS progress_count integer DEFAULT 0 NOT NULL,
    ADD COLUMN IF NOT EXISTS last_event_at timestamp with time zone;

DO $$
BEGIN
    -----------------------------------------------------------------------
    -- 2. Migrate data from assistant_goal_state (if table exists)
    -----------------------------------------------------------------------
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'assistant_goal_state') THEN
        UPDATE public.assistant_goals ag
        SET 
            target_count = ags.target_count,
            progress_count = ags.progress_count,
            last_event_at = ags.last_event_at,
            updated_at = ags.updated_at
        FROM public.assistant_goal_state ags
        WHERE ag.id = ags.goal_id;
        
        DROP TABLE public.assistant_goal_state CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    -----------------------------------------------------------------------
    -- 4. Migrate assistant_failures to ops_alerts (if table exists)
    -----------------------------------------------------------------------
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'assistant_failures') THEN
        INSERT INTO public.ops_alerts (kind, severity, title, detail, source, dedupe_key, meta, created_at, updated_at)
        SELECT 
            'assistant_failure'::text as kind,
            'warn'::text as severity,
            'Assistant Failure: ' || code as title,
            message as detail,
            'assistant_telemetry'::text as source,
            'fail_' || id as dedupe_key,
            jsonb_build_object(
                'code', code,
                'user_id', user_id,
                'conversation_id', conversation_id,
                'original_details', details
            ) as meta,
            now() as created_at,
            now() as updated_at
        FROM public.assistant_failures;
        
        DROP TABLE public.assistant_failures CASCADE;
    END IF;
END $$;

COMMIT;
