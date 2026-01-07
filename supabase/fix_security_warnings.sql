-- FIX SECURITY WARNING: function_search_path_mutable
-- Sets a fixed search_path for the security definer function 'handle_new_user'.
-- This prevents malicious users from hijacking the search path to execute arbitrary code.

ALTER FUNCTION public.handle_new_user() SET search_path = public;