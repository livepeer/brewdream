-- Update all clips with null raw_uploaded_file_url to have asset_ready=true
UPDATE public.clips
SET asset_ready = true
WHERE raw_uploaded_file_url IS NULL;