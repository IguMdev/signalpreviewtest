-- Expand rooms
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS broker text,
  ADD COLUMN IF NOT EXISTS welcome_message text,
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  ADD COLUMN IF NOT EXISTS stop_loss_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stop_loss_value numeric,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- room_windows
CREATE TABLE public.room_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  weekdays smallint[] NOT NULL DEFAULT '{}',
  asset_filter text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.room_windows ENABLE ROW LEVEL SECURITY;
CREATE POLICY rw_select_own ON public.room_windows FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY rw_insert_own ON public.room_windows FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY rw_update_own ON public.room_windows FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY rw_delete_own ON public.room_windows FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_room_windows_room ON public.room_windows(room_id);
CREATE TRIGGER trg_rw_updated BEFORE UPDATE ON public.room_windows FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- room_templates
CREATE TYPE public.template_kind AS ENUM ('entry','gain','loss','event');
CREATE TABLE public.room_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  kind public.template_kind NOT NULL,
  content text NOT NULL DEFAULT '',
  parse_mode text NOT NULL DEFAULT 'HTML',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, kind)
);
ALTER TABLE public.room_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY rt_select_own ON public.room_templates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY rt_insert_own ON public.room_templates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY rt_update_own ON public.room_templates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY rt_delete_own ON public.room_templates FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_rt_updated BEFORE UPDATE ON public.room_templates FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- room_session_messages
CREATE TYPE public.session_msg_kind AS ENUM ('open','close');
CREATE TABLE public.room_session_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  kind public.session_msg_kind NOT NULL,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, kind)
);
ALTER TABLE public.room_session_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY rsm_select_own ON public.room_session_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY rsm_insert_own ON public.room_session_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY rsm_update_own ON public.room_session_messages FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY rsm_delete_own ON public.room_session_messages FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_rsm_updated BEFORE UPDATE ON public.room_session_messages FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- room_images
CREATE TYPE public.room_image_kind AS ENUM ('gain','loss');
CREATE TABLE public.room_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  kind public.room_image_kind NOT NULL,
  storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.room_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY ri_select_own ON public.room_images FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY ri_insert_own ON public.room_images FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY ri_update_own ON public.room_images FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY ri_delete_own ON public.room_images FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_room_images_room ON public.room_images(room_id);

-- room_reports
CREATE TABLE public.room_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  room_id uuid NOT NULL UNIQUE REFERENCES public.rooms(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  send_time time NOT NULL DEFAULT '23:00',
  include_stats boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.room_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY rr_select_own ON public.room_reports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY rr_insert_own ON public.room_reports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY rr_update_own ON public.room_reports FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY rr_delete_own ON public.room_reports FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_rr_updated BEFORE UPDATE ON public.room_reports FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Storage bucket for room images (gain/loss)
INSERT INTO storage.buckets (id, name, public) VALUES ('room-images', 'room-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "room_images_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'room-images');
CREATE POLICY "room_images_owner_write" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'room-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "room_images_owner_update" ON storage.objects FOR UPDATE USING (bucket_id = 'room-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "room_images_owner_delete" ON storage.objects FOR DELETE USING (bucket_id = 'room-images' AND auth.uid()::text = (storage.foldername(name))[1]);