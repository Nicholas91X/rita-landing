-- 20260420_07_session_rpc.sql
-- RPC wrappers to expose auth.sessions via PostgREST.
-- SECURITY DEFINER because auth schema is not exposed via the API by default.
-- Both functions require an explicit p_user_id and the caller must be a service_role
-- (enforced by REVOKE + GRANT below) — no user-facing exposure.

BEGIN;

CREATE OR REPLACE FUNCTION public.list_user_sessions(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  user_agent text,
  ip text,
  created_at timestamptz,
  updated_at timestamptz,
  not_after timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT
    s.id,
    s.user_agent,
    host(s.ip) AS ip,
    s.created_at,
    s.updated_at,
    s.not_after
  FROM auth.sessions s
  WHERE s.user_id = p_user_id
    AND (s.not_after IS NULL OR s.not_after > now())
  ORDER BY s.updated_at DESC NULLS LAST, s.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.revoke_user_session(p_session_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM auth.sessions
  WHERE id = p_session_id AND user_id = p_user_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count > 0;
END;
$$;

-- Lock down: only service_role can call. No anon/authenticated.
REVOKE ALL ON FUNCTION public.list_user_sessions(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revoke_user_session(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_user_sessions(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_user_session(uuid, uuid) TO service_role;

COMMIT;
