ALTER TABLE public.telegram_accounts
  ADD COLUMN IF NOT EXISTS tg_api_id bigint,
  ADD COLUMN IF NOT EXISTS tg_api_hash text,
  ADD COLUMN IF NOT EXISTS tg_session text,
  ADD COLUMN IF NOT EXISTS tg_phone_code_hash text;

ALTER TABLE public.telegram_accounts ALTER COLUMN bot_token DROP NOT NULL;