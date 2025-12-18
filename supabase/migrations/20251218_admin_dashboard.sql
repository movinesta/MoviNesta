-- 2025-12-18 Admin dashboard + observability for MoviNesta
-- Safe to run multiple times.

begin;

-- =========================
-- Admin tables
-- =========================
create table if not exists public.app_admins (
  user_id uuid primary key,
  role text not null default 'admin',
  created_at timestamptz not null default now()
);

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  admin_user_id uuid not null,
  action text not null,
  target text not null,
  details jsonb not null default '{}'::jsonb
);

create index if not exists admin_audit_log_created_at_idx on public.admin_audit_log (created_at desc);

create table if not exists public.job_run_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  job_name text not null,
  provider text,
  model text,
  ok boolean not null default false,
  scanned integer,
  embedded integer,
  skipped_existing integer,
  total_tokens bigint,
  error_code text,
  error_message text,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists job_run_log_started_at_idx on public.job_run_log (started_at desc);
create index if not exists job_run_log_ok_idx on public.job_run_log (ok);
create index if not exists job_run_log_job_name_idx on public.job_run_log (job_name);

-- =========================
-- Embedding settings additions
-- =========================
alter table if exists public.embedding_settings
  add column if not exists rerank_swipe_enabled boolean not null default false;

alter table if exists public.embedding_settings
  add column if not exists rerank_search_enabled boolean not null default false;

alter table if exists public.embedding_settings
  add column if not exists rerank_top_k integer not null default 50;

-- =========================
-- RLS hardening (admin tables should never be readable from client)
-- =========================
alter table public.app_admins enable row level security;
alter table public.admin_audit_log enable row level security;
alter table public.job_run_log enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='app_admins' and policyname='deny_all') then
    create policy deny_all on public.app_admins for all using (false) with check (false);
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='admin_audit_log' and policyname='deny_all') then
    create policy deny_all on public.admin_audit_log for all using (false) with check (false);
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='job_run_log' and policyname='deny_all') then
    create policy deny_all on public.job_run_log for all using (false) with check (false);
  end if;
end$$;

-- =========================
-- Admin RPCs
-- =========================

-- Search users (server-side only)
create or replace function public.admin_search_users(
  p_search text,
  p_limit integer,
  p_offset integer
)
returns table (
  id uuid,
  email text,
  created_at timestamptz,
  banned_until timestamptz
)
language sql
security definer
set search_path = auth, public
as $$
  select u.id, u.email, u.created_at, u.banned_until
  from auth.users u
  where (p_search is null)
     or (u.email ilike ('%' || p_search || '%'))
  order by u.created_at desc
  limit greatest(1, least(p_limit, 200))
  offset greatest(p_offset, 0);
$$;

revoke all on function public.admin_search_users(text, integer, integer) from public;
grant execute on function public.admin_search_users(text, integer, integer) to service_role;

-- =========================
-- pg_cron helpers (server-side only)
-- =========================
create table if not exists public.admin_cron_registry (
  jobname text primary key,
  schedule text not null,
  command text not null,
  updated_at timestamptz not null default now()
);

-- Best-effort: capture any existing cron jobs into the registry (if pg_cron exists)
do $$
begin
  if to_regclass('cron.job') is not null then
    insert into public.admin_cron_registry(jobname, schedule, command, updated_at)
    select j.jobname, j.schedule, j.command, now()
    from cron.job j
    where j.jobname is not null
    on conflict (jobname) do update
      set schedule = excluded.schedule,
          command = excluded.command,
          updated_at = now();
  end if;
end$$;

create or replace function public.admin_list_cron_jobs()
returns table (
  jobid integer,
  jobname text,
  schedule text,
  active boolean
)
language plpgsql
security definer
set search_path = public, cron
as $$
begin
  if to_regclass('cron.job') is null then
    raise exception 'pg_cron is not installed';
  end if;

  return query
  with current_jobs as (
    select j.jobid, j.jobname, j.schedule, true as active
    from cron.job j
  ),
  registry_only as (
    select null::integer as jobid, r.jobname, r.schedule, false as active
    from public.admin_cron_registry r
    where not exists (select 1 from cron.job j where j.jobname = r.jobname)
  )
  select * from current_jobs
  union all
  select * from registry_only
  order by jobname;
end;
$$;

revoke all on function public.admin_list_cron_jobs() from public;
grant execute on function public.admin_list_cron_jobs() to service_role;

create or replace function public.admin_set_cron_active(p_jobname text, p_active boolean)
returns void
language plpgsql
security definer
set search_path = public, cron
as $$
declare
  v_jobid integer;
  v_schedule text;
  v_command text;
begin
  if to_regclass('cron.job') is null then
    raise exception 'pg_cron is not installed';
  end if;

  if p_jobname is null or length(trim(p_jobname)) = 0 then
    raise exception 'jobname required';
  end if;

  select j.jobid into v_jobid
  from cron.job j
  where j.jobname = p_jobname
  limit 1;

  if p_active = false then
    if v_jobid is not null then
      perform cron.unschedule(v_jobid);
    end if;
    return;
  end if;

  -- enabling
  -- if already scheduled, nothing to do
  if v_jobid is not null then
    return;
  end if;

  -- ensure registry has schedule+command
  select r.schedule, r.command into v_schedule, v_command
  from public.admin_cron_registry r
  where r.jobname = p_jobname;

  if v_schedule is null or v_command is null then
    -- last chance: try to pull from cron.job by jobname (older row) - but job isn't scheduled now
    raise exception 'Cron job % is not in registry. Re-create it once via SQL, then it will appear here.', p_jobname;
  end if;

  perform cron.schedule(p_jobname, v_schedule, v_command);
end;
$$;

revoke all on function public.admin_set_cron_active(text, boolean) from public;
grant execute on function public.admin_set_cron_active(text, boolean) to service_role;

commit;
