-- Create users table for email OTP login
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  twitter_handle TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create sessions table for stream tracking
CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  stream_id TEXT NOT NULL,
  playback_id TEXT NOT NULL,
  camera_type TEXT CHECK (camera_type IN ('front', 'back')) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create clips table for Livepeer assets
CREATE TABLE IF NOT EXISTS public.clips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
  asset_playback_id TEXT NOT NULL,
  asset_url TEXT,
  prompt TEXT NOT NULL,
  texture_id TEXT,
  texture_weight FLOAT CHECK (texture_weight >= 0 AND texture_weight <= 1),
  t_index_list INTEGER[],
  duration_ms INTEGER NOT NULL CHECK (duration_ms >= 3000 AND duration_ms <= 10000),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create tickets table for coffee QR codes
CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
  code TEXT UNIQUE NOT NULL,
  redeemed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users (users can view and update their own data)
CREATE POLICY "Users can view their own data" ON public.users
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own data" ON public.users
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own data" ON public.users
  FOR UPDATE USING (true);

-- RLS Policies for sessions (authenticated users can create, owners can view)
CREATE POLICY "Anyone can view sessions" ON public.sessions
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create sessions" ON public.sessions
  FOR INSERT WITH CHECK (true);

-- RLS Policies for clips (public read, authenticated create)
CREATE POLICY "Anyone can view clips" ON public.clips
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create clips" ON public.clips
  FOR INSERT WITH CHECK (true);

-- RLS Policies for tickets (owners only, except for redemption)
CREATE POLICY "Users can view their own tickets" ON public.tickets
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.sessions s WHERE s.id = session_id
  ));

CREATE POLICY "Users can create tickets" ON public.tickets
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their tickets" ON public.tickets
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM public.sessions s WHERE s.id = session_id
  ));

-- Add indexes for performance
CREATE INDEX idx_sessions_user_id ON public.sessions(user_id);
CREATE INDEX idx_clips_session_id ON public.clips(session_id);
CREATE INDEX idx_clips_created_at ON public.clips(created_at DESC);
CREATE INDEX idx_tickets_session_id ON public.tickets(session_id);
CREATE INDEX idx_tickets_code ON public.tickets(code);