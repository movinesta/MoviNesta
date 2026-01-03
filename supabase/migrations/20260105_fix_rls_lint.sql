-- Migration: 20260105_fix_rls_lint
-- Description: Resolve RLS lint warnings and remove duplicate indexes.

BEGIN;

-- Drop duplicate/overlapping policies introduced in earlier migrations
DROP POLICY IF EXISTS "Users can view their own assistant action logs" ON public.assistant_message_action_log;
DROP POLICY IF EXISTS "Users can insert their own assistant action logs" ON public.assistant_message_action_log;

DROP POLICY IF EXISTS "Users can view their own library entries" ON public.library_entries;
DROP POLICY IF EXISTS "Users can insert their own library entries" ON public.library_entries;
DROP POLICY IF EXISTS "Users can update their own library entries" ON public.library_entries;
DROP POLICY IF EXISTS "Users can delete their own library entries" ON public.library_entries;

DROP POLICY IF EXISTS "Users can view their own lists" ON public.lists;
DROP POLICY IF EXISTS "Users can view public lists" ON public.lists;
DROP POLICY IF EXISTS "Users can insert their own lists" ON public.lists;
DROP POLICY IF EXISTS "Users can update their own lists" ON public.lists;
DROP POLICY IF EXISTS "Users can delete their own lists" ON public.lists;
DROP POLICY IF EXISTS lists_owner_only ON public.lists;

DROP POLICY IF EXISTS "Users can view items in accessible lists" ON public.list_items;
DROP POLICY IF EXISTS "Users can insert items into their own lists" ON public.list_items;
DROP POLICY IF EXISTS "Users can update items in their own lists" ON public.list_items;
DROP POLICY IF EXISTS "Users can delete items from their own lists" ON public.list_items;
DROP POLICY IF EXISTS list_items_owner_only ON public.list_items;

-- Recreate list policies with initplan-friendly auth calls and single permissive policy per action
CREATE POLICY "Users can view accessible lists"
    ON public.lists FOR SELECT
    TO authenticated
    USING (user_id = (SELECT auth.uid()) OR is_public = true);

CREATE POLICY "Users can insert their own lists"
    ON public.lists FOR INSERT
    TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update their own lists"
    ON public.lists FOR UPDATE
    TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can delete their own lists"
    ON public.lists FOR DELETE
    TO authenticated
    USING (user_id = (SELECT auth.uid()));

-- Recreate list_items policies with initplan-friendly auth calls
CREATE POLICY "Users can view items in accessible lists"
    ON public.list_items FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.lists
            WHERE lists.id = list_items.list_id
            AND (lists.user_id = (SELECT auth.uid()) OR lists.is_public = true)
        )
    );

CREATE POLICY "Users can insert items into their own lists"
    ON public.list_items FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.lists
            WHERE lists.id = list_items.list_id
            AND lists.user_id = (SELECT auth.uid())
        )
    );

CREATE POLICY "Users can update items in their own lists"
    ON public.list_items FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.lists
            WHERE lists.id = list_items.list_id
            AND lists.user_id = (SELECT auth.uid())
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.lists
            WHERE lists.id = list_items.list_id
            AND lists.user_id = (SELECT auth.uid())
        )
    );

CREATE POLICY "Users can delete items from their own lists"
    ON public.list_items FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.lists
            WHERE lists.id = list_items.list_id
            AND lists.user_id = (SELECT auth.uid())
        )
    );

-- Drop duplicate indexes
DROP INDEX IF EXISTS public.idx_assistant_message_action_log_conversation_id;
DROP INDEX IF EXISTS public.idx_assistant_message_action_log_user_id;
DROP INDEX IF EXISTS public.idx_lists_user_id;

COMMIT;
