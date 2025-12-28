-- Title rating summary RPC used by TitleDetailPageV2 / TitleReviewsPageV2
-- Aggregates from canonical tables:
--   - public.ratings (verified ratings)
--   - public.reviews (text reviews)
--
-- NOTE: This function is safe to run multiple times.

create or replace function public.get_title_rating_summary_v1(p_title_id uuid)
returns table (
  title_id uuid,
  reviews_count integer,
  ratings_count integer,
  average_rating_0_10 numeric,
  average_rating_0_5 numeric,
  stars_5 integer,
  stars_4 integer,
  stars_3 integer,
  stars_2 integer,
  stars_1 integer
)
language sql
stable
security definer
set search_path = public
as $$
  with
  r as (
    select rating
    from public.ratings
    where title_id = p_title_id
      and rating is not null
  ),
  buckets as (
    select
      case
        when rating is null then null
        else greatest(1, least(5, ceil((rating::numeric) / 2)))
      end as stars
    from r
  )
  select
    p_title_id as title_id,
    (select count(*) from public.reviews where title_id = p_title_id) as reviews_count,
    (select count(*) from public.ratings where title_id = p_title_id) as ratings_count,
    (select avg(rating) from r) as average_rating_0_10,
    (select avg(rating) / 2 from r) as average_rating_0_5,
    (select count(*) from buckets where stars = 5) as stars_5,
    (select count(*) from buckets where stars = 4) as stars_4,
    (select count(*) from buckets where stars = 3) as stars_3,
    (select count(*) from buckets where stars = 2) as stars_2,
    (select count(*) from buckets where stars = 1) as stars_1;
$$;

-- Allow clients to call via PostgREST (rpc endpoint)
grant execute on function public.get_title_rating_summary_v1(uuid) to anon, authenticated;
