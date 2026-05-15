
CREATE TABLE public.welcome_extra_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  room_id uuid NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  content text,
  image_path text,
  image_mime text,
  video_id uuid,
  button_text text,
  button_url text,
  delay_seconds integer NOT NULL DEFAULT 2,
  parse_mode text NOT NULL DEFAULT 'HTML',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX wem_room_idx ON public.welcome_extra_messages(room_id, sort_order);

ALTER TABLE public.welcome_extra_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY wem_select_own ON public.welcome_extra_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY wem_insert_own ON public.welcome_extra_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY wem_update_own ON public.welcome_extra_messages FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY wem_delete_own ON public.welcome_extra_messages FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER wem_touch BEFORE UPDATE ON public.welcome_extra_messages
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
