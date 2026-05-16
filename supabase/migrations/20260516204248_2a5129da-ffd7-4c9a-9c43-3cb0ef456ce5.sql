ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS market_tips_interval_hours integer NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS market_tips_categories text[] NOT NULL DEFAULT ARRAY['forex','crypto']::text[],
  ADD COLUMN IF NOT EXISTS market_tips_last_fire_at timestamptz;

CREATE TABLE IF NOT EXISTS public.market_tips_sent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  room_id uuid NOT NULL,
  link_hash text NOT NULL,
  title text,
  link text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, link_hash)
);

CREATE INDEX IF NOT EXISTS market_tips_sent_room_created_idx
  ON public.market_tips_sent (room_id, created_at DESC);

ALTER TABLE public.market_tips_sent ENABLE ROW LEVEL SECURITY;

CREATE POLICY mts_select_own ON public.market_tips_sent
  FOR SELECT USING (auth.uid() = user_id);