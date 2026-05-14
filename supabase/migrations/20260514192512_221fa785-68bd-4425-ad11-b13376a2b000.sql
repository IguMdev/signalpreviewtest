ALTER TYPE engagement_bot_type ADD VALUE IF NOT EXISTS 'salas';

-- Run insert in a separate statement after enum commit
COMMIT;

INSERT INTO public.engagement_plans
  (slug, name, bot_type, price_brl, description, monthly_quota, sort_order, is_active)
VALUES
  ('salas-1', 'Plano Básico',  'salas', 150, 'Inclui 1 crédito de sala — você pode operar 1 sala de sinais.',                1, 10, true),
  ('salas-3', 'Plano Premium', 'salas', 300, 'Inclui 3 créditos de sala — opere até 3 salas simultaneamente.',               3, 20, true)
ON CONFLICT (slug) DO NOTHING;