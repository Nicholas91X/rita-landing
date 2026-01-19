-- OPTIMIZATION OF RLS POLICIES
-- This script fixes "auth_rls_initplan" warnings by wrapping auth functions in (select ...)
-- and fixes "multiple_permissive_policies" warnings by consolidating policies.

-- 1. TABLE: admin_notifications
-- Re-create Admin policies with optimized auth calls
DROP POLICY IF EXISTS "Admins can update notifications" ON admin_notifications;

CREATE POLICY "Admins can update notifications" ON admin_notifications FOR
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

DROP POLICY IF EXISTS "Admins can view notifications" ON admin_notifications;

CREATE POLICY "Admins can view notifications" ON admin_notifications FOR
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

DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON admin_notifications;

CREATE POLICY "Authenticated users can insert notifications" ON admin_notifications FOR
INSERT
WITH
    CHECK (
        (
            (
                select auth.role ()
            ) = 'authenticated'
        )
        AND (
            user_id = (
                select auth.uid ()
            )
        )
    );

-- 2. TABLE: refund_requests
-- Consolidate SELECT policies (User + Admin) to fix multiple permissive policy warning
DROP POLICY IF EXISTS "Admins can view all refund requests" ON refund_requests;

DROP POLICY IF EXISTS "Users can view their own refund requests" ON refund_requests;

CREATE POLICY "Users and Admins can view refund requests" ON refund_requests FOR
SELECT USING (
        (
            user_id = (
                select auth.uid ()
            )
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

-- Optimize Admin UPDATE
DROP POLICY IF EXISTS "Admins can update refund requests" ON refund_requests;

CREATE POLICY "Admins can update refund requests" ON refund_requests FOR
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

-- Optimize User INSERT
DROP POLICY IF EXISTS "Users can insert their own refund requests" ON refund_requests;

CREATE POLICY "Users can insert their own refund requests" ON refund_requests FOR
INSERT
WITH
    CHECK (
        (
            select auth.uid ()
        ) = user_id
    );

-- 3. TABLE: user_notifications
-- Optimize Admin INSERT
DROP POLICY IF EXISTS "Admins can insert notifications" ON user_notifications;

CREATE POLICY "Admins can insert notifications" ON user_notifications FOR
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

-- Optimize User UPDATE
DROP POLICY IF EXISTS "Users can update their own notifications (mark as read)" ON user_notifications;

CREATE POLICY "Users can update their own notifications" ON user_notifications FOR
UPDATE USING (
    (
        select auth.uid ()
    ) = user_id
)
WITH
    CHECK (
        (
            select auth.uid ()
        ) = user_id
    );

-- Optimize User SELECT
DROP POLICY IF EXISTS "Users can view their own notifications" ON user_notifications;

CREATE POLICY "Users can view their own notifications" ON user_notifications FOR
SELECT USING (
        (
            select auth.uid ()
        ) = user_id
    );

-- 4. TABLE: user_subscriptions
-- Consolidate SELECT policies (User + Admin)
DROP POLICY IF EXISTS "Admins can view all subscriptions" ON user_subscriptions;

DROP POLICY IF EXISTS "Users can view their own subscriptions" ON user_subscriptions;

CREATE POLICY "Users and Admins can view subscriptions" ON user_subscriptions FOR
SELECT USING (
        (
            user_id = (
                select auth.uid ()
            )
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

-- Consolidate UPDATE policies (User + Admin)
DROP POLICY IF EXISTS "Admins can update all subscriptions" ON user_subscriptions;

DROP POLICY IF EXISTS "Users can update their own subscriptions" ON user_subscriptions;

CREATE POLICY "Users and Admins can update subscriptions" ON user_subscriptions FOR
UPDATE USING (
    (
        user_id = (
            select auth.uid ()
        )
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

-- 5. TABLE: video_watch_progress
-- Optimize User INSERT
DROP POLICY IF EXISTS "Users can insert their own progress" ON video_watch_progress;

CREATE POLICY "Users can insert their own progress" ON video_watch_progress FOR
INSERT
WITH
    CHECK (
        (
            select auth.uid ()
        ) = user_id
    );

-- Optimize User UPDATE
DROP POLICY IF EXISTS "Users can update their own progress" ON video_watch_progress;

CREATE POLICY "Users can update their own progress" ON video_watch_progress FOR
UPDATE USING (
    (
        select auth.uid ()
    ) = user_id
)
WITH
    CHECK (
        (
            select auth.uid ()
        ) = user_id
    );

-- Optimize User SELECT
DROP POLICY IF EXISTS "Users can view their own progress" ON video_watch_progress;

CREATE POLICY "Users can view their own progress" ON video_watch_progress FOR
SELECT USING (
        (
            select auth.uid ()
        ) = user_id
    );