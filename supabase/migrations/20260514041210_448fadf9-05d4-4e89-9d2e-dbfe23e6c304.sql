
-- Videos table
CREATE TABLE public.videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  storage_path text NOT NULL,
  file_size bigint,
  duration_seconds int,
  mime_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "videos_select_own" ON public.videos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "videos_insert_own" ON public.videos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "videos_update_own" ON public.videos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "videos_delete_own" ON public.videos FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER videos_touch_updated_at
BEFORE UPDATE ON public.videos
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Scheduled messages: optional video reference
ALTER TABLE public.scheduled_messages
  ADD COLUMN video_id uuid REFERENCES public.videos(id) ON DELETE SET NULL;

-- Allow content to be empty when sending a video
ALTER TABLE public.scheduled_messages ALTER COLUMN content DROP NOT NULL;

-- Storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('videos', 'videos', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: path layout videos/{user_id}/file.mp4
CREATE POLICY "videos_storage_select_own"
ON storage.objects FOR SELECT
USING (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "videos_storage_insert_own"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "videos_storage_update_own"
ON storage.objects FOR UPDATE
USING (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "videos_storage_delete_own"
ON storage.objects FOR DELETE
USING (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);
