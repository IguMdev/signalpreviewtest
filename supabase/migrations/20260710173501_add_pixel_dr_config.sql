ALTER TABLE public.tracking_pixels
  ADD COLUMN IF NOT EXISTS dr_config JSONB DEFAULT '{}'::jsonb;
