-- Recsys Control Center: position-based metrics (daily)
-- Provides funnel metrics by served position for analysis and UI charts.

begin;

create or replace view public.rec_position_daily_metrics_v1 as
with imp as (
  select
    date_trunc('day', i.created_at)::date as day,
    i.user_id,
    i.rec_request_id,
    i.media_item_id,
    i.position
  from public.rec_impressions i
),
outc as (
  select
    o.user_id,
    o.rec_request_id,
    o.media_item_id,
    o.outcome_type,
    o.created_at
  from public.rec_outcomes o
)
select
  imp.day,
  imp.position,
  count(*)::bigint as impressions,
  count(*) filter (where o.outcome_type in ('like','more_like_this'))::bigint as likes,
  count(*) filter (where o.outcome_type in ('dislike','not_interested','hide'))::bigint as dislikes,
  count(*) filter (where o.outcome_type = 'watchlist_add')::bigint as watchlist_adds,
  count(*) filter (where o.outcome_type in ('detail_open','open_detail'))::bigint as detail_opens,
  (count(*) filter (where o.outcome_type in ('like','more_like_this'))::numeric / nullif(count(*)::numeric, 0)) as like_rate,
  (count(*) filter (where o.outcome_type in ('dislike','not_interested','hide'))::numeric / nullif(count(*)::numeric, 0)) as dislike_rate
from imp
left join lateral (
  select o.outcome_type
  from outc o
  where o.user_id = imp.user_id
    and o.rec_request_id = imp.rec_request_id
    and o.media_item_id = imp.media_item_id
    and o.created_at >= (imp.day::timestamptz)
    and o.created_at < (imp.day::timestamptz + interval '1 day')
  order by o.created_at asc
  limit 1
) o on true
group by imp.day, imp.position
order by imp.day desc, imp.position asc;

grant select on public.rec_position_daily_metrics_v1 to authenticated;

commit;
