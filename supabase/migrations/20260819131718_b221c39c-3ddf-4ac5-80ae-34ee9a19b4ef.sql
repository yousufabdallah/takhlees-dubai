CREATE TABLE public.gov_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text,
  contact_person text,
  phone text,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gov_entities TO authenticated;
GRANT ALL ON public.gov_entities TO service_role;

ALTER TABLE public.gov_entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gov entities all" ON public.gov_entities FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER gov_entities_updated_at BEFORE UPDATE ON public.gov_entities
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.transaction_types ADD COLUMN entity_id uuid REFERENCES public.gov_entities(id) ON DELETE SET NULL;

INSERT INTO public.gov_entities (name, code)
SELECT DISTINCT gov_entity, NULL FROM public.transaction_types
WHERE gov_entity IS NOT NULL AND btrim(gov_entity) <> '';

UPDATE public.transaction_types t
SET entity_id = e.id
FROM public.gov_entities e
WHERE t.gov_entity = e.name;