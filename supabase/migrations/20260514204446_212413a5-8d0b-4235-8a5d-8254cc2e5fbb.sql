
ALTER TABLE public.engagement_plans
  ADD COLUMN IF NOT EXISTS smm_service_id integer,
  ADD COLUMN IF NOT EXISTS smm_default_quantity integer;

ALTER TABLE public.user_engagement_subscriptions
  ADD COLUMN IF NOT EXISTS target_link text;

UPDATE public.engagement_plans SET smm_service_id = 7102, smm_default_quantity = monthly_quota WHERE bot_type = 'inscritos';
UPDATE public.engagement_plans SET smm_service_id = 8485, smm_default_quantity = monthly_quota WHERE bot_type = 'interacoes';
