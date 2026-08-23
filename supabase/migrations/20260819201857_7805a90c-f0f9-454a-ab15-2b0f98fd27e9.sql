DROP POLICY IF EXISTS "gov entities operations access" ON public.gov_entities;

CREATE POLICY "gov entities read" ON public.gov_entities
FOR SELECT TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role, 'staff'::app_role]));

CREATE POLICY "gov entities insert" ON public.gov_entities
FOR INSERT TO authenticated
WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role]));

CREATE POLICY "gov entities update" ON public.gov_entities
FOR UPDATE TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role]))
WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role]));

CREATE POLICY "gov entities delete" ON public.gov_entities
FOR DELETE TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role]));