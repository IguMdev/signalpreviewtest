ALTER TABLE public.message_logs ADD COLUMN IF NOT EXISTS account_id uuid;
CREATE INDEX IF NOT EXISTS message_logs_account_created_idx ON public.message_logs (account_id, created_at DESC);
