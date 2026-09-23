-- Transactions CRUD hardening. Everything here is enforced in the database, so it also
-- applies to direct Supabase API calls that bypass the UI.
--  1) Only admins may delete transactions. Reading and creating keep the previous access
--     (admin, accountant, staff).
--  2) Staff may still update a transaction, but only its status / completion date and the
--     government-fee-paid flag (the inline controls in the transactions table). Changing
--     client, services, fees, discount, VAT, etc. requires admin or accountant.
--  3) A transaction whose invoice has recorded payments can never be deleted, and an invoice
--     with recorded payments can never be deleted directly: invoices -> payments is
--     ON DELETE CASCADE, so either delete would silently erase cash/bank receipts.
--  4) Service lines (transaction_items) can be inserted by anyone who can create a
--     transaction, but only admin/accountant may change or remove them.
--  5) update_transaction_with_items(): edits a transaction and replaces its service lines
--     in a single database transaction (all-or-nothing), enforcing the payment rules.

-- 1) Split the transactions policy so DELETE is admin-only -------------------------------
DROP POLICY IF EXISTS "transactions operations access" ON public.transactions;
DROP POLICY IF EXISTS "transactions read" ON public.transactions;
DROP POLICY IF EXISTS "transactions insert" ON public.transactions;
DROP POLICY IF EXISTS "transactions update" ON public.transactions;
DROP POLICY IF EXISTS "transactions delete" ON public.transactions;

CREATE POLICY "transactions read" ON public.transactions
FOR SELECT TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role, 'staff'::app_role]));

CREATE POLICY "transactions insert" ON public.transactions
FOR INSERT TO authenticated
WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role, 'staff'::app_role]));

CREATE POLICY "transactions update" ON public.transactions
FOR UPDATE TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role, 'staff'::app_role]))
WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role, 'staff'::app_role]));

CREATE POLICY "transactions delete" ON public.transactions
FOR DELETE TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role));

-- 2) Staff may only change status / completion / gov-fee-paid ---------------------------
CREATE OR REPLACE FUNCTION public.guard_transaction_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- auth.uid() is NULL for the service role / SQL editor: trusted server-side access.
  IF auth.uid() IS NULL
     OR private.has_any_role(auth.uid(), ARRAY['admin','accountant']::public.app_role[]) THEN
    RETURN NEW;
  END IF;
  IF (NEW.ref_no, NEW.client_id, NEW.type_id, NEW.type_name, NEW.type_name_en,
      NEW.gov_entity, NEW.gov_entity_en, NEW.employee_id, NEW.opened_at,
      NEW.gov_fee, NEW.office_fee, NEW.discount, NEW.vat_rate, NEW.payment_method,
      NEW.notes, NEW.created_by, NEW.created_at)
     IS DISTINCT FROM
     (OLD.ref_no, OLD.client_id, OLD.type_id, OLD.type_name, OLD.type_name_en,
      OLD.gov_entity, OLD.gov_entity_en, OLD.employee_id, OLD.opened_at,
      OLD.gov_fee, OLD.office_fee, OLD.discount, OLD.vat_rate, OLD.payment_method,
      OLD.notes, OLD.created_by, OLD.created_at) THEN
    RAISE EXCEPTION 'تعديل بيانات المعاملة متاح لمدير النظام والمحاسب فقط. يمكنك تغيير الحالة وحالة دفع الرسوم الحكومية.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END; $$;

REVOKE EXECUTE ON FUNCTION public.guard_transaction_update() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS transactions_guard_update ON public.transactions;
CREATE TRIGGER transactions_guard_update BEFORE UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.guard_transaction_update();

-- 3) Never delete a transaction or invoice that has payments -----------------------------
CREATE OR REPLACE FUNCTION public.prevent_paid_transaction_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.payments p
    JOIN public.invoices i ON i.id = p.invoice_id
    WHERE i.transaction_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'لا يمكن حذف معاملة على فاتورتها دفعات مسجلة. احذف الدفعات أو عالجها أولاً.';
  END IF;
  RETURN OLD;
END; $$;

REVOKE EXECUTE ON FUNCTION public.prevent_paid_transaction_delete() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS transactions_prevent_paid_delete ON public.transactions;
CREATE TRIGGER transactions_prevent_paid_delete BEFORE DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.prevent_paid_transaction_delete();

CREATE OR REPLACE FUNCTION public.prevent_paid_invoice_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.payments WHERE invoice_id = OLD.id) THEN
    RAISE EXCEPTION 'لا يمكن حذف فاتورة عليها دفعات مسجلة.';
  END IF;
  RETURN OLD;
END; $$;

REVOKE EXECUTE ON FUNCTION public.prevent_paid_invoice_delete() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS invoices_prevent_paid_delete ON public.invoices;
CREATE TRIGGER invoices_prevent_paid_delete BEFORE DELETE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.prevent_paid_invoice_delete();

-- 4) Service lines: insert for all operations roles, change/remove for admin/accountant --
DROP POLICY IF EXISTS "transaction_items operations access" ON public.transaction_items;
DROP POLICY IF EXISTS "transaction_items read" ON public.transaction_items;
DROP POLICY IF EXISTS "transaction_items insert" ON public.transaction_items;
DROP POLICY IF EXISTS "transaction_items update" ON public.transaction_items;
DROP POLICY IF EXISTS "transaction_items delete" ON public.transaction_items;

CREATE POLICY "transaction_items read" ON public.transaction_items
FOR SELECT TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role, 'staff'::app_role]));

CREATE POLICY "transaction_items insert" ON public.transaction_items
FOR INSERT TO authenticated
WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role, 'staff'::app_role]));

CREATE POLICY "transaction_items update" ON public.transaction_items
FOR UPDATE TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role]))
WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role]));

CREATE POLICY "transaction_items delete" ON public.transaction_items
FOR DELETE TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role]));

-- 5) Atomic edit ---------------------------------------------------------------------------
-- SECURITY INVOKER: runs with the caller's rights, so every RLS policy and trigger above
-- still applies. p_patch holds the editable transaction columns; p_items the new lines.
CREATE OR REPLACE FUNCTION public.update_transaction_with_items(
  p_id uuid,
  p_patch jsonb,
  p_items jsonb
)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_old_client uuid;
  v_paid numeric;
  v_total numeric;
BEGIN
  IF NOT private.has_any_role(auth.uid(), ARRAY['admin','accountant']::public.app_role[]) THEN
    RAISE EXCEPTION 'تعديل المعاملات متاح لمدير النظام والمحاسب فقط.' USING ERRCODE = '42501';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'يجب أن تحتوي المعاملة على خدمة واحدة على الأقل.';
  END IF;

  SELECT client_id INTO v_old_client FROM public.transactions WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'المعاملة غير موجودة.';
  END IF;

  UPDATE public.transactions AS t SET
    client_id       = r.client_id,
    type_id         = r.type_id,
    type_name       = r.type_name,
    type_name_en    = r.type_name_en,
    gov_entity      = r.gov_entity,
    gov_entity_en   = r.gov_entity_en,
    employee_id     = r.employee_id,
    status          = r.status,
    opened_at       = r.opened_at,
    completed_at    = r.completed_at,
    gov_fee         = r.gov_fee,
    office_fee      = r.office_fee,
    discount        = r.discount,
    vat_rate        = r.vat_rate,
    payment_method  = r.payment_method,
    gov_fee_paid    = r.gov_fee_paid,
    gov_fee_paid_at = r.gov_fee_paid_at,
    notes           = r.notes
  FROM (
    -- keys missing from p_patch keep their current value
    SELECT (jsonb_populate_record(cur, p_patch)).*
    FROM public.transactions AS cur
    WHERE cur.id = p_id
  ) AS r
  WHERE t.id = p_id;

  DELETE FROM public.transaction_items WHERE transaction_id = p_id;

  INSERT INTO public.transaction_items (
    transaction_id, entity_id, gov_entity, gov_entity_en, type_id, type_name, type_name_en,
    gov_fee, office_fee, qty, sort_order
  )
  SELECT p_id, x.entity_id, x.gov_entity, x.gov_entity_en, x.type_id, x.type_name, x.type_name_en,
         COALESCE(x.gov_fee, 0), COALESCE(x.office_fee, 0), GREATEST(COALESCE(x.qty, 1), 1),
         COALESCE(x.sort_order, 0)
  FROM jsonb_populate_recordset(NULL::public.transaction_items, p_items) AS x;

  -- The invoice is re-synced by the transactions trigger above; check it against payments.
  SELECT paid, total INTO v_paid, v_total FROM public.invoices WHERE transaction_id = p_id;
  IF COALESCE(v_paid, 0) > 0 THEN
    IF (SELECT client_id FROM public.transactions WHERE id = p_id) IS DISTINCT FROM v_old_client THEN
      RAISE EXCEPTION 'لا يمكن تغيير عميل معاملة على فاتورتها دفعات مسجلة.';
    END IF;
    IF v_total < v_paid THEN
      RAISE EXCEPTION 'لا يمكن أن يقل إجمالي الفاتورة (%) عن المبلغ المحصّل (%).', v_total, v_paid;
    END IF;
  END IF;
END; $$;

REVOKE EXECUTE ON FUNCTION public.update_transaction_with_items(uuid, jsonb, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.update_transaction_with_items(uuid, jsonb, jsonb) TO authenticated;
