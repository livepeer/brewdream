-- Add index for asset_ready for faster queries on unprocessed clips
CREATE INDEX IF NOT EXISTS idx_clips_asset_ready ON public.clips(asset_ready) WHERE asset_ready = false;

-- Add index for asset_id for faster asset status lookups
CREATE INDEX IF NOT EXISTS idx_clips_asset_id ON public.clips(asset_id);
