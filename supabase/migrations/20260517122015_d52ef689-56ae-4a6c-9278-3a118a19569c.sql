CREATE TABLE public.tracking_postbacks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  pixel_id UUID NOT NULL REFERENCES public.tracking_pixels(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  event TEXT NOT NULL CHECK (event IN ('viewpage','click_button','channel_enter','channel_leave')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tracking_postbacks_pixel ON public.tracking_postbacks(pixel_id);
CREATE INDEX idx_tracking_postbacks_user ON public.tracking_postbacks(user_id);

ALTER TABLE public.tracking_postbacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own postbacks select" ON public.tracking_postbacks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own postbacks insert" ON public.tracking_postbacks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own postbacks update" ON public.tracking_postbacks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own postbacks delete" ON public.tracking_postbacks FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_tracking_postbacks_updated
BEFORE UPDATE ON public.tracking_postbacks
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();