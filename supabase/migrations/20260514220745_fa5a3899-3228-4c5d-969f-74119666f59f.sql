ALTER TABLE public.videos
ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'round'
CHECK (kind IN ('round', 'normal'));