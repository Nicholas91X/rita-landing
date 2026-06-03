-- 20260603_11_sequential_unlock.sql
-- Sequential package unlocking. A package becomes purchasable/playable only
-- after every package BEFORE it in the same course is completed. The "chain"
-- is the course: packages within one course form an ordered sequence via
-- order_index; a new course is simply a new independent chain. Packages alone
-- in their course (the lead "Rituale della Leggerezza", the 1:1 "Rinascita")
-- have no predecessor, so they're always unlocked — no special-casing needed.

BEGIN;

ALTER TABLE public.packages
    ADD COLUMN IF NOT EXISTS order_index integer NOT NULL DEFAULT 0;

-- Seed the only existing chain (course "Pilates & Total Body"): Bali → New York.
UPDATE public.packages SET order_index = 0 WHERE name = 'BALI';
UPDATE public.packages SET order_index = 1 WHERE name = 'NEW YORK';

-- Helps the per-course ordered lookups used by the unlock checks.
CREATE INDEX IF NOT EXISTS idx_packages_course_order
    ON public.packages(course_id, order_index);

COMMIT;
