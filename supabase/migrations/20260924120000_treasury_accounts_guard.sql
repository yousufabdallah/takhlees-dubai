-- Treasury accounts: edit, deactivate/reactivate and delete rules, enforced in the database
-- so they also apply to direct Supabase API calls that bypass the UI.
--
--  1) Admin and accountant may read, create and update accounts (unchanged); only admins may
--     delete. Accounts referenced by payments, expenses, transfers or withdrawals can never be
--     deleted anyway (existing foreign keys).
--  2) Once an account has financial records, its opening balance and type are locked: balances
--     are computed live from the opening balance, so changing it (or moving the account between
--     cash and bank) would rewrite every past balance. Name, bank name and account number stay
--     editable, and the account can always be deactivated/reactivated.
--  3) An inactive account cannot be used by a new payment, expense, withdrawal or transfer, nor
--     be set as the account of an existing one. Existing records that already use it are kept
--     and can still be edited as long as their account does not change.

-- 1) Policies ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "accounts finance access" ON public.accounts;
DROP POLICY IF EXISTS "accounts read" ON public.accounts;
DROP POLICY IF EXISTS "accounts insert" ON public.accounts;
DROP POLICY IF EXISTS "accounts update" ON public.accounts;
DROP POLICY IF EXISTS "accounts delete" ON public.accounts;

CREATE POLICY "accounts read" ON public.accounts
FOR SELECT TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role]));

CREATE POLICY "accounts insert" ON public.accounts
FOR INSERT TO authenticated
WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role]));

CREATE POLICY "accounts update" ON public.accounts
FOR UPDATE TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role]))
WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role]));

CREATE POLICY "accounts delete" ON public.accounts
FOR DELETE TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role));

-- 2) Lock opening balance and type once the account has financial records ---------------
CREATE OR REPLACE FUNCTION public.guard_account_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (NEW.opening_balance, NEW.account_type) IS DISTINCT FROM (OLD.opening_balance, OLD.account_type)
     AND (
       EXISTS (SELECT 1 FROM public.payments WHERE account_id = OLD.id)
       OR EXISTS (SELECT 1 FROM public.expenses WHERE account_id = OLD.id)
       OR EXISTS (SELECT 1 FROM public.withdrawals WHERE account_id = OLD.id)
       OR EXISTS (SELECT 1 FROM public.transfers WHERE from_account_id = OLD.id OR to_account_id = OLD.id)
     ) THEN
    RAISE EXCEPTION 'لا يمكن تعديل الرصيد الافتتاحي أو نوع حساب عليه حركات مالية مسجلة. يمكنك تعديل الاسم وبيانات البنك فقط.';
  END IF;
  RETURN NEW;
END; $$;

REVOKE EXECUTE ON FUNCTION public.guard_account_update() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS accounts_guard_update ON public.accounts;
CREATE TRIGGER accounts_guard_update BEFORE UPDATE ON public.accounts
FOR EACH ROW EXECUTE FUNCTION public.guard_account_update();

-- 3) Inactive accounts cannot receive new financial records -------------------------------
-- SECURITY DEFINER so the check can read accounts even for staff, who record payments on the
-- invoice page but have no read access to accounts.
CREATE OR REPLACE FUNCTION public.require_active_account()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ids uuid[];
  v_name text;
BEGIN
  IF TG_TABLE_NAME = 'transfers' THEN
    v_ids := ARRAY[]::uuid[];
    IF TG_OP = 'INSERT' OR NEW.from_account_id IS DISTINCT FROM OLD.from_account_id THEN
      v_ids := v_ids || NEW.from_account_id;
    END IF;
    IF TG_OP = 'INSERT' OR NEW.to_account_id IS DISTINCT FROM OLD.to_account_id THEN
      v_ids := v_ids || NEW.to_account_id;
    END IF;
  ELSIF TG_OP = 'INSERT' OR NEW.account_id IS DISTINCT FROM OLD.account_id THEN
    v_ids := ARRAY[NEW.account_id];
  END IF;

  SELECT name INTO v_name
  FROM public.accounts
  WHERE id = ANY (v_ids) AND NOT active
  LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'الحساب "%" موقوف ولا يمكن استخدامه في حركات مالية جديدة. أعد تفعيله أو اختر حساباً آخر.', v_name;
  END IF;
  RETURN NEW;
END; $$;

REVOKE EXECUTE ON FUNCTION public.require_active_account() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS payments_require_active_account ON public.payments;
CREATE TRIGGER payments_require_active_account BEFORE INSERT OR UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.require_active_account();

DROP TRIGGER IF EXISTS expenses_require_active_account ON public.expenses;
CREATE TRIGGER expenses_require_active_account BEFORE INSERT OR UPDATE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.require_active_account();

DROP TRIGGER IF EXISTS withdrawals_require_active_account ON public.withdrawals;
CREATE TRIGGER withdrawals_require_active_account BEFORE INSERT OR UPDATE ON public.withdrawals
FOR EACH ROW EXECUTE FUNCTION public.require_active_account();

DROP TRIGGER IF EXISTS transfers_require_active_account ON public.transfers;
CREATE TRIGGER transfers_require_active_account BEFORE INSERT OR UPDATE ON public.transfers
FOR EACH ROW EXECUTE FUNCTION public.require_active_account();
