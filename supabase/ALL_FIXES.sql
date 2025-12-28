-- MoviNesta consolidated fixes (idempotent)

-- -----------------------------------------------------------------------------
-- 1) Rate limit state table + RPC
-- -----------------------------------------------------------------------------
create table if not exists public.rate_limit_state (
  rl_key text not null,
  action text not null,
  window_start timestamptz not null,
  count int not null,
  primary key (rl_key, action)
);

alter table public.rate_limit_state enable row level security;

drop policy if exists rate_limit_state_deny_all on public.rate_limit_state;
create policy rate_limit_state_deny_all
  on public.rate_limit_state
  for all
  to anon, authenticated
  using (false)
  with check (false);

create or replace function public.check_rate_limit(
  p_key text,
  p_action text,
  p_max_per_minute int
) returns table(
  ok boolean,
  remaining int,
  reset_at timestamptz,
  retry_after_seconds int
)
language plpgsql
security definer
set search_path to public
as $$
declare
  v_now timestamptz := now();
  v_window_start timestamptz := date_trunc('minute', v_now);
  v_count int;
  v_reset timestamptz;
begin
  if p_key is null or p_key = '' or p_action is null or p_action = '' then
    return query select true, null::int, v_window_start + interval '1 minute', 0;
    return;
  end if;

  if p_max_per_minute is null or p_max_per_minute <= 0 then
    return query select true, null::int, v_window_start + interval '1 minute', 0;
    return;
  end if;

  insert into public.rate_limit_state (rl_key, action, window_start, count)
  values (p_key, p_action, v_window_start, 1)
  on conflict (rl_key, action) do update
    set window_start = case
      when public.rate_limit_state.window_start = v_window_start
        then public.rate_limit_state.window_start
      else v_window_start
    end,
    count = case
      when public.rate_limit_state.window_start = v_window_start
        then public.rate_limit_state.count + 1
      else 1
    end
  returning count, window_start into v_count, v_window_start;

  v_reset := v_window_start + interval '1 minute';

  return query select
    (v_count <= p_max_per_minute),
    greatest(p_max_per_minute - v_count, 0),
    v_reset,
    case
      when v_count <= p_max_per_minute then 0
      else greatest(ceil(extract(epoch from (v_reset - v_now)))::int, 1)
    end;
end;
$$;

grant execute on function public.check_rate_limit(text, text, int) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2) RLS write policies for diary tables
-- -----------------------------------------------------------------------------
-- ratings

drop policy if exists ratings_insert_self on public.ratings;
drop policy if exists ratings_update_self on public.ratings;
drop policy if exists ratings_delete_self on public.ratings;

create policy ratings_insert_self
  on public.ratings
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy ratings_update_self
  on public.ratings
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy ratings_delete_self
  on public.ratings
  for delete
  to authenticated
  using (user_id = auth.uid());

-- library_entries

drop policy if exists library_entries_insert_self on public.library_entries;
drop policy if exists library_entries_update_self on public.library_entries;
drop policy if exists library_entries_delete_self on public.library_entries;

create policy library_entries_insert_self
  on public.library_entries
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy library_entries_update_self
  on public.library_entries
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy library_entries_delete_self
  on public.library_entries
  for delete
  to authenticated
  using (user_id = auth.uid());

-- reviews

drop policy if exists reviews_insert_self on public.reviews;
drop policy if exists reviews_update_self on public.reviews;
drop policy if exists reviews_delete_self on public.reviews;

create policy reviews_insert_self
  on public.reviews
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy reviews_update_self
  on public.reviews
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy reviews_delete_self
  on public.reviews
  for delete
  to authenticated
  using (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 3) Activity feed triggers
-- -----------------------------------------------------------------------------
create or replace function public.handle_rating_insert_activity()
returns trigger
language plpgsql
security definer
set search_path to public
as $$
begin
  insert into public.activity_events (user_id, event_type, title_id, media_item_id, payload)
  values (
    new.user_id,
    'rating_created',
    new.title_id::text,
    new.title_id,
    jsonb_build_object('rating', new.rating)
  );
  return new;
end;
$$;

drop trigger if exists ratings_activity_insert on public.ratings;
create trigger ratings_activity_insert
  after insert on public.ratings
  for each row
  execute function public.handle_rating_insert_activity();

create or replace function public.handle_review_insert_activity()
returns trigger
language plpgsql
security definer
set search_path to public
as $$
declare
  v_snippet text;
begin
  v_snippet := case
    when new.body is null then null
    else left(new.body, 240)
  end;

  insert into public.activity_events (user_id, event_type, title_id, media_item_id, payload)
  values (
    new.user_id,
    'review_created',
    new.title_id::text,
    new.title_id,
    jsonb_build_object(
      'rating', new.rating,
      'headline', new.headline,
      'review_snippet', v_snippet
    )
  );
  return new;
end;
$$;

drop trigger if exists reviews_activity_insert on public.reviews;
create trigger reviews_activity_insert
  after insert on public.reviews
  for each row
  execute function public.handle_review_insert_activity();

create or replace function public.handle_library_entry_activity()
returns trigger
language plpgsql
security definer
set search_path to public
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'want_to_watch' then
      insert into public.activity_events (user_id, event_type, title_id, media_item_id, payload)
      values (
        new.user_id,
        'watchlist_added',
        new.title_id::text,
        new.title_id,
        jsonb_build_object('status', new.status)
      );
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      if new.status = 'want_to_watch' then
        insert into public.activity_events (user_id, event_type, title_id, media_item_id, payload)
        values (
          new.user_id,
          'watchlist_added',
          new.title_id::text,
          new.title_id,
          jsonb_build_object('status', new.status)
        );
      elsif old.status = 'want_to_watch' and new.status <> 'want_to_watch' then
        insert into public.activity_events (user_id, event_type, title_id, media_item_id, payload)
        values (
          new.user_id,
          'watchlist_removed',
          new.title_id::text,
          new.title_id,
          jsonb_build_object('status', new.status)
        );
      end if;
    end if;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists library_entries_activity_write on public.library_entries;
create trigger library_entries_activity_write
  after insert or update on public.library_entries
  for each row
  execute function public.handle_library_entry_activity();

-- -----------------------------------------------------------------------------
-- 4) Feed privacy filter
-- -----------------------------------------------------------------------------
create or replace function public.get_home_feed_v2(
  p_user_id uuid,
  p_limit integer default 40,
  p_cursor_created_at timestamp with time zone default null,
  p_cursor_id uuid default null
)
returns table(
  id uuid,
  created_at timestamp with time zone,
  user_id uuid,
  event_type public.activity_event_type,
  media_item_id uuid,
  related_user_id uuid,
  payload jsonb,
  actor_profile jsonb,
  media_item jsonb
)
language plpgsql
security definer
set search_path to 'public'
as $_$
declare
  effective_limit integer := least(coalesce(p_limit, 40), 200);
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'Not authorized';
  end if;

  return query
  with base as (
    select e.*
    from public.activity_events e
    where (
      e.user_id = p_user_id
      or e.user_id in (select f.followed_id from public.follows f where f.follower_id = p_user_id)
    )
    and public.can_view_profile(e.user_id)
    and (
      p_cursor_created_at is null
      or (e.created_at, e.id) < (
        p_cursor_created_at,
        coalesce(p_cursor_id, '00000000-0000-0000-0000-000000000000'::uuid)
      )
    )
    order by e.created_at desc, e.id desc
    limit effective_limit + 1
  )
  select
    b.id,
    b.created_at,
    b.user_id,
    b.event_type,
    coalesce(
      b.media_item_id,
      (case
        when b.title_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then b.title_id::uuid
        else null
      end)
    ) as media_item_id,
    b.related_user_id,
    b.payload,
    jsonb_build_object(
      'id', p.id,
      'display_name', p.display_name,
      'username', p.username,
      'avatar_url', p.avatar_url
    ) as actor_profile,
    jsonb_build_object(
      'id', mi.id,
      'kind', mi.kind,
      'tmdb_title', mi.tmdb_title,
      'tmdb_name', mi.tmdb_name,
      'tmdb_original_title', mi.tmdb_original_title,
      'tmdb_original_name', mi.tmdb_original_name,
      'tmdb_poster_path', mi.tmdb_poster_path,
      'tmdb_backdrop_path', mi.tmdb_backdrop_path,
      'tmdb_original_language', mi.tmdb_original_language,
      'tmdb_release_date', mi.tmdb_release_date,
      'tmdb_first_air_date', mi.tmdb_first_air_date,
      'omdb_title', mi.omdb_title,
      'omdb_year', mi.omdb_year,
      'omdb_poster', mi.omdb_poster,
      'omdb_rated', mi.omdb_rated,
      'omdb_imdb_rating', mi.omdb_imdb_rating,
      'omdb_rating_rotten_tomatoes', mi.omdb_rating_rotten_tomatoes,
      'omdb_imdb_id', mi.omdb_imdb_id,
      'tmdb_id', mi.tmdb_id
    ) as media_item
  from base b
  join public.profiles p on p.id = b.user_id
  left join public.media_items mi on mi.id = coalesce(
    b.media_item_id,
    (case
      when b.title_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then b.title_id::uuid
      else null
    end)
  )
  order by b.created_at desc, b.id desc;
end;
$_$;
