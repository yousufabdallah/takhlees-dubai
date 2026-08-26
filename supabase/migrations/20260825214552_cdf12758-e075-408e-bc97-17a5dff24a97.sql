CREATE TABLE public.service_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type_id uuid NOT NULL REFERENCES public.transaction_types(id) ON DELETE CASCADE,
  name text NOT NULL,
  name_en text,
  color text NOT NULL DEFAULT 'muted',
  sort_order integer NOT NULL DEFAULT 0,
  is_final boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_statuses TO authenticated;
GRANT ALL ON public.service_statuses TO service_role;

ALTER TABLE public.service_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service statuses read" ON public.service_statuses
  FOR SELECT TO authenticated USING (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role, 'staff'::app_role]));
CREATE POLICY "service statuses insert" ON public.service_statuses
  FOR INSERT TO authenticated WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role]));
CREATE POLICY "service statuses update" ON public.service_statuses
  FOR UPDATE TO authenticated USING (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role])) WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role]));
CREATE POLICY "service statuses delete" ON public.service_statuses
  FOR DELETE TO authenticated USING (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role]));

CREATE INDEX service_statuses_type_idx ON public.service_statuses(type_id, sort_order);

CREATE TRIGGER service_statuses_updated BEFORE UPDATE ON public.service_statuses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();