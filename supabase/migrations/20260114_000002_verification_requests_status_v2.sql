-- Verification Badges (Phase 2 hardening)
-- Created: 2026-01-14
--
-- Goals:
-- - Introduce a dedicated request status enum (requests are not the same as verifications).
-- - Add reviewer notes separate from the user's request notes.
-- - Allow a user to update their request when staff requests more info.

begin;

-- 1) Dedicated request status enum
DO $$
begin
  if not exists (select 1 from pg_type where typname = 'verification_request_status') then
    create type public.verification_request_status as enum ('pending', 'needs_more_info', 'approved', 'rejected');
  end if;
end $$;

-- 2) Add reviewer-only note fields
alter table public.verification_requests
  add column if not exists reviewer_note text,
  add column if not exists reviewer_reason text;

-- 3) Migrate status column from verification_status -> verification_request_status
--    Existing values mapping (legacy MVP):
--      pending  -> pending
--      approved -> approved
--      revoked  -> rejected
--      none     -> pending (should not exist for requests; treat as pending)
DO $$
begin
  -- Only run if column is still the old enum
  if exists (
    select 1
      from information_schema.columns
     where table_schema='public'
       and table_name='verification_requests'
       and column_name='status'
       and udt_name='verification_status'
  ) then
    alter table public.verification_requests
      alter column status drop default;

    alter table public.verification_requests
      alter column status type public.verification_request_status
      using (
        case (status::text)
          when 'pending' then 'pending'::public.verification_request_status
          when 'approved' then 'approved'::public.verification_request_status
          when 'revoked' then 'rejected'::public.verification_request_status
          else 'pending'::public.verification_request_status
        end
      );

    alter table public.verification_requests
      alter column status set default 'pending';
  end if;
end $$;

-- 4) Allow users to update their request when staff asks for more info.
--    (Admin updates are already allowed via the existing admin policy.)
drop policy if exists "verification_requests_update_own_when_needs_more_info" on public.verification_requests;
create policy "verification_requests_update_own_when_needs_more_info"
on public.verification_requests
for update
to authenticated
using (
  auth.uid() = user_id
  and status = 'needs_more_info'
)
with check (
  auth.uid() = user_id
  and status in ('needs_more_info', 'pending')
);

commit;
