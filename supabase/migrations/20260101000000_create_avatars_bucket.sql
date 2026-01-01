-- Create avatars storage bucket with public access
-- This bucket is used for user profile pictures

-- Create the avatars bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  false,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

-- Allow authenticated users to upload their own avatars
CREATE POLICY "Users can upload their own avatars"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to update their own avatars
CREATE POLICY "Users can update their own avatars"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to delete their own avatars
CREATE POLICY "Users can delete their own avatars"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow anyone to view avatars (public access)
CREATE POLICY "Anyone can view avatars"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- Also ensure proofs bucket exists and has proper policies for avatars subfolder
-- (for backward compatibility with existing avatar URLs)
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit)
VALUES (
  'proofs',
  'proofs',
  false, -- proofs bucket stays private by default
  false,
  52428800 -- 50MB limit for video proofs
)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to avatars subfolder in proofs bucket
-- This maintains backward compatibility with existing avatar URLs
CREATE POLICY "Public read access to avatars in proofs bucket"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'proofs' AND
  (storage.foldername(name))[1] = 'avatars'
);

-- Allow authenticated users to upload avatars to proofs bucket
CREATE POLICY "Users can upload avatars to proofs bucket"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'proofs' AND
  (storage.foldername(name))[1] = 'avatars' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- Allow authenticated users to update their avatars in proofs bucket
CREATE POLICY "Users can update avatars in proofs bucket"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'proofs' AND
  (storage.foldername(name))[1] = 'avatars' AND
  (storage.foldername(name))[2] = auth.uid()::text
);
