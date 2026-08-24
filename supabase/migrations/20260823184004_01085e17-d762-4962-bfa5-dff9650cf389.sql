ALTER TABLE public.gov_entities ADD COLUMN IF NOT EXISTS name_en text;
ALTER TABLE public.transaction_types ADD COLUMN IF NOT EXISTS name_en text;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS type_name_en text;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS gov_entity_en text;