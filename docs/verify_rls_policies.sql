-- RLS Policy Verification Script
-- Run this after applying the migration to verify policies are correctly configured
-- Expected: All queries should show proper RLS restrictions

-- ====================================================================================
-- SETUP: Get current user ID for testing
-- ====================================================================================
SELECT auth.uid() as current_user_id;

-- ====================================================================================
-- TEST 1: Verify users table policies
-- ====================================================================================

-- This should only return the current user's row (or empty if not logged in)
SELECT count(*) as my_user_count,
       'Should be 0 (not logged in) or 1 (logged in)' as expected
FROM public.users
WHERE id = auth.uid();

-- This should return 0 rows (can't see other users)
SELECT count(*) as other_users_count,
       'Should be 0 (can only see own data)' as expected
FROM public.users
WHERE id != auth.uid();

-- Test: Try to insert user with different ID (should fail via RLS)
-- INSERT INTO public.users (id, email) VALUES ('00000000-0000-0000-0000-000000000000', 'hacker@example.com');
-- Expected: RLS policy violation

-- ====================================================================================
-- TEST 2: Verify sessions table policies
-- ====================================================================================

-- This should show only sessions owned by current user (security fix: no public read)
SELECT count(*) as my_sessions,
       'Should only show sessions I own' as expected
FROM public.sessions;

-- Test: Try to insert session with different user_id (should fail via RLS)
-- INSERT INTO public.sessions (user_id, stream_id, playback_id, camera_type)
-- VALUES ('00000000-0000-0000-0000-000000000000', 'test', 'test', 'front');
-- Expected: RLS policy violation

-- ====================================================================================
-- TEST 3: Verify clips table policies
-- ====================================================================================

-- This should show all clips (public read is intentional)
SELECT count(*) as total_clips,
       'Public read is OK - social app' as note
FROM public.clips;

-- This should show clips owned by current user (via sessions)
SELECT count(*) as my_clips,
       'Should show clips from my sessions' as expected
FROM public.clips
WHERE session_id IN (
  SELECT id FROM public.sessions WHERE user_id = auth.uid()
);

-- Test: Try to insert clip for someone else's session (should fail via RLS)
-- Note: Can't even query sessions you don't own, so this test requires service role
-- Then try: INSERT INTO public.clips (session_id, asset_playback_id, prompt, duration_ms) ...
-- Expected: RLS policy violation

-- ====================================================================================
-- TEST 4: Verify tickets table policies
-- ====================================================================================

-- This should only show tickets for sessions owned by current user
SELECT count(*) as my_tickets,
       'Should only show tickets from my sessions' as expected
FROM public.tickets t
WHERE EXISTS (
  SELECT 1 FROM public.sessions s
  WHERE s.id = t.session_id
  AND s.user_id = auth.uid()
);

-- This should return 0 (can't see other users' tickets)
SELECT count(*) as other_tickets,
       'Should be 0 (can only see own tickets)' as expected
FROM public.tickets t
WHERE NOT EXISTS (
  SELECT 1 FROM public.sessions s
  WHERE s.id = t.session_id
  AND s.user_id = auth.uid()
);

-- Test: Try to insert ticket for someone else's session (should fail via RLS)
-- Expected: RLS policy violation

-- ====================================================================================
-- TEST 5: Verify clip_likes table policies
-- ====================================================================================

-- This should show all likes (public read is intentional)
SELECT count(*) as total_likes,
       'Public read is OK - likes are public' as note
FROM public.clip_likes;

-- This should show only likes created by current user
SELECT count(*) as my_likes,
       'Should show likes I created' as expected
FROM public.clip_likes
WHERE user_id = auth.uid();

-- Test: Try to insert like with different user_id (should fail via RLS)
-- First get a clip ID: SELECT id FROM public.clips LIMIT 1;
-- Then try: INSERT INTO public.clip_likes (clip_id, user_id)
--           VALUES ('...', '00000000-0000-0000-0000-000000000000');
-- Expected: RLS policy violation

-- Test: Try to delete someone else's like (should fail via RLS)
-- First get a like you don't own: SELECT id FROM public.clip_likes WHERE user_id != auth.uid() LIMIT 1;
-- Then try: DELETE FROM public.clip_likes WHERE id = '...';
-- Expected: RLS policy violation

-- ====================================================================================
-- VERIFICATION SUMMARY
-- ====================================================================================

-- Show all active policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('users', 'sessions', 'clips', 'tickets', 'clip_likes')
ORDER BY tablename, policyname;

-- Expected policies:
-- ✅ users: 3 policies (SELECT, INSERT, UPDATE) - all using auth.uid() = id
-- ✅ sessions: 2 policies (SELECT with user_id check, INSERT with user_id check)
-- ✅ clips: 3 policies (SELECT with true, INSERT with session check, UPDATE with session check)
-- ✅ tickets: 3 policies (SELECT/INSERT/UPDATE with session ownership check)
-- ✅ clip_likes: 3 policies (SELECT with true, INSERT/DELETE with user_id check)

-- ====================================================================================
-- CLEANUP TEST DATA (if any was created)
-- ====================================================================================

-- Uncomment these if you created test data:
-- DELETE FROM public.clip_likes WHERE clip_id = 'test-clip-id' AND user_id = auth.uid();
-- DELETE FROM public.clips WHERE id = 'test-clip-id';
-- DELETE FROM public.sessions WHERE id = 'test-session-id' AND user_id = auth.uid();

