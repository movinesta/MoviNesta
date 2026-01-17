# OpenRouter generation backfill

The Edge Function `openrouter-generation-backfill` enriches rows in `openrouter_request_log` by fetching OpenRouter generation metadata (`/api/v1/generation?id=...`) and storing it into `openrouter_request_log.meta.generation_stats`.

## Credit / limit safety gate

The job can optionally exit early when the OpenRouter API key is low on remaining credits.

Request body options:

- `min_limit_remaining` (number, optional):
  - If set, the job reads OpenRouter `GET /api/v1/key` (cached in `external_api_cache` as category `key`).
  - When `limit_remaining` is a number and is **below** this threshold, the job returns early without scanning/updating logs.

- `max_key_age_minutes` (int, optional, default `60`):
  - How old the cached `/key` payload is allowed to be before it is re-fetched.

This helps prevent burning the last credits on log enrichment.

## Scheduling on Supabase (pg_cron + pg_net)

Run the SQL patch:

- `supabase/schema/patches/20260117_p25_openrouter_generation_backfill_cron_credit_gate.sql`

It creates/updates a `pg_cron` job that invokes the Edge Function using `pg_net.http_post`, and stores secrets in Supabase Vault.

## Typical usage

```json
{
  "batch_size": 50,
  "max_age_hours": 72,
  "timeout_ms": 1500,
  "concurrency": 3,
  "min_limit_remaining": 0.25,
  "max_key_age_minutes": 60
}
```
