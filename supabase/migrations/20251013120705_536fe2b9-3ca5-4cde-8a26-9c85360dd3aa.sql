-- Support anonymous users
-- Allow null emails and add auth ID as primary key

-- Drop existing unique constraint on email if it exists
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_email_key;

-- Make email nullable
ALTER TABLE public.users ALTER COLUMN email DROP NOT NULL;

-- Add auth user ID if not exists (to link with Supabase auth)
-- First check if column exists, if not add it
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'users' AND column_name = 'id' AND data_type = 'uuid') THEN
    -- Add id column as UUID
    ALTER TABLE public.users ADD COLUMN id UUID PRIMARY KEY DEFAULT gen_random_uuid();
  END IF;
END $$;

-- Make email unique only when not null
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique
  ON public.users (email)
  WHERE email IS NOT NULL;

-- Add helpful comment
COMMENT ON COLUMN public.users.email IS
  'User email. NULL for anonymous users, unique when set.';

COMMENT ON TABLE public.users IS
  'App users. Can be anonymous (email=NULL) or authenticated (email set). ID matches Supabase auth.users.id.';