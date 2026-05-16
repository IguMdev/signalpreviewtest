-- Toggle premium por item (modelo de envio rápido + agendamento)
ALTER TABLE public.quick_send_templates
  ADD COLUMN IF NOT EXISTS is_premium boolean NOT NULL DEFAULT false;

ALTER TABLE public.scheduled_messages
  ADD COLUMN IF NOT EXISTS is_premium boolean NOT NULL DEFAULT false;

-- Indicador do status do emoji premium no envio
ALTER TABLE public.message_logs
  ADD COLUMN IF NOT EXISTS premium_status text;

COMMENT ON COLUMN public.message_logs.premium_status IS
  'premium_sent | premium_blocked | no_premium_account | plain | plain_forced | mirror_premium | mirror_copy';

-- Idempotência da Abertura/Fechamento de sessão por janela (dispara 1x por dia/horário)
ALTER TABLE public.room_windows
  ADD COLUMN IF NOT EXISTS last_session_fire jsonb NOT NULL DEFAULT '{}'::jsonb;