-- Add raw_uploaded_file_url column to clips table
ALTER TABLE public.clips
ADD COLUMN IF NOT EXISTS raw_uploaded_file_url text;

-- Add asset_id column to clips table if it doesn't exist
ALTER TABLE public.clips
ADD COLUMN IF NOT EXISTS asset_id text;

-- Add asset_ready column to clips table if it doesn't exist
ALTER TABLE public.clips
ADD COLUMN IF NOT EXISTS asset_ready boolean DEFAULT false;