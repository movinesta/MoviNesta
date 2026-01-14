-- 20260114_120000_admin_rec_variant_metrics_v1.sql
-- Admin-only analytics view for recommendation experiments.
-- Uses rec_impressions.request_context.experiments and joins to rec_outcomes.

create or replace view public.rec_variant_daily_metrics_v1 as
with impressions as (
  select
    date_trunc('day', i.created_at)::date as day,
    i.id as impression_id,
    i.user_id,
    i.rec_request_id,
    i.media_item_id,
    coalesce(i.request_context->'experiments', '{}'::jsonb) as experiments
  from public.rec_impressions i
),
expanded as (
  select
    day,
    impression_id,
    user_id,
    rec_request_id,
    media_item_id,
    e.key as experiment_key,
    e.value as variant
  from impressions
  cross join lateral jsonb_each_text(impressions.experiments) as e(key, value)
),
outcomes_agg as (
  select
    user_id,
    rec_request_id,
    media_item_id,
    bool_or(outcome_type = 'open_detail') as opened_detail,
    bool_or(outcome_type = 'like') as liked,
    bool_or(outcome_type = 'dislike') as disliked,
    bool_or(outcome_type = 'watchlist_add') as watchlist_add,
    bool_or(outcome_type = 'rating') as rated
  from public.rec_outcomes
  group by 1,2,3
)
select
  e.day,
  e.experiment_key,
  e.variant,
  count(*) as impressions,
  count(distinct e.user_id) as users,
  count(*) filter (where o.opened_detail) as detail_opens,
  count(*) filter (where o.liked) as likes,
  count(*) filter (where o.disliked) as dislikes,
  count(*) filter (where o.watchlist_add) as watchlist_adds,
  count(*) filter (where o.rated) as ratings,
  (count(*) filter (where o.liked))::float / nullif(count(*),0) as like_rate,
  (count(*) filter (where o.watchlist_add))::float / nullif(count(*),0) as watchlist_add_rate
from expanded e
left join outcomes_agg o
  on o.user_id = e.user_id
 and o.rec_request_id = e.rec_request_id
 and o.media_item_id = e.media_item_id
group by 1,2,3;

comment on view public.rec_variant_daily_metrics_v1 is
  'Daily experiment metrics derived from rec_impressions/rec_outcomes. Admin-only access via Edge Functions.';
