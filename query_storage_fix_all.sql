DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Auth Upload" ON storage.objects;
DROP POLICY IF EXISTS "Auth Update" ON storage.objects;
DROP POLICY IF EXISTS "Auth Delete" ON storage.objects;

-- Create buckets if they don't exist
INSERT INTO storage.buckets (id, name, public) VALUES 
('room-images', 'room-images', true),
('videos', 'videos', true),
('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Allow public read access to all 3 buckets
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING ( bucket_id IN ('room-images', 'videos', 'avatars') );

-- Policy: Allow authenticated users to upload to all 3 buckets
CREATE POLICY "Auth Upload" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK ( bucket_id IN ('room-images', 'videos', 'avatars') );

-- Policy: Allow authenticated users to update
CREATE POLICY "Auth Update" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING ( bucket_id IN ('room-images', 'videos', 'avatars') );

-- Policy: Allow authenticated users to delete
CREATE POLICY "Auth Delete" 
ON storage.objects FOR DELETE 
TO authenticated 
USING ( bucket_id IN ('room-images', 'videos', 'avatars') );
