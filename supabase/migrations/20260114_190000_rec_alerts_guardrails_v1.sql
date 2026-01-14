-- 20260114_190000_rec_alerts_guardrails_v1.sql
-- Session 15: Guardrails & alerts views for Recsys Control Center
--
-- These are aggregate-only views consumed by admin-only Edge Functions.
-- No user PII beyond telemetry tables is exposed.

-- -----------------------------------------------------------------------------
-- Daily aggregate with simple guardrail signals
-- -----------------------------------------------------------------------------
create or replace view public.rec_alerts_daily_metrics_v1 as
with
impress as (
  select
    date_trunc('day', i.created_at)::date as day,
    count(*)::bigint as impressions
  from public.rec_impressions i
  group by 1
),
outc as (
  select
    date_trunc('day', o.created_at)::date as day,
    count(*) filter (where o.outcome_type in ('like','more_like_this'))::bigint as likes,
    count(*) filter (where o.outcome_type in ('dislike','not_interested','hide'))::bigint as dislikes,
    count(*) filter (where o.outcome_type in ('watchlist_add'))::bigint as watchlist_adds,
    count(*) filter (where o.outcome_type in ('detail_open','open_detail'))::bigint as detail_opens
  from public.rec_outcomes o
  group by 1
),
src as (
  select
    day,
    sum(impressions)::bigint as impressions,
    sum(impressions) filter (where source = 'cf')::bigint as cf_impressions
  from public.rec_source_daily_metrics_v1
  group by 1
),
muted as (
  select
    day,
    sum(muted_impressions)::bigint as muted_impressions
  from public.rec_genre_daily_metrics_v1
  group by 1
),
joined as (
  select
    coalesce(i.day, o.day, s.day, m.day) as day,
    coalesce(i.impressions, s.impressions, 0) as impressions,
    coalesce(o.likes, 0) as likes,
    coalesce(o.dislikes, 0) as dislikes,
    coalesce(o.watchlist_adds, 0) as watchlist_adds,
    coalesce(o.detail_opens, 0) as detail_opens,
    coalesce(s.cf_impressions, 0) as cf_impressions,
    coalesce(m.muted_impressions, 0) as muted_impressions
  from impress i
  full outer join outc o using(day)
  full outer join src s using(day)
  full outer join muted m using(day)
),
rates as (
  select
    day,
    impressions,
    likes,
    dislikes,
    watchlist_adds,
    detail_opens,
    cf_impressions,
    muted_impressions,
    case when impressions > 0 then likes::double precision / impressions else 0 end as like_rate,
    case when impressions > 0 then dislikes::double precision / impressions else 0 end as dislike_rate,
    case when impressions > 0 then watchlist_adds::double precision / impressions else 0 end as watchlist_rate,
    case when impressions > 0 then detail_opens::double precision / impressions else 0 end as detail_open_rate,
    case when impressions > 0 then cf_impressions::double precision / impressions else 0 end as cf_share
  from joined
),
with_baselines as (
  select
    r.*,
    avg(r.like_rate) over (order by r.day rows between 7 preceding and 1 preceding) as like_rate_7d_avg,
    avg(r.watchlist_rate) over (order by r.day rows between 7 preceding and 1 preceding) as watchlist_rate_7d_avg
  from rates r
)
select
  day,
  impressions,
  likes,
  dislikes,
  watchlist_adds,
  detail_opens,
  cf_impressions,
  muted_impressions,
  like_rate,
  dislike_rate,
  watchlist_rate,
  detail_open_rate,
  cf_share,
  like_rate_7d_avg,
  watchlist_rate_7d_avg,
  -- Guardrails (simple, explainable)
  (muted_impressions > 0) as alert_muted_leakage,
  (impressions >= 200 and like_rate_7d_avg is not null and like_rate < like_rate_7d_avg * 0.80) as alert_like_rate_drop,
  (impressions >= 200 and watchlist_rate_7d_avg is not null and watchlist_rate < watchlist_rate_7d_avg * 0.80) as alert_watchlist_rate_drop,
  (impressions >= 200 and cf_impressions = 0) as alert_cf_starvation
from with_baselines
order by day desc;

-- -----------------------------------------------------------------------------
-- Flattened "active alerts" for easy UI rendering
-- -----------------------------------------------------------------------------
create or replace view public.rec_active_alerts_v1 as
with d as (
  select * from public.rec_alerts_daily_metrics_v1
)
select
  day,
  'muted_leakage'::text as alert_key,
  'high'::text as severity,
  'Muted-genre leakage detected (muted impressions > 0).'::text as message
from d
where alert_muted_leakage
union all
select
  day,
  'like_rate_drop'::text,
  'medium'::text,
  'Like-rate dropped >20% vs trailing 7-day average (with enough impressions).'::text
from d
where alert_like_rate_drop
union all
select
  day,
  'watchlist_rate_drop'::text,
  'medium'::text,
  'Watchlist-add rate dropped >20% vs trailing 7-day average (with enough impressions).'::text
from d
where alert_watchlist_rate_drop
union all
select
  day,
  'cf_starvation'::text,
  'low'::text,
  'CF share is zero with sufficient traffic (CF not being served or not trained/published).'::text
from d
where alert_cf_starvation
order by day desc;

-- Permissions: views are accessed by service role via admin edge functions.
grant select on public.rec_alerts_daily_metrics_v1 to service_role;
grant select on public.rec_active_alerts_v1 to service_role;
