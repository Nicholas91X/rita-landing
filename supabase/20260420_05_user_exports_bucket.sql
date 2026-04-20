-- 20260420_05_user_exports_bucket.sql
-- Private bucket for GDPR data exports. 50MB ceiling per file.
-- No storage.objects policies: service role only (created & signed URLs issued server-side).

BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('user-exports', 'user-exports', false, 52428800, ARRAY['application/zip'])
ON CONFLICT (id) DO NOTHING;

COMMIT;
