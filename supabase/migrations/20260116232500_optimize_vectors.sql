-- Scalability Phase 1: Vector Storage Optimization
-- Reduces storage and improves performance for embeddings

BEGIN;

-----------------------------------------------------------------------
-- 0. Drop views that depend on vector columns
-----------------------------------------------------------------------
-- These views must be dropped before altering technical column types
DROP VIEW IF EXISTS public.media_embeddings_active CASCADE;
DROP VIEW IF EXISTS public.media_user_vectors_active CASCADE;
DROP VIEW IF EXISTS public.media_session_vectors_active CASCADE;

-----------------------------------------------------------------------
-- 1. Convert media_embeddings to halfvec (float16)
-- Reduces storage by 50% with minimal quality loss
-----------------------------------------------------------------------

-- Create new table with halfvec
CREATE TABLE public.media_embeddings_optimized (
    media_item_id uuid NOT NULL,
    embedding extensions.halfvec(1024),  -- float16 instead of float32
    provider text DEFAULT 'jina'::text NOT NULL,
    model text DEFAULT 'jina-embeddings-v3'::text NOT NULL,
    dimensions integer DEFAULT 1024 NOT NULL,
    task text DEFAULT 'retrieval.passage'::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    PRIMARY KEY (media_item_id, provider, model, task)
);

-- Copy data with cast to halfvec
INSERT INTO public.media_embeddings_optimized
SELECT 
    media_item_id,
    embedding::extensions.halfvec(1024),
    provider,
    model,
    dimensions,
    task,
    updated_at
FROM public.media_embeddings;

-- Swap tables
DROP TABLE public.media_embeddings CASCADE;
ALTER TABLE public.media_embeddings_optimized RENAME TO media_embeddings;

-- Recreate index for similarity search
CREATE INDEX idx_media_embeddings_hnsw 
    ON public.media_embeddings 
    USING hnsw (embedding extensions.halfvec_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Grant permissions
GRANT ALL ON TABLE public.media_embeddings TO anon;
GRANT ALL ON TABLE public.media_embeddings TO authenticated;
GRANT ALL ON TABLE public.media_embeddings TO service_role;

-----------------------------------------------------------------------
-- 2. Optimize user vectors to halfvec
-----------------------------------------------------------------------
ALTER TABLE public.media_user_vectors 
    ALTER COLUMN taste TYPE extensions.halfvec(1024);

-----------------------------------------------------------------------
-- 3. Optimize session vectors to halfvec
-----------------------------------------------------------------------
ALTER TABLE public.media_session_vectors 
    ALTER COLUMN taste TYPE extensions.halfvec(1024);

-----------------------------------------------------------------------
-- 4. Optimize user centroids to halfvec
-----------------------------------------------------------------------
ALTER TABLE public.media_user_centroids 
    ALTER COLUMN taste TYPE extensions.halfvec;

-----------------------------------------------------------------------
-- 5. Recreate views (using correct joins to active_embedding_profile)
-----------------------------------------------------------------------

CREATE OR REPLACE VIEW public.media_embeddings_active WITH (security_invoker='true') AS
 SELECT me.media_item_id,
    me.embedding,
    me.model,
    me.task,
    me.updated_at,
    me.provider,
    me.dimensions
   FROM (public.media_embeddings me
     JOIN public.active_embedding_profile p ON (((me.provider = p.provider) AND (me.model = p.model) AND (me.dimensions = p.dimensions) AND (me.task = p.task))));

CREATE OR REPLACE VIEW public.media_user_vectors_active WITH (security_invoker='true') AS
 SELECT uv.user_id,
    uv.taste,
    uv.updated_at,
    uv.provider,
    uv.model,
    uv.dimensions,
    uv.task
   FROM (public.media_user_vectors uv
     JOIN public.active_embedding_profile p ON (((uv.provider = p.provider) AND (uv.model = p.model) AND (uv.dimensions = p.dimensions) AND (uv.task = p.task))));

CREATE OR REPLACE VIEW public.media_session_vectors_active WITH (security_invoker='true') AS
 SELECT sv.user_id,
    sv.session_id,
    sv.taste,
    sv.updated_at,
    sv.provider,
    sv.model,
    sv.dimensions,
    sv.task
   FROM (public.media_session_vectors sv
     JOIN public.active_embedding_profile p ON (((sv.provider = p.provider) AND (sv.model = p.model) AND (sv.dimensions = p.dimensions) AND (sv.task = p.task))));

COMMIT;

