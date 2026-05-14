
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS photo_updated_at timestamptz;

INSERT INTO storage.buckets (id, name, public)
VALUES ('room-photos', 'room-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "room_photos_public_read" ON storage.objects;
CREATE POLICY "room_photos_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'room-photos');

DROP POLICY IF EXISTS "room_photos_owner_insert" ON storage.objects;
CREATE POLICY "room_photos_owner_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'room-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "room_photos_owner_update" ON storage.objects;
CREATE POLICY "room_photos_owner_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'room-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "room_photos_owner_delete" ON storage.objects;
CREATE POLICY "room_photos_owner_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'room-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
