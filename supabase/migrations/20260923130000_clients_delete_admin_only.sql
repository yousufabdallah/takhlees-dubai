-- Clients CRUD hardening: only admins may delete clients.
-- Reading, creating and updating keep the previous access (admin, accountant, staff).
-- Clients with transactions or invoices are already protected by ON DELETE RESTRICT;
-- their documents rows cascade (the storage files are removed by the app).

DROP POLICY IF EXISTS "clients operations access" ON public.clients;
DROP POLICY IF EXISTS "clients read" ON public.clients;
DROP POLICY IF EXISTS "clients insert" ON public.clients;
DROP POLICY IF EXISTS "clients update" ON public.clients;
DROP POLICY IF EXISTS "clients delete" ON public.clients;

CREATE POLICY "clients read" ON public.clients
FOR SELECT TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role, 'staff'::app_role]));

CREATE POLICY "clients insert" ON public.clients
FOR INSERT TO authenticated
WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role, 'staff'::app_role]));

CREATE POLICY "clients update" ON public.clients
FOR UPDATE TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role, 'staff'::app_role]))
WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role, 'staff'::app_role]));

CREATE POLICY "clients delete" ON public.clients
FOR DELETE TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role));
