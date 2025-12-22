# Next steps after SQL migration (Voyage-only embeddings)

You already applied the embeddings migration. Next:
- deploy the updated Edge Function
- set Voyage API secrets
- (optionally) schedule a cron job for continuous backfill

This repo is **locked** to:
- Embeddings: `voyage-3-large`
- Rerank: `rerank-2.5`

## 1) Deploy the Edge Functions
Deploy your Supabase Edge Functions (CLI or GitHub Action), including:
- `media-embed-backfill`
- `media-rerank` (if you use rerank)

## 2) Set environment variables (Supabase dashboard)
Required:
- `VOYAGE_API_KEY`

Optional overrides (usually leave default):
- `VOYAGE_EMBEDDINGS_URL` (default: `https://api.voyageai.com/v1/embeddings`)
- `VOYAGE_RERANK_URL` (default: `https://api.voyageai.com/v1/rerank`)

## 3) Create a Supabase Cron job (Dashboard)
Schedule calls to `media-embed-backfill`.

Example request body is in:
- `cron_payloads_media_embed_backfill.json`

Recommended:
- run every 5–15 minutes
- keep `useSavedCursor: true`

## 4) Helper SQL (recommended)
Run `supabase_embedding_helpers.sql` after the migration. It adds:
- `public.set_active_embedding_profile(...)`
- `*_active` views (media_embeddings_active, media_user_vectors_active, media_session_vectors_active)
- supporting indexes/triggers

## 5) Switching profiles
This repo does not support switching providers/models. If you want to change the model later, update the code + DB profile together (to avoid mixed vectors).
