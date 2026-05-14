
ALTER TABLE public.room_templates ADD COLUMN IF NOT EXISTS image_mime text;
ALTER TABLE public.room_templates ADD COLUMN IF NOT EXISTS image_ext text;

ALTER TABLE public.room_session_messages ADD COLUMN IF NOT EXISTS image_mime text;
ALTER TABLE public.room_session_messages ADD COLUMN IF NOT EXISTS image_ext text;

ALTER TABLE public.room_reports ADD COLUMN IF NOT EXISTS image_mime text;
ALTER TABLE public.room_reports ADD COLUMN IF NOT EXISTS image_ext text;
