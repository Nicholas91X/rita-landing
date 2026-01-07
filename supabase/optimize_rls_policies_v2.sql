-- OPTIMIZE RLS POLICIES V2
-- Fixes remaining "auth_rls_initplan" and "multiple_permissive_policies" warnings.

-- 1. PROFILES: Fix auth_rls_initplan
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;

CREATE POLICY "Users can update own profile" ON public.profiles FOR
UPDATE USING (
    (
        select auth.uid ()
    ) = id
)
WITH
    CHECK (
        (
            select auth.uid ()
        ) = id
    );

-- 2. CONTENT TABLES: Fix multiple_permissive_policies (SELECT overlap)
-- Strategy: Restrict Admin policies to INSERT, UPDATE, DELETE only.
-- "Public read access" already covers SELECT for everyone (including admins).

-- LEVELS
DROP POLICY IF EXISTS "Admins can modify levels" ON public.levels;

CREATE POLICY "Admins can modify levels" ON public.levels FOR
INSERT
WITH
    CHECK (
        EXISTS (
            SELECT 1
            FROM admins
            WHERE
                admins.user_id = (
                    select auth.uid ()
                )
        )
    );

CREATE POLICY "Admins can update levels" ON public.levels FOR
UPDATE USING (
    EXISTS (
        SELECT 1
        FROM admins
        WHERE
            admins.user_id = (
                select auth.uid ()
            )
    )
);

CREATE POLICY "Admins can delete levels" ON public.levels FOR DELETE USING (
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
DROP POLICY IF EXISTS "Admins can modify courses" ON public.courses;

CREATE POLICY "Admins can modify courses" ON public.courses FOR
INSERT
WITH
    CHECK (
        EXISTS (
            SELECT 1
            FROM admins
            WHERE
                admins.user_id = (
                    select auth.uid ()
                )
        )
    );

CREATE POLICY "Admins can update courses" ON public.courses FOR
UPDATE USING (
    EXISTS (
        SELECT 1
        FROM admins
        WHERE
            admins.user_id = (
                select auth.uid ()
            )
    )
);

CREATE POLICY "Admins can delete courses" ON public.courses FOR DELETE USING (
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
DROP POLICY IF EXISTS "Admins can modify packages" ON public.packages;

CREATE POLICY "Admins can modify packages" ON public.packages FOR
INSERT
WITH
    CHECK (
        EXISTS (
            SELECT 1
            FROM admins
            WHERE
                admins.user_id = (
                    select auth.uid ()
                )
        )
    );

CREATE POLICY "Admins can update packages" ON public.packages FOR
UPDATE USING (
    EXISTS (
        SELECT 1
        FROM admins
        WHERE
            admins.user_id = (
                select auth.uid ()
            )
    )
);

CREATE POLICY "Admins can delete packages" ON public.packages FOR DELETE USING (
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
DROP POLICY IF EXISTS "Admins can modify videos" ON public.videos;

CREATE POLICY "Admins can modify videos" ON public.videos FOR
INSERT
WITH
    CHECK (
        EXISTS (
            SELECT 1
            FROM admins
            WHERE
                admins.user_id = (
                    select auth.uid ()
                )
        )
    );

CREATE POLICY "Admins can update videos" ON public.videos FOR
UPDATE USING (
    EXISTS (
        SELECT 1
        FROM admins
        WHERE
            admins.user_id = (
                select auth.uid ()
            )
    )
);

CREATE POLICY "Admins can delete videos" ON public.videos FOR DELETE USING (
    EXISTS (
        SELECT 1
        FROM admins
        WHERE
            admins.user_id = (
                select auth.uid ()
            )
    )
);

-- 3. ONE_TIME_PURCHASES: Consolidate Policies
-- Combining disjoint policies into single permissive ones to avoid warnings.

DROP POLICY IF EXISTS "Users can view own purchases" ON public.one_time_purchases;

DROP POLICY IF EXISTS "Admins can view all purchases" ON public.one_time_purchases;

DROP POLICY IF EXISTS "Admins can modify all purchases" ON public.one_time_purchases;

DROP POLICY IF EXISTS "Service role can manage purchases" ON public.one_time_purchases;

-- Unified SELECT (User Own OR Admin)
CREATE POLICY "Users and Admins can view purchases" ON public.one_time_purchases FOR
SELECT USING (
        (
            (
                select auth.uid ()
            ) = user_id
        )
        OR EXISTS (
            SELECT 1
            FROM admins
            WHERE
                admins.user_id = (
                    select auth.uid ()
                )
        )
    );

-- Unified MODIFY (Admin OR Service Role)
-- Splitting by action to be precise
CREATE POLICY "Admins and Service can insert purchases" ON public.one_time_purchases FOR
INSERT
WITH
    CHECK (
        EXISTS (
            SELECT 1
            FROM admins
            WHERE
                admins.user_id = (
                    select auth.uid ()
                )
        )
        OR (
            select auth.role ()
        ) = 'service_role'
    );

CREATE POLICY "Admins and Service can update purchases" ON public.one_time_purchases FOR
UPDATE USING (
    EXISTS (
        SELECT 1
        FROM admins
        WHERE
            admins.user_id = (
                select auth.uid ()
            )
    )
    OR (
        select auth.role ()
    ) = 'service_role'
);

CREATE POLICY "Admins and Service can delete purchases" ON public.one_time_purchases FOR DELETE USING (
    EXISTS (
        SELECT 1
        FROM admins
        WHERE
            admins.user_id = (
                select auth.uid ()
            )
    )
    OR (
        select auth.role ()
    ) = 'service_role'
);