UPDATE room_engagement_settings 
SET welcome_bot_enabled = true 
WHERE room_id = '674014c1-1e5b-41c1-9a70-8555ef60609d';

SELECT welcome_bot_enabled FROM room_engagement_settings WHERE room_id = '674014c1-1e5b-41c1-9a70-8555ef60609d';
