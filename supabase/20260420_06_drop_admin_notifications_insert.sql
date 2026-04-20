-- 20260420_06_drop_admin_notifications_insert.sql
-- Drops the user-scoped INSERT policy on admin_notifications.
-- After PR #2 is deployed, the 3 server actions that insert here use service_role
-- (which bypasses RLS), so this policy is no longer needed and removing it
-- prevents future drift.
--
-- ⚠️ DO NOT APPLY UNTIL PR #2 IS LIVE IN PRODUCTION AND STABLE ≥24H.

BEGIN;

DROP POLICY IF EXISTS "Authenticated users can insert notifications"
  ON public.admin_notifications;

COMMIT;
