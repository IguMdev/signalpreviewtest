-- Extend enums
ALTER TYPE public.room_niche ADD VALUE IF NOT EXISTS 'hot';
ALTER TYPE public.room_niche ADD VALUE IF NOT EXISTS 'igaming';
ALTER TYPE public.room_niche ADD VALUE IF NOT EXISTS 'expert';

ALTER TYPE public.affiliate_store ADD VALUE IF NOT EXISTS 'privacy';
ALTER TYPE public.affiliate_store ADD VALUE IF NOT EXISTS 'crakrevenue';
ALTER TYPE public.affiliate_store ADD VALUE IF NOT EXISTS 'awempire';
ALTER TYPE public.affiliate_store ADD VALUE IF NOT EXISTS 'bet365';
ALTER TYPE public.affiliate_store ADD VALUE IF NOT EXISTS 'betano';
ALTER TYPE public.affiliate_store ADD VALUE IF NOT EXISTS 'blaze';
ALTER TYPE public.affiliate_store ADD VALUE IF NOT EXISTS 'kto';
ALTER TYPE public.affiliate_store ADD VALUE IF NOT EXISTS 'sportingbet';

-- New enum for iGaming results
DO $$ BEGIN
  CREATE TYPE public.igaming_signal_result AS ENUM ('win','loss','gale_win');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.expert_prompt_kind AS ENUM ('question','poll');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- hot_vip_funnel
CREATE TABLE IF NOT EXISTS public.hot_vip_funnel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  room_id uuid NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT false,
  vip_checkout_url text,
  vip_price_brl numeric,
  teaser_interval_hours integer NOT NULL DEFAULT 3,
  cta_button_text text NOT NULL DEFAULT 'Entrar no VIP 🔥',
  welcome_message text,
  last_teaser_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hot_vip_funnel ENABLE ROW LEVEL SECURITY;
CREATE POLICY hvf_select_own ON public.hot_vip_funnel FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY hvf_insert_own ON public.hot_vip_funnel FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY hvf_update_own ON public.hot_vip_funnel FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY hvf_delete_own ON public.hot_vip_funnel FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER hot_vip_funnel_touch BEFORE UPDATE ON public.hot_vip_funnel
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- hot_teasers
CREATE TABLE IF NOT EXISTS public.hot_teasers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  room_id uuid NOT NULL,
  caption text,
  image_path text,
  image_mime text,
  video_id uuid,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hot_teasers ENABLE ROW LEVEL SECURITY;
CREATE POLICY ht_select_own ON public.hot_teasers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY ht_insert_own ON public.hot_teasers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY ht_update_own ON public.hot_teasers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY ht_delete_own ON public.hot_teasers FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER hot_teasers_touch BEFORE UPDATE ON public.hot_teasers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- igaming_results
CREATE TABLE IF NOT EXISTS public.igaming_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  room_id uuid NOT NULL,
  window_id uuid,
  signal_message_id bigint,
  chat_id bigint,
  result public.igaming_signal_result NOT NULL,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.igaming_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY igr_select_own ON public.igaming_results FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY igr_insert_own ON public.igaming_results FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY igr_update_own ON public.igaming_results FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY igr_delete_own ON public.igaming_results FOR DELETE USING (auth.uid() = user_id);

-- expert_funnel
CREATE TABLE IF NOT EXISTS public.expert_funnel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  room_id uuid NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT false,
  product_name text,
  checkout_url text,
  price_brl numeric,
  cta_button_text text NOT NULL DEFAULT 'Quero participar 🎓',
  welcome_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.expert_funnel ENABLE ROW LEVEL SECURITY;
CREATE POLICY ef_select_own ON public.expert_funnel FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY ef_insert_own ON public.expert_funnel FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY ef_update_own ON public.expert_funnel FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY ef_delete_own ON public.expert_funnel FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER expert_funnel_touch BEFORE UPDATE ON public.expert_funnel
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- expert_engagement_prompts
CREATE TABLE IF NOT EXISTS public.expert_engagement_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  room_id uuid NOT NULL,
  kind public.expert_prompt_kind NOT NULL DEFAULT 'question',
  content text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  send_time time NOT NULL DEFAULT '10:00:00',
  weekdays smallint[] NOT NULL DEFAULT ARRAY[1,2,3,4,5]::smallint[],
  is_active boolean NOT NULL DEFAULT true,
  last_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.expert_engagement_prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY eep_select_own ON public.expert_engagement_prompts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY eep_insert_own ON public.expert_engagement_prompts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY eep_update_own ON public.expert_engagement_prompts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY eep_delete_own ON public.expert_engagement_prompts FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER eep_touch BEFORE UPDATE ON public.expert_engagement_prompts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS hot_teasers_room_idx ON public.hot_teasers(room_id, sort_order);
CREATE INDEX IF NOT EXISTS igr_room_idx ON public.igaming_results(room_id, confirmed_at DESC);
CREATE INDEX IF NOT EXISTS eep_room_idx ON public.expert_engagement_prompts(room_id, send_time);