ALTER TABLE public.recurring_schedules
ADD COLUMN IF NOT EXISTS weekday_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;