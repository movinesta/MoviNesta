-- Verification Badges (Phase 1: DB foundation)
-- Created: 2026-01-14
--
-- Goals:
-- - Store verification status/type in a dedicated table.
-- - Mirror safe, display-ready fields onto profiles_public for fast reads.
-- - Lock everything down with RLS (admin-only writes).
--
-- Supabase guidance: enable RLS on exposed tables and define explicit policies.
-- https://supabase.com/docs/guides/database/postgres/row-level-security

begin;

-- 1) Enums
DO $$
begin
  if not exists (select 1 from pg_type where typname = 'verification_status') then
    create type public.verification_status as enum ('none', 'pending', 'approved', 'revoked');
  end if;

  if not exists (select 1 from pg_type where typname = 'verification_badge_type') then
    create type public.verification_badge_type as enum ('identity', 'official', 'trusted_verifier', 'subscription');
  end if;
end $$;

-- 2) profile_verifications (admin-controlled)
create table if not exists public.profile_verifications (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  status public.verification_status not null default 'none',
  badge_type public.verification_badge_type not null default 'identity',
  verified_at timestamptz,
  verified_by uuid references public.profiles(id),
  verifier_org text,
  public_label text,
  details jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists ix_profile_verifications_status on public.profile_verifications(status);

alter table public.profile_verifications enable row level security;

-- Read: user can read their own row; admins can read all.
drop policy if exists "profile_verifications_select_own_or_admin" on public.profile_verifications;
create policy "profile_verifications_select_own_or_admin"
on public.profile_verifications
for select
to authenticated
using (
  auth.uid() = user_id
  or public.is_app_admin()
);

-- Writes: admin only.
drop policy if exists "profile_verifications_admin_write" on public.profile_verifications;
create policy "profile_verifications_admin_write"
on public.profile_verifications
for all
to authenticated
using (public.is_app_admin())
with check (public.is_app_admin());

-- 3) verification_requests (user-submitted, admin-reviewed)
create table if not exists public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status public.verification_status not null default 'pending',
  badge_type public.verification_badge_type,
  evidence jsonb,
  notes text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

create index if not exists ix_verification_requests_user_id on public.verification_requests(user_id);
create index if not exists ix_verification_requests_status on public.verification_requests(status);

alter table public.verification_requests enable row level security;

-- User can insert their own request.
drop policy if exists "verification_requests_insert_own" on public.verification_requests;
create policy "verification_requests_insert_own"
on public.verification_requests
for insert
to authenticated
with check (auth.uid() = user_id);

-- User can read their own requests; admins can read all.
drop policy if exists "verification_requests_select_own_or_admin" on public.verification_requests;
create policy "verification_requests_select_own_or_admin"
on public.verification_requests
for select
to authenticated
using (
  auth.uid() = user_id
  or public.is_app_admin()
);

-- Admin can update/delete.
drop policy if exists "verification_requests_admin_update" on public.verification_requests;
create policy "verification_requests_admin_update"
on public.verification_requests
for update
to authenticated
using (public.is_app_admin())
with check (public.is_app_admin());

drop policy if exists "verification_requests_admin_delete" on public.verification_requests;
create policy "verification_requests_admin_delete"
on public.verification_requests
for delete
to authenticated
using (public.is_app_admin());

-- 4) Mirror fields on profiles_public (public-safe)
alter table public.profiles_public
  add column if not exists is_verified boolean not null default false,
  add column if not exists verified_type public.verification_badge_type,
  add column if not exists verified_label text,
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by_org text;

-- 5) Keep profiles_public in sync when profiles change
--    (existing trigger syncs basic profile fields; we extend it to also refresh verification fields)
create or replace function public.sync_profiles_public() returns trigger
language plpgsql security definer
set search_path to 'public'
set row_security to 'off'
as $$
begin
  insert into public.profiles_public (
    id,
    username,
    display_name,
    avatar_url,
    avatar_path,
    bio,
    last_seen_at,
    created_at,
    updated_at
  )
  values (
    new.id,
    new.username,
    new.display_name,
    new.avatar_url,
    new.avatar_url,
    new.bio,
    new.last_seen_at,
    coalesce(new.created_at, now()),
    now()
  )
  on conflict (id) do update
    set username     = excluded.username,
        display_name = excluded.display_name,
        avatar_url   = excluded.avatar_url,
        avatar_path  = excluded.avatar_path,
        bio          = excluded.bio,
        last_seen_at = coalesce(excluded.last_seen_at, public.profiles_public.last_seen_at),
        updated_at   = now();

  update public.profiles_public pp
     set is_verified = exists (
           select 1
             from public.profile_verifications pv
            where pv.user_id = new.id
              and pv.status = 'approved'
         ),
         verified_type = (
           select pv.badge_type
             from public.profile_verifications pv
            where pv.user_id = new.id
              and pv.status = 'approved'
            limit 1
         ),
         verified_label = (
           select coalesce(pv.public_label, initcap(replace(pv.badge_type::text, '_', ' ')))
             from public.profile_verifications pv
            where pv.user_id = new.id
              and pv.status = 'approved'
            limit 1
         ),
         verified_at = (
           select pv.verified_at
             from public.profile_verifications pv
            where pv.user_id = new.id
              and pv.status = 'approved'
            limit 1
         ),
         verified_by_org = (
           select pv.verifier_org
             from public.profile_verifications pv
            where pv.user_id = new.id
              and pv.status = 'approved'
            limit 1
         )
   where pp.id = new.id;

  return new;
end;
$$;

-- 6) Keep profiles_public in sync when verification rows change
create or replace function public.sync_profiles_public_from_verification() returns trigger
language plpgsql security definer
set search_path to 'public'
set row_security to 'off'
as $$
declare
  v_user_id uuid;
begin
  v_user_id := coalesce(new.user_id, old.user_id);

  update public.profiles_public pp
     set is_verified = exists (
           select 1
             from public.profile_verifications pv
            where pv.user_id = v_user_id
              and pv.status = 'approved'
         ),
         verified_type = (
           select pv.badge_type
             from public.profile_verifications pv
            where pv.user_id = v_user_id
              and pv.status = 'approved'
            limit 1
         ),
         verified_label = (
           select coalesce(pv.public_label, initcap(replace(pv.badge_type::text, '_', ' ')))
             from public.profile_verifications pv
            where pv.user_id = v_user_id
              and pv.status = 'approved'
            limit 1
         ),
         verified_at = (
           select pv.verified_at
             from public.profile_verifications pv
            where pv.user_id = v_user_id
              and pv.status = 'approved'
            limit 1
         ),
         verified_by_org = (
           select pv.verifier_org
             from public.profile_verifications pv
            where pv.user_id = v_user_id
              and pv.status = 'approved'
            limit 1
         )
   where pp.id = v_user_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_sync_profiles_public_verification on public.profile_verifications;
create trigger trg_sync_profiles_public_verification
after insert or update or delete on public.profile_verifications
for each row execute function public.sync_profiles_public_from_verification();

commit;
