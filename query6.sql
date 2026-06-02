SELECT created_at, event, chat_id, tg_user_id, tg_first_name, message, error, details 
FROM bot_execution_logs 
WHERE bot_type = 'boasvindas' 
ORDER BY created_at DESC 
LIMIT 10;
