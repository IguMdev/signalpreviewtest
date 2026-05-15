ALTER TABLE public.recurring_pending_followups
  ADD COLUMN IF NOT EXISTS video_id uuid;