-- Fix security issue: sessions table was publicly readable, exposing user_id
-- This allowed attackers to map users to sessions and track activity patterns
--
-- The fix restricts SELECT to only allow users to view their own sessions.
-- This doesn't break ClipView.tsx ownership checks - they'll simply return null
-- for non-owners, which correctly results in isOwner=false.

-- ============================================================================
-- 1. DROP PUBLIC SELECT POLICY
-- ============================================================================

DROP POLICY IF EXISTS "Anyone can view sessions" ON public.sessions;

-- ============================================================================
-- 2. CREATE OWNER-ONLY SELECT POLICY
-- ============================================================================

CREATE POLICY "Users can view their own sessions" ON public.sessions
  FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================================================
-- COMMENT
-- ============================================================================

COMMENT ON POLICY "Users can view their own sessions" ON public.sessions IS
  'Security fix: Users can only view their own sessions to prevent user tracking and activity correlation';

