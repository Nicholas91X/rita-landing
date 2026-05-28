-- 20260528_10_lead_magnet.sql
-- Adds schema for the "Rituale della Leggerezza" lead-magnet:
--   * profiles.account_type enum ('lead' | 'standard') + lead-related timestamps
--   * packages.hidden_from_discover flag (Lezioni Gratis is granted automatically,
--     never sold via Discover)
--   * Unique constraint on one_time_purchases(user_id, package_id) so the lead
--     grant in /auth/callback can be expressed as an idempotent upsert
--   * Updated handle_new_user that reads account_type, lead_source,
--     marketing_consent_at from raw_user_meta_data (forwarded by
--     requestLeadMagicLink via auth.admin.generateLink)
--   * Indices for cron lookups (lead_expires_at) and admin KPIs

BEGIN;

-- 1. account_type enum ─────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_type') THEN
        CREATE TYPE account_type AS ENUM ('lead', 'standard');
    END IF;
END $$;

-- 2. profiles columns ──────────────────────────────────────────────
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS account_type account_type NOT NULL DEFAULT 'standard',
    ADD COLUMN IF NOT EXISTS lead_expires_at timestamptz,
    ADD COLUMN IF NOT EXISTS upgraded_from_lead_at timestamptz,
    ADD COLUMN IF NOT EXISTS lead_source text,
    ADD COLUMN IF NOT EXISTS marketing_consent_at timestamptz,
    ADD COLUMN IF NOT EXISTS lead_reminder_t10_sent_at timestamptz,
    ADD COLUMN IF NOT EXISTS lead_reminder_t20_sent_at timestamptz,
    ADD COLUMN IF NOT EXISTS completion_modal_shown_at timestamptz;

-- 3. packages.hidden_from_discover ─────────────────────────────────
ALTER TABLE public.packages
    ADD COLUMN IF NOT EXISTS hidden_from_discover boolean NOT NULL DEFAULT false;

-- 4. Unique constraint on one_time_purchases for idempotent lead upsert ───
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'one_time_purchases_user_package_unique'
    ) THEN
        ALTER TABLE public.one_time_purchases
            ADD CONSTRAINT one_time_purchases_user_package_unique
            UNIQUE (user_id, package_id);
    END IF;
END $$;

-- 5. Replace handle_new_user to forward lead metadata ─────────────
-- COALESCE for full_name/avatar_url retained from migration 09 (Google
-- name/picture fallback). account_type defaults to 'standard' if not
-- forwarded; the lead path passes account_type='lead' via raw_user_meta_data.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.profiles (
        id, email, full_name, avatar_url,
        terms_accepted_at, account_type, lead_source, marketing_consent_at
    )
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
        END,
        COALESCE(
            (NEW.raw_user_meta_data->>'account_type')::account_type,
            'standard'
        ),
        NEW.raw_user_meta_data->>'lead_source',
        CASE
            WHEN NEW.raw_user_meta_data->>'marketing_consent_at' IS NOT NULL
                THEN (NEW.raw_user_meta_data->>'marketing_consent_at')::timestamptz
            ELSE NULL
        END
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Indices for cron + admin ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_lead_expires_at
    ON public.profiles(lead_expires_at)
    WHERE account_type = 'lead';

CREATE INDEX IF NOT EXISTS idx_profiles_upgraded_from_lead_at
    ON public.profiles(upgraded_from_lead_at)
    WHERE upgraded_from_lead_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_account_type
    ON public.profiles(account_type);

COMMIT;
