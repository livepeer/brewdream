-- Fix likes_count trigger to use COUNT instead of increment/decrement
-- This is more reliable and always accurate

-- Replace the trigger function with COUNT-based approach
CREATE OR REPLACE FUNCTION update_clip_likes_count()
RETURNS TRIGGER AS $$
DECLARE
  affected_clip_id UUID;
BEGIN
  -- Determine which clip_id was affected
  IF TG_OP = 'INSERT' THEN
    affected_clip_id := NEW.clip_id;
  ELSIF TG_OP = 'DELETE' THEN
    affected_clip_id := OLD.clip_id;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Handle UPDATE in case someone changes clip_id (shouldn't happen, but defensive)
    -- Update both old and new clip_id
    UPDATE public.clips
    SET likes_count = (
      SELECT COUNT(*)
      FROM public.clip_likes
      WHERE clip_id = OLD.clip_id
    )
    WHERE id = OLD.clip_id;

    affected_clip_id := NEW.clip_id;
  END IF;

  -- Update the count based on actual COUNT query
  UPDATE public.clips
  SET likes_count = (
    SELECT COUNT(*)
    FROM public.clip_likes
    WHERE clip_id = affected_clip_id
  )
  WHERE id = affected_clip_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Update the trigger to also handle UPDATE operations
DROP TRIGGER IF EXISTS trigger_update_clip_likes_count ON public.clip_likes;
CREATE TRIGGER trigger_update_clip_likes_count
AFTER INSERT OR UPDATE OR DELETE ON public.clip_likes
FOR EACH ROW
EXECUTE FUNCTION update_clip_likes_count();

-- Fix ALL existing clips' counts (not just WHERE likes_count = 0)
UPDATE public.clips
SET likes_count = (
  SELECT COUNT(*)
  FROM public.clip_likes
  WHERE clip_likes.clip_id = clips.id
);