-- Align usernames with profiles_username_format_chk constraint.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_username_format_chk;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_username_format_chk
  CHECK ((username IS NULL) OR (username ~ '^[a-z0-9_]{3,30}$'::text));
