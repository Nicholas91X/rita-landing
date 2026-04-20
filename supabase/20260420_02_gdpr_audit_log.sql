-- 20260420_02_gdpr_audit_log.sql
-- Audit log for GDPR export and deletion actions.

BEGIN;

CREATE TABLE IF NOT EXISTS public.gdpr_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  action text NOT NULL CHECK (action IN ('export', 'delete_request', 'delete_completed')),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  metadata jsonb
);

CREATE INDEX IF NOT EXISTS idx_gdpr_audit_occurred_at
  ON public.gdpr_audit_log(occurred_at);

CREATE INDEX IF NOT EXISTS idx_gdpr_audit_user_id
  ON public.gdpr_audit_log(user_id) WHERE user_id IS NOT NULL;

ALTER TABLE public.gdpr_audit_log ENABLE ROW LEVEL SECURITY;
-- No policies: service role only.

COMMIT;
