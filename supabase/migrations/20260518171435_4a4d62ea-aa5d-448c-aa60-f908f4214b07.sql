CREATE TABLE public.tracking_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  pixel_id UUID NOT NULL REFERENCES public.tracking_pixels(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('register','ftd','deposit','custom')),
  custom_event_name TEXT,
  redirect_url TEXT NOT NULL,
  meta_custom_event TEXT,
  meta_value NUMERIC,
  meta_currency TEXT DEFAULT 'BRL',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tracking_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY ti_select_own ON public.tracking_integrations
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY ti_insert_own ON public.tracking_integrations
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY ti_update_own ON public.tracking_integrations
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY ti_delete_own ON public.tracking_integrations
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_ti_user ON public.tracking_integrations(user_id);
CREATE INDEX idx_ti_pixel ON public.tracking_integrations(pixel_id);

CREATE TRIGGER trg_ti_touch
  BEFORE UPDATE ON public.tracking_integrations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();