CREATE TABLE public.withdrawals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  kind text NOT NULL DEFAULT 'withdrawal' CHECK (kind IN ('withdrawal','gov_payment')),
  amount numeric NOT NULL CHECK (amount > 0),
  withdraw_date date NOT NULL DEFAULT CURRENT_DATE,
  gov_entity text,
  reference text,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.withdrawals TO authenticated;
GRANT ALL ON public.withdrawals TO service_role;

ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "withdrawals_select" ON public.withdrawals FOR SELECT TO authenticated USING (true);
CREATE POLICY "withdrawals_insert" ON public.withdrawals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "withdrawals_update" ON public.withdrawals FOR UPDATE TO authenticated
  USING (private.has_any_role(auth.uid(), ARRAY['admin','accountant']::app_role[]))
  WITH CHECK (private.has_any_role(auth.uid(), ARRAY['admin','accountant']::app_role[]));
CREATE POLICY "withdrawals_delete" ON public.withdrawals FOR DELETE TO authenticated
  USING (private.has_any_role(auth.uid(), ARRAY['admin','accountant']::app_role[]));

CREATE TRIGGER withdrawals_set_updated_at BEFORE UPDATE ON public.withdrawals
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();