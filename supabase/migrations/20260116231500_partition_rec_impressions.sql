-- Scalability Phase 1: Partition rec_impressions by created_at
-- Similar to media_events, converts to monthly partitions

BEGIN;

DO $$
BEGIN
    -- Only proceed if rec_impressions is NOT already partitioned
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_partitioned_table 
        WHERE partrelid = 'public.rec_impressions'::regclass
    ) THEN

        -----------------------------------------------------------------------
        -- 1. Create new partitioned table structure
        -----------------------------------------------------------------------
        CREATE TABLE IF NOT EXISTS public.rec_impressions_partitioned (
            id uuid DEFAULT gen_random_uuid() NOT NULL,
            rec_request_id uuid NOT NULL,
            user_id uuid NOT NULL,
            session_id uuid NOT NULL,
            deck_id uuid NOT NULL,
            media_item_id uuid NOT NULL,
            "position" integer NOT NULL,
            source text,
            dedupe_key text NOT NULL,
            request_context jsonb,
            created_at timestamp with time zone DEFAULT now() NOT NULL,
            created_day date DEFAULT ((now() AT TIME ZONE 'utc'::text))::date NOT NULL
        ) PARTITION BY RANGE (created_day);

        -----------------------------------------------------------------------
        -- 2. Create partitions
        -----------------------------------------------------------------------
        CREATE TABLE IF NOT EXISTS public.rec_impressions_default 
            PARTITION OF public.rec_impressions_partitioned DEFAULT;

        CREATE TABLE IF NOT EXISTS public.rec_impressions_2026_01 
            PARTITION OF public.rec_impressions_partitioned 
            FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

        CREATE TABLE IF NOT EXISTS public.rec_impressions_2026_02 
            PARTITION OF public.rec_impressions_partitioned 
            FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

        CREATE TABLE IF NOT EXISTS public.rec_impressions_2026_03 
            PARTITION OF public.rec_impressions_partitioned 
            FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

        -----------------------------------------------------------------------
        -- 3. Copy existing data
        -----------------------------------------------------------------------
        INSERT INTO public.rec_impressions_partitioned 
            (id, rec_request_id, user_id, session_id, deck_id, media_item_id, 
             "position", source, dedupe_key, request_context, created_at, created_day)
        SELECT 
            id, rec_request_id, user_id, session_id, deck_id, media_item_id,
            "position", source, dedupe_key, request_context, created_at,
            (created_at AT TIME ZONE 'utc')::date
        FROM public.rec_impressions;

        -----------------------------------------------------------------------
        -- 4. Swap tables
        -----------------------------------------------------------------------
        DROP TABLE public.rec_impressions CASCADE;
        ALTER TABLE public.rec_impressions_partitioned RENAME TO rec_impressions;

        -----------------------------------------------------------------------
        -- 5. Recreate constraints and indexes
        -----------------------------------------------------------------------
        ALTER TABLE public.rec_impressions 
            ADD CONSTRAINT rec_impressions_pkey PRIMARY KEY (id, created_day);

        CREATE INDEX idx_rec_impressions_user_item 
            ON public.rec_impressions (user_id, media_item_id);

        CREATE INDEX idx_rec_impressions_user_created 
            ON public.rec_impressions (user_id, created_at DESC);

        -----------------------------------------------------------------------
        -- 6. Grant permissions
        -----------------------------------------------------------------------
        GRANT ALL ON TABLE public.rec_impressions TO anon;
        GRANT ALL ON TABLE public.rec_impressions TO authenticated;
        GRANT ALL ON TABLE public.rec_impressions TO service_role;

    END IF;
END $$;

COMMIT;

