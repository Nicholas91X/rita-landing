-- 20260420_03_stripe_anonymization.sql
-- Enables fiscal-compliant anonymization: preserve financial records (10y legal retention)
-- while detaching them from the user's identity.

BEGIN;

ALTER TABLE public.stripe_payments
  ADD COLUMN IF NOT EXISTS anonymized_at timestamptz;

ALTER TABLE public.stripe_invoices
  ADD COLUMN IF NOT EXISTS anonymized_at timestamptz;

-- Allow user_id NULL so anonymized rows can detach from users.
-- (Verified 2026-04-20: both columns already nullable; these statements are no-ops.)
ALTER TABLE public.stripe_payments
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.stripe_invoices
  ALTER COLUMN user_id DROP NOT NULL;

COMMIT;
