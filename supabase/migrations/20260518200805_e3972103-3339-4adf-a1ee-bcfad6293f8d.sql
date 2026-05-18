
-- ===== room_engagement_settings: campos do botão CTA =====
ALTER TABLE public.room_engagement_settings
  ADD COLUMN IF NOT EXISTS followup_cta_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS followup_cta_button_text text NOT NULL DEFAULT 'Iniciar conversa privada 💬';

-- ===== followup_settings =====
CREATE TABLE IF NOT EXISTS public.followup_settings (
  room_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.followup_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY fus_select_own ON public.followup_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY fus_insert_own ON public.followup_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY fus_update_own ON public.followup_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY fus_delete_own ON public.followup_settings FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_followup_settings_updated_at
  BEFORE UPDATE ON public.followup_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===== followup_messages =====
CREATE TABLE IF NOT EXISTS public.followup_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  room_id uuid NOT NULL,
  day_number integer NOT NULL CHECK (day_number >= 1 AND day_number <= 365),
  send_time time NOT NULL DEFAULT '09:00',
  content text,
  image_path text,
  image_mime text,
  video_id uuid,
  parse_mode text NOT NULL DEFAULT 'HTML',
  premium_enabled boolean NOT NULL DEFAULT false,
  premium_account_id uuid,
  button_text text,
  button_url text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, day_number)
);
CREATE INDEX IF NOT EXISTS idx_followup_messages_room ON public.followup_messages(room_id);
ALTER TABLE public.followup_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY fum_select_own ON public.followup_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY fum_insert_own ON public.followup_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY fum_update_own ON public.followup_messages FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY fum_delete_own ON public.followup_messages FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_followup_messages_updated_at
  BEFORE UPDATE ON public.followup_messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===== followup_leads =====
CREATE TABLE IF NOT EXISTS public.followup_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  room_id uuid NOT NULL,
  account_id uuid NOT NULL,
  tg_user_id bigint NOT NULL,
  chat_id bigint NOT NULL,
  first_name text,
  username text,
  status text NOT NULL DEFAULT 'active',
  started_at timestamptz NOT NULL DEFAULT now(),
  last_sent_day integer,
  last_sent_at timestamptz,
  stopped_at timestamptz,
  stopped_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, tg_user_id)
);
CREATE INDEX IF NOT EXISTS idx_followup_leads_status ON public.followup_leads(status);
CREATE INDEX IF NOT EXISTS idx_followup_leads_user ON public.followup_leads(user_id);
ALTER TABLE public.followup_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY ful_select_own ON public.followup_leads FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY ful_update_own ON public.followup_leads FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY ful_delete_own ON public.followup_leads FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_followup_leads_updated_at
  BEFORE UPDATE ON public.followup_leads
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===== followup_dispatch_log =====
CREATE TABLE IF NOT EXISTS public.followup_dispatch_log (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL,
  lead_id uuid NOT NULL,
  day_number integer NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  ok boolean NOT NULL,
  error text,
  UNIQUE (lead_id, day_number)
);
CREATE INDEX IF NOT EXISTS idx_followup_dispatch_lead ON public.followup_dispatch_log(lead_id);
ALTER TABLE public.followup_dispatch_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY fudl_select_own ON public.followup_dispatch_log FOR SELECT USING (auth.uid() = user_id);
