-- ENABLE RLS & FIX SECURITY ERRORS
-- This script enables Row Level Security on all tables and adds necessary policies
-- to ensure the application continues to work (e.g. public access for catalog).

-- 1. PROFILES (Policy exists, just enable)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. CONTENT TABLES (Public Read Access required for Landing/Discover)

-- LEVELS
ALTER TABLE public.levels ENABLE ROW LEVEL SECURITY;
-- Allow everyone (anon + authenticated) to read content
CREATE POLICY "Public read access" ON public.levels FOR
SELECT USING (true);
-- Allow only Admins to modify content
CREATE POLICY "Admins can modify levels" ON public.levels FOR ALL USING (
    EXISTS (
        SELECT 1
        FROM admins
        WHERE
            admins.user_id = (
                select auth.uid ()
            )
    )
);

-- COURSES
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access" ON public.courses FOR
SELECT USING (true);

CREATE POLICY "Admins can modify courses" ON public.courses FOR ALL USING (
    EXISTS (
        SELECT 1
        FROM admins
        WHERE
            admins.user_id = (
                select auth.uid ()
            )
    )
);

-- PACKAGES
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access" ON public.packages FOR
SELECT USING (true);

CREATE POLICY "Admins can modify packages" ON public.packages FOR ALL USING (
    EXISTS (
        SELECT 1
        FROM admins
        WHERE
            admins.user_id = (
                select auth.uid ()
            )
    )
);

-- VIDEOS
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
-- Metadata is public (thumbnails, titles), secure URL generation handles access control
CREATE POLICY "Public read access" ON public.videos FOR
SELECT USING (true);

CREATE POLICY "Admins can modify videos" ON public.videos FOR ALL USING (
    EXISTS (
        SELECT 1
        FROM admins
        WHERE
            admins.user_id = (
                select auth.uid ()
            )
    )
);

-- 3. USER DATA TABLES (Private Access)

-- ONE_TIME_PURCHASES
ALTER TABLE public.one_time_purchases ENABLE ROW LEVEL SECURITY;

-- Users see their own purchases
CREATE POLICY "Users can view own purchases" ON public.one_time_purchases FOR
SELECT USING (
        (
            select auth.uid ()
        ) = user_id
    );

-- Admins see all
CREATE POLICY "Admins can view all purchases" ON public.one_time_purchases FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM admins
            WHERE
                admins.user_id = (
                    select auth.uid ()
                )
        )
    );

-- Admins can modify all
CREATE POLICY "Admins can modify all purchases" ON public.one_time_purchases FOR ALL USING (
    EXISTS (
        SELECT 1
        FROM admins
        WHERE
            admins.user_id = (
                select auth.uid ()
            )
    )
);

-- Users likely don't INSERT/UPDATE manually (managed by webhooks/server actions),
-- but if client-side insert is needed:
CREATE POLICY "Service role can manage purchases" ON public.one_time_purchases FOR ALL USING (
    (
        select auth.role ()
    ) = 'service_role'
);