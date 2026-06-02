-- 1. Desativar o cron antigo
SELECT cron.unschedule('dispatch-recurring-schedules');
SELECT cron.unschedule('check-telegram-webhooks');

-- 2. Limpar os agendamentos "pendentes" ou "enviando" que ficaram presos no passado
-- (Isso impede que o bot fique disparando a 'versão antiga' do que já deu erro)
DELETE FROM recurring_pending_followups WHERE status = 'pending' OR status = 'sending';

-- 3. Criar cron para disparar os agendamentos no seu NOVO DOMÍNIO (a cada 1 minuto)
SELECT cron.schedule(
    'dispatch-recurring-schedules',
    '* * * * *',
    $$
    select net.http_post(
        url := 'https://telesignal.com.br/api/public/cron/dispatch-recurring',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := '{}'::jsonb
    )
    $$
);

-- 4. Criar cron para checar os webhooks no seu NOVO DOMÍNIO (a cada 10 minutos)
SELECT cron.schedule(
    'check-telegram-webhooks',
    '*/10 * * * *',
    $$
    select net.http_post(
        url := 'https://telesignal.com.br/api/public/cron/check-telegram-webhooks',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := '{}'::jsonb
    )
    $$
);
