SELECT created_at, event, message, error, details FROM bot_execution_logs WHERE bot_type='boasvindas' ORDER BY created_at DESC LIMIT 5;
SELECT r.title, res.welcome_bot_enabled FROM room_engagement_settings res JOIN rooms r ON r.id = res.room_id WHERE r.title ILIKE '%Imperio%';
