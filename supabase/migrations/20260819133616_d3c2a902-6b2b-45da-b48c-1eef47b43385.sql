GRANT INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;

CREATE POLICY "admins manage roles insert" ON public.user_roles
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins manage roles update" ON public.user_roles
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins manage roles delete" ON public.user_roles
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin') AND user_id <> auth.uid());