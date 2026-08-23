ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS gov_fee_paid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gov_fee_paid_at date;