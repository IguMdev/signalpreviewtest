CREATE TABLE public.room_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  asset_code text NOT NULL,
  category text NOT NULL,
  payout numeric(5,2) NOT NULL DEFAULT 1.85,
  is_open boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, asset_code)
);

ALTER TABLE public.room_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY ra_select_own ON public.room_assets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY ra_insert_own ON public.room_assets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY ra_update_own ON public.room_assets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY ra_delete_own ON public.room_assets FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_room_assets_room ON public.room_assets(room_id);

CREATE TRIGGER trg_room_assets_updated
BEFORE UPDATE ON public.room_assets
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();