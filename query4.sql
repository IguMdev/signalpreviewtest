-- Verificar assinaturas ativas e bot_type
SELECT id, bot_type, status, current_period_end FROM user_engagement_subscriptions WHERE status = 'active';

-- Verificar planos de engajamento
SELECT slug, name, bot_type FROM engagement_plans WHERE is_active = true;

-- Verificar a linha completa de room_engagement_settings para a sala
SELECT room_id, welcome_bot_enabled, welcome_message, welcome_premium_enabled, updated_at 
FROM room_engagement_settings 
WHERE room_id IN (SELECT id FROM rooms WHERE name ILIKE '%Imperio%');
