
ALTER TABLE public.tracking_pixels
  ADD COLUMN IF NOT EXISTS tracking_mode text NOT NULL DEFAULT 'telegram',
  ADD COLUMN IF NOT EXISTS sales_page_url text,
  ADD COLUMN IF NOT EXISTS event_on_view text NOT NULL DEFAULT 'ViewContent',
  ADD COLUMN IF NOT EXISTS event_on_lead text NOT NULL DEFAULT 'Lead',
  ADD COLUMN IF NOT EXISTS event_on_checkout text NOT NULL DEFAULT 'InitiateCheckout',
  ADD COLUMN IF NOT EXISTS event_on_payment_info text NOT NULL DEFAULT 'AddPaymentInfo',
  ADD COLUMN IF NOT EXISTS event_on_purchase text NOT NULL DEFAULT 'Purchase';

ALTER TABLE public.tracking_pixels
  DROP CONSTRAINT IF EXISTS tracking_pixels_tracking_mode_check;
ALTER TABLE public.tracking_pixels
  ADD CONSTRAINT tracking_pixels_tracking_mode_check
  CHECK (tracking_mode IN ('telegram','direct_response'));

ALTER TABLE public.tracking_clicks
  ADD COLUMN IF NOT EXISTS viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS lead_at timestamptz,
  ADD COLUMN IF NOT EXISTS checkout_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_info_at timestamptz,
  ADD COLUMN IF NOT EXISTS purchased_at timestamptz;
