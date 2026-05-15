
ALTER TABLE public.room_engagement_settings
  ADD COLUMN IF NOT EXISTS welcome_image_path text,
  ADD COLUMN IF NOT EXISTS welcome_image_mime text,
  ADD COLUMN IF NOT EXISTS welcome_video_id uuid,
  ADD COLUMN IF NOT EXISTS welcome_parse_mode text NOT NULL DEFAULT 'HTML',
  ADD COLUMN IF NOT EXISTS welcome_button_text text,
  ADD COLUMN IF NOT EXISTS welcome_button_url text;
