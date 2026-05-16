CREATE TABLE IF NOT EXISTS public.forwarder_dedupe (
  chat_id bigint NOT NULL,
  message_id bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chat_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_forwarder_dedupe_created ON public.forwarder_dedupe (created_at);

ALTER TABLE public.forwarder_dedupe ENABLE ROW LEVEL SECURITY;
-- Nenhuma policy: apenas service role (server) acessa.
