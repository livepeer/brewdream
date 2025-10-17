-- Fix RLS security issues
-- This migration replaces insecure "true" policies with proper auth checks

-- ============================================================================
-- 1. FIX USERS TABLE (CRITICAL)
-- ============================================================================
-- Drop insecure policies that allow anyone to view/update any user
DROP POLICY IF EXISTS "Users can view their own data" ON public.users;
DROP POLICY IF EXISTS "Users can insert their own data" ON public.users;
DROP POLICY IF EXISTS "Users can update their own data" ON public.users;

-- Users can only view their own data
CREATE POLICY "Users can view their own data" ON public.users
  FOR SELECT
  USING (auth.uid() = id);

-- Users can only insert their own data (auth.uid() must match the id being inserted)
CREATE POLICY "Users can insert their own data" ON public.users
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Users can only update their own data
CREATE POLICY "Users can update their own data" ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================================================
-- 2. FIX SESSIONS TABLE
-- ============================================================================
-- Public SELECT is needed for clip ownership verification (ClipView.tsx:216-220)
-- But we need to restrict INSERT to ensure users can only create their own sessions

DROP POLICY IF EXISTS "Authenticated users can create sessions" ON public.sessions;

-- Users can only create sessions for themselves
CREATE POLICY "Authenticated users can create sessions" ON public.sessions
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    auth.uid() = user_id
  );

-- Keep public SELECT (needed for clip ownership checks)
-- Policy "Anyone can view sessions" remains unchanged

-- ============================================================================
-- 3. FIX CLIPS TABLE
-- ============================================================================
-- Public SELECT is correct (social app), but INSERT/UPDATE need proper auth check

DROP POLICY IF EXISTS "Authenticated users can create clips" ON public.clips;

-- Users can only create clips for sessions they own
CREATE POLICY "Authenticated users can create clips" ON public.clips
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.sessions
      WHERE sessions.id = session_id
      AND sessions.user_id = auth.uid()
    )
  );

-- Users can only update clips for sessions they own
-- Note: update-clip-asset-status edge function uses service role (bypasses RLS)
-- This policy is for direct client updates
CREATE POLICY "Users can update their own clips" ON public.clips
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions
      WHERE sessions.id = session_id
      AND sessions.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sessions
      WHERE sessions.id = session_id
      AND sessions.user_id = auth.uid()
    )
  );

-- Keep public SELECT
-- Policy "Anyone can view clips" remains unchanged

-- ============================================================================
-- 4. FIX TICKETS TABLE
-- ============================================================================
-- Tickets should only be accessible by the session owner

DROP POLICY IF EXISTS "Users can view their own tickets" ON public.tickets;
DROP POLICY IF EXISTS "Users can create tickets" ON public.tickets;
DROP POLICY IF EXISTS "Users can update their tickets" ON public.tickets;

-- Users can only view tickets for sessions they own
CREATE POLICY "Users can view their own tickets" ON public.tickets
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions
      WHERE sessions.id = session_id
      AND sessions.user_id = auth.uid()
    )
  );

-- Users can only create tickets for sessions they own
CREATE POLICY "Users can create tickets" ON public.tickets
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.sessions
      WHERE sessions.id = session_id
      AND sessions.user_id = auth.uid()
    )
  );

-- Users can only update tickets for sessions they own
CREATE POLICY "Users can update their tickets" ON public.tickets
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions
      WHERE sessions.id = session_id
      AND sessions.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sessions
      WHERE sessions.id = session_id
      AND sessions.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 5. FIX CLIP_LIKES TABLE
-- ============================================================================
-- Anyone can view likes (public), but users can only manage their own likes

DROP POLICY IF EXISTS "Authenticated users can insert likes" ON public.clip_likes;
DROP POLICY IF EXISTS "Users can delete their own likes" ON public.clip_likes;

-- Users can only insert likes with their own user_id
CREATE POLICY "Authenticated users can insert likes" ON public.clip_likes
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    auth.uid() = user_id
  );

-- Users can only delete their own likes
CREATE POLICY "Users can delete their own likes" ON public.clip_likes
  FOR DELETE
  USING (auth.uid() = user_id);

-- Keep public SELECT
-- Policy "Anyone can view likes" remains unchanged

-- ============================================================================
-- VERIFICATION QUERIES (commented out - uncomment to test)
-- ============================================================================

-- Test 1: Verify users can only see their own data
-- SELECT * FROM public.users WHERE id != auth.uid(); -- Should return 0 rows

-- Test 2: Verify users can only create sessions for themselves
-- INSERT INTO public.sessions (user_id, stream_id, playback_id, camera_type)
-- VALUES ('00000000-0000-0000-0000-000000000000', 'test', 'test', 'front');
-- Should fail if user_id doesn't match auth.uid()

-- Test 3: Verify anyone can still view sessions (for clip ownership checks)
-- SELECT * FROM public.sessions; -- Should work (public read)

-- Test 4: Verify users can only create clips for their own sessions
-- Requires valid session_id owned by the user

-- Test 5: Verify users can only manage their own tickets
-- Requires valid session_id owned by the user

-- Test 6: Verify users can only create likes with their own user_id
-- INSERT INTO public.clip_likes (clip_id, user_id)
-- VALUES ('...', auth.uid()); -- Should work
-- INSERT INTO public.clip_likes (clip_id, user_id)
-- VALUES ('...', '00000000-0000-0000-0000-000000000000'); -- Should fail

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON POLICY "Users can view their own data" ON public.users IS
  'Security fix: Users can only access their own profile data to prevent email harvesting';

COMMENT ON POLICY "Authenticated users can create sessions" ON public.sessions IS
  'Security fix: Users can only create sessions for themselves to prevent impersonation';

COMMENT ON POLICY "Authenticated users can create clips" ON public.clips IS
  'Security fix: Users can only create clips for sessions they own';

COMMENT ON POLICY "Authenticated users can insert likes" ON public.clip_likes IS
  'Security fix: Users can only create likes with their own user_id to prevent fake engagement';

COMMENT ON POLICY "Users can delete their own likes" ON public.clip_likes IS
  'Security fix: Users can only delete their own likes';

