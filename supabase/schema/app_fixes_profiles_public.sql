-- Ensure profiles_public stays in sync when profiles are deleted.

create or replace function public.sync_profiles_public_delete()
returns trigger
language plpgsql
as $$
begin
  delete from public.profiles_public where id = old.id;
  return old;
end;
$$;

drop trigger if exists trg_sync_profiles_public_delete on public.profiles;
create trigger trg_sync_profiles_public_delete
after delete on public.profiles
for each row
execute function public.sync_profiles_public_delete();
