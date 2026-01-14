-- 20260115_040000_recsys_experiments_all.sql
-- Consolidated recsys experiments admin changes (schema, RLS, functions, views, diagnostics).

begin;

-- -----------------------------------------------------------------------------
-- Experiments constraints + indexes
-- -----------------------------------------------------------------------------

alter table public.rec_experiments
  alter column created_at set default now(),
  alter column updated_at set default now();

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'rec_experiments_status_check'
      and conrelid = 'public.rec_experiments'::regclass
  ) then
    alter table public.rec_experiments drop constraint rec_experiments_status_check;
  end if;
end $$;

alter table public.rec_experiments
  add constraint rec_experiments_status_check
  check (status in ('draft','active','ended'));

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
    where c.conrelid = 'public.rec_experiments'::regclass
      and c.contype = 'u'
      and a.attname = 'key'
  ) then
    alter table public.rec_experiments
      add constraint rec_experiments_key_uk unique (key);
  end if;
end $$;

create index if not exists idx_rec_experiments_status on public.rec_experiments(status);
create index if not exists idx_rec_experiments_updated_at on public.rec_experiments(updated_at desc);
create index if not exists idx_rec_experiments_started_at on public.rec_experiments(started_at desc);

-- -----------------------------------------------------------------------------
-- Assignments: columns + indexes
-- -----------------------------------------------------------------------------

alter table public.rec_user_experiment_assignments
  add column if not exists assignment_mode text not null default 'auto',
  add column if not exists assigned_by uuid null;

create index if not exists idx_rec_assignments_user_time
  on public.rec_user_experiment_assignments(user_id, assigned_at desc);

create index if not exists idx_rec_assignments_exp_time
  on public.rec_user_experiment_assignments(experiment_id, assigned_at desc);

-- -----------------------------------------------------------------------------
-- RLS auth.uid initplan fixes
-- -----------------------------------------------------------------------------

-- rec_impressions policies
 drop policy if exists rec_impressions_select_own on public.rec_impressions;
create policy rec_impressions_select_own
  on public.rec_impressions
  for select
  to authenticated
  using (user_id = (select auth.uid()));

 drop policy if exists rec_impressions_insert_own on public.rec_impressions;
create policy rec_impressions_insert_own
  on public.rec_impressions
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

-- rec_outcomes policies
 drop policy if exists rec_outcomes_select_own on public.rec_outcomes;
create policy rec_outcomes_select_own
  on public.rec_outcomes
  for select
  to authenticated
  using (user_id = (select auth.uid()));

 drop policy if exists rec_outcomes_insert_own on public.rec_outcomes;
create policy rec_outcomes_insert_own
  on public.rec_outcomes
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

-- rec_user_experiment_assignments policy
 drop policy if exists rec_assignments_read_own on public.rec_user_experiment_assignments;
create policy rec_assignments_read_own
  on public.rec_user_experiment_assignments
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- recsys_user_prefs policy
 drop policy if exists recsys_user_prefs_owner_rw on public.recsys_user_prefs;
create policy recsys_user_prefs_owner_rw
  on public.recsys_user_prefs
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- cf_recos policy
 drop policy if exists "cf_recos_read_own" on public.cf_recos;
create policy "cf_recos_read_own"
  on public.cf_recos
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Function search_path hardening
-- -----------------------------------------------------------------------------

alter function public.tg_set_updated_at() set search_path = public;

-- -----------------------------------------------------------------------------
-- Experiments assignment helpers
-- -----------------------------------------------------------------------------

create or replace function public.rec_active_experiments()
returns table (id uuid, key text, variants jsonb, salt text)
language sql
stable
as $$
  select id, key, variants, salt
  from public.rec_experiments
  where status = 'active'
    and (ended_at is null or ended_at > now());
$$;

create or replace function public.rec_assign_variant(experiment_key text, user_id uuid)
returns text
language plpgsql
as $$
declare
  exp record;
  assignment text;
  total_weight numeric;
  pick numeric;
  variant_row record;
begin
  select id, key, variants, salt
    into exp
  from public.rec_experiments
  where key = experiment_key
    and status = 'active'
    and (ended_at is null or ended_at > now())
  limit 1;

  if exp.id is null then
    return null;
  end if;

  select variant
    into assignment
  from public.rec_user_experiment_assignments
  where experiment_id = exp.id
    and user_id = rec_assign_variant.user_id
  limit 1;

  if assignment is not null then
    return assignment;
  end if;

  select sum((v->>'weight')::numeric)
    into total_weight
  from jsonb_array_elements(exp.variants) as v
  where (v->>'weight') is not null
    and (v->>'name') is not null
    and (v->>'weight')::numeric > 0;

  if total_weight is null or total_weight <= 0 then
    total_weight := 1;
  end if;

  select (
    ('x' || substr(encode(digest(coalesce(exp.salt, '') || user_id::text, 'sha256'), 'hex'), 1, 16))::bit(64)::bigint
  )::numeric / 18446744073709551616::numeric
    into pick;

  pick := pick * total_weight;

  for variant_row in
    select v->>'name' as name, (v->>'weight')::numeric as weight
    from jsonb_array_elements(exp.variants) as v
    where (v->>'name') is not null
      and (v->>'weight') is not null
      and (v->>'weight')::numeric > 0
  loop
    pick := pick - variant_row.weight;
    if pick <= 0 and assignment is null then
      assignment := variant_row.name;
    end if;
  end loop;

  if assignment is null then
    assignment := 'control';
  end if;

  insert into public.rec_user_experiment_assignments (experiment_id, user_id, variant, assignment_mode)
  values (exp.id, rec_assign_variant.user_id, assignment, 'auto')
  on conflict (experiment_id, user_id)
  do update set
    variant = excluded.variant,
    assignment_mode = 'auto',
    assigned_by = null,
    assigned_at = now();

  return assignment;
end;
$$;

create or replace function public.rec_set_user_variant(
  experiment_key text,
  user_id uuid,
  variant text,
  admin_id uuid
)
returns void
language plpgsql
as $$
declare
  exp_id uuid;
begin
  select id
    into exp_id
  from public.rec_experiments
  where key = experiment_key
  limit 1;

  if exp_id is null then
    return;
  end if;

  insert into public.rec_user_experiment_assignments (
    experiment_id,
    user_id,
    variant,
    assignment_mode,
    assigned_by
  )
  values (
    exp_id,
    rec_set_user_variant.user_id,
    rec_set_user_variant.variant,
    'manual',
    admin_id
  )
  on conflict (experiment_id, user_id)
  do update set
    variant = excluded.variant,
    assignment_mode = 'manual',
    assigned_by = admin_id,
    assigned_at = now();
end;
$$;

-- -----------------------------------------------------------------------------
-- Views: ensure security invoker (no security definer)
-- -----------------------------------------------------------------------------

create or replace view public.rec_source_daily_metrics_v1
with (security_invoker='true')
as
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

comment on view public.rec_source_daily_metrics_v1 is
  'Daily metrics grouped by recommendation source and mode (composition + basic outcomes). Admin-only via Edge Functions.';

create or replace view public.rec_variant_daily_metrics_v1
with (security_invoker='true')
as
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

comment on view public.rec_variant_daily_metrics_v1 is
  'Daily experiment metrics derived from rec_impressions/rec_outcomes. Admin-only access via Edge Functions.';

create or replace view public.rec_genre_daily_metrics_v1
with (security_invoker='true')
as
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

create or replace view public.rec_health_daily_metrics_v1
with (security_invoker='true')
as
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

create or replace view public.rec_position_daily_metrics_v1
with (security_invoker='true')
as
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

create or replace view public.rec_alerts_daily_metrics_v1
with (security_invoker='true')
as
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
  (muted_impressions > 0) as alert_muted_leakage,
  (impressions >= 200 and like_rate_7d_avg is not null and like_rate < like_rate_7d_avg * 0.80) as alert_like_rate_drop,
  (impressions >= 200 and watchlist_rate_7d_avg is not null and watchlist_rate < watchlist_rate_7d_avg * 0.80) as alert_watchlist_rate_drop,
  (impressions >= 200 and cf_impressions = 0) as alert_cf_starvation
from with_baselines
order by day desc;

create or replace view public.rec_active_alerts_v1
with (security_invoker='true')
as
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

grant select on public.rec_alerts_daily_metrics_v1 to service_role;
grant select on public.rec_active_alerts_v1 to service_role;

-- -----------------------------------------------------------------------------
-- Diagnostics and assignment counts
-- -----------------------------------------------------------------------------

create or replace view public.rec_experiment_diagnostics_v1
with (security_invoker='true')
as
with recent_impressions as (
  select
    i.id,
    i.request_context
  from public.rec_impressions i
  where i.created_at >= now() - interval '7 days'
),
summary as (
  select
    count(*)::bigint as total_impressions,
    count(*) filter (
      where (request_context->'experiments') is null
        or (request_context->'experiments') = '{}'::jsonb
    )::bigint as missing_experiments
  from recent_impressions
),
outcomes_without as (
  select
    count(*)::bigint as outcomes_without_impression
  from public.rec_outcomes o
  left join public.rec_impressions i
    on i.user_id = o.user_id
   and i.rec_request_id = o.rec_request_id
   and i.media_item_id = o.media_item_id
  where o.created_at >= now() - interval '7 days'
    and i.id is null
)
select
  (now() - interval '7 days') as window_start,
  summary.total_impressions,
  summary.missing_experiments,
  case
    when summary.total_impressions > 0
      then summary.missing_experiments::double precision / summary.total_impressions
    else 0
  end as missing_ratio,
  outcomes_without.outcomes_without_impression
from summary
cross join outcomes_without;

comment on view public.rec_experiment_diagnostics_v1 is
  '7-day experiment tagging and outcome-join diagnostics for admin dashboard.';

grant select on public.rec_experiment_diagnostics_v1 to service_role;

create or replace view public.rec_experiment_assignment_counts_v1
with (security_invoker='true')
as
select
  e.key as experiment_key,
  a.variant,
  count(*)::bigint as assignments
from public.rec_user_experiment_assignments a
join public.rec_experiments e on e.id = a.experiment_id
group by e.key, a.variant;

comment on view public.rec_experiment_assignment_counts_v1 is
  'Assignment counts grouped by experiment key + variant for admin dashboards.';

grant select on public.rec_experiment_assignment_counts_v1 to service_role;

commit;
