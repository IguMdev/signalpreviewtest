
-- Restrict broad SELECT (list) on public buckets to owner only.
-- Public download via /object/public/* bypasses RLS, so getPublicUrl keeps working
-- for Telegram. This prevents anonymous users from listing every file.

DROP POLICY IF EXISTS "Avatars are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "room_images_public_read" ON storage.objects;
DROP POLICY IF EXISTS "room_photos_public_read" ON storage.objects;

CREATE POLICY "avatars_owner_list"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'avatars' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "room_images_owner_list"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'room-images' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "room_images_messages_owner_list"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'room-images'
  AND (storage.foldername(name))[1] = 'messages'
  AND (storage.foldername(name))[2] = (auth.uid())::text
);

CREATE POLICY "room_photos_owner_list"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'room-photos' AND (auth.uid())::text = (storage.foldername(name))[1]);
