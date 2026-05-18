UPDATE public.room_reports SET delay_minutes = 0 WHERE delay_minutes > 0;
ALTER TABLE public.room_reports ALTER COLUMN delay_minutes SET DEFAULT 0;