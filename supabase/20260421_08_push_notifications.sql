-- 20260421_08_push_notifications.sql
-- Sub-2: tables for Web Push subscriptions and user notification preferences.

BEGIN;

-- Endpoint storage, one row per browser device. Service role writes on dispatch,
-- users manage their own via RLS.
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  last_error text,
  last_error_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
  ON public.push_subscriptions(user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_subscriptions_select" ON public.push_subscriptions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own_subscriptions_insert" ON public.push_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_subscriptions_delete" ON public.push_subscriptions
  FOR DELETE USING (auth.uid() = user_id);
-- No UPDATE policy for end users: endpoint rotations are delete+insert.
-- Service role bypasses RLS for diagnostic column updates.

-- Preference row per user. Transactional pushes have no column (always on,
-- legitimate interest). Broadcasts are opt-out-able.
CREATE TABLE IF NOT EXISTS public.user_notification_prefs (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  push_broadcast_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_notification_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_prefs_all" ON public.user_notification_prefs
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- T-2 trial reminder idempotency guard. Cron sets this on successful send.
ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS trial_reminder_sent_at timestamptz;

COMMIT;
