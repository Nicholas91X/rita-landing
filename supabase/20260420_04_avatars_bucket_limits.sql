-- 20260420_04_avatars_bucket_limits.sql
-- Enforces server-side size (5 MB) and MIME type (image jpeg/png/webp) constraints
-- on the avatars bucket. Previously null = unlimited.

BEGIN;

UPDATE storage.buckets
SET file_size_limit = 5242880, -- 5 MB
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id = 'avatars';

COMMIT;
