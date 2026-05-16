-- Sistema de trackeamento avançado (Track4You-like)

-- 1. PIXELS
CREATE TABLE public.tracking_pixels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  vertical TEXT NOT NULL DEFAULT 'outro' CHECK (vertical IN ('bet','igaming','hot','promo','outro')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  meta_integration_id UUID REFERENCES public.meta_integrations(id) ON DELETE SET NULL,
  account_id UUID REFERENCES public.telegram_accounts(id) ON DELETE SET NULL,
  room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  bot_username TEXT,
  event_on_join TEXT NOT NULL DEFAULT 'Lead',
  event_on_offer_click TEXT NOT NULL DEFAULT 'InitiateCheckout',
  event_on_register TEXT NOT NULL DEFAULT 'CompleteRegistration',
  event_on_deposit TEXT NOT NULL DEFAULT 'Purchase',
  postback_secret TEXT NOT NULL DEFAULT encode(gen_random_bytes(24), 'base64'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tracking_pixels_user ON public.tracking_pixels(user_id);

ALTER TABLE public.tracking_pixels ENABLE ROW LEVEL SECURITY;
CREATE POLICY tp_select_own ON public.tracking_pixels FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY tp_insert_own ON public.tracking_pixels FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY tp_update_own ON public.tracking_pixels FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY tp_delete_own ON public.tracking_pixels FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER tp_touch BEFORE UPDATE ON public.tracking_pixels
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. OFFERS
CREATE TABLE public.tracking_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  pixel_id UUID NOT NULL REFERENCES public.tracking_pixels(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  destination_url TEXT NOT NULL,
  subid_param TEXT NOT NULL DEFAULT 'sub1',
  default_event TEXT NOT NULL DEFAULT 'InitiateCheckout',
  default_value NUMERIC,
  default_currency TEXT NOT NULL DEFAULT 'BRL',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pixel_id, slug)
);

CREATE INDEX idx_tracking_offers_pixel ON public.tracking_offers(pixel_id);
CREATE INDEX idx_tracking_offers_user ON public.tracking_offers(user_id);

ALTER TABLE public.tracking_offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY tof_select_own ON public.tracking_offers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY tof_insert_own ON public.tracking_offers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY tof_update_own ON public.tracking_offers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY tof_delete_own ON public.tracking_offers FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER tof_touch BEFORE UPDATE ON public.tracking_offers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. CLICKS
CREATE TABLE public.tracking_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  click_id TEXT NOT NULL UNIQUE,
  pixel_id UUID NOT NULL REFERENCES public.tracking_pixels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  -- ad identifiers
  fbp TEXT,
  fbc TEXT,
  fbclid TEXT,
  ttclid TEXT,
  gclid TEXT,
  kwai_click_id TEXT,
  -- utms
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  -- context
  ip TEXT,
  user_agent TEXT,
  referrer TEXT,
  landing_url TEXT,
  external_id TEXT,
  -- funnel state
  joined_at TIMESTAMPTZ,
  clicked_offer_at TIMESTAMPTZ,
  registered_at TIMESTAMPTZ,
  deposited_at TIMESTAMPTZ,
  -- telegram
  tg_user_id BIGINT,
  tg_username TEXT,
  -- conversion
  sale_value NUMERIC,
  sale_currency TEXT,
  external_user_id TEXT,
  -- capi
  meta_events_sent JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tc_pixel_created ON public.tracking_clicks(pixel_id, created_at DESC);
CREATE INDEX idx_tc_pixel_content ON public.tracking_clicks(pixel_id, utm_content);
CREATE INDEX idx_tc_pixel_campaign ON public.tracking_clicks(pixel_id, utm_campaign);
CREATE INDEX idx_tc_pixel_source ON public.tracking_clicks(pixel_id, utm_source);
CREATE INDEX idx_tc_user ON public.tracking_clicks(user_id);

ALTER TABLE public.tracking_clicks ENABLE ROW LEVEL SECURITY;
CREATE POLICY tc_select_own ON public.tracking_clicks FOR SELECT USING (auth.uid() = user_id);
-- inserts/updates só via service role (backend)

-- 4. STATS FUNCTION
CREATE OR REPLACE FUNCTION public.tracking_attribution(
  _pixel_id UUID,
  _group_col TEXT,
  _from TIMESTAMPTZ,
  _to TIMESTAMPTZ
)
RETURNS TABLE (
  dimension TEXT,
  clicks BIGINT,
  joins BIGINT,
  offer_clicks BIGINT,
  registers BIGINT,
  deposits BIGINT,
  revenue NUMERIC
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  col TEXT;
BEGIN
  -- whitelist column names to prevent SQL injection
  IF _group_col NOT IN ('utm_source','utm_medium','utm_campaign','utm_content','utm_term') THEN
    RAISE EXCEPTION 'invalid group_col: %', _group_col;
  END IF;
  col := _group_col;

  -- ensure caller owns this pixel
  IF NOT EXISTS (SELECT 1 FROM public.tracking_pixels WHERE id = _pixel_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'pixel not found or not owned';
  END IF;

  RETURN QUERY EXECUTE format($f$
    SELECT
      COALESCE(%I, '(sem valor)')::TEXT AS dimension,
      COUNT(*)::BIGINT AS clicks,
      COUNT(joined_at)::BIGINT AS joins,
      COUNT(clicked_offer_at)::BIGINT AS offer_clicks,
      COUNT(registered_at)::BIGINT AS registers,
      COUNT(deposited_at)::BIGINT AS deposits,
      COALESCE(SUM(sale_value), 0)::NUMERIC AS revenue
    FROM public.tracking_clicks
    WHERE pixel_id = $1
      AND created_at >= $2
      AND created_at < $3
    GROUP BY COALESCE(%I, '(sem valor)')
    ORDER BY clicks DESC
    LIMIT 200
  $f$, col, col) USING _pixel_id, _from, _to;
END;
$$;