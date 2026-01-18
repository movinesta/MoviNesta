-- Session 25: Swipe ingest health rollups (hourly)
--
-- Stores sampled aggregated ingestion diagnostics from the media-swipe-event Edge Function.
-- We keep write volume small by aggregating per-hour and by issue code.

begin;

-- 1) Hourly totals (one row per hour bucket)
create table if not exists public.swipe_ingest_hourly_metrics (
  bucket_start timestamptz not null,
  requests integer not null default 0,
  accepted_events integer not null default 0,
  rejected_events integer not null default 0,
  retry_events integer not null default 0,
  sample_rate numeric not null default 1,
  updated_at timestamptz not null default now(),
  primary key (bucket_start)
);

-- 2) Hourly issue counts by stable code
create table if not exists public.swipe_ingest_hourly_issue_counts (
  bucket_start timestamptz not null,
  code text not null,
  count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (bucket_start, code),
  constraint swipe_ingest_hourly_issue_counts_bucket_fkey
    foreign key (bucket_start) references public.swipe_ingest_hourly_metrics(bucket_start) on delete cascade
);

-- Lock down: enable RLS with no policies (service_role uses BYPASSRLS)
alter table public.swipe_ingest_hourly_metrics enable row level security;
alter table public.swipe_ingest_hourly_issue_counts enable row level security;

revoke all on table public.swipe_ingest_hourly_metrics from anon, authenticated;
revoke all on table public.swipe_ingest_hourly_issue_counts from anon, authenticated;

-- 3) Upsert helper called by Edge (service_role)
create or replace function public.swipe_ingest_rollup_add_v1(
  p_bucket_start timestamptz,
  p_requests integer,
  p_accepted integer,
  p_rejected integer,
  p_retry integer,
  p_issue_counts jsonb,
  p_sample_rate numeric default 1
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  k text;
  v text;
  n integer;
begin
  insert into public.swipe_ingest_hourly_metrics(
    bucket_start, requests, accepted_events, rejected_events, retry_events, sample_rate, updated_at
  ) values (
    date_trunc('hour', p_bucket_start),
    greatest(coalesce(p_requests, 0), 0),
    greatest(coalesce(p_accepted, 0), 0),
    greatest(coalesce(p_rejected, 0), 0),
    greatest(coalesce(p_retry, 0), 0),
    coalesce(p_sample_rate, 1),
    now()
  )
  on conflict (bucket_start) do update
  set
    requests = public.swipe_ingest_hourly_metrics.requests + excluded.requests,
    accepted_events = public.swipe_ingest_hourly_metrics.accepted_events + excluded.accepted_events,
    rejected_events = public.swipe_ingest_hourly_metrics.rejected_events + excluded.rejected_events,
    retry_events = public.swipe_ingest_hourly_metrics.retry_events + excluded.retry_events,
    sample_rate = excluded.sample_rate,
    updated_at = now();

  if p_issue_counts is null or jsonb_typeof(p_issue_counts) <> 'object' then
    return;
  end if;

  for k, v in select key, value from jsonb_each_text(p_issue_counts) loop
    begin
      n := greatest(coalesce((v)::integer, 0), 0);
    exception when others then
      n := 0;
    end;

    if k is null or btrim(k) = '' then
      continue;
    end if;

    insert into public.swipe_ingest_hourly_issue_counts(bucket_start, code, count, updated_at)
    values (date_trunc('hour', p_bucket_start), btrim(k), n, now())
    on conflict (bucket_start, code) do update
    set
      count = public.swipe_ingest_hourly_issue_counts.count + excluded.count,
      updated_at = now();
  end loop;
end;
$$;

revoke all on function public.swipe_ingest_rollup_add_v1(timestamptz, integer, integer, integer, integer, jsonb, numeric) from public;
grant execute on function public.swipe_ingest_rollup_add_v1(timestamptz, integer, integer, integer, integer, jsonb, numeric) to service_role;

-- 4) Convenience view for admin charts
create or replace view public.swipe_ingest_hourly_health_v1
with (security_invoker = true) as
select
  bucket_start,
  requests,
  accepted_events,
  rejected_events,
  retry_events,
  case when (accepted_events + rejected_events + retry_events) > 0
    then rejected_events::numeric / (accepted_events + rejected_events + retry_events)
    else null
  end as rejection_rate,
  case when (accepted_events + rejected_events + retry_events) > 0
    then retry_events::numeric / (accepted_events + rejected_events + retry_events)
    else null
  end as retry_rate,
  sample_rate,
  updated_at
from public.swipe_ingest_hourly_metrics;

commit;
