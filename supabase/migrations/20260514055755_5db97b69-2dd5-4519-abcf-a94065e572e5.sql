
-- 1. Create bot_type enum
CREATE TYPE public.engagement_bot_type AS ENUM ('inscritos', 'interacoes', 'boasvindas', 'encaminhador');

-- 2. Add bot_type and unified quota to plans
ALTER TABLE public.engagement_plans
  ADD COLUMN bot_type public.engagement_bot_type,
  ADD COLUMN monthly_quota integer NOT NULL DEFAULT 0;

-- 3. Add bot_type + unified usage to subscriptions
ALTER TABLE public.user_engagement_subscriptions
  ADD COLUMN bot_type public.engagement_bot_type,
  ADD COLUMN units_used integer NOT NULL DEFAULT 0;

-- 4. Add fields for new bots in room_engagement_settings
ALTER TABLE public.room_engagement_settings
  ADD COLUMN welcome_bot_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN welcome_message text DEFAULT 'Seja bem-vindo(a) ao grupo! 🎉',
  ADD COLUMN forwarder_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN forwarder_source_chat_id bigint,
  ADD COLUMN forwarder_target_chat_ids bigint[] NOT NULL DEFAULT '{}';

-- 5. Wipe old generic plans and seed the 4 bots
DELETE FROM public.engagement_plans;

INSERT INTO public.engagement_plans (slug, name, description, bot_type, price_brl, monthly_quota, monthly_reactions_quota, monthly_members_quota, sort_order) VALUES
  -- BotInscritos (members per month)
  ('inscritos-500',    'BotInscritos 500',     '500 novos membros por mês',   'inscritos',    20.00,  500,  0, 500,  10),
  ('inscritos-1000',   'BotInscritos 1000',    '1.000 novos membros por mês', 'inscritos',    30.00, 1000,  0, 1000, 11),
  ('inscritos-3000',   'BotInscritos 3000',    '3.000 novos membros por mês', 'inscritos',    70.00, 3000,  0, 3000, 12),

  -- BotInterações (reactions per month)
  ('interacoes-10',    'BotInterações 10',     '10 reações por sinal',        'interacoes',   30.00,   10, 10, 0,    20),
  ('interacoes-20',    'BotInterações 20',     '20 reações por sinal',        'interacoes',   50.00,   20, 20, 0,    21),
  ('interacoes-50',    'BotInterações 50',     '50 reações por sinal',        'interacoes',   80.00,   50, 50, 0,    22),
  ('interacoes-100',   'BotInterações 100',    '100 reações por sinal',       'interacoes',  120.00,  100, 100, 0,   23),

  -- BotBoasVindas (feature unlock, no quota)
  ('boasvindas-mensal','BotBoasVindas',        'Mensagem automática de boas-vindas a novos membros', 'boasvindas', 50.00, 0, 0, 0, 30),

  -- BotEncaminhador (feature unlock, no quota)
  ('encaminhador-mensal','BotEncaminhador',    'Encaminha mensagens automaticamente entre canais',   'encaminhador', 30.00, 0, 0, 0, 40);

-- 6. Make bot_type required after seeding
ALTER TABLE public.engagement_plans ALTER COLUMN bot_type SET NOT NULL;
