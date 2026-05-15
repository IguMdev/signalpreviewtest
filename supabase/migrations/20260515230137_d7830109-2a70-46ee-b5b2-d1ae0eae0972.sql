CREATE TABLE IF NOT EXISTS public.bot_execution_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id uuid,
  room_id uuid,
  bot_type text NOT NULL,         -- 'boasvindas' | 'encaminhador'
  event text NOT NULL,            -- 'received' | 'sent' | 'skipped' | 'failed'
  chat_id bigint,
  target_chat_id bigint,
  tg_user_id bigint,
  tg_username text,
  tg_first_name text,
  message text,
  error text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bel_user_created_idx ON public.bot_execution_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS bel_user_bot_idx ON public.bot_execution_logs(user_id, bot_type, created_at DESC);

ALTER TABLE public.bot_execution_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bel_select_own" ON public.bot_execution_logs
  FOR SELECT USING (auth.uid() = user_id);
-- inserts feitos via service role (webhook), nenhum INSERT/UPDATE/DELETE para usuários
