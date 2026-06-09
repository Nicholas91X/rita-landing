-- 20260604_13_profiles_created_at.sql
-- The admin Leads view (getLeadsList) selects and orders by profiles.created_at,
-- but the deployed profiles table never had that column (only updated_at) → 500.
-- Add it (additive) and backfill from auth.users.created_at for accurate signup
-- time. New rows get DEFAULT now() at profile-insert (≈ signup), set by the
-- handle_new_user trigger firing on user creation.

BEGIN;

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

UPDATE public.profiles p
SET created_at = u.created_at
FROM auth.users u
WHERE p.id = u.id;

COMMIT;
