-- 20260604_12_prelaunch_mode.sql
-- Pre-launch mode support.
-- email_unsubscribed_at: master switch for all bulk email (Community + future
-- marketing). NULL = subscribed. Set by /api/unsubscribe and the profile
-- toggle; honoured by the Community email send. Transactional email ignores it.
-- Backfill: in pre-launch the lead access window is removed (lead_expires_at
-- NULL = never expires, per the existing check in content.ts), so extend any
-- existing leads.

BEGIN;

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS email_unsubscribed_at timestamptz;

-- Extend existing leads (likely none real yet) so nobody loses access during
-- the ~2 month pre-launch gap.
UPDATE public.profiles SET lead_expires_at = NULL WHERE account_type = 'lead';

COMMIT;
