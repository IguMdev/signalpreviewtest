-- Add monthly schedule support to recurring_schedules

ALTER TABLE public.recurring_schedules
  ADD COLUMN IF NOT EXISTS schedule_type text NOT NULL DEFAULT 'weekly' CHECK (schedule_type IN ('weekly', 'monthly')),
  ADD COLUMN IF NOT EXISTS month_days smallint[] NOT NULL DEFAULT '{}';

-- Create index for faster querying
CREATE INDEX IF NOT EXISTS idx_recurring_schedules_schedule_type ON public.recurring_schedules (schedule_type);
