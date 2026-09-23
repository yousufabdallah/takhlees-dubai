-- Withdrawals: only admins and accountants may view them.
--
-- The original policy (migration 20260820040602) was USING (true), so any signed-in user -
-- including staff - could read every withdrawal (amounts, accounts, references, notes)
-- through the Supabase API, although the only screen that shows withdrawals is the Treasury
-- page (admin/accountant only). This aligns SELECT with the existing UPDATE/DELETE policies.
-- INSERT, UPDATE and DELETE policies are unchanged.

DROP POLICY IF EXISTS "withdrawals_select" ON public.withdrawals;

CREATE POLICY "withdrawals_select" ON public.withdrawals
FOR SELECT TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin','accountant']::app_role[]));
