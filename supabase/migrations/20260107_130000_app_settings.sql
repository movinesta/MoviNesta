-- Migration: 20260107_130000_app_settings
-- Description: Generic non-secret app settings with scopes, history, and meta versioning.
--
-- IMPORTANT SECURITY NOTES:
-- - Store ONLY non-secret values in these tables.
-- - Secrets (API keys/service role keys) must remain in Edge Function env (or Vault).

begin;

-- 1) Settings table (non-secret config)
create table if not exists public.app_settings (
  key text primary key,
  scope text not null check (scope in ('public','admin','server_only')),
  value jsonb not null,
  description text null,
  version bigint not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id)
);

create index if not exists app_settings_scope_idx on public.app_settings(scope);

alter table public.app_settings enable row level security;

drop policy if exists app_settings_public_select on public.app_settings;
create policy app_settings_public_select
on public.app_settings for select
to anon, authenticated
using (scope = 'public');

drop policy if exists app_settings_service_role_all on public.app_settings;
create policy app_settings_service_role_all
on public.app_settings for all
to service_role
using (true)
with check (true);

-- 2) Meta table for a single monotonic version counter
create table if not exists public.app_settings_meta (
  id integer primary key,
  version bigint not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.app_settings_meta enable row level security;

drop policy if exists app_settings_meta_public_select on public.app_settings_meta;
create policy app_settings_meta_public_select
on public.app_settings_meta for select
to anon, authenticated
using (true);

drop policy if exists app_settings_meta_service_role_all on public.app_settings_meta;
create policy app_settings_meta_service_role_all
on public.app_settings_meta for all
to service_role
using (true)
with check (true);

insert into public.app_settings_meta (id, version)
values (1, 1)
on conflict (id) do nothing;

create or replace function public.bump_app_settings_meta()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.app_settings_meta
     set version = version + 1,
         updated_at = now()
   where id = 1;
  return null;
end;
$$;

drop trigger if exists trg_bump_app_settings_meta on public.app_settings;
create trigger trg_bump_app_settings_meta
after insert or update or delete on public.app_settings
for each statement
execute function public.bump_app_settings_meta();

-- 3) Settings history (write-only, service_role only)
create table if not exists public.app_settings_history (
  id bigserial primary key,
  key text not null,
  scope text not null check (scope in ('public','admin','server_only')),
  old_value jsonb null,
  new_value jsonb null,
  old_version bigint null,
  new_version bigint null,
  change_reason text null,
  request_id text null,
  changed_at timestamptz not null default now(),
  changed_by uuid null references auth.users(id)
);

create index if not exists app_settings_history_key_changed_at_idx
on public.app_settings_history(key, changed_at desc);

alter table public.app_settings_history enable row level security;

drop policy if exists app_settings_history_service_role_all on public.app_settings_history;
create policy app_settings_history_service_role_all
on public.app_settings_history for all
to service_role
using (true)
with check (true);

-- 4) Seed public defaults (keep behavior identical until frontend opts-in)
insert into public.app_settings (key, scope, value, description)
values
  ('ux.presence.channel', 'public', to_jsonb('presence:global'::text), 'Realtime presence channel base name.'),
  ('ux.presence.online_ttl_ms', 'public', to_jsonb(45000), 'Presence: considered online if last_seen age <= this window (ms).'),
  ('ux.presence.away_ttl_ms', 'public', to_jsonb(120000), 'Presence: considered away if last_seen age <= this window (ms).'),
  ('ux.presence.heartbeat_ms', 'public', to_jsonb(20000), 'Presence: how often the client re-tracks presence (ms).'),
  ('ux.presence.recompute_ms', 'public', to_jsonb(5000), 'Presence: how often the client recomputes time-based status (ms).'),
  ('ux.presence.db_touch_min_interval_ms', 'public', to_jsonb(60000), 'Presence: minimum interval between best-effort last_seen DB updates (ms).'),
  ('ux.presence.initial_sync_delay_ms', 'public', to_jsonb(150), 'Presence: delay before forcing a sync after subscribe (ms).'),
  ('ux.typing.inactivity_ms', 'public', to_jsonb(3000), 'Typing: stop typing after this many ms without input.'),
  ('ux.typing.heartbeat_ms', 'public', to_jsonb(2000), 'Typing: re-broadcast typing at most once per heartbeat (ms).'),
  ('ux.typing.remote_ttl_ms', 'public', to_jsonb(5000), 'Typing: remote typing indicator expiry TTL (ms).')
on conflict (key) do nothing;

commit;
