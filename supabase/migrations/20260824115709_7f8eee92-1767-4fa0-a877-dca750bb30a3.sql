CREATE TABLE public.transaction_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  entity_id uuid REFERENCES public.gov_entities(id),
  gov_entity text,
  gov_entity_en text,
  type_id uuid REFERENCES public.transaction_types(id),
  type_name text NOT NULL,
  type_name_en text,
  gov_fee numeric NOT NULL DEFAULT 0,
  office_fee numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transaction_items TO authenticated;
GRANT ALL ON public.transaction_items TO service_role;

ALTER TABLE public.transaction_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transaction_items operations access" ON public.transaction_items
FOR ALL TO authenticated
USING (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role, 'staff'::app_role]))
WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'accountant'::app_role, 'staff'::app_role]));

CREATE INDEX transaction_items_transaction_id_idx ON public.transaction_items(transaction_id);