-- 20260527_09_auth_login_hardening.sql
-- Hardens the auth flow:
--   * Adds profiles.terms_accepted_at to persist GDPR consent.
--   * Adds profiles.welcome_email_sent_at as an idempotent guard so the welcome
--     email cannot fire twice for the same user (Google OAuth was re-sending it
--     on every login).
--   * Rewrites handle_new_user() to read both Supabase-standard
--     (full_name/avatar_url) and Google OAuth (name/picture) metadata keys, and
--     to forward terms_accepted_at when signUpAction supplies it.
--   * Adds handle_user_email_change() so profiles.email tracks auth.users.email
--     after an email_change flow.
--   * Backfills full_name/avatar_url/email for existing rows where they ended
--     up NULL because of the previous trigger reading the wrong metadata keys.

BEGIN;

-- 1. Schema additions ───────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'profiles'
          AND column_name = 'terms_accepted_at'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN terms_accepted_at timestamptz;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'profiles'
          AND column_name = 'welcome_email_sent_at'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN welcome_email_sent_at timestamptz;
    END IF;
END $$;

-- 2. Replace handle_new_user() ──────────────────────────────────────
-- Google's OAuth metadata uses `name` and `picture`; native Supabase signup
-- (and our signUpAction) uses `full_name` and `avatar_url`. Coalesce both so
-- the profile row is never left empty regardless of provider.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url, terms_accepted_at)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(
            NEW.raw_user_meta_data->>'full_name',
            NEW.raw_user_meta_data->>'name'
        ),
        COALESCE(
            NEW.raw_user_meta_data->>'avatar_url',
            NEW.raw_user_meta_data->>'picture'
        ),
        CASE
            WHEN NEW.raw_user_meta_data->>'terms_accepted_at' IS NOT NULL
                THEN (NEW.raw_user_meta_data->>'terms_accepted_at')::timestamptz
            ELSE NULL
        END
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- The on_auth_user_created trigger itself already exists from triggers.sql.
-- We only need to ensure it points at the (now-updated) function — CREATE OR
-- REPLACE FUNCTION leaves the existing trigger binding intact.

-- 3. Email sync trigger ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_user_email_change()
RETURNS trigger AS $$
BEGIN
    IF NEW.email IS DISTINCT FROM OLD.email THEN
        UPDATE public.profiles
        SET email = NEW.email,
            updated_at = now()
        WHERE id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_email_changed ON auth.users;
CREATE TRIGGER on_auth_user_email_changed
    AFTER UPDATE OF email ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_user_email_change();

-- 4. Backfill ───────────────────────────────────────────────────────
-- Idempotent: only touches columns that are currently NULL. Re-running is a
-- no-op once everyone is healed.
UPDATE public.profiles p
SET
    full_name = COALESCE(
        p.full_name,
        u.raw_user_meta_data->>'full_name',
        u.raw_user_meta_data->>'name'
    ),
    avatar_url = COALESCE(
        p.avatar_url,
        u.raw_user_meta_data->>'avatar_url',
        u.raw_user_meta_data->>'picture'
    ),
    email = COALESCE(p.email, u.email),
    updated_at = now()
FROM auth.users u
WHERE p.id = u.id
  AND (
      p.full_name IS NULL
      OR p.avatar_url IS NULL
      OR p.email IS NULL
  );

COMMIT;
