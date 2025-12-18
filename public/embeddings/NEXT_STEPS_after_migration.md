# Next steps after SQL migration (dual-provider embeddings)

You already applied the multi-model migration. The next step is to deploy the updated Edge Function and create two Cron jobs (one for Jina, one for OpenAI).

## 1) Deploy the updated Edge Function code
Use the provided patched repo zip and deploy your Supabase Edge Functions as you normally do (CLI or GitHub Action).

Key changes:
- `media-embed-backfill` now supports: provider/model/dimensions/task
- It uses a per-profile cursor (so Jina/OpenAI do not fight over pagination)
- Optional protection: if `EMBED_BACKFILL_JOB_TOKEN` is set, the function requires header `X-Job-Token`

## 2) Set Edge Function environment variables (Supabase dashboard)
### Required for OpenAI
- `OPENAI_API_KEY`

### Recommended defaults
- `OPENAI_MODEL` = `text-embedding-3-small`
- `OPENAI_DIM` = `1024`
- `OPENAI_EMBEDDINGS_URL` = `https://api.openai.com/v1/embeddings` (optional; defaulted in code)

### Existing Jina variables (keep as-is)
- `JINA_API_KEY`
- `JINA_MODEL` (default in code: `jina-embeddings-v3`)
- `JINA_DIM` (default in code: `1024`)

### Optional: protect the backfill function
- `EMBED_BACKFILL_JOB_TOKEN` = a long random string
Then set Cron request header `X-Job-Token` to the same value.

## 3) Create two Supabase Cron jobs (Dashboard)
Create two scheduled triggers for the same function (`media-embed-backfill`) with different request bodies:
- Jina job body: see `cron_payloads_media_embed_backfill.json` (jina_example)
- OpenAI job body: see `cron_payloads_media_embed_backfill.json` (openai_example)

Recommended:
- Start with the OpenAI Cron job DISABLED until env vars are set.
- Run both jobs on the same schedule or stagger them (they are independent).

## 4) Install helper SQL (recommended)
Run `supabase_embedding_helpers.sql` after the migration. It adds:
- `public.set_active_embedding_profile(...)` function
- `*_active` views (media_embeddings_active, media_user_vectors_active, media_session_vectors_active)
- performance indexes
- updated_at trigger for embedding_settings

## 5) Update your ranking/RPC queries before turning on OpenAI in production
Once OpenAI embeddings exist in `public.media_embeddings`, old queries that join `media_embeddings` by `media_item_id` without filtering can produce duplicates.

Recommended approach:
- Update your SQL/RPCs to read from `public.media_embeddings_active` (or filter by `public.active_embedding_profile`), so they always use the currently active provider/model/dim/task.

## 6) Switching providers (after OpenAI backfill)
After you have enough OpenAI coverage, switch the active profile in DB:
- Use `public.set_active_embedding_profile(...)` (included in helper SQL), or update `public.embedding_settings` row id=1.

Important: keep taste vectors consistent with the active profile (your taste-vector builder/RPC should write per-profile rows).

