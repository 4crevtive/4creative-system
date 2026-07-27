ALTER TABLE public.freelancers
  ADD COLUMN IF NOT EXISTS wallet_provider text,
  ADD COLUMN IF NOT EXISTS wallet_number text,
  ADD COLUMN IF NOT EXISTS bank_account_holder text,
  ADD COLUMN IF NOT EXISTS bank_account_number text,
  ADD COLUMN IF NOT EXISTS bank_branch text;