SELECT created_at, event, message, error, details FROM bot_execution_logs WHERE bot_type='boasvindas' AND created_at > '2026-05-31 22:15:00+00' ORDER BY created_at DESC;
SELECT r.name, res.welcome_bot_enabled FROM room_engagement_settings res JOIN rooms r ON r.id = res.room_id WHERE r.name ILIKE '%Imperio%';
