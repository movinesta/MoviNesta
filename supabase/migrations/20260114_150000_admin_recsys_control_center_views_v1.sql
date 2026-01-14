-- 20260114_150000_admin_recsys_control_center_views_v1.sql
-- Session 12: Recsys Control Center (admin dashboard)
--
-- Purpose
--   Provide admin-only analytics views derived from existing telemetry tables:
--     - public.rec_impressions (what we served)
--     - public.rec_outcomes    (what users did)
--
-- Notes
--   These views are consumed via admin-only Edge Functions (service role) and
--   are intentionally aggregate-only (no PII beyond ids already in telemetry).

-- -----------------------------------------------------------------------------
-- 1) Source / mode composition
-- -----------------------------------------------------------------------------

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
    bool_or(outcome_type = 'open_detail') as opened_detail,
    bool_or(outcome_type = 'like') as liked,
    bool_or(outcome_type = 'dislike') as disliked,
    bool_or(outcome_type = 'watchlist_add') as watchlist_add,
    bool_or(outcome_type = 'rating') as rated
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

comment on view public.rec_source_daily_metrics_v1 is
  'Daily metrics grouped by recommendation source and mode (composition + basic outcomes). Admin-only via Edge Functions.';

-- -----------------------------------------------------------------------------
-- 2) Genre exposure + drift vs catalog + muted leakage
-- -----------------------------------------------------------------------------

create or replace view public.rec_genre_daily_metrics_v1 as
with imp as (
  select
    i.id as impression_id,
    date_trunc('day', i.created_at)::date as day,
    i.user_id,
    i.media_item_id
  from public.rec_impressions i
),
imp_genres as (
  select
    imp.day,
    imp.user_id,
    imp.impression_id,
    g.slug as genre_slug
  from imp
  join public.media_items m on m.id = imp.media_item_id
  cross join lateral unnest(coalesce(m.tmdb_genre_ids, '{}'::int[])) as gid
  join public.genres g on g.id = gid
),
day_totals as (
  select day, count(distinct impression_id) as total_impressions
  from imp
  group by 1
),
catalog_genres as (
  select
    g.slug as genre_slug,
    count(*)::float as n
  from public.media_items m
  cross join lateral unnest(coalesce(m.tmdb_genre_ids, '{}'::int[])) as gid
  join public.genres g on g.id = gid
  group by 1
),
catalog_total as (
  select sum(n) as total_n from catalog_genres
),
genre_daily as (
  select
    day,
    genre_slug,
    count(distinct impression_id) as impressions,
    count(distinct user_id) as users
  from imp_genres
  group by 1,2
),
muted_daily as (
  select
    ig.day,
    ig.genre_slug,
    count(distinct ig.impression_id) as muted_impressions
  from imp_genres ig
  join public.recsys_user_prefs p on p.user_id = ig.user_id
  where ig.genre_slug = any(p.muted_genres)
  group by 1,2
)
select
  gd.day,
  gd.genre_slug,
  gd.impressions,
  gd.users,
  (gd.impressions)::float / nullif(dt.total_impressions, 0) as share_day,
  (cg.n)::float / nullif(ct.total_n, 0) as share_catalog,
  coalesce(md.muted_impressions, 0) as muted_impressions
from genre_daily gd
join day_totals dt on dt.day = gd.day
left join catalog_genres cg on cg.genre_slug = gd.genre_slug
cross join catalog_total ct
left join muted_daily md on md.day = gd.day and md.genre_slug = gd.genre_slug;

comment on view public.rec_genre_daily_metrics_v1 is
  'Daily genre exposure metrics from rec_impressions joined to media_items.tmdb_genre_ids. Includes share vs catalog and muted-genre leakage count. Admin-only via Edge Functions.';

-- -----------------------------------------------------------------------------
-- 3) Basic health counters (volume + key flags)
-- -----------------------------------------------------------------------------

create or replace view public.rec_health_daily_metrics_v1 as
with base as (
  select
    date_trunc('day', i.created_at)::date as day,
    i.user_id,
    i.rec_request_id,
    i.source,
    i.request_context
  from public.rec_impressions i
),
decks as (
  select
    day,
    rec_request_id,
    max(
      case
        when request_context ? 'mix_applied' then (request_context->>'mix_applied')::boolean
        else false
      end
    ) as mix_applied,
    max(
      case
        when request_context ? 'blend_applied' then (request_context->>'blend_applied')::boolean
        else false
      end
    ) as blend_applied,
    max(
      case
        when request_context ? 'diversity_applied' then (request_context->>'diversity_applied')::boolean
        else false
      end
    ) as diversity_applied
  from base
  group by 1,2
)
select
  b.day,
  count(distinct b.rec_request_id) as decks,
  count(*) as impressions,
  count(distinct b.user_id) as users,
  count(*) filter (where b.source = 'cf') as cf_impressions,
  count(*) filter (where b.source = 'seg_pop') as seg_pop_impressions,
  count(*) filter (where b.source = 'friends') as friends_impressions,
  count(*) filter (where b.source = 'trending') as trending_impressions,
  count(*) filter (where b.source = 'for_you') as for_you_impressions,
  count(*) filter (where d.mix_applied) as impressions_in_mix_decks,
  count(*) filter (where d.blend_applied) as impressions_in_blend_decks,
  count(*) filter (where d.diversity_applied) as impressions_in_diversity_decks
from base b
left join decks d
  on d.day = b.day
 and d.rec_request_id = b.rec_request_id
group by 1;

comment on view public.rec_health_daily_metrics_v1 is
  'Daily volume + key feature flags derived from rec_impressions.request_context. Admin-only via Edge Functions.';
