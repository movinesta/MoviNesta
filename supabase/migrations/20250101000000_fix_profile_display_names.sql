-- Ensure display names are populated for existing profiles without a name.
update public.profiles
set display_name = coalesce(nullif(display_name, ''), username)
where display_name is null
  or display_name = '';
