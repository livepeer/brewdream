-- Remove the trigger-based likes_count approach
-- We'll use JOINs to count likes dynamically instead

-- Drop the trigger
DROP TRIGGER IF EXISTS trigger_update_clip_likes_count ON public.clip_likes;

-- Drop the function
DROP FUNCTION IF EXISTS update_clip_likes_count();

-- Remove the likes_count column from clips table
ALTER TABLE public.clips DROP COLUMN IF EXISTS likes_count;