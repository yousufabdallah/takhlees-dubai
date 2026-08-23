CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles public.app_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = ANY(_roles)
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_any_role(uuid, public.app_role[]) TO authenticated;

DROP POLICY IF EXISTS "profiles read" ON public.profiles;
DROP POLICY IF EXISTS "profiles self insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles self update" ON public.profiles;
CREATE POLICY "profiles read self or admin" ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles self insert" ON public.profiles FOR INSERT TO authenticated
WITH CHECK (id = auth.uid());
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid()) WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "roles read" ON public.user_roles;
CREATE POLICY "roles read self or admin" ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "accounts all" ON public.accounts;
CREATE POLICY "accounts finance access" ON public.accounts FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::public.app_role[]));

DROP POLICY IF EXISTS "coa all" ON public.chart_of_accounts;
CREATE POLICY "coa finance access" ON public.chart_of_accounts FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::public.app_role[]));

DROP POLICY IF EXISTS "clients all" ON public.clients;
CREATE POLICY "clients operations access" ON public.clients FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','accountant','staff']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','accountant','staff']::public.app_role[]));

DROP POLICY IF EXISTS "documents all" ON public.documents;
CREATE POLICY "documents operations access" ON public.documents FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','accountant','staff']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','accountant','staff']::public.app_role[]));

DROP POLICY IF EXISTS "employees all" ON public.employees;
CREATE POLICY "employees finance access" ON public.employees FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::public.app_role[]));

DROP POLICY IF EXISTS "expenses all" ON public.expenses;
CREATE POLICY "expenses finance access" ON public.expenses FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::public.app_role[]));

DROP POLICY IF EXISTS "gov entities all" ON public.gov_entities;
CREATE POLICY "gov entities operations access" ON public.gov_entities FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','accountant','staff']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','accountant','staff']::public.app_role[]));

DROP POLICY IF EXISTS "invoices all" ON public.invoices;
CREATE POLICY "invoices operations access" ON public.invoices FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','accountant','staff']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','accountant','staff']::public.app_role[]));

DROP POLICY IF EXISTS "journal all" ON public.journal_entries;
CREATE POLICY "journal entries finance access" ON public.journal_entries FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::public.app_role[]));

DROP POLICY IF EXISTS "journal lines all" ON public.journal_lines;
CREATE POLICY "journal lines finance access" ON public.journal_lines FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::public.app_role[]));

DROP POLICY IF EXISTS "payments all" ON public.payments;
CREATE POLICY "payments operations access" ON public.payments FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','accountant','staff']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','accountant','staff']::public.app_role[]));

DROP POLICY IF EXISTS "payroll all" ON public.payroll_entries;
CREATE POLICY "payroll finance access" ON public.payroll_entries FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::public.app_role[]));

DROP POLICY IF EXISTS "suppliers all" ON public.suppliers;
CREATE POLICY "suppliers finance access" ON public.suppliers FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::public.app_role[]));

DROP POLICY IF EXISTS "ttypes all" ON public.transaction_types;
CREATE POLICY "transaction types read" ON public.transaction_types FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','accountant','staff']::public.app_role[]));
CREATE POLICY "transaction types finance manage" ON public.transaction_types FOR INSERT TO authenticated
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::public.app_role[]));
CREATE POLICY "transaction types finance update" ON public.transaction_types FOR UPDATE TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::public.app_role[]));
CREATE POLICY "transaction types finance delete" ON public.transaction_types FOR DELETE TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::public.app_role[]));

DROP POLICY IF EXISTS "transactions all" ON public.transactions;
CREATE POLICY "transactions operations access" ON public.transactions FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','accountant','staff']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','accountant','staff']::public.app_role[]));

DROP POLICY IF EXISTS "transfers all" ON public.transfers;
CREATE POLICY "transfers finance access" ON public.transfers FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','accountant']::public.app_role[]));