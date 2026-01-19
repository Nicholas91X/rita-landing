-- 1. Add stripe_customer_id to profiles table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'stripe_customer_id') THEN
        ALTER TABLE public.profiles ADD COLUMN stripe_customer_id text;
    END IF;
END $$;

-- 2. Optional: Index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id ON public.profiles (stripe_customer_id);

-- 3. Sync existing IDs from user_subscriptions (One-off fix)
-- Uses current_period_end as a proxy for 'most recent' subscription since created_at might be missing
UPDATE public.profiles p
SET
    stripe_customer_id = sub.stripe_customer_id
FROM (
        SELECT DISTINCT
            ON (user_id) user_id, stripe_customer_id
        FROM public.user_subscriptions
        WHERE
            stripe_customer_id IS NOT NULL
        ORDER BY user_id, current_period_end DESC
    ) sub
WHERE
    p.id = sub.user_id
    AND p.stripe_customer_id IS NULL;