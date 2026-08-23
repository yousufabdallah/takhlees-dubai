CREATE TABLE public.office_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name text NOT NULL DEFAULT '',
  legal_name_en text,
  license_no text,
  trn text,
  address text,
  phone text,
  email text,
  website text,
  logo_url text,
  invoice_footer text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.office_settings TO authenticated;
GRANT ALL ON public.office_settings TO service_role;

ALTER TABLE public.office_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "office_settings_select" ON public.office_settings
FOR SELECT TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role, 'staff'::app_role]));

CREATE POLICY "office_settings_insert" ON public.office_settings
FOR INSERT TO authenticated
WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role]));

CREATE POLICY "office_settings_update" ON public.office_settings
FOR UPDATE TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role]))
WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role]));

CREATE TRIGGER office_settings_set_updated_at
BEFORE UPDATE ON public.office_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.office_settings (legal_name) VALUES ('');