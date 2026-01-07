-- Add image_url to packages
ALTER TABLE packages ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Create package-images bucket if it doesn't exist
INSERT INTO
    storage.buckets (id, name, public)
VALUES (
        'package-images',
        'package-images',
        true
    ) ON CONFLICT (id) DO NOTHING;

-- RLS for package-images bucket
-- Allow public access to read
CREATE POLICY "Public Access" ON storage.objects FOR
SELECT USING (bucket_id = 'package-images');

-- Allow admins to upload/update/delete
CREATE POLICY "Admin CRUD" 
ON storage.objects FOR ALL 
TO authenticated 
USING (
    bucket_id = 'package-images' 
    AND (
        SELECT (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid IN (
            SELECT user_id FROM admins
        )
    )
)
WITH CHECK (
    bucket_id = 'package-images' 
    AND (
        SELECT (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid IN (
            SELECT user_id FROM admins
        )
    )
);