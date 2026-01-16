-- Scalability Phase 1: Partition media_events by event_day
-- This migration converts media_events to a partitioned table
-- IMPORTANT: Run during maintenance window - requires table recreation

BEGIN;

-- Scalability Phase 1: Partition media_events by event_day
-- This migration converts media_events to a partitioned table
-- IMPORTANT: Run during maintenance window - requires table recreation


DO $$
BEGIN
    -- Only proceed if media_events is NOT already partitioned
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_partitioned_table 
        WHERE partrelid = 'public.media_events'::regclass
    ) THEN

        -----------------------------------------------------------------------
        -- 1. Create new partitioned table structure
        -----------------------------------------------------------------------
        CREATE TABLE IF NOT EXISTS public.media_events_partitioned (
            id uuid DEFAULT gen_random_uuid() NOT NULL,
            user_id uuid NOT NULL,
            session_id uuid NOT NULL,
            deck_id uuid,
            "position" integer,
            media_item_id uuid NOT NULL,
            event_type public.media_event_type NOT NULL,
            source text,
            dwell_ms integer,
            payload jsonb,
            created_at timestamp with time zone DEFAULT now() NOT NULL,
            client_event_id uuid,
            rating_0_10 numeric,
            in_watchlist boolean,
            event_day date DEFAULT ((now() AT TIME ZONE 'utc'::text))::date NOT NULL,
            dedupe_key text NOT NULL,
            rec_request_id uuid
        ) PARTITION BY RANGE (event_day);

        -----------------------------------------------------------------------
        -- 2. Create default partition
        -----------------------------------------------------------------------
        CREATE TABLE IF NOT EXISTS public.media_events_default 
            PARTITION OF public.media_events_partitioned DEFAULT;

        -----------------------------------------------------------------------
        -- 3. Create monthly partitions (next 6 months for efficiency)
        -----------------------------------------------------------------------
        CREATE TABLE IF NOT EXISTS public.media_events_2026_01 PARTITION OF public.media_events_partitioned FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
        CREATE TABLE IF NOT EXISTS public.media_events_2026_02 PARTITION OF public.media_events_partitioned FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
        CREATE TABLE IF NOT EXISTS public.media_events_2026_03 PARTITION OF public.media_events_partitioned FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
        CREATE TABLE IF NOT EXISTS public.media_events_2026_04 PARTITION OF public.media_events_partitioned FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
        CREATE TABLE IF NOT EXISTS public.media_events_2026_05 PARTITION OF public.media_events_partitioned FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
        CREATE TABLE IF NOT EXISTS public.media_events_2026_06 PARTITION OF public.media_events_partitioned FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

        -----------------------------------------------------------------------
        -- 4. Copy data from old table
        -----------------------------------------------------------------------
        INSERT INTO public.media_events_partitioned 
        SELECT * FROM public.media_events;

        -----------------------------------------------------------------------
        -- 5. Drop old table and rename new one
        -----------------------------------------------------------------------
        DROP TABLE public.media_events CASCADE;
        ALTER TABLE public.media_events_partitioned RENAME TO media_events;

        -----------------------------------------------------------------------
        -- 6. Recreate primary key and unique constraint
        -----------------------------------------------------------------------
        ALTER TABLE public.media_events 
            ADD CONSTRAINT media_events_pkey PRIMARY KEY (id, event_day);

        ALTER TABLE public.media_events 
            ADD CONSTRAINT media_events_user_dedupe_uq UNIQUE (user_id, dedupe_key, event_day);

        -----------------------------------------------------------------------
        -- 7. Recreate essential indexes (partitioned)
        -----------------------------------------------------------------------
        CREATE INDEX idx_media_events_user_day 
            ON public.media_events (user_id, event_day DESC);

        CREATE INDEX idx_media_events_user_item_time 
            ON public.media_events (user_id, media_item_id, created_at DESC);

        CREATE INDEX idx_media_events_event_type 
            ON public.media_events (event_type, created_at DESC);

        CREATE INDEX idx_media_events_media_item 
            ON public.media_events (media_item_id, event_day DESC);

        -----------------------------------------------------------------------
        -- 8. Grant permissions
        -----------------------------------------------------------------------
        GRANT ALL ON TABLE public.media_events TO anon;
        GRANT ALL ON TABLE public.media_events TO authenticated;
        GRANT ALL ON TABLE public.media_events TO service_role;

    END IF;
END $$;

-----------------------------------------------------------------------
-- 9. Create function to auto-create monthly partitions
-----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_media_events_partition_if_needed()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    partition_date date;
    partition_name text;
    start_date date;
    end_date date;
BEGIN
    -- Create partition for next month if it doesn't exist
    partition_date := date_trunc('month', now() + interval '1 month')::date;
    partition_name := 'media_events_' || to_char(partition_date, 'YYYY_MM');
    start_date := partition_date;
    end_date := partition_date + interval '1 month';
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' AND tablename = partition_name
    ) THEN
        EXECUTE format(
            'CREATE TABLE public.%I PARTITION OF public.media_events FOR VALUES FROM (%L) TO (%L)',
            partition_name, start_date, end_date
        );
    END IF;
END;
$$;

COMMIT;
