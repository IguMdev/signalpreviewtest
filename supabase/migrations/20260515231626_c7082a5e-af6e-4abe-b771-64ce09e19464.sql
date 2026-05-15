
ALTER TABLE public.room_engagement_settings
  ADD COLUMN IF NOT EXISTS welcome_premium_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS welcome_premium_account_id uuid;

ALTER TABLE public.room_engagement_settings
  DROP COLUMN IF EXISTS welcome_button_text,
  DROP COLUMN IF EXISTS welcome_button_url;

ALTER TABLE public.welcome_extra_messages
  ADD COLUMN IF NOT EXISTS premium_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS premium_account_id uuid;

ALTER TABLE public.welcome_extra_messages
  DROP COLUMN IF EXISTS button_text,
  DROP COLUMN IF EXISTS button_url;
