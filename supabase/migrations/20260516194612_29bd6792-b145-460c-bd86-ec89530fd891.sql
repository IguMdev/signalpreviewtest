ALTER TABLE public.message_logs
  ADD COLUMN IF NOT EXISTS account_id uuid,
  ADD COLUMN IF NOT EXISTS room_id uuid,
  ADD COLUMN IF NOT EXISTS source text;

CREATE INDEX IF NOT EXISTS idx_message_logs_room_created
  ON public.message_logs (room_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_message_logs_user_created
  ON public.message_logs (user_id, created_at DESC);