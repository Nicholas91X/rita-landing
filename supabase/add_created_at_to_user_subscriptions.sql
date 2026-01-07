-- Add created_at to user_subscriptions table
ALTER TABLE public.user_subscriptions 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;

-- Backfill existing records (optional, default to now is fine but if we have current_period_start from Stripe we could use it)
-- For now, default to now() is safe, but existing users might get a fresh 4-day window.