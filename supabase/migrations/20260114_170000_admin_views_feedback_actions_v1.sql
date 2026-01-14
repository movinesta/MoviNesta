-- 20260114_170000_admin_views_feedback_actions_v1.sql
-- Session 13: Extend admin recsys views to treat fine-grained feedback actions
-- ("more_like_this", "not_interested", "hide") as first-class outcomes.
--
-- This keeps dashboard KPIs stable while improving correctness of like/dislike counts.

-- Update composition view
create or replace view public.rec_source_daily_metrics_v1 as
with impressions as (
  select
    date_trunc('day', i.created_at)::date as day,
    i.id as impression_id,
    i.user_id,
    i.rec_request_id,
    i.media_item_id,
    coalesce(nullif(i.source, ''), 'unknown') as source,
    coalesce(nullif(i.request_context->>'mode', ''), 'unknown') as mode
  from public.rec_impressions i
),
outcomes_agg as (
  select
    user_id,
    rec_request_id,
    media_item_id,
    bool_or(outcome_type in ('open_detail','detail_open')) as opened_detail,
    bool_or(outcome_type in ('like','more_like_this')) as liked,
    bool_or(outcome_type in ('dislike','not_interested','hide')) as disliked,
    bool_or(outcome_type in ('watchlist_add','watchlist')) as watchlist_add,
    bool_or(outcome_type in ('rating','rating_set')) as rated
  from public.rec_outcomes
  group by 1,2,3
)
select
  i.day,
  i.mode,
  i.source,
  count(*) as impressions,
  count(distinct i.user_id) as users,
  count(*) filter (where o.opened_detail) as detail_opens,
  count(*) filter (where o.liked) as likes,
  count(*) filter (where o.disliked) as dislikes,
  count(*) filter (where o.watchlist_add) as watchlist_adds,
  count(*) filter (where o.rated) as ratings,
  (count(*) filter (where o.liked))::float / nullif(count(*), 0) as like_rate,
  (count(*) filter (where o.watchlist_add))::float / nullif(count(*), 0) as watchlist_add_rate
from impressions i
left join outcomes_agg o
  on o.user_id = i.user_id
 and o.rec_request_id = i.rec_request_id
 and o.media_item_id = i.media_item_id
group by 1,2,3;

-- Update variant view
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
    bool_or(outcome_type in ('open_detail','detail_open')) as opened_detail,
    bool_or(outcome_type in ('like','more_like_this')) as liked,
    bool_or(outcome_type in ('dislike','not_interested','hide')) as disliked,
    bool_or(outcome_type in ('watchlist_add','watchlist')) as watchlist_add,
    bool_or(outcome_type in ('rating','rating_set')) as rated
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
