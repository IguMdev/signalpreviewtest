ALTER TABLE public.room_engagement_settings
  ADD COLUMN IF NOT EXISTS forwarder_premium_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS forwarder_premium_account_id uuid;