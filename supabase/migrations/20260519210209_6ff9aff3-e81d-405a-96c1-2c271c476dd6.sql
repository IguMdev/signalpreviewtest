CREATE TABLE IF NOT EXISTS public.engagement_reaction_dispatches (
  chat_id bigint NOT NULL,
  telegram_message_id bigint NOT NULL,
  user_id uuid NOT NULL,
  subscription_id uuid,
  smm_order_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chat_id, telegram_message_id)
);

ALTER TABLE public.engagement_reaction_dispatches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "erd_select_own"
  ON public.engagement_reaction_dispatches
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_erd_user_created
  ON public.engagement_reaction_dispatches (user_id, created_at DESC);