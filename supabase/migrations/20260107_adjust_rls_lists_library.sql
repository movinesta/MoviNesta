-- Restrict library entries visibility to the owning user.
drop policy if exists library_entries_select_merged on public.library_entries;
create policy library_entries_select_self
  on public.library_entries
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Allow public read access to lists marked as public.
create policy lists_public_read
  on public.lists
  for select
  to anon, authenticated
  using (is_public = true);

-- Allow public read access to list items that belong to public lists.
create policy list_items_public_read
  on public.list_items
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.lists l
      where l.id = list_items.list_id
        and l.is_public = true
    )
  );
