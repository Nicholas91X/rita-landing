-- RLS audit fixes — 2026-04-20
--
-- 1. public.admins: drop overly permissive SELECT policy that exposed the
--    full admin list to any authenticated user. The remaining policy
--    "Admins are viewable by themselves and other admins" covers legitimate
--    reads (own row + admin role).
--
-- 2. storage.objects: drop "Public Access" SELECT on the avatars bucket. The
--    bucket is flagged public=true, so the CDN endpoint
--    /storage/v1/object/public/avatars/... keeps serving files without RLS.
--    Dropping the policy prevents file enumeration via .list() API calls.

BEGIN;

DROP POLICY IF EXISTS "Admins are visible to authenticated"
  ON public.admins;

DROP POLICY IF EXISTS "Public Access"
  ON storage.objects;

COMMIT;
