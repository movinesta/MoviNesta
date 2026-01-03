-- Migration: 20260103_fix_assistant_rls
-- Description: Enable RLS and add policies for assistant-related tables (library, lists). Add missing indexes.

BEGIN;

-- 1. Library Entries
ALTER TABLE IF EXISTS public.library_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own library entries"
    ON public.library_entries FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own library entries"
    ON public.library_entries FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own library entries"
    ON public.library_entries FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own library entries"
    ON public.library_entries FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- 2. Lists
ALTER TABLE IF EXISTS public.lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own lists"
    ON public.lists FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view public lists"
    ON public.lists FOR SELECT
    TO authenticated
    USING (is_public = true);

CREATE POLICY "Users can insert their own lists"
    ON public.lists FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own lists"
    ON public.lists FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own lists"
    ON public.lists FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- 3. List Items
ALTER TABLE IF EXISTS public.list_items ENABLE ROW LEVEL SECURITY;

-- Note: List items don't have a user_id directly usually, they link to a list.
-- We must check the parent list's ownership or visibility.

CREATE POLICY "Users can view items in accessible lists"
    ON public.list_items FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.lists
            WHERE lists.id = list_items.list_id
            AND (lists.user_id = auth.uid() OR lists.is_public = true)
        )
    );

CREATE POLICY "Users can insert items into their own lists"
    ON public.list_items FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.lists
            WHERE lists.id = list_items.list_id
            AND lists.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update items in their own lists"
    ON public.list_items FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.lists
            WHERE lists.id = list_items.list_id
            AND lists.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.lists
            WHERE lists.id = list_items.list_id
            AND lists.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete items from their own lists"
    ON public.list_items FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.lists
            WHERE lists.id = list_items.list_id
            AND lists.user_id = auth.uid()
        )
    );

-- 4. Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_library_entries_user_id ON public.library_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_lists_user_id ON public.lists(user_id);
CREATE INDEX IF NOT EXISTS idx_list_items_list_id ON public.list_items(list_id);

-- Optional: Index on internal IDs if they are foreign keys
-- CREATE INDEX IF NOT EXISTS idx_library_entries_title_id ON public.library_entries(title_id); -- title_id can be text or uuid depending on schema.
-- Assuming standard Supabase patterns, these are safe.

COMMIT;
