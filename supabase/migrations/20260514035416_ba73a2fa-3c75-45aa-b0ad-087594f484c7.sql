DO $$ BEGIN
  CREATE TYPE public.account_type AS ENUM ('bot', 'premium');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE public.telegram_accounts
  ADD COLUMN IF NOT EXISTS account_type public.account_type NOT NULL DEFAULT 'bot',
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS daily_limit integer NOT NULL DEFAULT 1000;