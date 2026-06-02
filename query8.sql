SELECT created_at, event, chat_id, tg_user_id, tg_first_name, message, error, details 
FROM bot_execution_logs 
WHERE bot_type = 'boasvindas' 
  AND created_at > NOW() - INTERVAL '5 minutes'
ORDER BY created_at DESC;
