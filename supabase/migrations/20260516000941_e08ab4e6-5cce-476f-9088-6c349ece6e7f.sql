ALTER TABLE public.room_engagement_settings
  ADD COLUMN IF NOT EXISTS forwarder_marked_recurring uuid[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS forwarder_marked_scheduled uuid[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS forwarder_marked_templates text[] NOT NULL DEFAULT '{}'::text[];