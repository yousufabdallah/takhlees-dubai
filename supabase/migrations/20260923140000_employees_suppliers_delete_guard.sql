-- Employees & suppliers CRUD hardening.
--  * Reading, creating and updating keep the previous access (admin, accountant).
--  * Only admins may delete.
--  * An employee with payroll entries can never be deleted: payroll_entries.employee_id is
--    ON DELETE CASCADE, so a delete would silently erase salary/advance history.
--    Employees referenced by transactions or expenses are already protected by their FKs.
--    Deactivate (active = false) instead.
--  * Suppliers referenced by expenses are already protected by their FK (no cascade).

DROP POLICY IF EXISTS "employees finance access" ON public.employees;
DROP POLICY IF EXISTS "employees read" ON public.employees;
DROP POLICY IF EXISTS "employees insert" ON public.employees;
DROP POLICY IF EXISTS "employees update" ON public.employees;
DROP POLICY IF EXISTS "employees delete" ON public.employees;

CREATE POLICY "employees read" ON public.employees
FOR SELECT TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role]));

CREATE POLICY "employees insert" ON public.employees
FOR INSERT TO authenticated
WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role]));

CREATE POLICY "employees update" ON public.employees
FOR UPDATE TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role]))
WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role]));

CREATE POLICY "employees delete" ON public.employees
FOR DELETE TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.prevent_employee_with_payroll_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.payroll_entries WHERE employee_id = OLD.id) THEN
    RAISE EXCEPTION 'لا يمكن حذف موظف له حركات رواتب مسجلة. أوقف الموظف بدلاً من الحذف.';
  END IF;
  RETURN OLD;
END; $$;

REVOKE EXECUTE ON FUNCTION public.prevent_employee_with_payroll_delete() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS employees_prevent_payroll_delete ON public.employees;
CREATE TRIGGER employees_prevent_payroll_delete BEFORE DELETE ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.prevent_employee_with_payroll_delete();

DROP POLICY IF EXISTS "suppliers finance access" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers read" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers insert" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers update" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers delete" ON public.suppliers;

CREATE POLICY "suppliers read" ON public.suppliers
FOR SELECT TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role]));

CREATE POLICY "suppliers insert" ON public.suppliers
FOR INSERT TO authenticated
WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role]));

CREATE POLICY "suppliers update" ON public.suppliers
FOR UPDATE TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role]))
WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role]));

CREATE POLICY "suppliers delete" ON public.suppliers
FOR DELETE TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role));
