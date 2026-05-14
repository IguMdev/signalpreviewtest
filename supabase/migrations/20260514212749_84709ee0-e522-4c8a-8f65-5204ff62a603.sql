ALTER TABLE public.recurring_schedules
  ADD COLUMN IF NOT EXISTS image_path text,
  ADD COLUMN IF NOT EXISTS image_mime text;

-- Storage policies for messages/<user_id>/... in room-images bucket
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='msg_images_insert_own') THEN
    CREATE POLICY "msg_images_insert_own" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'room-images'
        AND (storage.foldername(name))[1] = 'messages'
        AND (storage.foldername(name))[2] = auth.uid()::text
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='msg_images_update_own') THEN
    CREATE POLICY "msg_images_update_own" ON storage.objects
      FOR UPDATE TO authenticated
      USING (
        bucket_id = 'room-images'
        AND (storage.foldername(name))[1] = 'messages'
        AND (storage.foldername(name))[2] = auth.uid()::text
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='msg_images_delete_own') THEN
    CREATE POLICY "msg_images_delete_own" ON storage.objects
      FOR DELETE TO authenticated
      USING (
        bucket_id = 'room-images'
        AND (storage.foldername(name))[1] = 'messages'
        AND (storage.foldername(name))[2] = auth.uid()::text
      );
  END IF;
END $$;