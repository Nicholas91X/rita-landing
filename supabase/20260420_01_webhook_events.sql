-- 20260420_01_webhook_events.sql
-- Creates the idempotency ledger for Stripe webhook events.

BEGIN;

CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_processed_at
  ON public.stripe_webhook_events(processed_at);

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
-- No policies: service role bypasses RLS; client roles have no access.

COMMIT;
