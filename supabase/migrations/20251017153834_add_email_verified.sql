-- Add email_verified column to users table
-- This allows tracking whether a user has verified their email address

-- Add the column with a default value
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false NOT NULL;

-- Add helpful comment
COMMENT ON COLUMN public.users.email_verified IS
  'Whether the user has verified their email address via OTP. False for anonymous users.';