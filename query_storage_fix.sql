-- Create bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('room-images', 'room-images', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects just in case
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy: Allow public read access to room-images
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'room-images' );

-- Policy: Allow authenticated users to upload to room-images
CREATE POLICY "Auth Upload" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK ( bucket_id = 'room-images' );

-- Policy: Allow authenticated users to update their own uploads or just any in room-images
CREATE POLICY "Auth Update" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING ( bucket_id = 'room-images' );

-- Policy: Allow authenticated users to delete from room-images
CREATE POLICY "Auth Delete" 
ON storage.objects FOR DELETE 
TO authenticated 
USING ( bucket_id = 'room-images' );
