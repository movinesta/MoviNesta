-- OpenRouter cache + usage logging schema and cron refresh job.

create table if not exists public.openrouter_models_cache (
  base_url text primary key,
  fetched_at timestamp with time zone default now() not null,
  payload jsonb default '{}'::jsonb not null
);

create table if not exists public.openrouter_credits_cache (
  base_url text primary key,
  fetched_at timestamp with time zone default now() not null,
  payload jsonb default '{}'::jsonb not null
);

create table if not exists public.openrouter_usage_cache (
  base_url text primary key,
  fetched_at timestamp with time zone default now() not null,
  payload jsonb default '{}'::jsonb not null
);

create table if not exists public.openrouter_endpoints_cache (
  base_url text primary key,
  fetched_at timestamp with time zone default now() not null,
  payload jsonb default '{}'::jsonb not null
);

create table if not exists public.openrouter_request_log (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default now() not null,
  fn text not null,
  request_id text,
  user_id uuid,
  conversation_id uuid,
  provider text,
  model text,
  base_url text,
  usage jsonb,
  upstream_request_id text,
  variant text,
  meta jsonb default '{}'::jsonb not null
);

create index if not exists openrouter_models_cache_fetched_at_idx
  on public.openrouter_models_cache (fetched_at desc);

create index if not exists openrouter_credits_cache_fetched_at_idx
  on public.openrouter_credits_cache (fetched_at desc);

create index if not exists openrouter_usage_cache_fetched_at_idx
  on public.openrouter_usage_cache (fetched_at desc);

create index if not exists openrouter_endpoints_cache_fetched_at_idx
  on public.openrouter_endpoints_cache (fetched_at desc);

create index if not exists openrouter_request_log_created_at_idx
  on public.openrouter_request_log (created_at desc);

create index if not exists openrouter_request_log_fn_created_at_idx
  on public.openrouter_request_log (fn, created_at desc);

create index if not exists openrouter_request_log_request_id_idx
  on public.openrouter_request_log (request_id);

alter table public.openrouter_models_cache enable row level security;
alter table public.openrouter_credits_cache enable row level security;
alter table public.openrouter_usage_cache enable row level security;
alter table public.openrouter_endpoints_cache enable row level security;
alter table public.openrouter_request_log enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'openrouter_models_cache'
      and policyname = 'openrouter_models_cache_anon_deny'
  ) then
    execute 'create policy openrouter_models_cache_anon_deny on public.openrouter_models_cache to anon using (false) with check (false)';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'openrouter_models_cache'
      and policyname = 'openrouter_models_cache_authenticated_deny'
  ) then
    execute 'create policy openrouter_models_cache_authenticated_deny on public.openrouter_models_cache to authenticated using (false) with check (false)';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'openrouter_models_cache'
      and policyname = 'openrouter_models_cache_service_role_all'
  ) then
    execute 'create policy openrouter_models_cache_service_role_all on public.openrouter_models_cache to service_role using (true) with check (true)';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'openrouter_credits_cache'
      and policyname = 'openrouter_credits_cache_anon_deny'
  ) then
    execute 'create policy openrouter_credits_cache_anon_deny on public.openrouter_credits_cache to anon using (false) with check (false)';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'openrouter_credits_cache'
      and policyname = 'openrouter_credits_cache_authenticated_deny'
  ) then
    execute 'create policy openrouter_credits_cache_authenticated_deny on public.openrouter_credits_cache to authenticated using (false) with check (false)';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'openrouter_credits_cache'
      and policyname = 'openrouter_credits_cache_service_role_all'
  ) then
    execute 'create policy openrouter_credits_cache_service_role_all on public.openrouter_credits_cache to service_role using (true) with check (true)';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'openrouter_usage_cache'
      and policyname = 'openrouter_usage_cache_anon_deny'
  ) then
    execute 'create policy openrouter_usage_cache_anon_deny on public.openrouter_usage_cache to anon using (false) with check (false)';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'openrouter_usage_cache'
      and policyname = 'openrouter_usage_cache_authenticated_deny'
  ) then
    execute 'create policy openrouter_usage_cache_authenticated_deny on public.openrouter_usage_cache to authenticated using (false) with check (false)';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'openrouter_usage_cache'
      and policyname = 'openrouter_usage_cache_service_role_all'
  ) then
    execute 'create policy openrouter_usage_cache_service_role_all on public.openrouter_usage_cache to service_role using (true) with check (true)';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'openrouter_endpoints_cache'
      and policyname = 'openrouter_endpoints_cache_anon_deny'
  ) then
    execute 'create policy openrouter_endpoints_cache_anon_deny on public.openrouter_endpoints_cache to anon using (false) with check (false)';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'openrouter_endpoints_cache'
      and policyname = 'openrouter_endpoints_cache_authenticated_deny'
  ) then
    execute 'create policy openrouter_endpoints_cache_authenticated_deny on public.openrouter_endpoints_cache to authenticated using (false) with check (false)';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'openrouter_endpoints_cache'
      and policyname = 'openrouter_endpoints_cache_service_role_all'
  ) then
    execute 'create policy openrouter_endpoints_cache_service_role_all on public.openrouter_endpoints_cache to service_role using (true) with check (true)';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'openrouter_request_log'
      and policyname = 'openrouter_request_log_anon_deny'
  ) then
    execute 'create policy openrouter_request_log_anon_deny on public.openrouter_request_log to anon using (false) with check (false)';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'openrouter_request_log'
      and policyname = 'openrouter_request_log_authenticated_deny'
  ) then
    execute 'create policy openrouter_request_log_authenticated_deny on public.openrouter_request_log to authenticated using (false) with check (false)';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'openrouter_request_log'
      and policyname = 'openrouter_request_log_service_role_all'
  ) then
    execute 'create policy openrouter_request_log_service_role_all on public.openrouter_request_log to service_role using (true) with check (true)';
  end if;
end $$;

grant all on table public.openrouter_models_cache to service_role;
grant all on table public.openrouter_credits_cache to service_role;
grant all on table public.openrouter_usage_cache to service_role;
grant all on table public.openrouter_endpoints_cache to service_role;
grant all on table public.openrouter_request_log to service_role;

do $$
declare
  job_sql text;
  existing_job_id integer;
begin
  job_sql := $job$
select
      net.http_post(
        url :=
          (select decrypted_secret
           from vault.decrypted_secrets
           where name = 'project_url')
          || '/functions/v1/openrouter-refresh',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          -- Use anon key as Bearer token so Authorization is present
          'Authorization',
            'Bearer ' ||
            (select decrypted_secret
             from vault.decrypted_secrets
             where name = 'anon_key'),
          'x-job-token',
            (select decrypted_secret
             from vault.decrypted_secrets
             where name = 'internal_job_token')
        ),
        body := jsonb_build_object(
          'reason', 'cron-openrouter-refresh'
        )
      ) as request_id;
$job$;

  select jobid into existing_job_id
  from cron.job
  where jobname = 'openrouter-refresh-hourly'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule('openrouter-refresh-hourly', '0 * * * *', job_sql);
end $$;
