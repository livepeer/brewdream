-- Seed data (currently empty - users created on-demand)

-- Anonymous users: Created when clicking "Continue without email"
-- Authenticated users: Created when signing up with email OTP

COMMENT ON TABLE public.users IS
  'App users table. Supports both anonymous (email=NULL) and authenticated (email set) users.';

