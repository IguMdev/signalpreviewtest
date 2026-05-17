ALTER TABLE public.telegram_accounts
  ADD COLUMN IF NOT EXISTS member_tracking_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS member_tracking_last_check timestamptz,
  ADD COLUMN IF NOT EXISTS member_tracking_last_error text,
  ADD COLUMN IF NOT EXISTS member_tracking_recovered_at timestamptz;