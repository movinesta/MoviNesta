-- Normalize usernames to align with profiles_username_format_chk.
-- Strip leading @ and lower-case stored values.
update public.profiles
set username = lower(regexp_replace(username, '^@+', ''))
where username is not null
  and username <> lower(regexp_replace(username, '^@+', ''));

update public.profiles_public
set username = lower(regexp_replace(username, '^@+', ''))
where username is not null
  and username <> lower(regexp_replace(username, '^@+', ''));
