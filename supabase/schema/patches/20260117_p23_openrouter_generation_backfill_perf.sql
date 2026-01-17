-- P23: OpenRouter generation backfill performance helpers
--
-- Adds:
--  1) A small SQL RPC to fetch rows missing meta.generation_stats efficiently
--  2) Partial indexes to speed up both scheduled and ad-hoc backfills
--
-- Safe to run multiple times.

begin;

-- 1) Speed up "pending stats" scans (common pattern: created_at desc + missing generation_stats)
create index if not exists openrouter_request_log_pending_genstats_idx
  on public.openrouter_request_log using btree (created_at desc, id desc)
  where upstream_request_id is not null
    and not (meta ? 'generation_stats');

create index if not exists openrouter_request_log_pending_genstats_upstream_id_idx
  on public.openrouter_request_log using btree (upstream_request_id)
  where upstream_request_id is not null
    and not (meta ? 'generation_stats');

-- Optional: make it cheap to look up by stored generation_id (if you later add admin filters)
create index if not exists openrouter_request_log_generation_id_expr_idx
  on public.openrouter_request_log using btree ((meta->>'generation_id'))
  where (meta ? 'generation_id');

-- 2) RPC to fetch candidates with jsonb predicates (PostgREST doesn't support these well)
create or replace function public.openrouter_generation_backfill_candidates_v1(
  p_since timestamptz,
  p_limit int default 50,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null
)
returns table (
  id uuid,
  created_at timestamptz,
  base_url text,
  upstream_request_id text,
  meta jsonb
)
language sql
stable
as $$
  select
    l.id,
    l.created_at,
    l.base_url,
    l.upstream_request_id,
    l.meta
  from public.openrouter_request_log l
  where l.created_at >= p_since
    and l.upstream_request_id is not null
    and not (l.meta ? 'generation_stats')
    and (
      p_cursor_created_at is null
      or l.created_at < p_cursor_created_at
      or (l.created_at = p_cursor_created_at and (p_cursor_id is null or l.id < p_cursor_id))
    )
  order by l.created_at desc, l.id desc
  limit greatest(1, least(p_limit, 200));
$$;

revoke all on function public.openrouter_generation_backfill_candidates_v1(timestamptz, int, timestamptz, uuid) from public;
grant execute on function public.openrouter_generation_backfill_candidates_v1(timestamptz, int, timestamptz, uuid) to service_role;

commit;
