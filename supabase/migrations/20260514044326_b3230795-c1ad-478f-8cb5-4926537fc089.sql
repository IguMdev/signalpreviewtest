CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE public.recurring_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  room_id uuid NOT NULL,
  account_id uuid,
  title text NOT NULL,
  content text,
  video_id uuid,
  parse_mode text NOT NULL DEFAULT 'HTML',
  times text[] NOT NULL DEFAULT '{}',
  weekdays smallint[] NOT NULL DEFAULT '{}',
  is_premium boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  last_fire_key text,
  last_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recurring_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY rs_select_own ON public.recurring_schedules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY rs_insert_own ON public.recurring_schedules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY rs_update_own ON public.recurring_schedules FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY rs_delete_own ON public.recurring_schedules FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_rs_user_room ON public.recurring_schedules(user_id, room_id);
CREATE INDEX idx_rs_active ON public.recurring_schedules(is_active) WHERE is_active = true;

CREATE TRIGGER rs_touch BEFORE UPDATE ON public.recurring_schedules
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();