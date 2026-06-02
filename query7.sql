-- Buscar bot token da conta vinculada à sala Imperio Invest
SELECT ta.id, ta.bot_token, ta.label, ta.bot_username
FROM telegram_accounts ta
JOIN rooms r ON r.default_account_id = ta.id
WHERE r.name ILIKE '%Imperio%';
