-- Withdrawals: only admins and accountants may create them.
--
-- The original policy (migration 20260820040602) was WITH CHECK (true), so any signed-in
-- user - including staff - could record a withdrawal through the Supabase API, even though
-- the only UI that creates withdrawals is the Treasury page (admin/accountant only).
-- This aligns INSERT with the existing UPDATE/DELETE policies. SELECT, UPDATE and DELETE are
-- unchanged.

DROP POLICY IF EXISTS "withdrawals_insert" ON public.withdrawals;

CREATE POLICY "withdrawals_insert" ON public.withdrawals
FOR INSERT TO authenticated
WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin','accountant']::app_role[]));
