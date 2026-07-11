ALTER TABLE public.telegram_accounts ADD COLUMN IF NOT EXISTS push_subscription JSONB;
