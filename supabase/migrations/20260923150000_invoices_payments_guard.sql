-- Invoices & payments hardening (enforced in the database, so it also applies to direct
-- Supabase API calls that bypass the UI).
--
-- Invoices are always derived data: created by create_invoice_for_transaction, kept in sync
-- by sync_invoice_from_transaction / sync_invoice_paid and recalculated by
-- calc_invoice_totals. Those triggers are SECURITY DEFINER (they run as the table owner), so
-- they are not affected by the user-facing policies below.
--
--  Invoices
--   * read: admin, accountant, staff (unchanged)
--   * insert: nobody directly - only the transaction trigger creates invoices
--   * update: admin, accountant - and only non-financial fields (issue/due date, notes,
--     status e.g. marking as refunded). Fees, discount, VAT rate, paid, client, transaction
--     and invoice number can only change through the sync triggers.
--   * delete: nobody directly - an invoice is removed only together with its transaction
--     (cascade, admin-only, and never when payments exist; see invoices_prevent_paid_delete
--     in migration 20260923120000).
--
--  Payments
--   * read / insert: admin, accountant, staff (unchanged - staff record payments on the
--     invoice page)
--   * update / delete: admin, accountant
--   * a payment can never be moved to another invoice (sync_invoice_paid would only
--     recalculate the new invoice and leave the old invoice's paid amount wrong)
--   * new payments must have a positive amount

-- Invoices ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "invoices operations access" ON public.invoices;
DROP POLICY IF EXISTS "invoices read" ON public.invoices;
DROP POLICY IF EXISTS "invoices update" ON public.invoices;

CREATE POLICY "invoices read" ON public.invoices
FOR SELECT TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role, 'staff'::app_role]));

CREATE POLICY "invoices update" ON public.invoices
FOR UPDATE TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role]))
WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role]));

-- No INSERT or DELETE policy: with RLS enabled, direct inserts/deletes are denied.

CREATE OR REPLACE FUNCTION public.guard_invoice_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- auth.uid() IS NULL: service role / SQL editor (trusted server-side access).
  -- pg_trigger_depth() > 1: the change comes from the sync triggers (transaction edit or
  -- payment change), which compute these values themselves.
  IF auth.uid() IS NULL OR pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;
  IF (NEW.invoice_no, NEW.transaction_id, NEW.client_id, NEW.gov_fees, NEW.office_fees,
      NEW.discount, NEW.vat_rate, NEW.paid, NEW.created_at)
     IS DISTINCT FROM
     (OLD.invoice_no, OLD.transaction_id, OLD.client_id, OLD.gov_fees, OLD.office_fees,
      OLD.discount, OLD.vat_rate, OLD.paid, OLD.created_at) THEN
    RAISE EXCEPTION 'المبالغ والعميل في الفاتورة تُحسب تلقائياً من المعاملة والدفعات ولا يمكن تعديلها مباشرة. عدّل المعاملة أو الدفعات بدلاً من ذلك.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END; $$;

REVOKE EXECUTE ON FUNCTION public.guard_invoice_update() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS invoices_guard_update ON public.invoices;
CREATE TRIGGER invoices_guard_update BEFORE UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.guard_invoice_update();

-- Payments ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "payments operations access" ON public.payments;
DROP POLICY IF EXISTS "payments read" ON public.payments;
DROP POLICY IF EXISTS "payments insert" ON public.payments;
DROP POLICY IF EXISTS "payments update" ON public.payments;
DROP POLICY IF EXISTS "payments delete" ON public.payments;

CREATE POLICY "payments read" ON public.payments
FOR SELECT TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role, 'staff'::app_role]));

CREATE POLICY "payments insert" ON public.payments
FOR INSERT TO authenticated
WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role, 'staff'::app_role]));

CREATE POLICY "payments update" ON public.payments
FOR UPDATE TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role]))
WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role]));

CREATE POLICY "payments delete" ON public.payments
FOR DELETE TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role]));

CREATE OR REPLACE FUNCTION public.guard_payment_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.invoice_id IS DISTINCT FROM OLD.invoice_id THEN
    RAISE EXCEPTION 'لا يمكن نقل دفعة إلى فاتورة أخرى. احذفها وسجّلها على الفاتورة الصحيحة.';
  END IF;
  RETURN NEW;
END; $$;

REVOKE EXECUTE ON FUNCTION public.guard_payment_update() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS payments_guard_update ON public.payments;
CREATE TRIGGER payments_guard_update BEFORE UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.guard_payment_update();

-- NOT VALID: applies to new and updated rows without failing on any historical data.
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_amount_positive;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_amount_positive CHECK (amount > 0) NOT VALID;
