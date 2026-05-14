
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS premium_account_id uuid,
  ADD COLUMN IF NOT EXISTS access_url text,
  ADD COLUMN IF NOT EXISTS stop_loss_message text,
  ADD COLUMN IF NOT EXISTS market_tips_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.room_windows
  ADD COLUMN IF NOT EXISTS signals_qty int NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS max_losses int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS martingale int NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS signal_type text NOT NULL DEFAULT 'message',
  ADD COLUMN IF NOT EXISTS timeframes text[] NOT NULL DEFAULT ARRAY['M1']::text[],
  ADD COLUMN IF NOT EXISTS use_all_assets boolean NOT NULL DEFAULT true;

ALTER TABLE public.room_session_messages
  ADD COLUMN IF NOT EXISTS image_path text,
  ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS lead_minutes int NOT NULL DEFAULT 5;

ALTER TABLE public.room_reports
  ADD COLUMN IF NOT EXISTS delay_minutes int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS template text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS image_path text;

ALTER TABLE public.room_assets
  ADD COLUMN IF NOT EXISTS window_id uuid REFERENCES public.room_windows(id) ON DELETE CASCADE;

-- Extend template_kind enum with new variants
ALTER TYPE public.template_kind ADD VALUE IF NOT EXISTS 'signal';
ALTER TYPE public.template_kind ADD VALUE IF NOT EXISTS 'win';
ALTER TYPE public.template_kind ADD VALUE IF NOT EXISTS 'win_martingale';
ALTER TYPE public.template_kind ADD VALUE IF NOT EXISTS 'buy_direction';
ALTER TYPE public.template_kind ADD VALUE IF NOT EXISTS 'sell_direction';

-- Custom template buttons
CREATE TABLE IF NOT EXISTS public.room_template_buttons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  template_kind public.template_kind NOT NULL,
  label text NOT NULL,
  url text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.room_template_buttons ENABLE ROW LEVEL SECURITY;
CREATE POLICY rtb_select_own ON public.room_template_buttons FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY rtb_insert_own ON public.room_template_buttons FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY rtb_update_own ON public.room_template_buttons FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY rtb_delete_own ON public.room_template_buttons FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_rtb_updated BEFORE UPDATE ON public.room_template_buttons FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
