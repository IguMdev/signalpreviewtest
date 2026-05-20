
-- 1. Enum de nicho
CREATE TYPE public.room_niche AS ENUM ('ob', 'promo');

-- 2. Coluna niche em rooms
ALTER TABLE public.rooms
  ADD COLUMN niche public.room_niche NOT NULL DEFAULT 'ob';

-- 3. Trigger impedindo alteração de niche após criação
CREATE OR REPLACE FUNCTION public.prevent_room_niche_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.niche IS DISTINCT FROM OLD.niche THEN
    RAISE EXCEPTION 'O nicho da sala não pode ser alterado após a criação.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_room_niche_change
BEFORE UPDATE ON public.rooms
FOR EACH ROW
EXECUTE FUNCTION public.prevent_room_niche_change();

-- 4. Enum de loja afiliada
CREATE TYPE public.affiliate_store AS ENUM ('amazon', 'shopee', 'aliexpress', 'mercadolivre');

-- 5. affiliate_accounts
CREATE TABLE public.affiliate_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  store public.affiliate_store NOT NULL,
  label text NOT NULL,
  credentials jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  last_check_at timestamptz,
  last_error text,
  last_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, store, label)
);

ALTER TABLE public.affiliate_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY aa_select_own ON public.affiliate_accounts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY aa_insert_own ON public.affiliate_accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY aa_update_own ON public.affiliate_accounts
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY aa_delete_own ON public.affiliate_accounts
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_aa_updated_at
BEFORE UPDATE ON public.affiliate_accounts
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 6. promo_bot_settings
CREATE TABLE public.promo_bot_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  room_id uuid NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT false,
  interval_hours integer NOT NULL DEFAULT 4,
  stores public.affiliate_store[] NOT NULL DEFAULT '{}',
  min_discount_pct integer NOT NULL DEFAULT 0,
  min_price numeric,
  max_price numeric,
  categories text[] NOT NULL DEFAULT '{}',
  keywords text[] NOT NULL DEFAULT '{}',
  blacklist_keywords text[] NOT NULL DEFAULT '{}',
  message_template text NOT NULL DEFAULT '🔥 <b>{title}</b>

<s>De R$ {old_price}</s> por <b>R$ {price}</b>
💰 {discount}% OFF

👉 {link}',
  parse_mode text NOT NULL DEFAULT 'HTML',
  send_image boolean NOT NULL DEFAULT true,
  premium_account_id uuid,
  premium_enabled boolean NOT NULL DEFAULT false,
  last_fire_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.promo_bot_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY pbs_select_own ON public.promo_bot_settings
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY pbs_insert_own ON public.promo_bot_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY pbs_update_own ON public.promo_bot_settings
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY pbs_delete_own ON public.promo_bot_settings
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_pbs_updated_at
BEFORE UPDATE ON public.promo_bot_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 7. promo_offers (cache de produtos)
CREATE TABLE public.promo_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  store public.affiliate_store NOT NULL,
  external_id text NOT NULL,
  title text NOT NULL,
  description text,
  price numeric,
  old_price numeric,
  discount_pct integer,
  image_url text,
  product_url text NOT NULL,
  category text,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  UNIQUE (user_id, store, external_id)
);

CREATE INDEX idx_promo_offers_user_store ON public.promo_offers (user_id, store, fetched_at DESC);

ALTER TABLE public.promo_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY po_select_own ON public.promo_offers
  FOR SELECT USING (auth.uid() = user_id);

-- 8. promo_dispatches (log + base do tracking)
CREATE TABLE public.promo_dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  room_id uuid NOT NULL,
  offer_id uuid,
  store public.affiliate_store NOT NULL,
  external_id text NOT NULL,
  chat_id bigint NOT NULL,
  affiliate_link text NOT NULL,
  short_url text,
  telegram_message_id bigint,
  ok boolean NOT NULL DEFAULT false,
  error text,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_promo_dispatches_user_room ON public.promo_dispatches (user_id, room_id, sent_at DESC);
CREATE INDEX idx_promo_dispatches_dedupe ON public.promo_dispatches (room_id, store, external_id, sent_at DESC);

ALTER TABLE public.promo_dispatches ENABLE ROW LEVEL SECURITY;

CREATE POLICY pd_select_own ON public.promo_dispatches
  FOR SELECT USING (auth.uid() = user_id);

-- 9. promo_clicks
CREATE TABLE public.promo_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id uuid NOT NULL,
  user_id uuid NOT NULL,
  clicked_at timestamptz NOT NULL DEFAULT now(),
  ip_hash text,
  user_agent text,
  country text,
  referrer text
);

CREATE INDEX idx_promo_clicks_dispatch ON public.promo_clicks (dispatch_id, clicked_at DESC);
CREATE INDEX idx_promo_clicks_user ON public.promo_clicks (user_id, clicked_at DESC);

ALTER TABLE public.promo_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY pc_select_own ON public.promo_clicks
  FOR SELECT USING (auth.uid() = user_id);

-- 10. promo_conversions
CREATE TABLE public.promo_conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  dispatch_id uuid,
  store public.affiliate_store NOT NULL,
  order_id text NOT NULL,
  sub_id text,
  commission_value numeric NOT NULL DEFAULT 0,
  sale_value numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  status text NOT NULL DEFAULT 'pending',
  confirmed_at timestamptz,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, store, order_id)
);

CREATE INDEX idx_promo_conversions_dispatch ON public.promo_conversions (dispatch_id);
CREATE INDEX idx_promo_conversions_user ON public.promo_conversions (user_id, confirmed_at DESC NULLS LAST);

ALTER TABLE public.promo_conversions ENABLE ROW LEVEL SECURITY;

CREATE POLICY pcv_select_own ON public.promo_conversions
  FOR SELECT USING (auth.uid() = user_id);
