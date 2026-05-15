ALTER TABLE public.room_engagement_settings
  ADD COLUMN IF NOT EXISTS forwarder_allowed_types text[] NOT NULL DEFAULT '{}'::text[];