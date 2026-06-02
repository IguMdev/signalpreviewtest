SELECT created_at, event, message, error, details FROM bot_execution_logs WHERE bot_type='boasvindas' ORDER BY created_at DESC LIMIT 5;
