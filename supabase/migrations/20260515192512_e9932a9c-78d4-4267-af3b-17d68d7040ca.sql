ALTER TABLE public.recurring_schedules
  ADD COLUMN IF NOT EXISTS button_text text,
  ADD COLUMN IF NOT EXISTS button_url text;

ALTER TABLE public.recurring_pending_followups
  ADD COLUMN IF NOT EXISTS button_text text,
  ADD COLUMN IF NOT EXISTS button_url text;