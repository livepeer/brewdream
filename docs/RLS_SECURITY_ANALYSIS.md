# RLS Security Analysis & Migration

**Date**: 2025-10-17
**Migration File**: `supabase/migrations/20251017_fix_rls_security.sql`

## 🔴 Critical Security Issues Found

### 1. **`users` Table** - Email Harvesting Vulnerability

**Current Policies** (lines 49-56 in `20251009014350_init.sql`):
```sql
CREATE POLICY "Users can view their own data" ON public.users
  FOR SELECT USING (true);  -- ❌ ALLOWS ANYONE TO VIEW ALL USERS

CREATE POLICY "Users can insert their own data" ON public.users
  FOR INSERT WITH CHECK (true);  -- ❌ ALLOWS ANYONE TO INSERT

CREATE POLICY "Users can update their own data" ON public.users
  FOR UPDATE USING (true);  -- ❌ ALLOWS ANYONE TO UPDATE ANY USER
```

**Security Risk**:
- ✉️ Anyone can query the database and harvest ALL email addresses
- 🔓 Anyone can update any user's profile (change email, twitter_handle)
- 👤 Anyone can create fake user records
- **Severity**: CRITICAL - Direct PII exposure and identity theft risk

**Current Data Exposure**:
```sql
-- Any unauthenticated user can run:
SELECT email FROM public.users;
-- Returns: ['victor@livepeer.org', 'jamesdawsonwd@gmail.com', ...]
```

---

### 2. **`clip_likes` Table** - Fake Engagement Vulnerability

**Current Policies** (lines 29-36 in `20251013141949_add_likes_system.sql`):
```sql
CREATE POLICY "Authenticated users can insert likes" ON public.clip_likes
  FOR INSERT WITH CHECK (true);  -- ❌ DOESN'T VERIFY user_id

CREATE POLICY "Users can delete their own likes" ON public.clip_likes
  FOR DELETE USING (true);  -- ❌ CAN DELETE ANYONE'S LIKES
```

**Security Risk**:
- ❤️ Anyone can create likes with ANY user_id (fake engagement)
- 🗑️ Anyone can delete any user's likes (sabotage)
- **Severity**: CRITICAL - Data integrity and engagement manipulation

---

## ⚠️ High Priority Issues

### 3. **`sessions` Table** - Session Hijacking Risk

**Current Policies** (lines 59-63 in `20251009014350_init.sql`):
```sql
CREATE POLICY "Anyone can view sessions" ON public.sessions
  FOR SELECT USING (true);  -- ⚠️ NEEDED for clip ownership checks

CREATE POLICY "Authenticated users can create sessions" ON public.sessions
  FOR INSERT WITH CHECK (true);  -- ❌ DOESN'T VERIFY user_id
```

**Security Risk**:
- 🔐 Anyone can create sessions for any user_id (impersonation)
- 📺 Public read of sessions is actually *required* (see explanation below)
- **Severity**: HIGH - Session creation impersonation

**Why Public Read is Required**:

In `ClipView.tsx` (lines 216-220), the app needs to query ANY session to check clip ownership:
```typescript
const { data: sessionData } = await supabase
  .from('sessions')
  .select('user_id, id')
  .eq('id', clip.session_id)
  .single();

// Then checks: sessionData.user_id === currentUser.id
```

This is **legitimate functionality** - users viewing clips need to determine if they own them (to show/hide tickets). The public read stays, but we fix INSERT.

---

### 4. **`tickets` Table** - Unauthorized Ticket Access

**Current Policies** (lines 73-84 in `20251009014350_init.sql`):
```sql
CREATE POLICY "Users can view their own tickets" ON public.tickets
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.sessions s WHERE s.id = session_id
  ));  -- ❌ CHECKS IF SESSION EXISTS, NOT IF USER OWNS IT
```

**Security Risk**:
- ☕ Anyone can view/update tickets for any session (as long as session exists)
- 🎟️ Tickets can be stolen or redeemed by wrong users
- **Severity**: HIGH - Business logic bypass

---

## 📊 Medium Priority Issues

### 5. **`clips` Table** - Weak INSERT Validation

**Current Policies** (lines 66-70 in `20251009014350_init.sql`):
```sql
CREATE POLICY "Anyone can view clips" ON public.clips
  FOR SELECT USING (true);  -- ✅ CORRECT (social app)

CREATE POLICY "Authenticated users can create clips" ON public.clips
  FOR INSERT WITH CHECK (true);  -- ❌ DOESN'T VERIFY session ownership
```

**Security Risk**:
- 🎬 Public read is CORRECT (social media app - clips should be public)
- ❌ Users can create clips for sessions they don't own
- **Severity**: MEDIUM - Data integrity issue

---

## ✅ Migration Solution

The migration file `20251017_fix_rls_security.sql` fixes all issues:

### Fixed `users` Table
```sql
-- ✅ Users can only view their own data
CREATE POLICY "Users can view their own data" ON public.users
  FOR SELECT USING (auth.uid() = id);

-- ✅ Users can only insert their own data
CREATE POLICY "Users can insert their own data" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ✅ Users can only update their own data
CREATE POLICY "Users can update their own data" ON public.users
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
```

### Fixed `sessions` Table
```sql
-- ✅ Keep public SELECT (needed for clip ownership checks)
-- Policy "Anyone can view sessions" remains unchanged

-- ✅ Users can only create sessions for themselves
CREATE POLICY "Authenticated users can create sessions" ON public.sessions
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND
    auth.uid() = user_id
  );
```

### Fixed `clips` Table
```sql
-- ✅ Keep public SELECT (social app)
-- Policy "Anyone can view clips" remains unchanged

-- ✅ Users can only create clips for sessions they own
CREATE POLICY "Authenticated users can create clips" ON public.clips
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.sessions
      WHERE sessions.id = session_id
      AND sessions.user_id = auth.uid()
    )
  );

-- ✅ Users can only update clips for sessions they own
CREATE POLICY "Users can update their own clips" ON public.clips
  FOR UPDATE USING (...session ownership check...);
```

### Fixed `tickets` Table
```sql
-- ✅ Users can only view tickets for sessions they own
CREATE POLICY "Users can view their own tickets" ON public.tickets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.sessions
      WHERE sessions.id = session_id
      AND sessions.user_id = auth.uid()  -- ← KEY ADDITION
    )
  );
```

### Fixed `clip_likes` Table
```sql
-- ✅ Users can only create likes with their own user_id
CREATE POLICY "Authenticated users can insert likes" ON public.clip_likes
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND
    auth.uid() = user_id  -- ← KEY ADDITION
  );

-- ✅ Users can only delete their own likes
CREATE POLICY "Users can delete their own likes" ON public.clip_likes
  FOR DELETE USING (auth.uid() = user_id);  -- ← KEY ADDITION
```

---

## 🧪 Frontend Compatibility Analysis

### Frontend Direct Table Access

**Files Analyzed**:
- `src/components/Login.tsx`
- `src/pages/Capture.tsx`
- `src/components/Gallery.tsx`
- `src/pages/ClipView.tsx`

**Access Patterns**:

| Table | Operation | Usage | Will Work? |
|-------|-----------|-------|------------|
| `users` | INSERT/UPSERT | Login.tsx: Create user record with auth.uid() | ✅ Yes - user creates own record |
| `users` | SELECT | Capture.tsx: Query own user by auth.uid() | ✅ Yes - user queries own data |
| `sessions` | INSERT | Capture.tsx: Create session with own user_id | ✅ Yes - user creates own session |
| `sessions` | SELECT | Capture.tsx: Query own sessions | ✅ Yes - public read maintained |
| `sessions` | SELECT | ClipView.tsx: Check clip ownership | ✅ Yes - public read maintained |
| `clips` | SELECT | Gallery.tsx: View all clips | ✅ Yes - public read maintained |
| `clips` | INSERT | save-clip edge function: Create clip | ✅ Yes - verified via session ownership |
| `tickets` | SELECT | ClipView.tsx: Load own tickets | ✅ Yes - checked via session ownership |
| `clip_likes` | INSERT | Frontend: Like a clip | ✅ Yes - user_id set to auth.uid() |
| `clip_likes` | DELETE | Frontend: Unlike a clip | ✅ Yes - user deletes own like |

### Edge Functions (Bypass RLS)

| Function | Key Used | Bypasses RLS? | Notes |
|----------|----------|---------------|-------|
| `save-clip` | ANON_KEY | ❌ No | Subject to RLS - uses user's JWT |
| `generate-ticket` | SERVICE_ROLE | ✅ Yes | Does own auth check (lines 82-103) |
| `redeem-ticket` | SERVICE_ROLE | ✅ Yes | Does own auth check (lines 72-79) |
| `update-clip-asset-status` | SERVICE_ROLE | ✅ Yes | Internal webhook/polling |

**Conclusion**: All edge functions will continue to work correctly.

---

## 🚀 Deployment Steps

1. **Review the migration**:
   ```bash
   cat supabase/migrations/20251017_fix_rls_security.sql
   ```

2. **Apply the migration**:
   ```bash
   # Option 1: Via Supabase CLI
   supabase db push

   # Option 2: Via Supabase Dashboard
   # Go to SQL Editor → Paste migration → Run
   ```

3. **Verify policies are active**:
   ```sql
   SELECT schemaname, tablename, policyname
   FROM pg_policies
   WHERE schemaname = 'public'
   AND tablename IN ('users', 'sessions', 'clips', 'tickets', 'clip_likes')
   ORDER BY tablename, policyname;
   ```

4. **Test in staging first**:
   - Try logging in (anonymous + email)
   - Create a clip
   - Like a clip
   - Generate and view a ticket
   - Verify you can't see other users' data

---

## 🔒 Security Improvements Summary

### Before (Insecure)
- ❌ Anyone can view all user emails
- ❌ Anyone can update any user's profile
- ❌ Anyone can create sessions for any user
- ❌ Anyone can create fake likes
- ❌ Anyone can view/redeem any ticket

### After (Secure)
- ✅ Users can only view their own profile
- ✅ Users can only update their own profile
- ✅ Users can only create their own sessions
- ✅ Users can only create likes with their own user_id
- ✅ Users can only view/manage their own tickets
- ✅ Public read still works for clips and sessions (social app features)

---

## 📝 Testing Checklist

After deploying the migration, test these scenarios:

- [ ] **Anonymous Login**: User can create account and access app
- [ ] **Email OTP Login**: User can authenticate via email
- [ ] **Create Clip**: User can create and save clips
- [ ] **View Gallery**: Anyone can view all clips (public)
- [ ] **View Clip Page**: Users can check if they own a clip
- [ ] **Generate Ticket**: Users can generate tickets for their clips
- [ ] **Like/Unlike**: Users can like/unlike clips
- [ ] **Security**: Try accessing another user's data via API (should fail)

---

## ⚠️ Breaking Changes

**None** - The migration only restricts unauthorized access. All legitimate app functionality continues to work.

---

## 📚 References

- **Migration File**: `supabase/migrations/20251017_fix_rls_security.sql`
- **Supabase RLS Docs**: https://supabase.com/docs/guides/auth/row-level-security
- **Auth Helpers**: https://supabase.com/docs/guides/auth/auth-helpers

